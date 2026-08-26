import {
  NextRequest,
  NextResponse,
} from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const stripeSecretKey =
      process.env.STRIPE_SECRET_KEY;

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
        "Only contractors can access Stripe Connect status.",
        403
      );
    }

    const {
      data: savedAccount,
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

    if (!savedAccount) {
      return NextResponse.json({
        connected: false,
        ready: false,
      });
    }

    const stripe =
      new Stripe(stripeSecretKey);

    const account =
      await stripe.accounts.retrieve(
        savedAccount.stripe_account_id
      );

    if ("deleted" in account) {
      return errorResponse(
        "The connected Stripe account no longer exists.",
        410
      );
    }

    const transfersStatus =
      account.capabilities
        ?.transfers ??
      "inactive";

    const ready =
      Boolean(
        account.details_submitted
      ) &&
      transfersStatus === "active" &&
      Boolean(
        account.payouts_enabled
      );

    const {
      error: updateError,
    } =
      await adminSupabase
        .from(
          "contractor_stripe_accounts"
        )
        .update({
          transfers_status:
            transfersStatus,
          updated_at:
            new Date().toISOString(),
          last_synced_at:
            new Date().toISOString(),
        })
        .eq(
          "contractor_id",
          user.id
        );

    if (updateError) {
      console.error(
        "Could not sync Stripe account status:",
        updateError.message
      );
    }

    return NextResponse.json({
      connected: true,
      accountId: account.id,
      detailsSubmitted:
        account.details_submitted,
      transfersStatus,
      payoutsEnabled:
        account.payouts_enabled,
      ready,
    });
  } catch (error) {
    console.error(
      "Stripe Connect status error:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Could not load Stripe Connect status.",
      500
    );
  }
}