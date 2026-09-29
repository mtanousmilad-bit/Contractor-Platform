export function checkoutWindow(invoiceId: string, nowInSeconds: number) {
  const bucketSeconds = 30 * 60;
  const bucket = Math.floor(nowInSeconds / bucketSeconds);
  return {
    idempotencyKey: `invoice-checkout-connect-v3-${invoiceId}-${bucket}`,
    // Same key must have the same parameters. Always at least 31 minutes away.
    expiresAt: (bucket + 1) * bucketSeconds + 31 * 60,
  };
}
