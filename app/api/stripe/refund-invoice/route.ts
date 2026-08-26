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
const PLATFORM_FEE_PERCENT = 5;

type RefundRequestBody = {
  invoiceId?: string;
  amount?: number;
  reason?:
    | "requested_by_customer"
    | "duplicate"
    | "other";
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  amount: string | number;
  status: string;
  contractor_id: string;
  customer_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_destination_account_id: string | null;
  platform_fee_percent: string | number | null;
  refund_status: string | null;
  refunded_amount: string | number | null;
  dispute_status: string | null;
};

function errorResponse(
  error: string,
  status: number
) {
  return NextResponse.json(
    { error },
    { status }
  );
}

function getObjectId(
  value:
    | string
    | { id: string }
    | null
    | undefined
) {
  if (!value) {
    return null;
  }

  return typeof value === "string"
    ? value
    : value.id;
}

function isSuccessfulRefundStatus(
  status: string | null
) {
  return (
    status === "succeeded" ||
    status === "successful"
  );
}

function isPendingRefundStatus(
  status: string | null
) {
  return (
    status === "pending" ||
    status === "requires_action"
  );
}

function isRefundAllowedDisputeStatus(
  status: string | null
) {
  return (
    !status ||
    status === "none" ||
    status === "won" ||
    status === "prevented" ||
    status === "warning_closed"
  );
}



export async function POST(
  request: NextRequest
) {
  try {
    if (isPrelaunchMode()) {
  return NextResponse.json(
    {
      error:
        "Contractorhub is currently in pre-launch mode. Live refunds are temporarily disabled.",
    },
    { status: 503 }
  );
}
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
        "Supabase server environment variables are missing.",
        500
      );
    }

    const authorization =
      request.headers.get(
        "authorization"
      );

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

    let body: RefundRequestBody;

    try {
      body =
        (await request.json()) as
          RefundRequestBody;
    } catch {
      return errorResponse(
        "Invalid request body.",
        400
      );
    }

    const invoiceId =
      body.invoiceId?.trim();

    if (!invoiceId) {
      return errorResponse(
        "Invoice ID is required.",
        400
      );
    }

    const requestedAmount =
      Number(body.amount);

    if (
      !Number.isFinite(
        requestedAmount
      ) ||
      requestedAmount <= 0
    ) {
      return errorResponse(
        "Refund amount must be greater than zero.",
        400
      );
    }

    const refundAmountInCents =
      Math.round(
        requestedAmount * 100
      );

    if (
      !Number.isSafeInteger(
        refundAmountInCents
      ) ||
      refundAmountInCents <= 0
    ) {
      return errorResponse(
        "Refund amount is invalid.",
        400
      );
    }

    const reason =
      body.reason ??
      "requested_by_customer";

    if (
      ![
        "requested_by_customer",
        "duplicate",
        "other",
      ].includes(reason)
    ) {
      return errorResponse(
        "Refund reason is invalid.",
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

    async function reconcileRefundSummary(
          stripe: Stripe,
          invoice: InvoiceRow,
          chargeId: string,
          latestRefundId: string | null
        ) {
      const refunds =
        await stripe.refunds.list({
          charge: chargeId,
          limit: 100,
        });

      let succeededCents = 0;
      let pendingCents = 0;
      let hasFailedRefund = false;

      for (const refund of refunds.data) {
        const status =
          refund.status ?? null;

        if (
          isSuccessfulRefundStatus(
            status
          )
        ) {
          succeededCents +=
            refund.amount;
        } else if (
          isPendingRefundStatus(status)
        ) {
          pendingCents += refund.amount;
        } else if (
          status === "failed"
        ) {
          hasFailedRefund = true;
        }
      }

      const invoiceAmountCents =
        Math.round(
          Number(invoice.amount) * 100
        );

      let refundStatus = "none";

      if (
        succeededCents >=
        invoiceAmountCents
      ) {
        refundStatus = "full";
      } else if (
        succeededCents > 0
      ) {
        refundStatus = "partial";
      } else if (
        pendingCents > 0
      ) {
        refundStatus = "pending";
      } else if (hasFailedRefund) {
        refundStatus = "failed";
      }

      const {
        error: updateError,
      } =
        await adminSupabase
          .from("project_invoices")
          .update({
            stripe_charge_id:
              chargeId,
            refund_status:
              refundStatus,
            refunded_amount:
              succeededCents / 100,
            stripe_latest_refund_id:
              latestRefundId,
            refund_updated_at:
              new Date().toISOString(),
            customer_seen: false,
            contractor_seen: false,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", invoice.id);

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }

      return {
        refundStatus,
        refundedAmount:
          succeededCents / 100,
        pendingRefundAmount:
          pendingCents / 100,
        remainingRefundableAmount:
          Math.max(
            0,
            invoiceAmountCents -
              succeededCents -
              pendingCents
          ) / 100,
      };
    }

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

    const {
      data: accountData,
      error: accountError,
    } =
      await adminSupabase
        .from("user_accounts")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

    if (accountError) {
      return errorResponse(
        accountError.message,
        500
      );
    }

    if (
      accountData?.account_type !==
      "contractor"
    ) {
      return errorResponse(
        "Only the contractor for this invoice can issue this refund.",
        403
      );
    }

    const {
      data: invoiceData,
      error: invoiceError,
    } =
      await adminSupabase
        .from("project_invoices")
        .select(`
          id,
          invoice_number,
          amount,
          status,
          contractor_id,
          customer_id,
          stripe_payment_intent_id,
          stripe_charge_id,
          stripe_destination_account_id,
          platform_fee_percent,
          refund_status,
          refunded_amount,
          dispute_status
        `)
        .eq("id", invoiceId)
        .eq(
          "contractor_id",
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

    if (
      invoice.status !== "paid"
    ) {
      return errorResponse(
        "Only paid invoices can be refunded.",
        409
      );
    }

    if (
      !invoice
        .stripe_payment_intent_id
    ) {
      return errorResponse(
        "This invoice is missing its Stripe payment reference.",
        409
      );
    }

    if (
      invoice.dispute_status ===
      "lost"
    ) {
      return errorResponse(
        "This payment was lost in a Stripe dispute. The cardholder has already received the disputed funds, so an additional refund is blocked.",
        409
      );
    }

    if (
      !isRefundAllowedDisputeStatus(
        invoice.dispute_status
      )
    ) {
      return errorResponse(
        "A Stripe dispute is active on this payment. Resolve the dispute before issuing a refund.",
        409
      );
    }

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

    const destinationAccountId =
      contractorStripeData
        ?.stripe_account_id ??
      null;

    if (!destinationAccountId) {
      return errorResponse(
        "Contractor Stripe account is missing.",
        409
      );
    }

    const stripe =
      new Stripe(
        stripeSecretKey
      );

    const paymentIntent =
      await stripe.paymentIntents
        .retrieve(
          invoice
            .stripe_payment_intent_id,
          {
            expand: [
              "latest_charge",
            ],
          }
        );

    if (
      paymentIntent.status !==
      "succeeded"
    ) {
      return errorResponse(
        "The Stripe payment is not in a refundable succeeded state.",
        409
      );
    }

    const expectedInvoiceCents =
      Math.round(
        Number(invoice.amount) * 100
      );

    const expectedFeeCents =
      Math.round(
        expectedInvoiceCents *
          (PLATFORM_FEE_PERCENT /
            100)
      );

    const destination =
      getObjectId(
        paymentIntent.transfer_data
          ?.destination as
          | string
          | { id: string }
          | null
          | undefined
      );

    if (
      paymentIntent.amount !==
        expectedInvoiceCents ||
      paymentIntent.currency !==
        "aud" ||
      paymentIntent
        .application_fee_amount !==
        expectedFeeCents ||
      destination !==
        destinationAccountId
    ) {
      return errorResponse(
        "Stripe payment details do not match this invoice. Refund blocked for safety.",
        409
      );
    }

    const latestCharge =
      paymentIntent.latest_charge;

    const charge =
      typeof latestCharge ===
      "string"
        ? await stripe.charges
            .retrieve(
              latestCharge
            )
        : latestCharge;

    if (!charge) {
      return errorResponse(
        "Stripe charge could not be found.",
        409
      );
    }

    if (charge.disputed) {
      return errorResponse(
        "This payment currently has a dispute. Refund blocked until the dispute is resolved.",
        409
      );
    }

    const existingRefunds =
      await stripe.refunds.list({
        charge: charge.id,
        limit: 100,
      });

    let committedRefundCents = 0;

    for (
      const refund
      of existingRefunds.data
    ) {
      const status =
        refund.status ?? null;

      if (
        status !== "failed" &&
        status !== "canceled"
      ) {
        committedRefundCents +=
          refund.amount;
      }
    }

    const remainingCents =
      charge.amount -
      committedRefundCents;

    if (remainingCents <= 0) {
      return errorResponse(
        "This payment has already been fully refunded.",
        409
      );
    }

    if (
      refundAmountInCents >
      remainingCents
    ) {
      return errorResponse(
        `Maximum refundable amount is A$${(
          remainingCents / 100
        ).toFixed(2)}.`,
        409
      );
    }

    const stripeReason =
      reason ===
        "requested_by_customer" ||
      reason === "duplicate"
        ? reason
        : undefined;

    /*
      Idempotency is based on the amount already committed
      before this request. Browser/network retries therefore
      cannot create the same refund twice.
    */
    const idempotencyKey =
      `invoice-refund-v1-${invoice.id}-${committedRefundCents}-${refundAmountInCents}`;

    const refund =
      await stripe.refunds.create(
        {
          charge: charge.id,
          amount:
            refundAmountInCents,
          reverse_transfer: true,
          refund_application_fee:
            true,
          reason: stripeReason,
          metadata: {
            invoice_id:
              invoice.id,
            invoice_number:
              invoice.invoice_number,
            contractor_id:
              invoice.contractor_id,
            customer_id:
              invoice.customer_id,
            initiated_by:
              user.id,
            refund_reason:
              reason,
          },
        },
        {
          idempotencyKey,
        }
      );

    const refundStatus =
      refund.status ??
      "pending";

    const {
      error: refundLogError,
    } =
      await adminSupabase
        .from(
          "project_invoice_refunds"
        )
        .upsert(
          {
            invoice_id:
              invoice.id,
            stripe_refund_id:
              refund.id,
            stripe_charge_id:
              charge.id,
            stripe_payment_intent_id:
              invoice
                .stripe_payment_intent_id,
            amount:
              refund.amount / 100,
            currency:
              refund.currency,
            status:
              refundStatus,
            reason,
            failure_reason:
              (
                refund as Stripe.Refund & {
                  failure_reason?:
                    | string
                    | null;
                }
              ).failure_reason ??
              null,
            initiated_by:
              user.id,
            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "stripe_refund_id",
          }
        );

    if (refundLogError) {
      console.error(
        "Refund created in Stripe but refund audit log failed:",
        refundLogError.message
      );
    }

    const summary =
      await reconcileRefundSummary(
        stripe,
        invoice,
        charge.id,
        refund.id
      );

    return NextResponse.json({
      refunded: true,
      refundId: refund.id,
      stripeStatus:
        refundStatus,
      amount:
        refund.amount / 100,
      ...summary,
    });
  } catch (error) {
    console.error(
      "Stripe invoice refund error:",
      error
    );

    const stripeError =
      error as {
        type?: string;
        code?: string;
        message?: string;
      };

    if (
      stripeError.type ===
      "StripeInvalidRequestError"
    ) {
      return errorResponse(
        stripeError.message ??
          "Stripe could not create the refund.",
        409
      );
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Could not create the refund.",
      500
    );
  }
}