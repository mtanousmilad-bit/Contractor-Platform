import { createHash } from "node:crypto";
import type Stripe from "stripe";

export class RefundConflictError extends Error {}

export async function listAllRefunds(stripe: Stripe, charge: string) {
  const refunds: Stripe.Refund[] = [];
  for await (const refund of stripe.refunds.list({ charge, limit: 100 })) {
    refunds.push(refund);
  }
  return refunds;
}

// The caller must authenticate the contractor and validate invoice/charge ownership.
export async function createRefundOnce(
  stripe: Stripe,
  input: {
    requestId: string;
    expectedRefundedCents: number;
    chargeAmount: number;
    params: Omit<Stripe.RefundCreateParams, "metadata"> & { charge: string; amount: number; metadata: Stripe.MetadataParam };
  },
) {
  const { requestId, expectedRefundedCents, chargeAmount, params } = input;
  const refunds = await listAllRefunds(stripe, params.charge);
  const previous = refunds.find((r) => r.metadata?.refund_request_id === requestId);

  // Check the permanent Stripe object before the balance, including on retries
  // after Stripe's temporary idempotency cache expires or a full refund finishes.
  if (previous) {
    if (
      previous.amount !== params.amount ||
      previous.metadata?.refund_reason !== params.metadata.refund_reason ||
      previous.metadata?.initiated_by !== params.metadata.initiated_by
    ) {
      throw new RefundConflictError("This refund request already exists with different details.");
    }
    return previous;
  }

  const committed = refunds.reduce((total, r) =>
    r.status === "failed" || r.status === "canceled" ? total : total + r.amount, 0);
  if (committed !== expectedRefundedCents) {
    throw new RefundConflictError("The refund balance changed or a refund is pending. Review the updated invoice before creating another refund.");
  }
  if (params.amount > chargeAmount - committed) {
    throw new RefundConflictError("The requested refund exceeds the remaining payment balance.");
  }

  // Concurrent requests based on the same ledger share one Stripe key. Different
  // operation IDs/amounts conflict instead of creating two refunds. Include failed
  // refunds in the ledger so a later intentional retry gets a fresh key.
  const ledger = createHash("sha256")
    .update(refunds.map((r) => r.id).sort().join(","))
    .digest("hex");
  return stripe.refunds.create({
    ...params,
    metadata: { ...params.metadata, refund_request_id: requestId },
  }, { idempotencyKey: `invoice-refund-v2-${params.charge}-${ledger}` });
}
