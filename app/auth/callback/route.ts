import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // Fixed destinations prevent the callback from becoming an open redirect.
  const destination = params.get("next") === "/reset-password"
    ? "/reset-password" : "/dashboard";
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies, headers) {
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  try {
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    // token_hash supports the documented recovery email template on any device.
    const result = params.has("error") ? null
      : tokenHash && params.get("type") === "recovery"
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
        : code ? await supabase.auth.exchangeCodeForSession(code) : null;
    if (result && !result.error) return response;
  } catch {
    // Do not log authentication codes or tokens.
  }

  const failure = NextResponse.redirect(new URL("/forgot-password?error=invalid_link", request.url));
  response.cookies.getAll().forEach((cookie) => failure.cookies.set(cookie));
  failure.headers.set("Cache-Control", "private, no-store");
  failure.headers.set("Referrer-Policy", "no-referrer");
  return failure;
}
