import {
  NextRequest,
  NextResponse,
} from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORM_FEE_PERCENT = 5;

type VerifyBody = {
  sessionId?: string;
};

type InvoiceRow = {
  id: string;
  status: string;
  amount: string | number;
  customer_id: string;
  contractor_id: string;
  stripe_payment_intent_id:
    | string
    | null;
};

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

function getDestinationAccountId(
  paymentIntent: Stripe.PaymentIntent
) {
  const destination =
    paymentIntent.transfer_data
      ?.destination;

  if (!destination) {
    return null;
  }

  return typeof destination === "string"
    ? destination
    : destination.id;
}

export async function POST(
  request: NextRequest
) {
  try {
    const stripeSecretKey =
      process.env.STRIPE_SECRET_KEY;

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabasePublishableKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const supabaseSecretKey =
      process.env
        .SUPABASE_SECRET_KEY;

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
      request.headers.get(
        "authorization"
      );

    if (
      !authorization
        ?.startsWith("Bearer ")
    ) {
      return errorResponse(
        "You must be logged in.",
        401
      );
    }

    const accessToken =
      authorization
        .slice(
          "Bearer ".length
        )
        .trim();

    if (!accessToken) {
      return errorResponse(
        "You must be logged in.",
        401
      );
    }

    let body: VerifyBody;

    try {
      body =
        (await request.json()) as
          VerifyBody;
    } catch {
      return errorResponse(
        "Invalid request body.",
        400
      );
    }

    const sessionId =
      body.sessionId?.trim();

    if (
      !sessionId ||
      !sessionId
        .startsWith("cs_")
    ) {
      return errorResponse(
        "A valid Stripe Checkout Session ID is required.",
        400
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
            persistSession:
              false,
            autoRefreshToken:
              false,
            detectSessionInUrl:
              false,
          },
        }
      );

    const adminSupabase =
      createClient(
        supabaseUrl,
        supabaseSecretKey,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
            detectSessionInUrl:
              false,
          },
        }
      );

    const {
      data: { user },
      error: userError,
    } =
      await userSupabase
        .auth.getUser(
          accessToken
        );

    if (
      userError ||
      !user
    ) {
      return errorResponse(
        "Your login session is invalid.",
        401
      );
    }

    const stripe =
      new Stripe(
        stripeSecretKey
      );

    const checkoutSession =
      await stripe
        .checkout.sessions
        .retrieve(
          sessionId
        );

    const invoiceId =
      checkoutSession
        .metadata?.invoice_id ??
      checkoutSession
        .client_reference_id;

    if (!invoiceId) {
      return errorResponse(
        "This Stripe Session is missing its invoice reference.",
        400
      );
    }

    if (
      checkoutSession
        .metadata?.customer_id !==
      user.id
    ) {
      return errorResponse(
        "This Stripe payment does not belong to your account.",
        403
      );
    }

    const {
      data: invoiceData,
      error: invoiceError,
    } =
      await adminSupabase
        .from(
          "project_invoices"
        )
        .select(`
          id,
          status,
          amount,
          customer_id,
          contractor_id,
          stripe_payment_intent_id
        `)
        .eq("id", invoiceId)
        .eq(
          "customer_id",
          user.id
        )
        .maybeSingle();

    if (invoiceError) {
      return errorResponse(
        invoiceError.message,
        500
      );
    }

    const invoice =
      invoiceData as
        InvoiceRow | null;

    if (!invoice) {
      return errorResponse(
        "Invoice not found.",
        404
      );
    }

    /*
      If another verified path already marked this invoice
      paid, there is nothing left to change.
    */
    if (
      invoice.status ===
        "paid"
    ) {
      return NextResponse.json({
        paid: true,
        alreadyPaid: true,
        invoiceId:
          invoice.id,
      });
    }

    if (
      invoice.status !==
        "sent"
    ) {
      return errorResponse(
        "Only sent invoices can be marked as paid.",
        409
      );
    }

    const expectedAmountInCents =
      Math.round(
        Number(
          invoice.amount
        ) * 100
      );

    if (
      !Number.isSafeInteger(
        expectedAmountInCents
      ) ||
      expectedAmountInCents <=
        0
    ) {
      return errorResponse(
        "Stored invoice amount is invalid.",
        400
      );
    }

    const expectedFeeInCents =
      Math.round(
        expectedAmountInCents *
          (PLATFORM_FEE_PERCENT /
            100)
      );

    const expectedNetInCents =
      expectedAmountInCents -
      expectedFeeInCents;

    const {
      data:
        contractorStripeData,
      error:
        contractorStripeError,
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
          invoice.contractor_id
        )
        .maybeSingle();

    if (
      contractorStripeError
    ) {
      return errorResponse(
        contractorStripeError.message,
        500
      );
    }

    const expectedDestination =
      contractorStripeData
        ?.stripe_account_id ??
      null;

    if (!expectedDestination) {
      return errorResponse(
        "Contractor Stripe account is missing.",
        409
      );
    }

    /*
      Verify the Checkout Session itself first.
    */
    if (
      checkoutSession.currency !==
        "aud" ||
      checkoutSession
        .amount_total !==
        expectedAmountInCents ||
      checkoutSession
        .metadata
        ?.invoice_id !==
        invoice.id ||
      checkoutSession
        .metadata
        ?.customer_id !==
        invoice.customer_id ||
      checkoutSession
        .metadata
        ?.contractor_id !==
        invoice.contractor_id ||
      checkoutSession
        .metadata
        ?.platform_fee_percent !==
        String(
          PLATFORM_FEE_PERCENT
        ) ||
      checkoutSession
        .metadata
        ?.platform_fee_amount_cents !==
        String(
          expectedFeeInCents
        ) ||
      checkoutSession
        .metadata
        ?.contractor_net_amount_cents !==
        String(
          expectedNetInCents
        ) ||
      checkoutSession
        .metadata
        ?.stripe_destination_account_id !==
        expectedDestination
    ) {
      return errorResponse(
        "Stripe Checkout details do not match this invoice payment split.",
        400
      );
    }

    if (
      checkoutSession
        .payment_status !==
      "paid"
    ) {
      return NextResponse.json({
        paid: false,
        status:
          checkoutSession
            .payment_status,
      });
    }

    const paymentIntentId =
      typeof checkoutSession
        .payment_intent ===
      "string"
        ? checkoutSession
            .payment_intent
        : checkoutSession
            .payment_intent
            ?.id ?? null;

    if (!paymentIntentId) {
      return errorResponse(
        "Stripe payment is missing its PaymentIntent.",
        400
      );
    }

    /*
      Verify what Stripe actually charged and transferred.
      The invoice is not marked paid unless all of these
      Connect values match.
    */
    const paymentIntent =
      await stripe
        .paymentIntents
        .retrieve(
          paymentIntentId
        );

    const actualDestination =
      getDestinationAccountId(
        paymentIntent
      );

    if (
      paymentIntent.status !==
        "succeeded" ||
      paymentIntent.amount !==
        expectedAmountInCents ||
      paymentIntent.currency !==
        "aud" ||
      paymentIntent
        .application_fee_amount !==
        expectedFeeInCents ||
      actualDestination !==
        expectedDestination ||
      paymentIntent.metadata
        ?.invoice_id !==
        invoice.id ||
      paymentIntent.metadata
        ?.customer_id !==
        invoice.customer_id ||
      paymentIntent.metadata
        ?.contractor_id !==
        invoice.contractor_id
    ) {
      return errorResponse(
        "Stripe Connect payment details do not match this invoice.",
        400
      );
    }

    const {
      data: updatedInvoice,
      error: updateError,
    } =
      await adminSupabase
        .from(
          "project_invoices"
        )
        .update({
          status: "paid",
          paid_at:
            new Date()
              .toISOString(),
          payment_reference:
            paymentIntentId,
          stripe_checkout_session_id:
            checkoutSession.id,
          stripe_payment_intent_id:
            paymentIntentId,
          stripe_checkout_created_at:
            new Date(
              checkoutSession
                .created * 1000
            ).toISOString(),
          platform_fee_percent:
            PLATFORM_FEE_PERCENT,
          platform_fee_amount:
            expectedFeeInCents /
            100,
          contractor_net_amount:
            expectedNetInCents /
            100,
          stripe_destination_account_id:
            expectedDestination,
          customer_seen: true,
          contractor_seen: false,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          invoice.id
        )
        .eq(
          "status",
          "sent"
        )
        .select("id")
        .maybeSingle();

    if (updateError) {
      return errorResponse(
        updateError.message,
        500
      );
    }

    return NextResponse.json({
      paid: true,
      synced:
        Boolean(
          updatedInvoice
        ),
      invoiceId:
        invoice.id,
      platformFeePercent:
        PLATFORM_FEE_PERCENT,
      platformFeeAmount:
        expectedFeeInCents /
        100,
      contractorNetAmount:
        expectedNetInCents /
        100,
    });
  } catch (error) {
    console.error(
      "Stripe Connect payment verification error:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Could not verify the Stripe payment.",
      500
    );
  }
}