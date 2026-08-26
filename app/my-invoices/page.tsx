"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "cancelled";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  request_id: string;
  contractor_id: string;
  amount: string | number;
  description: string;
  due_date: string;
  status: InvoiceStatus;
  sent_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  refund_status: string | null;
  refunded_amount: string | number | null;
  stripe_latest_refund_id: string | null;
  dispute_status: string | null;
  dispute_amount: string | number | null;
  dispute_reason: string | null;
  dispute_updated_at: string | null;
  created_at: string;
};

type RequestRow = {
  id: string;
  project_type: string;
  project_location: string;
};

type ContractorProfile = {
  id: string;
  full_name: string;
  company_name: string | null;
  trade: string | null;
  avatar_url: string | null;
};

type CustomerInvoice = InvoiceRow & {
  request: RequestRow | null;
  contractor: ContractorProfile | null;
};

type DueState = {
  label: string;
  message: string;
  classes: string;
};

export default function MyInvoicesPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [userId, setUserId] =
    useState<string | null>(null);

  const [invoices, setInvoices] =
    useState<CustomerInvoice[]>([]);

  const [printingInvoiceId, setPrintingInvoiceId] =
    useState<string | null>(null);

  const [payingInvoiceId, setPayingInvoiceId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadInvoices = useCallback(
    async (
      showLoader = false,
      markSeen = false
    ) => {
      if (showLoader) {
        setLoading(true);
      }

      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLoading(false);
        router.replace("/auth");
        return;
      }

      setUserId(user.id);

      const {
        data: accountData,
        error: accountError,
      } = await supabase
        .from("user_accounts")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (accountError) {
        setError(accountError.message);
        setLoading(false);
        return;
      }

      if (
        accountData?.account_type !==
        "customer"
      ) {
        setLoading(false);
        router.replace("/invoices");
        return;
      }

      if (markSeen) {
        const { error: seenError } =
          await supabase.rpc(
            "mark_customer_invoices_seen"
          );

        if (seenError) {
          console.error(
            "Could not mark invoices as seen:",
            seenError.message
          );
        } else {
          window.dispatchEvent(
            new Event(
              "customer-invoices-seen"
            )
          );
        }
      }

      const {
        data: invoiceData,
        error: invoiceError,
      } = await supabase
        .from("project_invoices")
        .select(`
          id,
          invoice_number,
          request_id,
          contractor_id,
          amount,
          description,
          due_date,
          status,
          sent_at,
          paid_at,
          payment_reference,
          refund_status,
          refunded_amount,
          stripe_latest_refund_id,
          dispute_status,
          dispute_amount,
          dispute_reason,
          dispute_updated_at,
          created_at
        `)
        .eq("customer_id", user.id)
        .in("status", ["sent", "paid"])
        .order("created_at", {
          ascending: false,
        });

      if (invoiceError) {
        setError(invoiceError.message);
        setInvoices([]);
        setLoading(false);
        return;
      }

      const invoiceRows = (
        invoiceData ?? []
      ) as InvoiceRow[];

      if (invoiceRows.length === 0) {
        setInvoices([]);
        setLoading(false);
        return;
      }

      const requestIds = [
        ...new Set(
          invoiceRows.map(
            (invoice) =>
              invoice.request_id
          )
        ),
      ];

      const contractorIds = [
        ...new Set(
          invoiceRows.map(
            (invoice) =>
              invoice.contractor_id
          )
        ),
      ];

      const [requestResult, profileResult] =
        await Promise.all([
          supabase
            .from("contact_requests")
            .select(`
              id,
              project_type,
              project_location
            `)
            .in("id", requestIds),

          supabase
            .from("profiles")
            .select(`
              id,
              full_name,
              company_name,
              trade,
              avatar_url
            `)
            .in("id", contractorIds),
        ]);

      if (requestResult.error) {
        console.error(
          "Could not load invoice projects:",
          requestResult.error.message
        );
      }

      if (profileResult.error) {
        console.error(
          "Could not load contractor profiles:",
          profileResult.error.message
        );
      }

      const requests = (
        requestResult.data ?? []
      ) as RequestRow[];

      const contractors = (
        profileResult.data ?? []
      ) as ContractorProfile[];

      const combinedInvoices =
        invoiceRows.map((invoice) => ({
          ...invoice,
          request:
            requests.find(
              (request) =>
                request.id ===
                invoice.request_id
            ) ?? null,
          contractor:
            contractors.find(
              (contractor) =>
                contractor.id ===
                invoice.contractor_id
            ) ?? null,
        }));

      setInvoices(combinedInvoices);
      setLoading(false);
    },
    [router, supabase]
  );

  useEffect(() => {
    void loadInvoices(true, true);
  }, [loadInvoices]);

  /*
    Stripe success fallback:
    Webhooks remain the main payment confirmation method.
    If the customer returns from Stripe with a Checkout Session ID,
    verify that Session server-side too. This repairs the invoice
    immediately if the local webhook was delayed or missed.
  */
  useEffect(() => {
    let cancelled = false;

    async function verifyStripeReturn() {
      const params = new URLSearchParams(
        window.location.search
      );

      const payment = params.get("payment");
      const sessionId =
        params.get("session_id");

      if (
        payment !== "success" ||
        !sessionId
      ) {
        return;
      }

      setPayingInvoiceId(null);
      setError("");
      setSuccess(
        "Confirming your Stripe payment..."
      );

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          throw new Error(
            "Your login session has expired. Please sign in again."
          );
        }

        const response = await fetch(
          "/api/stripe/verify-checkout-session",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              sessionId,
            }),
          }
        );

        const result =
          (await response.json()) as {
            paid?: boolean;
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Could not verify the Stripe payment."
          );
        }

        if (cancelled) {
          return;
        }

        if (result.paid) {
          setSuccess(
            "Payment confirmed successfully."
          );

          await loadInvoices(
            false,
            false
          );

          window.history.replaceState(
            {},
            "",
            "/my-invoices"
          );
        } else {
          setSuccess("");
          setError(
            "Stripe has not confirmed this payment yet. Please refresh in a moment."
          );
        }
      } catch (verifyError) {
        if (cancelled) {
          return;
        }

        setSuccess("");
        setError(
          verifyError instanceof Error
            ? verifyError.message
            : "Could not verify the Stripe payment."
        );
      }
    }

    void verifyStripeReturn();

    return () => {
      cancelled = true;
    };
  }, [loadInvoices, supabase]);

  /*
    When the customer returns from Stripe using the browser Back button,
    Chrome may restore this page from its back-forward cache.
    Reset the loading button and refresh the invoice data.
  */
  useEffect(() => {
    function restoreInvoicePage() {
      setPayingInvoiceId(null);
      void loadInvoices(false, false);
    }

    window.addEventListener(
      "pageshow",
      restoreInvoicePage
    );

    return () => {
      window.removeEventListener(
        "pageshow",
        restoreInvoicePage
      );
    };
  }, [loadInvoices]);

  useEffect(() => {
    function resetPrintState() {
      setPrintingInvoiceId(null);
    }

    window.addEventListener(
      "afterprint",
      resetPrintState
    );

    return () => {
      window.removeEventListener(
        "afterprint",
        resetPrintState
      );
    };
  }, []);

  function printInvoice(invoiceId: string) {
    setPrintingInvoiceId(invoiceId);

    window.setTimeout(() => {
      window.print();
    }, 100);
  }

  async function payInvoice(invoice: CustomerInvoice) {
    if (invoice.status !== "sent") {
      setError("Only sent invoices can be paid.");
      return;
    }

    setPayingInvoiceId(invoice.id);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Your login session has expired. Please sign in again."
        );
      }

      const response = await fetch(
        "/api/stripe/create-checkout-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            invoiceId: invoice.id,
          }),
        }
      );

      const result = (await response.json()) as {
        url?: string;
        error?: string;
        alreadyPaid?: boolean;
        synced?: boolean;
      };

      if (
        response.ok &&
        result.alreadyPaid
      ) {
        setPayingInvoiceId(null);
        setError("");
        setSuccess(
          "Payment confirmed successfully."
        );

        await loadInvoices(
          false,
          false
        );

        return;
      }

      if (!response.ok || !result.url) {
        throw new Error(
          result.error ??
            "Could not open Stripe Checkout."
        );
      }

      setPayingInvoiceId(null);
      window.location.assign(result.url);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Could not open Stripe Checkout."
      );
      setPayingInvoiceId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border p-8">
          <p className="text-gray-600">
            Loading your invoices...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          header {
            display: none !important;
          }

          .invoice-print-hide {
            display: none !important;
          }

          .invoice-print-card {
            border: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        <div className="invoice-print-hide flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-950">
              My Invoices
            </h1>

            <p className="text-gray-600 mt-2">
              View invoices sent by your
              contractors.
            </p>
          </div>

          <Link
            href="/sent-requests"
            className="bg-black text-white px-6 py-3 rounded-xl text-center font-semibold hover:bg-gray-800"
          >
            Back to Sent Requests
          </Link>
        </div>

        {error && (
          <div className="invoice-print-hide bg-red-100 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="invoice-print-hide bg-green-100 border border-green-200 text-green-800 p-4 rounded-xl mb-6">
            ✅ {success}
          </div>
        )}

        {invoices.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm border p-10 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-3xl">
              🧾
            </div>

            <h2 className="text-2xl font-bold mt-5">
              No Invoices Yet
            </h2>

            <p className="text-gray-600 mt-3">
              Contractor invoices will appear
              here after they are sent.
            </p>

            <Link
              href="/sent-requests"
              className="inline-block mt-6 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700"
            >
              View Sent Requests
            </Link>
          </section>
        ) : (
          <div className="space-y-8">
            {invoices.map((invoice) => {
              const dueState =
                getDueState(invoice);

              const hideDuringPrint =
                printingInvoiceId &&
                printingInvoiceId !==
                  invoice.id;

              const isPaying =
                payingInvoiceId === invoice.id;

              const refundedAmount =
                Number(
                  invoice.refunded_amount ??
                    0
                );

              const disputeStatus =
                invoice.dispute_status ??
                "none";

              const disputeAmount =
                Number(
                  invoice.dispute_amount ??
                    0
                );

              const disputeState =
                getCustomerDisputeState(
                  disputeStatus
                );

              const paymentLabel =
                getCustomerInvoiceLabel(
                  invoice
                );

              return (
                <article
                  id={`invoice-${invoice.id}`}
                  key={invoice.id}
                  className={`${
                    hideDuringPrint
                      ? "print:hidden"
                      : ""
                  } invoice-print-card bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden`}
                >
                  <div className="bg-gray-950 text-white px-6 py-7 md:px-10 md:py-9">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-white text-gray-950 flex items-center justify-center font-black text-xl">
                          CP
                        </div>

                        <div>
                          <p className="text-sm uppercase tracking-[0.25em] text-gray-300">
                            Contractor Platform
                          </p>

                          <h2 className="text-3xl font-bold mt-1">
                            Invoice
                          </h2>
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-gray-300 text-sm">
                          Invoice Number
                        </p>

                        <p className="text-2xl font-bold mt-1">
                          {invoice.invoice_number}
                        </p>

                        <span
                          className={`inline-flex mt-3 px-4 py-2 rounded-full text-sm font-bold ${customerInvoiceStatusClasses(
                            invoice
                          )}`}
                        >
                          {invoice.status ===
                          "paid"
                            ? paymentLabel
                            : formatInvoiceStatus(
                                invoice.status
                              )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 md:p-10">
                    <section className="grid md:grid-cols-2 gap-8 pb-8 border-b">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                          From
                        </p>

                        <div className="flex items-center gap-4 mt-4">
                          {invoice.contractor
                            ?.avatar_url ? (
                            <img
                              src={
                                invoice.contractor
                                  .avatar_url
                              }
                              alt={
                                invoice.contractor
                                  .full_name
                              }
                              className="w-16 h-16 rounded-full object-cover border"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gray-100 border flex items-center justify-center font-bold text-gray-600">
                              {getInitials(
                                invoice.contractor
                                  ?.full_name ??
                                  "Contractor"
                              )}
                            </div>
                          )}

                          <div>
                            <p className="text-xl font-bold text-gray-950">
                              {invoice.contractor
                                ?.full_name ??
                                "Contractor"}
                            </p>

                            {invoice.contractor
                              ?.company_name && (
                              <p className="text-gray-600 mt-1">
                                {
                                  invoice
                                    .contractor
                                    .company_name
                                }
                              </p>
                            )}

                            {invoice.contractor
                              ?.trade && (
                              <p className="text-gray-500 text-sm mt-1">
                                {
                                  invoice
                                    .contractor
                                    .trade
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                          Project
                        </p>

                        <p className="text-xl font-bold text-gray-950 mt-4">
                          {invoice.request
                            ?.project_type ??
                            "Project unavailable"}
                        </p>

                        <p className="text-gray-600 mt-2">
                          {invoice.request
                            ?.project_location ??
                            "Location not provided"}
                        </p>

                        <Link
                          href="/sent-requests"
                          className="invoice-print-hide inline-flex mt-4 text-blue-600 font-semibold hover:underline"
                        >
                          View project request →
                        </Link>
                      </div>
                    </section>

                    <section className="grid sm:grid-cols-3 gap-4 py-8 border-b">
                      <InvoiceMeta
                        label="Invoice Date"
                        value={
                          invoice.sent_at
                            ? formatDateOnlyFromDateTime(
                                invoice.sent_at
                              )
                            : formatDateOnlyFromDateTime(
                                invoice.created_at
                              )
                        }
                      />

                      <InvoiceMeta
                        label="Due Date"
                        value={formatDateOnly(
                          invoice.due_date
                        )}
                      />

                      <InvoiceMeta
                        label="Amount Due"
                        value={
                          invoice.status === "paid"
                            ? formatCurrency(0)
                            : formatCurrency(
                                invoice.amount
                              )
                        }
                        strong
                      />
                    </section>

                    {invoice.status === "sent" && (
                      <div
                        className={`mt-8 border p-4 rounded-xl ${dueState.classes}`}
                      >
                        <p className="font-bold">
                          {dueState.label}
                        </p>

                        <p className="mt-1 text-sm">
                          {dueState.message}
                        </p>
                      </div>
                    )}

                    <section className="mt-8">
                      <h3 className="text-lg font-bold text-gray-950">
                        Invoice Details
                      </h3>

                      <div className="mt-4 border rounded-xl overflow-hidden">
                        <div className="hidden sm:grid sm:grid-cols-[1fr_100px_160px] bg-gray-50 border-b px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                          <span>Description</span>
                          <span className="text-center">
                            Qty
                          </span>
                          <span className="text-right">
                            Amount
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-[1fr_100px_160px] gap-4 px-5 py-5 items-start">
                          <div>
                            <p className="font-semibold text-gray-950">
                              {invoice.request
                                ?.project_type ??
                                "Project work"}
                            </p>

                            <p className="text-gray-600 whitespace-pre-wrap leading-7 mt-2">
                              {invoice.description}
                            </p>
                          </div>

                          <div className="sm:text-center">
                            <span className="sm:hidden text-sm font-semibold text-gray-500 mr-2">
                              Qty:
                            </span>
                            1
                          </div>

                          <div className="sm:text-right font-bold text-gray-950">
                            <span className="sm:hidden text-sm font-semibold text-gray-500 mr-2">
                              Amount:
                            </span>
                            {formatCurrency(
                              invoice.amount
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="flex justify-end mt-8">
                      <div className="w-full sm:w-96 bg-gray-50 border rounded-xl p-5">
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Subtotal</span>
                          <span>
                            {formatCurrency(
                              invoice.amount
                            )}
                          </span>
                        </div>

                        <div className="border-t mt-4 pt-4 flex items-end justify-between gap-4">
                          <span className="font-bold text-gray-950">
                            Total
                          </span>

                          <span className="text-3xl font-black text-gray-950">
                            {formatCurrency(
                              invoice.amount
                            )}
                          </span>
                        </div>

                        {invoice.status === "paid" && (
                          <div className="border-t mt-4 pt-4 flex items-center justify-between text-green-700 font-bold">
                            <span>Balance Due</span>
                            <span>
                              {formatCurrency(0)}
                            </span>
                          </div>
                        )}

                        {refundedAmount > 0 && (
                          <div className="border-t mt-4 pt-4 flex items-center justify-between text-purple-700 font-bold">
                            <span>
                              Refunded to You
                            </span>
                            <span>
                              {formatCurrency(
                                refundedAmount
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </section>

                    {invoice.status === "paid" &&
                      disputeState && (
                        <section
                          className={`mt-8 border rounded-xl p-5 ${disputeState.classes}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">
                              {disputeState.icon}
                            </span>

                            <div className="min-w-0">
                              <h3 className="font-bold text-lg">
                                {disputeState.title}
                              </h3>

                              <p className="mt-1">
                                {disputeState.message}
                              </p>

                              <div className="mt-3 space-y-1 text-sm">
                                <p>
                                  <strong>Status:</strong>{" "}
                                  {formatStripeState(
                                    disputeStatus
                                  )}
                                </p>

                                {Number.isFinite(
                                  disputeAmount
                                ) &&
                                  disputeAmount > 0 && (
                                    <p>
                                      <strong>Disputed Amount:</strong>{" "}
                                      {formatCurrency(
                                        disputeAmount
                                      )}
                                    </p>
                                  )}

                                {invoice.dispute_reason && (
                                  <p>
                                    <strong>Reason:</strong>{" "}
                                    {formatStripeState(
                                      invoice.dispute_reason
                                    )}
                                  </p>
                                )}

                                {invoice.dispute_updated_at && (
                                  <p>
                                    <strong>Last Updated:</strong>{" "}
                                    {formatDateTime(
                                      invoice.dispute_updated_at
                                    )}
                                  </p>
                                )}
                              </div>

                              {disputeState.active && (
                                <p className="mt-3 text-sm">
                                  Stripe is reviewing this payment dispute. The invoice will continue to show the latest dispute status here as Stripe updates it.
                                </p>
                              )}
                            </div>
                          </div>
                        </section>
                      )}

                    {invoice.status === "paid" ? (
                      invoice.refund_status ===
                      "full" ? (
                        <section className="mt-8 bg-purple-50 border border-purple-200 rounded-xl p-5">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">
                              ↩
                            </span>

                            <div>
                              <h3 className="font-bold text-purple-900 text-lg">
                                Payment Refunded
                              </h3>

                              <p className="text-purple-800 mt-1">
                                {formatCurrency(
                                  refundedAmount
                                )}{" "}
                                has been refunded to you through Stripe.
                              </p>

                              {invoice.stripe_latest_refund_id && (
                                <p className="text-purple-800 mt-2">
                                  <strong>
                                    Refund Reference:
                                  </strong>{" "}
                                  {
                                    invoice.stripe_latest_refund_id
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </section>
                      ) : invoice.refund_status ===
                        "partial" ? (
                        <section className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">
                              ↩
                            </span>

                            <div>
                              <h3 className="font-bold text-amber-900 text-lg">
                                Partially Refunded
                              </h3>

                              <p className="text-amber-800 mt-1">
                                {formatCurrency(
                                  refundedAmount
                                )}{" "}
                                of this payment has been refunded to you through Stripe.
                              </p>

                              {invoice.stripe_latest_refund_id && (
                                <p className="text-amber-800 mt-2">
                                  <strong>
                                    Latest Refund Reference:
                                  </strong>{" "}
                                  {
                                    invoice.stripe_latest_refund_id
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </section>
                      ) : invoice.refund_status ===
                        "pending" ? (
                        <section className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">
                              ⏳
                            </span>

                            <div>
                              <h3 className="font-bold text-amber-900 text-lg">
                                Refund Processing
                              </h3>

                              <p className="text-amber-800 mt-1">
                                A refund has been initiated in Stripe and is still processing.
                              </p>
                            </div>
                          </div>
                        </section>
                      ) : invoice.refund_status ===
                        "failed" ? (
                        <section className="mt-8 bg-red-50 border border-red-200 rounded-xl p-5">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">
                              ❌
                            </span>

                            <div>
                              <h3 className="font-bold text-red-900 text-lg">
                                Refund Failed
                              </h3>

                              <p className="text-red-800 mt-1">
                                Stripe could not complete the latest refund attempt. Please contact the contractor if you still expect a refund.
                              </p>
                            </div>
                          </div>
                        </section>
                      ) : disputeState?.active ? (
                        <section className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">
                              ⚠
                            </span>

                            <div>
                              <h3 className="font-bold text-amber-900 text-lg">
                                Payment Received — Under Dispute
                              </h3>

                              <p className="text-amber-800 mt-1">
                                Your payment was received successfully, but it is currently under Stripe dispute review.
                              </p>

                              {invoice.payment_reference && (
                                <p className="text-amber-800 mt-2">
                                  <strong>
                                    Payment Reference:
                                  </strong>{" "}
                                  {
                                    invoice.payment_reference
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </section>
                      ) : disputeStatus === "lost" ? (
                        <section className="mt-8 bg-green-50 border border-green-200 rounded-xl p-5">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">
                              ✅
                            </span>

                            <div>
                              <h3 className="font-bold text-green-900 text-lg">
                                Dispute Resolved in Your Favour
                              </h3>

                              <p className="text-green-800 mt-1">
                                The dispute is closed and the disputed amount remains with you through the chargeback process.
                              </p>

                              {invoice.payment_reference && (
                                <p className="text-green-800 mt-2">
                                  <strong>
                                    Payment Reference:
                                  </strong>{" "}
                                  {
                                    invoice.payment_reference
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </section>
                      ) : disputeStatus === "won" ? (
                        <section className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">
                              ℹ
                            </span>

                            <div>
                              <h3 className="font-bold text-gray-900 text-lg">
                                Dispute Resolved
                              </h3>

                              <p className="text-gray-700 mt-1">
                                Stripe closed the dispute in the contractor's favour and restored the payment.
                              </p>
                            </div>
                          </div>
                        </section>
                      ) : (
                        <section className="mt-8 bg-green-50 border border-green-200 rounded-xl p-5">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">
                              ✅
                            </span>

                            <div>
                              <h3 className="font-bold text-green-800 text-lg">
                                Payment Complete
                              </h3>

                              <p className="text-green-700 mt-1">
                                This invoice has been paid
                                {invoice.paid_at
                                  ? ` on ${formatDateTime(
                                      invoice.paid_at
                                    )}`
                                  : ""}
                                .
                              </p>

                              {invoice.payment_reference && (
                                <p className="text-green-700 mt-2">
                                  <strong>
                                    Payment Reference:
                                  </strong>{" "}
                                  {
                                    invoice.payment_reference
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </section>
                      )
                    ) : (
                      <section className="invoice-print-hide mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-blue-900 text-lg">
                              Payment Pending
                            </h3>

                            <p className="text-blue-800 mt-1">
                              You will be redirected to Stripe's
                              secure test checkout. No real money
                              will be charged.
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={isPaying}
                            onClick={() =>
                              payInvoice(invoice)
                            }
                            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {isPaying
                              ? "Opening Secure Checkout..."
                              : `Pay ${formatCurrency(
                                  invoice.amount
                                )} by Card`}
                          </button>
                        </div>
                      </section>
                    )}

                    <div className="invoice-print-hide flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-8 pt-6 border-t">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                          href={`/messages/${invoice.request_id}`}
                          className="bg-purple-600 text-white px-5 py-3 rounded-xl text-center font-semibold hover:bg-purple-700"
                        >
                          Message Contractor
                        </Link>

                        <Link
                          href="/sent-requests"
                          className="border border-gray-300 px-5 py-3 rounded-xl text-center font-semibold hover:bg-gray-50"
                        >
                          View Project Request
                        </Link>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          printInvoice(invoice.id)
                        }
                        className="border border-gray-300 px-5 py-3 rounded-xl font-semibold hover:bg-gray-50"
                      >
                        Print / Save PDF
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function InvoiceMeta({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="bg-gray-50 border rounded-xl p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
        {label}
      </p>

      <p
        className={`mt-2 break-words ${
          strong
            ? "text-xl font-black text-gray-950"
            : "font-semibold text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

function getDueState(
  invoice: CustomerInvoice
): DueState {
  if (invoice.status === "paid") {
    return {
      label: "Paid",
      message:
        "This invoice has already been paid.",
      classes:
        "bg-green-50 border-green-200 text-green-800",
    };
  }

  const dueDate = parseDateOnly(
    invoice.due_date
  );

  if (!dueDate) {
    return {
      label: "Due date unavailable",
      message:
        "Please contact the contractor for the invoice due date.",
      classes:
        "bg-gray-50 border-gray-200 text-gray-700",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const differenceInDays = Math.ceil(
    (dueDate.getTime() - today.getTime()) /
      86_400_000
  );

  if (differenceInDays < 0) {
    const overdueDays = Math.abs(
      differenceInDays
    );

    return {
      label: "Invoice Overdue",
      message: `This invoice was due ${overdueDays} ${
        overdueDays === 1 ? "day" : "days"
      } ago.`,
      classes:
        "bg-red-50 border-red-200 text-red-800",
    };
  }

  if (differenceInDays === 0) {
    return {
      label: "Due Today",
      message:
        "This invoice is due today.",
      classes:
        "bg-amber-50 border-amber-200 text-amber-800",
    };
  }

  if (differenceInDays <= 3) {
    return {
      label: "Due Soon",
      message: `This invoice is due in ${differenceInDays} ${
        differenceInDays === 1
          ? "day"
          : "days"
      }.`,
      classes:
        "bg-amber-50 border-amber-200 text-amber-800",
    };
  }

  return {
    label: "Payment Due",
    message: `Payment is due on ${formatDateOnly(
      invoice.due_date
    )}.`,
    classes:
      "bg-blue-50 border-blue-200 text-blue-800",
  };
}

function parseDateOnly(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatCurrency(
  value: string | number
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function formatDateOnly(value: string) {
  const date = parseDateOnly(value);

  if (!date) {
    return value || "Not provided";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateOnlyFromDateTime(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatInvoiceStatus(
  status: InvoiceStatus
) {
  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function formatStripeState(
  value: string
) {
  return value
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function hasActiveDispute(
  status: string | null
) {
  return ![
    null,
    "",
    "none",
    "won",
    "lost",
    "prevented",
    "warning_closed",
  ].includes(status);
}

function getCustomerDisputeState(
  status: string | null
) {
  if (!status || status === "none") {
    return null;
  }

  if (hasActiveDispute(status)) {
    return {
      active: true,
      icon: "⚠",
      title: "Payment Dispute Active",
      message:
        "A dispute is currently open for this Stripe payment.",
      classes:
        "bg-red-50 border-red-200 text-red-900",
    };
  }

  if (status === "won") {
    return {
      active: false,
      icon: "✅",
      title: "Payment Dispute Resolved",
      message:
        "Stripe has closed this dispute with a won outcome for the payment.",
      classes:
        "bg-green-50 border-green-200 text-green-900",
    };
  }

  if (status === "lost") {
    return {
      active: false,
      icon: "⚠",
      title: "Payment Dispute Resolved",
      message:
        "Stripe has closed this dispute with a lost outcome for the payment.",
      classes:
        "bg-red-50 border-red-200 text-red-900",
    };
  }

  if (status === "prevented") {
    return {
      active: false,
      icon: "✅",
      title: "Payment Dispute Prevented",
      message:
        "Stripe marked this dispute as prevented.",
      classes:
        "bg-green-50 border-green-200 text-green-900",
    };
  }

  return {
    active: false,
    icon: "ℹ",
    title: "Payment Dispute Closed",
    message:
      "Stripe has closed this dispute.",
    classes:
      "bg-gray-50 border-gray-200 text-gray-800",
  };
}

function getCustomerInvoiceLabel(
  invoice: InvoiceRow
) {
  if (
    hasActiveDispute(
      invoice.dispute_status
    )
  ) {
    return "Disputed";
  }

  if (invoice.dispute_status === "lost") {
    return "Dispute Resolved";
  }

  if (invoice.dispute_status === "won") {
    return "Dispute Resolved";
  }

  if (invoice.dispute_status === "prevented") {
    return "Dispute Prevented";
  }

  if (
    invoice.dispute_status ===
    "warning_closed"
  ) {
    return "Dispute Closed";
  }

  if (
    invoice.refund_status ===
    "full"
  ) {
    return "Refunded";
  }

  if (
    invoice.refund_status ===
    "partial"
  ) {
    return "Partially Refunded";
  }

  if (
    invoice.refund_status ===
    "pending"
  ) {
    return "Refund Processing";
  }

  if (
    invoice.refund_status ===
    "failed"
  ) {
    return "Refund Failed";
  }

  return formatInvoiceStatus(
    invoice.status
  );
}

function customerInvoiceStatusClasses(
  invoice: InvoiceRow
) {
  if (
    hasActiveDispute(
      invoice.dispute_status
    )
  ) {
    return "bg-red-100 text-red-800";
  }

  if (invoice.dispute_status === "lost") {
    return "bg-green-100 text-green-800";
  }

  if (invoice.dispute_status === "won") {
    return "bg-gray-100 text-gray-800";
  }

  if (invoice.dispute_status === "prevented") {
    return "bg-green-100 text-green-800";
  }

  if (
    invoice.dispute_status ===
    "warning_closed"
  ) {
    return "bg-gray-100 text-gray-800";
  }

  if (invoice.refund_status === "full") {
    return "bg-purple-100 text-purple-800";
  }

  if (
    invoice.refund_status === "partial" ||
    invoice.refund_status === "pending"
  ) {
    return "bg-amber-100 text-amber-800";
  }

  if (invoice.refund_status === "failed") {
    return "bg-red-100 text-red-800";
  }

  return invoiceStatusClasses(
    invoice.status
  );
}

function invoiceStatusClasses(
  status: InvoiceStatus
) {
  if (status === "paid") {
    return "bg-green-100 text-green-800";
  }

  if (status === "sent") {
    return "bg-blue-100 text-blue-800";
  }

  if (status === "cancelled") {
    return "bg-red-100 text-red-800";
  }

  return "bg-gray-100 text-gray-800";
}