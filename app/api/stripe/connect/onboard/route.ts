import {
  NextRequest,
  NextResponse,
} from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function isPrelaunchMode() {
  return process.env.PRELAUNCH_MODE === "true";
}
function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    if (isPrelaunchMode()) {
  return NextResponse.json(
    {
      error: "Contractorhub is currently in pre-launch mode.",
    },
    { status: 503 }
  );
}
    const stripeSecretKey =
      process.env.STRIPE_SECRET_KEY;
const stripeMode =
  stripeSecretKey?.startsWith("sk_live_")
    ? "live"
    : stripeSecretKey?.startsWith("sk_test_")
      ? "test"
      : "unknown";

console.log("STRIPE CONNECT RUNTIME MODE:", {
  stripeMode,
  vercelEnv: process.env.VERCEL_ENV,
});
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabasePublishableKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!stripeSecretKey) {
      return errorResponse(
        "STRIPE_SECRET_KEY is missing.",
        500
      );
    }

    if (
      !supabaseUrl ||
      !supabasePublishableKey ||
      !supabaseSecretKey
    ) {
      return errorResponse(
        "Supabase environment variables are missing.",
        500
      );
    }

    const authorization =
      request.headers.get("authorization");

    if (
      !authorization?.startsWith(
        "Bearer "
      )
    ) {
      return errorResponse(
        "You must be logged in.",
        401
      );
    }

    const accessToken =
      authorization
        .slice("Bearer ".length)
        .trim();

    if (!accessToken) {
      return errorResponse(
        "You must be logged in.",
        401
      );
    }

    const userSupabase =
      createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

    const adminSupabase =
      createClient(
        supabaseUrl,
        supabaseSecretKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

    const {
      data: { user },
      error: userError,
    } =
      await userSupabase.auth.getUser(
        accessToken
      );

    if (userError || !user) {
      return errorResponse(
        "Your login session is invalid.",
        401
      );
    }

    const {
      data: accountData,
      error: accountTypeError,
    } =
      await userSupabase
        .from("user_accounts")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

    if (accountTypeError) {
      return errorResponse(
        accountTypeError.message,
        500
      );
    }

    if (
      accountData?.account_type !==
      "contractor"
    ) {
      return errorResponse(
        "Only contractors can connect a Stripe account.",
        403
      );
    }

    const stripe =
      new Stripe(stripeSecretKey);

    const {
      data: savedStripeAccount,
      error: savedAccountError,
    } =
      await adminSupabase
        .from(
          "contractor_stripe_accounts"
        )
        .select(
          "stripe_account_id"
        )
        .eq(
          "contractor_id",
          user.id
        )
        .maybeSingle();

    if (savedAccountError) {
      return errorResponse(
        savedAccountError.message,
        500
      );
    }

    let stripeAccountId =
      savedStripeAccount
        ?.stripe_account_id ??
      null;

    if (!stripeAccountId) {
      const account =
        await stripe.accounts.create({
          type: "express",
          email:
            user.email ?? undefined,
          capabilities: {
            transfers: {
              requested: true,
            },
          },
          metadata: {
            contractor_id: user.id,
          },
        });

      stripeAccountId = account.id;

      const {
        error: insertError,
      } =
        await adminSupabase
          .from(
            "contractor_stripe_accounts"
          )
          .insert({
            contractor_id: user.id,
            stripe_account_id:
              account.id,
            transfers_status:
              account.capabilities
                ?.transfers ??
              "pending",
            created_at:
              new Date().toISOString(),
            updated_at:
              new Date().toISOString(),
            last_synced_at:
              new Date().toISOString(),
          });

      if (insertError) {
        console.error(
          "Could not save connected account:",
          insertError.message
        );

        return errorResponse(
          "Stripe account was created but could not be saved to the platform.",
          500
        );
      }
    }

    const origin =
      request.nextUrl.origin;

    const accountLink =
      await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url:
          `${origin}/profile?stripe=refresh`,
        return_url:
          `${origin}/profile?stripe=return`,
        type: "account_onboarding",
        collection_options: {
          fields: "eventually_due",
        },
      });

    return NextResponse.json({
      url: accountLink.url,
    });
  } catch (error) {
    console.error(
      "Stripe Connect onboarding error:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Could not start Stripe onboarding.",
      500
    );
  }
}