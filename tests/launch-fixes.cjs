const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { NextRequest, NextResponse } = require("next/server");

// Use the project's installed TypeScript compiler; no extra test dependency.
function loadTs(relative, mocks = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = (name) => Object.hasOwn(mocks, name) ? mocks[name] : originalRequire(name);
  mod._compile(source, filename);
  return mod.exports;
}

const { createRefundOnce, listAllRefunds, RefundConflictError } = loadTs("lib/stripe/refunds.ts");
const { redirectWithSession } = loadTs("lib/supabase/redirect.ts");
const { checkoutWindow } = loadTs("lib/stripe/checkout.ts");

test("checkout retries in the same bucket use identical expiry and key", () => {
  assert.deepEqual(checkoutWindow("invoice", 3600), checkoutWindow("invoice", 5399));
});

test("checkout expiry stays within Stripe's 30-minute to 24-hour window at bucket edges", () => {
  for (const now of [0, 1799, 1800, 3599, 3600, 5399, 1_800_000_000]) {
    const remaining = checkoutWindow("invoice", now).expiresAt - now;
    assert.ok(remaining >= 30 * 60 && remaining <= 24 * 60 * 60);
  }
  assert.notEqual(checkoutWindow("invoice", 1799).idempotencyKey, checkoutWindow("invoice", 1800).idempotencyKey);
});

function fakeStripe(initial = []) {
  const ledger = [...initial];
  const keys = new Map();
  let creates = 0;
  let loseResponse = false;
  const stripe = { refunds: {
    list() {
      const snapshot = [...ledger];
      return { async *[Symbol.asyncIterator]() { yield* snapshot; } };
    },
    async create(params, { idempotencyKey }) {
      const encoded = JSON.stringify(params);
      if (keys.has(idempotencyKey)) {
        const previous = keys.get(idempotencyKey);
        if (previous.encoded !== encoded) throw new Error("idempotency parameter conflict");
        return previous.result;
      }
      creates++;
      const result = { id: `re_${creates}`, amount: params.amount, status: "succeeded", metadata: params.metadata };
      ledger.push(result);
      keys.set(idempotencyKey, { encoded, result });
      if (loseResponse) { loseResponse = false; throw new Error("Connection lost after Stripe committed"); }
      return result;
    },
  } };
  return { stripe, ledger, keys, get creates() { return creates; }, loseNextResponse() { loseResponse = true; } };
}

function input(requestId = "request-1", amount = 2000, expectedRefundedCents = 0) {
  return { requestId, expectedRefundedCents, chargeAmount: 10000,
    params: { charge: "ch_1", amount, reverse_transfer: true, refund_application_fee: true,
      metadata: { initiated_by: "contractor-1", refund_reason: "requested_by_customer" } } };
}

test("lost response: retry returns the original partial refund", async () => {
  const api = fakeStripe();
  api.loseNextResponse();
  await assert.rejects(createRefundOnce(api.stripe, input()), /Connection lost/);
  const result = await createRefundOnce(api.stripe, input());
  assert.equal(result.id, "re_1");
  assert.equal(api.creates, 1);
});

test("retry after a full refund returns the original result", async () => {
  const api = fakeStripe();
  await createRefundOnce(api.stripe, input("full", 10000));
  assert.equal((await createRefundOnce(api.stripe, input("full", 10000))).amount, 10000);
  assert.equal(api.creates, 1);
});

test("retry remains safe after Stripe's idempotency cache is gone", async () => {
  const api = fakeStripe();
  await createRefundOnce(api.stripe, input());
  api.keys.clear();
  await createRefundOnce(api.stripe, input());
  assert.equal(api.creates, 1);
});

test("same ID with changed amount or reason is rejected", async () => {
  const api = fakeStripe();
  await createRefundOnce(api.stripe, input());
  await assert.rejects(createRefundOnce(api.stripe, input("request-1", 3000)), RefundConflictError);
  const changed = input(); changed.params.metadata.refund_reason = "duplicate";
  await assert.rejects(createRefundOnce(api.stripe, changed), RefundConflictError);
  assert.equal(api.creates, 1);
});

test("two concurrent identical retries create one refund", async () => {
  const api = fakeStripe();
  const results = await Promise.all([createRefundOnce(api.stripe, input()), createRefundOnce(api.stripe, input())]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(api.creates, 1);
});

test("two concurrent different operations on the same balance cannot both create", async () => {
  const api = fakeStripe();
  const results = await Promise.allSettled([
    createRefundOnce(api.stripe, input("one")), createRefundOnce(api.stripe, input("two", 3000)),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(api.creates, 1);
});

test("stale balance blocks a new request; refreshed balance permits an intentional second refund", async () => {
  const api = fakeStripe();
  await createRefundOnce(api.stripe, input());
  await assert.rejects(createRefundOnce(api.stripe, input("two")), RefundConflictError);
  await createRefundOnce(api.stripe, input("two", 2000, 2000));
  assert.equal(api.creates, 2);
});

test("pending refunds reserve balance", async () => {
  const api = fakeStripe([{ id: "old", amount: 2000, status: "pending", metadata: {} }]);
  await assert.rejects(createRefundOnce(api.stripe, input()), RefundConflictError);
  assert.equal(api.creates, 0);
});

test("a failed refund can be deliberately retried as a new operation", async () => {
  const api = fakeStripe();
  await createRefundOnce(api.stripe, input());
  api.ledger[0].status = "failed";
  assert.equal((await createRefundOnce(api.stripe, input())).status, "failed");
  await createRefundOnce(api.stripe, input("two"));
  assert.equal(api.creates, 2);
});

test("all pages of refund history are read, including legacy refunds without metadata", async () => {
  const ledger = Array.from({ length: 150 }, (_, i) => ({ id: `old-${i}`, amount: 1, status: "succeeded", metadata: null }));
  const api = fakeStripe(ledger);
  assert.equal((await listAllRefunds(api.stripe, "ch_1")).length, 150);
  await assert.rejects(createRefundOnce(api.stripe, input()), RefundConflictError);
  await createRefundOnce(api.stripe, input("new", 2000, 150));
  assert.equal(api.creates, 1);
});

test("refund exceeding remaining amount never calls Stripe create", async () => {
  const api = fakeStripe();
  await assert.rejects(createRefundOnce(api.stripe, input("too-large", 10001)), RefundConflictError);
  assert.equal(api.creates, 0);
});

test("redirect preserves refreshed/deleted cookies and prevents caching", () => {
  const request = new NextRequest("https://example.test/auth?code=secret");
  const session = NextResponse.next();
  session.cookies.set("session", "new", { httpOnly: true, secure: true, sameSite: "lax" });
  session.cookies.set("old-session", "", { maxAge: 0 });
  const result = redirectWithSession(request, session, "/dashboard");
  assert.equal(result.headers.get("location"), "https://example.test/dashboard");
  assert.equal(result.cookies.get("session").value, "new");
  assert.equal(result.cookies.get("old-session").maxAge, 0);
  assert.match(result.headers.get("cache-control"), /no-store/);
});

function callbackModule(methods) {
  return loadTs("app/auth/callback/route.ts", {
    "@supabase/ssr": { createServerClient(_url, _key, options) {
      return { auth: {
        async exchangeCodeForSession(code) {
          const result = await methods.exchange(code);
          if (!result.error) options.cookies.setAll([{ name: "session", value: "new", options: { httpOnly: true } }], {});
          return result;
        },
        verifyOtp: methods.verify,
      } };
    } },
  });
}

test("PKCE callback exchanges code, sets session cookie and redirects to reset form", async () => {
  const { GET } = callbackModule({ exchange: async (code) => { assert.equal(code, "valid"); return { error: null }; } });
  const response = await GET(new NextRequest("https://example.test/auth/callback?code=valid&next=/reset-password"));
  assert.equal(response.headers.get("location"), "https://example.test/reset-password");
  assert.equal(response.cookies.get("session").value, "new");
});

test("callback rejects external redirect destinations", async () => {
  const { GET } = callbackModule({ exchange: async () => ({ error: null }) });
  const response = await GET(new NextRequest("https://example.test/auth/callback?code=valid&next=https://evil.test"));
  assert.equal(response.headers.get("location"), "https://example.test/dashboard");
});

test("expired, missing and failed codes go to a clean retry URL without leaking tokens", async () => {
  const { GET } = callbackModule({ exchange: async () => ({ error: new Error("expired") }) });
  for (const query of ["?code=expired", "", "?error=access_denied&error_description=secret"]) {
    const response = await GET(new NextRequest(`https://example.test/auth/callback${query}`));
    assert.equal(response.headers.get("location"), "https://example.test/forgot-password?error=invalid_link");
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
});

test("recovery token hash supports the cross-device email template", async () => {
  const { GET } = callbackModule({ verify: async (args) => {
    assert.deepEqual(args, { token_hash: "hash", type: "recovery" }); return { error: null };
  } });
  const response = await GET(new NextRequest("https://example.test/auth/callback?token_hash=hash&type=recovery&next=/reset-password"));
  assert.equal(response.headers.get("location"), "https://example.test/reset-password");
});

test("proxy allows recovery routes before contractor onboarding", async () => {
  let queries = 0;
  const { updateSession } = loadTs("lib/supabase/proxy.ts", {
    "./redirect": { redirectWithSession },
    "@supabase/ssr": { createServerClient() { return {
      auth: { getClaims: async () => ({ data: { claims: { sub: "contractor" } } }) },
      from() { queries++; throw new Error("Recovery should not load the profile"); },
    }; } },
  });
  for (const path of ["/forgot-password", "/reset-password", "/auth/callback?code=valid"]) {
    const response = await updateSession(new NextRequest(`https://example.test${path}`));
    assert.equal(response.headers.get("location"), null);
  }
  assert.equal(queries, 0);
});

test("proxy sends unauthenticated reset requests to the recovery form", async () => {
  const { updateSession } = loadTs("lib/supabase/proxy.ts", {
    "./redirect": { redirectWithSession },
    "@supabase/ssr": { createServerClient() { return { auth: { getClaims: async () => ({ data: null }) } }; } },
  });
  const response = await updateSession(new NextRequest("https://example.test/reset-password"));
  assert.equal(response.headers.get("location"), "https://example.test/forgot-password?error=invalid_link");
});

test("saved refund attempt survives reload and is isolated by user and invoice", () => {
  const store = new Map();
  global.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const { readRefundAttempt, refundAttemptKey } = loadTs("lib/refund-attempt.ts");
  const key = refundAttemptKey("user", "invoice");
  const attempt = { requestId: "id", invoiceId: "invoice", amount: 20, reason: "other", expectedRefundedCents: 0 };
  localStorage.setItem(key, JSON.stringify(attempt));
  assert.deepEqual(readRefundAttempt(key), attempt);
  assert.equal(readRefundAttempt(refundAttemptKey("other-user", "invoice")), null);
  localStorage.setItem(key, "broken");
  assert.throws(() => readRefundAttempt(key));
  delete global.localStorage;
});
