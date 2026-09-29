export type RefundAttempt = {
  requestId: string;
  invoiceId: string;
  amount: number;
  reason: "requested_by_customer" | "duplicate" | "other";
  expectedRefundedCents: number;
};

export function refundAttemptKey(userId: string, invoiceId: string) {
  return `pending-refund-v2:${userId}:${invoiceId}`;
}

export function readRefundAttempt(key: string): RefundAttempt | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw) as RefundAttempt;
  if (
    typeof value.requestId !== "string" || typeof value.invoiceId !== "string" ||
    !Number.isFinite(value.amount) || value.amount <= 0 ||
    !Number.isSafeInteger(value.expectedRefundedCents) || value.expectedRefundedCents < 0 ||
    !["requested_by_customer", "duplicate", "other"].includes(value.reason)
  ) throw new Error("Saved refund details could not be read. Check the payment in Stripe before trying again.");
  return value;
}
