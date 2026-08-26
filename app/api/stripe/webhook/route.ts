import {
  NextRequest,
  NextResponse,
} from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORM_FEE_PERCENT = 5;

function createAdminSupabaseClient(
  url: string,
  secretKey: string
) {
  return createClient(
    url,
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

type SupabaseAdmin =
  ReturnType<
    typeof createAdminSupabaseClient
  >;

type InvoiceRow = {
  id: string;
  status: string;
  amount: string | number;
  customer_id: string;
  contractor_id: string;
  stripe_checkout_session_id:
    | string
    | null;
  stripe_payment_intent_id:
    | string
    | null;
  stripe_charge_id:
    | string
    | null;
  platform_fee_percent:
    | string
    | number
    | null;
  platform_fee_amount:
    | string
    | number
    | null;
  contractor_net_amount:
    | string
    | number
    | null;
  stripe_destination_account_id:
    | string
    | null;
};

function json(
  message: string,
  status = 200
) {
  return NextResponse.json(
    { message },
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

function getDestinationAccountId(
  paymentIntent: Stripe.PaymentIntent
) {
  return getObjectId(
    paymentIntent.transfer_data
      ?.destination as
      | string
      | { id: string }
      | null
      | undefined
  );
}

function moneyMatches(
  stored: string | number | null,
  expected: number
) {
  if (
    stored === null ||
    stored === undefined
  ) {
    return false;
  }

  const value = Number(stored);

  return (
    Number.isFinite(value) &&
    Math.abs(value - expected) <
      0.000001
  );
}

function isSuccessfulRefundStatus(
  status: string | null
) {
  return status === "succeeded";
}

function isPendingRefundStatus(
  status: string | null
) {
  return (
    status === "pending" ||
    status === "requires_action"
  );
}

async function findInvoiceForStripeObject(
  adminSupabase: SupabaseAdmin,
  options: {
    invoiceId?: string | null;
    paymentIntentId?:
      | string
      | null;
    chargeId?: string | null;
  }
) {
  if (options.invoiceId) {
    const {
      data,
      error,
    } =
      await adminSupabase
        .from("project_invoices")
        .select(`
          id,
          status,
          amount,
          customer_id,
          contractor_id,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          stripe_charge_id,
          platform_fee_percent,
          platform_fee_amount,
          contractor_net_amount,
          stripe_destination_account_id
        `)
        .eq(
          "id",
          options.invoiceId
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (data) {
      return data as InvoiceRow;
    }
  }

  if (options.paymentIntentId) {
    const {
      data,
      error,
    } =
      await adminSupabase
        .from("project_invoices")
        .select(`
          id,
          status,
          amount,
          customer_id,
          contractor_id,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          stripe_charge_id,
          platform_fee_percent,
          platform_fee_amount,
          contractor_net_amount,
          stripe_destination_account_id
        `)
        .eq(
          "stripe_payment_intent_id",
          options.paymentIntentId
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (data) {
      return data as InvoiceRow;
    }
  }

  if (options.chargeId) {
    const {
      data,
      error,
    } =
      await adminSupabase
        .from("project_invoices")
        .select(`
          id,
          status,
          amount,
          customer_id,
          contractor_id,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          stripe_charge_id,
          platform_fee_percent,
          platform_fee_amount,
          contractor_net_amount,
          stripe_destination_account_id
        `)
        .eq(
          "stripe_charge_id",
          options.chargeId
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (data) {
      return data as InvoiceRow;
    }
  }

  return null;
}

async function reconcileRefundSummary(
  stripe: Stripe,
  adminSupabase: SupabaseAdmin,
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
    const status: string | null =
      refund.status
        ? String(refund.status)
        : null;

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
  };
}

async function handleRefundEvent(
  stripe: Stripe,
  adminSupabase: SupabaseAdmin,
  event: Stripe.Event
) {
  const refund =
    event.data.object as
      Stripe.Refund;

  const refundRecord =
    refund as Stripe.Refund & {
      charge?:
        | string
        | Stripe.Charge
        | null;
      payment_intent?:
        | string
        | Stripe.PaymentIntent
        | null;
      failure_reason?:
        | string
        | null;
    };

  let chargeId =
    getObjectId(
      refundRecord.charge as
        | string
        | { id: string }
        | null
        | undefined
    );

  let paymentIntentId =
    getObjectId(
      refundRecord.payment_intent as
        | string
        | { id: string }
        | null
        | undefined
    );

  let charge:
    | Stripe.Charge
    | null = null;

  if (chargeId) {
    charge =
      await stripe.charges
        .retrieve(chargeId);

    paymentIntentId =
      paymentIntentId ??
      getObjectId(
        charge.payment_intent as
          | string
          | { id: string }
          | null
          | undefined
      );
  } else if (
    paymentIntentId
  ) {
    const paymentIntent =
      await stripe.paymentIntents
        .retrieve(
          paymentIntentId,
          {
            expand: [
              "latest_charge",
            ],
          }
        );

    const latestCharge =
      paymentIntent.latest_charge;

    if (latestCharge) {
      charge =
        typeof latestCharge ===
        "string"
          ? await stripe.charges
              .retrieve(
                latestCharge
              )
          : latestCharge;

      chargeId = charge.id;
    }
  }

  const invoice =
    await findInvoiceForStripeObject(
      adminSupabase,
      {
        invoiceId:
          refund.metadata
            ?.invoice_id ??
          null,
        paymentIntentId,
        chargeId,
      }
    );

  if (!invoice) {
    console.warn(
      "Refund does not match a local invoice:",
      refund.id
    );

    return NextResponse.json({
      received: true,
      refundInvoiceNotFound:
        true,
    });
  }

  if (!chargeId) {
    return json(
      "Refund is missing its Stripe charge.",
      400
    );
  }

  const refundStatus =
    refund.status
      ? String(refund.status)
      : "pending";

  const failureReason =
    refundRecord.failure_reason ??
    null;

  const initiatedBy =
    refund.metadata
      ?.initiated_by ??
    null;

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
            chargeId,
          stripe_payment_intent_id:
            paymentIntentId,
          amount:
            refund.amount / 100,
          currency:
            refund.currency,
          status:
            refundStatus,
          reason:
            refund.metadata
              ?.refund_reason ??
            refund.reason ??
            null,
          failure_reason:
            failureReason,
          initiated_by:
            initiatedBy || null,
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
      "Could not save Stripe refund audit log:",
      refundLogError.message
    );

    return json(
      "Could not save refund state.",
      500
    );
  }

  const summary =
    await reconcileRefundSummary(
      stripe,
      adminSupabase,
      invoice,
      chargeId,
      refund.id
    );

  return NextResponse.json({
    received: true,
    refundSynced: true,
    refundId: refund.id,
    ...summary,
  });
}

function getInvoiceMoneyCents(
  value: string | number | null
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
}

async function syncDisputeTransferRecovery(
  stripe: Stripe,
  invoice: InvoiceRow,
  charge: Stripe.Charge,
  dispute: Stripe.Dispute,
  status: string
) {
  const transferId =
    getObjectId(
      charge.transfer as
        | string
        | { id: string }
        | null
        | undefined
    );

  if (!transferId) {
    throw new Error(
      "Destination charge is missing its Stripe transfer."
    );
  }

  const transfer =
    await stripe.transfers.retrieve(
      transferId
    );

  const destinationAccountId =
    getObjectId(
      transfer.destination as
        | string
        | { id: string }
        | null
        | undefined
    ) ??
    invoice
      .stripe_destination_account_id;

  if (!destinationAccountId) {
    throw new Error(
      "Destination transfer is missing its connected Stripe account."
    );
  }

  if (
    invoice
      .stripe_destination_account_id &&
    invoice
      .stripe_destination_account_id !==
      destinationAccountId
  ) {
    throw new Error(
      "Stripe dispute transfer destination does not match the invoice."
    );
  }

  /*
    Load all reversals created specifically to recover
    contractor funds for this dispute.
  */
  const reversals =
    await stripe.transfers.listReversals(
      transferId,
      {
        limit: 100,
      }
    );

  const disputeRecoveryReversals =
    reversals.data.filter(
      (reversal) =>
        reversal.metadata?.purpose ===
          "dispute_recovery" &&
        reversal.metadata?.dispute_id ===
          dispute.id
    );

  const alreadyRecoveredCents =
    disputeRecoveryReversals.reduce(
      (total, reversal) =>
        total + reversal.amount,
      0
    );

  /*
    If Stripe resolves the dispute in the contractor's
    favour, repay exactly what was previously recovered.
  */
  const shouldRestoreContractor =
    status === "won" ||
    status === "prevented" ||
    status === "warning_closed";

  if (shouldRestoreContractor) {
    if (alreadyRecoveredCents <= 0) {
      return {
        transferId,
        recoveryAction: "none",
        recoveryAmount: 0,
      };
    }

    /*
      Search Stripe for an existing repayment before
      creating another one.

      This protects against duplicate webhook delivery
      and also lets a later retry use a fresh idempotency
      key after a temporary failure such as
      balance_insufficient.
    */
    let existingRepayment:
      | Stripe.Transfer
      | null = null;

    let startingAfter:
      | string
      | undefined;

    do {
      const repaymentPage =
        await stripe.transfers.list({
          destination:
            destinationAccountId,
          limit: 100,
          created: {
            gte: dispute.created,
          },
          ...(transfer.transfer_group
            ? {
                transfer_group:
                  transfer.transfer_group,
              }
            : {}),
          ...(startingAfter
            ? {
                starting_after:
                  startingAfter,
              }
            : {}),
        });

      existingRepayment =
        repaymentPage.data.find(
          (candidate) =>
            candidate.metadata?.purpose ===
              "dispute_repayment" &&
            candidate.metadata?.dispute_id ===
              dispute.id &&
            candidate.metadata
              ?.original_transfer_id ===
              transfer.id
        ) ?? null;

      if (
        existingRepayment ||
        !repaymentPage.has_more
      ) {
        break;
      }

      startingAfter =
        repaymentPage.data[
          repaymentPage.data.length - 1
        ]?.id;

      if (!startingAfter) {
        break;
      }
    } while (true);

    if (existingRepayment) {
      return {
        transferId,
        recoveryAction:
          "already_repaid",
        recoveryAmount:
          existingRepayment.amount /
          100,
        repaymentTransferId:
          existingRepayment.id,
      };
    }

    /*
      Stripe caches the result of an idempotent request,
      including some failed requests.

      Use a rolling retry bucket so a temporary failure
      can be retried later with a fresh request, while
      the existing-repayment lookup above prevents a
      successful repayment from being duplicated.
    */
    const repaymentRetryBucket =
      Math.floor(
        Date.now() /
          (10 * 60 * 1000)
      );

    const repayment =
      await stripe.transfers.create(
        {
          amount:
            alreadyRecoveredCents,
          currency:
            transfer.currency,
          destination:
            destinationAccountId,
          source_type: "card",
          description:
            `Dispute recovery repayment for ${dispute.id}`,
          transfer_group:
            transfer.transfer_group ??
            undefined,
          metadata: {
            purpose:
              "dispute_repayment",
            dispute_id:
              dispute.id,
            invoice_id:
              invoice.id,
            original_transfer_id:
              transfer.id,
          },
        },
        {
          idempotencyKey:
            `dispute-repayment-v4-${dispute.id}-${repaymentRetryBucket}`,
        }
      );

    return {
      transferId,
      recoveryAction:
        "repaid",
      recoveryAmount:
        repayment.amount / 100,
      repaymentTransferId:
        repayment.id,
    };
  }

  /*
    Active disputes and final lost disputes both require recovery.
    A lost event can arrive even if an earlier created/updated event
    was missed, so this remains safe and idempotent.
  */
  if (alreadyRecoveredCents > 0) {
    return {
      transferId,
      recoveryAction:
        "already_recovered",
      recoveryAmount:
        alreadyRecoveredCents /
        100,
    };
  }

  const invoiceAmountCents =
    getInvoiceMoneyCents(
      invoice.amount
    );

  const contractorNetCents =
    getInvoiceMoneyCents(
      invoice.contractor_net_amount
    );

  if (
    !invoiceAmountCents ||
    invoiceAmountCents <= 0 ||
    contractorNetCents === null ||
    contractorNetCents < 0 ||
    contractorNetCents >
      invoiceAmountCents
  ) {
    throw new Error(
      "Stored invoice payment split is invalid for dispute recovery."
    );
  }

  /*
    The platform fee is not recovered from the contractor.
    Recover only the contractor's proportional net share of the
    disputed amount. Example: 5% platform fee => recover 95%.
  */
  const targetRecoveryCents =
    Math.min(
      contractorNetCents,
      Math.round(
        dispute.amount *
          (contractorNetCents /
            invoiceAmountCents)
      )
    );

  const remainingTransferCents =
    Math.max(
      0,
      transfer.amount -
        transfer.amount_reversed
    );

  const recoveryCents =
    Math.min(
      targetRecoveryCents,
      remainingTransferCents
    );

  if (recoveryCents <= 0) {
    return {
      transferId,
      recoveryAction:
        "nothing_available",
      recoveryAmount: 0,
    };
  }

  if (
    recoveryCents <
    targetRecoveryCents
  ) {
    console.warn(
      "Stripe dispute recovery is limited by the unreversed transfer balance:",
      {
        invoiceId:
          invoice.id,
        disputeId:
          dispute.id,
        targetRecoveryCents,
        recoveryCents,
        transferId,
      }
    );
  }

  const reversal =
    await stripe.transfers
      .createReversal(
        transferId,
        {
          amount:
            recoveryCents,
          description:
            `Dispute recovery for ${dispute.id}`,
          metadata: {
            purpose:
              "dispute_recovery",
            dispute_id:
              dispute.id,
            invoice_id:
              invoice.id,
            stripe_charge_id:
              charge.id,
          },
        },
        {
          idempotencyKey:
            `dispute-recovery-v1-${dispute.id}`,
        }
      );

  return {
    transferId,
    recoveryAction:
      status === "lost"
        ? "recovered_after_loss"
        : "recovered",
    recoveryAmount:
      reversal.amount / 100,
    reversalId:
      reversal.id,
  };
}

async function handleDisputeEvent(
  stripe: Stripe,
  adminSupabase: SupabaseAdmin,
  event: Stripe.Event
) {
  const dispute =
    event.data.object as
      Stripe.Dispute;

  const chargeId =
    getObjectId(
      dispute.charge as
        | string
        | { id: string }
        | null
        | undefined
    );

  if (!chargeId) {
    return json(
      "Dispute is missing its charge.",
      400
    );
  }

  const charge =
    await stripe.charges
      .retrieve(chargeId);

  const paymentIntentId =
    getObjectId(
      charge.payment_intent as
        | string
        | { id: string }
        | null
        | undefined
    );

  const invoice =
    await findInvoiceForStripeObject(
      adminSupabase,
      {
        paymentIntentId,
        chargeId,
      }
    );

  if (!invoice) {
    console.warn(
      "Dispute does not match a local invoice:",
      dispute.id
    );

    return NextResponse.json({
      received: true,
      disputeInvoiceNotFound:
        true,
    });
  }

  const evidenceDueBy =
    dispute.evidence_details
      ?.due_by ??
    null;

  const status =
    String(dispute.status);

  const closed =
    status === "won" ||
    status === "lost" ||
    status === "prevented" ||
    status === "warning_closed";

  const {
    error: disputeLogError,
  } =
    await adminSupabase
      .from(
        "project_invoice_disputes"
      )
      .upsert(
        {
          invoice_id:
            invoice.id,
          stripe_dispute_id:
            dispute.id,
          stripe_charge_id:
            chargeId,
          stripe_payment_intent_id:
            paymentIntentId,
          amount:
            dispute.amount / 100,
          currency:
            dispute.currency,
          status,
          reason:
            dispute.reason ??
            null,
          evidence_due_at:
            evidenceDueBy
              ? new Date(
                  evidenceDueBy *
                    1000
                ).toISOString()
              : null,
          closed_at:
            closed
              ? new Date()
                  .toISOString()
              : null,
          updated_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            "stripe_dispute_id",
        }
      );

  if (disputeLogError) {
    console.error(
      "Could not save Stripe dispute audit log:",
      disputeLogError.message
    );

    return json(
      "Could not save dispute state.",
      500
    );
  }

  const {
    error: invoiceUpdateError,
  } =
    await adminSupabase
      .from("project_invoices")
      .update({
        stripe_charge_id:
          chargeId,
        stripe_dispute_id:
          dispute.id,
        dispute_status:
          status,
        dispute_amount:
          dispute.amount / 100,
        dispute_reason:
          dispute.reason ??
          null,
        dispute_updated_at:
          new Date().toISOString(),
        customer_seen: false,
        contractor_seen: false,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", invoice.id);

  if (invoiceUpdateError) {
    console.error(
      "Could not update invoice dispute summary:",
      invoiceUpdateError.message
    );

    return json(
      "Could not update dispute state.",
      500
    );
  }

  /*
    Destination-charge disputes debit the platform account.
    Recover the contractor's proportional net share by reversing
    the destination transfer. If Stripe later resolves the dispute
    in the contractor's favour, repay exactly the amount previously
    recovered. Both operations use Stripe idempotency keys.
  */
  const recovery =
    await syncDisputeTransferRecovery(
      stripe,
      invoice,
      charge,
      dispute,
      status
    );

  return NextResponse.json({
    received: true,
    disputeSynced: true,
    disputeId:
      dispute.id,
    disputeStatus:
      status,
    ...recovery,
  });
}

async function handleCheckoutEvent(
  stripe: Stripe,
  adminSupabase: SupabaseAdmin,
  event: Stripe.Event
) {
  const session =
    event.data.object as
      Stripe.Checkout.Session;

  const invoiceId =
    session.metadata
      ?.invoice_id ??
    session.client_reference_id;

  if (!invoiceId) {
    console.error(
      "Stripe session is missing invoice metadata:",
      session.id
    );

    return json(
      "Invoice ID is missing from the Stripe session.",
      400
    );
  }

  /*
    Expired Checkout Sessions cannot be used.
  */
  if (
    event.type ===
    "checkout.session.expired"
  ) {
    const {
      error:
        expiredUpdateError,
    } =
      await adminSupabase
        .from(
          "project_invoices"
        )
        .update({
          stripe_checkout_session_id:
            null,
          stripe_checkout_created_at:
            null,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq("id", invoiceId)
        .eq("status", "sent")
        .eq(
          "stripe_checkout_session_id",
          session.id
        );

    if (
      expiredUpdateError
    ) {
      console.error(
        "Could not clear expired Checkout Session:",
        expiredUpdateError.message
      );

      return json(
        "Could not clear the expired Checkout Session.",
        500
      );
    }

    return NextResponse.json({
      received: true,
      expiredSessionCleared:
        true,
    });
  }

  if (
    session.payment_status !==
    "paid"
  ) {
    return NextResponse.json({
      received: true,
      paymentNotPaid: true,
    });
  }

  const invoice =
    await findInvoiceForStripeObject(
      adminSupabase,
      {
        invoiceId,
      }
    );

  if (!invoice) {
    console.error(
      "Invoice not found for Stripe session:",
      session.id
    );

    return json(
      "Invoice not found.",
      404
    );
  }

  /*
    Acknowledge Stripe retries for an invoice
    already marked paid.
  */
  if (
    invoice.status === "paid"
  ) {
    const receivedPaymentIntentId =
      getObjectId(
        session.payment_intent as
          | string
          | { id: string }
          | null
          | undefined
      );

    if (
      invoice
        .stripe_payment_intent_id &&
      receivedPaymentIntentId &&
      invoice
        .stripe_payment_intent_id !==
        receivedPaymentIntentId
    ) {
      console.error(
        "Possible duplicate invoice payment detected:",
        {
          invoiceId,
          savedPaymentIntent:
            invoice
              .stripe_payment_intent_id,
          receivedPaymentIntent:
            receivedPaymentIntentId,
        }
      );
    }

    return NextResponse.json({
      received: true,
      alreadyPaid: true,
    });
  }

  if (
    invoice.status !== "sent"
  ) {
    return json(
      "Only sent invoices can be marked as paid.",
      409
    );
  }

  const expectedAmountInCents =
    Math.round(
      Number(invoice.amount) *
        100
    );

  if (
    !Number.isSafeInteger(
      expectedAmountInCents
    ) ||
    expectedAmountInCents <=
      0
  ) {
    return json(
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
    console.error(
      "Could not load contractor Stripe account:",
      contractorStripeError.message
    );

    return json(
      "Could not verify the contractor Stripe account.",
      500
    );
  }

  const contractorStripeAccount =
    contractorStripeData as
      | {
          stripe_account_id:
            string;
        }
      | null;

  const expectedDestination =
    contractorStripeAccount
      ?.stripe_account_id ??
    null;

  if (!expectedDestination) {
    return json(
      "Contractor Stripe account is missing.",
      409
    );
  }

  if (
    session.currency !==
      "aud" ||
    session.amount_total !==
      expectedAmountInCents ||
    session.metadata
      ?.invoice_id !==
      invoice.id ||
    session.metadata
      ?.customer_id !==
      invoice.customer_id ||
    session.metadata
      ?.contractor_id !==
      invoice.contractor_id ||
    session.metadata
      ?.platform_fee_percent !==
      String(
        PLATFORM_FEE_PERCENT
      ) ||
    session.metadata
      ?.platform_fee_amount_cents !==
      String(
        expectedFeeInCents
      ) ||
    session.metadata
      ?.contractor_net_amount_cents !==
      String(
        expectedNetInCents
      ) ||
    session.metadata
      ?.stripe_destination_account_id !==
      expectedDestination
  ) {
    console.error(
      "Stripe Checkout verification mismatch:",
      {
        invoiceId,
        sessionId:
          session.id,
      }
    );

    return json(
      "Stripe Checkout does not match the invoice payment split.",
      400
    );
  }

  const paymentIntentId =
    getObjectId(
      session.payment_intent as
        | string
        | { id: string }
        | null
        | undefined
    );

  if (!paymentIntentId) {
    return json(
      "Stripe payment is missing its PaymentIntent.",
      400
    );
  }

  const paymentIntent =
    await stripe.paymentIntents
      .retrieve(
        paymentIntentId,
        {
          expand: [
            "latest_charge",
          ],
        }
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
    console.error(
      "Stripe Connect PaymentIntent verification mismatch:",
      {
        invoiceId,
        sessionId:
          session.id,
        paymentIntentId,
      }
    );

    return json(
      "Stripe Connect payment does not match the invoice.",
      400
    );
  }

  if (
    invoice.platform_fee_percent !==
      null &&
    Number(
      invoice.platform_fee_percent
    ) !==
      PLATFORM_FEE_PERCENT
  ) {
    return json(
      "Stored platform fee percentage does not match.",
      409
    );
  }

  if (
    invoice.platform_fee_amount !==
      null &&
    !moneyMatches(
      invoice.platform_fee_amount,
      expectedFeeInCents /
        100
    )
  ) {
    return json(
      "Stored platform fee amount does not match.",
      409
    );
  }

  if (
    invoice.contractor_net_amount !==
      null &&
    !moneyMatches(
      invoice.contractor_net_amount,
      expectedNetInCents /
        100
    )
  ) {
    return json(
      "Stored contractor net amount does not match.",
      409
    );
  }

  if (
    invoice
      .stripe_destination_account_id !==
      null &&
    invoice
      .stripe_destination_account_id !==
      expectedDestination
  ) {
    return json(
      "Stored Stripe destination account does not match.",
      409
    );
  }

  const latestCharge =
    paymentIntent.latest_charge;

  const chargeId =
    getObjectId(
      latestCharge as
        | string
        | { id: string }
        | null
        | undefined
    );

  if (!chargeId) {
    return json(
      "Stripe payment is missing its charge.",
      400
    );
  }

  const paidAt =
    new Date(
      event.created * 1000
    ).toISOString();

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
        paid_at: paidAt,
        payment_reference:
          paymentIntentId,
        stripe_checkout_session_id:
          session.id,
        stripe_payment_intent_id:
          paymentIntentId,
        stripe_charge_id:
          chargeId,
        stripe_checkout_created_at:
          new Date(
            session.created *
              1000
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
        refund_status: "none",
        refunded_amount: 0,
        dispute_status: "none",
        customer_seen: true,
        contractor_seen: false,
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq("id", invoiceId)
      .eq("status", "sent")
      .select("id")
      .maybeSingle();

  if (updateError) {
    console.error(
      "Could not mark invoice as paid:",
      updateError.message
    );

    return json(
      "Could not mark the invoice as paid.",
      500
    );
  }

  if (!updatedInvoice) {
    return NextResponse.json({
      received: true,
      alreadyProcessed: true,
    });
  }

  console.log(
    `Invoice ${invoiceId} marked paid after verified Stripe Connect payment ${paymentIntentId}.`
  );

  return NextResponse.json({
    received: true,
    invoicePaid: true,
    platformFeePercent:
      PLATFORM_FEE_PERCENT,
    platformFeeAmount:
      expectedFeeInCents /
      100,
    contractorNetAmount:
      expectedNetInCents /
      100,
  });
}

export async function POST(
  request: NextRequest
) {
  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY;

  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET;

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;

  if (!stripeSecretKey) {
    return json(
      "STRIPE_SECRET_KEY is missing.",
      500
    );
  }

  if (!webhookSecret) {
    return json(
      "STRIPE_WEBHOOK_SECRET is missing.",
      500
    );
  }

  if (
    !supabaseUrl ||
    !supabaseSecretKey
  ) {
    return json(
      "Supabase server environment variables are missing.",
      500
    );
  }

  const signature =
    request.headers.get(
      "stripe-signature"
    );

  if (!signature) {
    return json(
      "Missing Stripe signature.",
      400
    );
  }

  const rawBody =
    await request.text();

  const stripe =
    new Stripe(
      stripeSecretKey
    );

  let event: Stripe.Event;

  try {
    event =
      stripe.webhooks
        .constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
  } catch (error) {
    console.error(
      "Stripe webhook signature error:",
      error
    );

    return json(
      error instanceof Error
        ? `Webhook signature verification failed: ${error.message}`
        : "Webhook signature verification failed.",
      400
    );
  }

  const adminSupabase =
    createAdminSupabaseClient(
      supabaseUrl,
      supabaseSecretKey
    );

  try {
    const eventType =
      String(event.type);

    if (
      eventType ===
        "checkout.session.completed" ||
      eventType ===
        "checkout.session.async_payment_succeeded" ||
      eventType ===
        "checkout.session.expired"
    ) {
      return await handleCheckoutEvent(
        stripe,
        adminSupabase,
        event
      );
    }

    if (
      eventType ===
        "refund.created" ||
      eventType ===
        "refund.updated" ||
      eventType ===
        "refund.failed"
    ) {
      return await handleRefundEvent(
        stripe,
        adminSupabase,
        event
      );
    }

    if (
      eventType ===
        "charge.dispute.created" ||
      eventType ===
        "charge.dispute.updated" ||
      eventType ===
        "charge.dispute.closed" ||
      eventType ===
        "charge.dispute.funds_reinstated" ||
      eventType ===
        "charge.dispute.funds_withdrawn"
    ) {
      return await handleDisputeEvent(
        stripe,
        adminSupabase,
        event
      );
    }

    return NextResponse.json({
      received: true,
      ignored: true,
    });
  } catch (error) {
    console.error(
      `Stripe webhook processing error for ${String(
        event.type
      )}:`,
      error
    );

    return json(
      error instanceof Error
        ? error.message
        : "Webhook processing failed.",
      500
    );
  }
}