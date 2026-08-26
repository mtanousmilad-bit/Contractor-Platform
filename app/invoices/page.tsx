"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProjectStatus =
  | "not_started"
  | "in_progress"
  | "completed";

type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "cancelled";

type ContactRequestRow = {
  id: string;
  sender_name: string;
  project_type: string;
  project_location: string;
  project_status: ProjectStatus;
  created_at: string;
};

type ProjectQuoteRow = {
  id: string;
  request_id: string;
  price: string | number;
  scope_of_work: string;
  estimated_duration_days: number;
  status: "accepted";
  responded_at: string | null;
};

type ProjectInvoiceRow = {
  id: string;
  invoice_number: string;
  request_id: string;
  amount: string | number;
  description: string;
  due_date: string;
  status: InvoiceStatus;
  sent_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  platform_fee_percent: string | number | null;
  platform_fee_amount: string | number | null;
  contractor_net_amount: string | number | null;
  refund_status: string | null;
  refunded_amount: string | number | null;
  stripe_latest_refund_id: string | null;
  dispute_status: string | null;
  dispute_amount: string | number | null;
  dispute_reason: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceProject = {
  request: ContactRequestRow;
  quote: ProjectQuoteRow;
  invoice: ProjectInvoiceRow | null;
};

export default function InvoicesPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [userId, setUserId] =
    useState<string | null>(null);

  const [projects, setProjects] =
    useState<InvoiceProject[]>([]);

  const [dueDates, setDueDates] =
    useState<Record<string, string>>({});

  const [descriptions, setDescriptions] =
    useState<Record<string, string>>({});

  const [loading, setLoading] =
    useState(true);

  const [sendingId, setSendingId] =
    useState<string | null>(null);

  const [
    refundModalInvoiceId,
    setRefundModalInvoiceId,
  ] = useState<string | null>(null);

  const [
    refundingId,
    setRefundingId,
  ] = useState<string | null>(null);

  const [
    refundAmount,
    setRefundAmount,
  ] = useState("");

  const [
    refundReason,
    setRefundReason,
  ] = useState<
    | "requested_by_customer"
    | "duplicate"
    | "other"
  >("requested_by_customer");

  const [error, setError] = useState("");
  const [success, setSuccess] =
    useState("");

  const loadInvoices = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
      }

      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
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
        "contractor"
      ) {
        router.replace("/sent-requests");
        return;
      }

      const {
        data: requestData,
        error: requestError,
      } = await supabase
        .from("contact_requests")
        .select(`
          id,
          sender_name,
          project_type,
          project_location,
          project_status,
          created_at
        `)
        .eq("contractor_id", user.id)
        .eq("status", "accepted")
        .order("created_at", {
          ascending: false,
        });

      if (requestError) {
        setError(requestError.message);
        setProjects([]);
        setLoading(false);
        return;
      }

      const requests = (
        requestData ?? []
      ).map((request) => ({
        ...request,
        project_status:
          request.project_status ??
          "not_started",
      })) as ContactRequestRow[];

      if (requests.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const requestIds = requests.map(
        (request) => request.id
      );

      const [quoteResult, invoiceResult] =
        await Promise.all([
          supabase
            .from("project_quotes")
            .select(`
              id,
              request_id,
              price,
              scope_of_work,
              estimated_duration_days,
              status,
              responded_at
            `)
            .eq("contractor_id", user.id)
            .eq("status", "accepted")
            .in("request_id", requestIds),

          supabase
            .from("project_invoices")
            .select(`
              id,
              invoice_number,
              request_id,
              amount,
              description,
              due_date,
              status,
              sent_at,
              paid_at,
              payment_reference,
              platform_fee_percent,
              platform_fee_amount,
              contractor_net_amount,
              refund_status,
              refunded_amount,
              stripe_latest_refund_id,
              dispute_status,
              dispute_amount,
              dispute_reason,
              created_at,
              updated_at
            `)
            .eq("contractor_id", user.id)
            .in("request_id", requestIds),
        ]);

      if (quoteResult.error) {
        setError(quoteResult.error.message);
        setProjects([]);
        setLoading(false);
        return;
      }

      if (invoiceResult.error) {
        setError(invoiceResult.error.message);
        setProjects([]);
        setLoading(false);
        return;
      }

      const quotes = (
        quoteResult.data ?? []
      ) as ProjectQuoteRow[];

      const invoices = (
        invoiceResult.data ?? []
      ) as ProjectInvoiceRow[];

      const combinedProjects = requests
        .map((request) => {
          const quote = quotes.find(
            (item) =>
              item.request_id === request.id
          );

          if (!quote) {
            return null;
          }

          const invoice =
            invoices.find(
              (item) =>
                item.request_id === request.id
            ) ?? null;

          return {
            request,
            quote,
            invoice,
          };
        })
        .filter(
          (
            project
          ): project is InvoiceProject =>
            project !== null
        );

      setProjects(combinedProjects);

      setDueDates((currentDates) => {
        const updatedDates = {
          ...currentDates,
        };

        for (const project of combinedProjects) {
          if (!updatedDates[project.request.id]) {
            updatedDates[project.request.id] =
              project.invoice?.due_date ??
              getDefaultDueDate();
          }
        }

        return updatedDates;
      });

      setDescriptions(
        (currentDescriptions) => {
          const updatedDescriptions = {
            ...currentDescriptions,
          };

          for (const project of combinedProjects) {
            if (
              updatedDescriptions[
                project.request.id
              ] === undefined
            ) {
              updatedDescriptions[
                project.request.id
              ] =
                project.invoice
                  ?.description ??
                project.quote.scope_of_work;
            }
          }

          return updatedDescriptions;
        }
      );

      setLoading(false);
    },
    [router, supabase]
  );

  useEffect(() => {
    void loadInvoices(true);
  }, [loadInvoices]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(
        `contractor-invoices-${userId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_invoices",
          filter: `contractor_id=eq.${userId}`,
        },
        () => {
          window.setTimeout(() => {
            void loadInvoices(false);
          }, 150);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_quotes",
          filter: `contractor_id=eq.${userId}`,
        },
        () => {
          window.setTimeout(() => {
            void loadInvoices(false);
          }, 150);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadInvoices, supabase, userId]);

  useEffect(() => {
    if (!refundModalInvoiceId) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape" &&
        !refundingId
      ) {
        closeRefundModal();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    refundModalInvoiceId,
    refundingId,
  ]);

  async function sendInvoice(
    requestId: string,
    existingInvoice: ProjectInvoiceRow | null
  ) {
    const dueDate = dueDates[requestId];
    const description =
      descriptions[requestId]?.trim() ?? "";

    if (!dueDate) {
      setError(
        "Please choose an invoice due date."
      );
      return;
    }

    if (dueDate < getTodayDate()) {
      setError(
        "Invoice due date cannot be in the past."
      );
      return;
    }

    setSendingId(requestId);
    setError("");
    setSuccess("");

    try {
      const { error: invoiceError } =
        await supabase.rpc(
          "send_project_invoice",
          {
            p_request_id: requestId,
            p_due_date: dueDate,
            p_description:
              description || null,
          }
        );

      if (invoiceError) {
        throw new Error(
          invoiceError.message
        );
      }

      await loadInvoices(false);

      setSuccess(
        existingInvoice
          ? "Invoice updated and resent successfully."
          : "Invoice sent successfully."
      );
    } catch (invoiceError) {
      setError(
        invoiceError instanceof Error
          ? invoiceError.message
          : "Could not send the invoice."
      );
    } finally {
      setSendingId(null);
    }
  }

  function openRefundModal(
    invoice: ProjectInvoiceRow
  ) {
    const total =
      Number(invoice.amount);

    const refunded =
      Number(
        invoice.refunded_amount ??
          0
      );

    const remaining =
      Math.max(
        0,
        Math.round(
          (total - refunded) *
            100
        ) / 100
      );

    setRefundModalInvoiceId(
      invoice.id
    );

    setRefundAmount(
      remaining.toFixed(2)
    );

    setRefundReason(
      "requested_by_customer"
    );

    setError("");
    setSuccess("");
  }

  function closeRefundModal() {
    if (refundingId) {
      return;
    }

    setRefundModalInvoiceId(
      null
    );

    setRefundAmount("");
    setRefundReason(
      "requested_by_customer"
    );
  }

  async function issueRefund(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!refundModalInvoiceId) {
      return;
    }

    const selectedProject =
      projects.find(
        (project) =>
          project.invoice?.id ===
          refundModalInvoiceId
      );

    const invoice =
      selectedProject?.invoice;

    if (!invoice) {
      setError(
        "Invoice could not be found."
      );
      return;
    }

    const amount =
      Number(refundAmount);

    const total =
      Number(invoice.amount);

    const alreadyRefunded =
      Number(
        invoice.refunded_amount ??
          0
      );

    const remaining =
      Math.max(
        0,
        Math.round(
          (total -
            alreadyRefunded) *
            100
        ) / 100
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Enter a valid refund amount."
      );
      return;
    }

    if (
      Math.round(amount * 100) >
      Math.round(remaining * 100)
    ) {
      setError(
        `Maximum refundable amount is ${formatCurrency(
          remaining
        )}.`
      );
      return;
    }

    setRefundingId(invoice.id);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth
          .getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Your login session has expired. Please sign in again."
        );
      }

      const response =
        await fetch(
          "/api/stripe/refund-invoice",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              invoiceId:
                invoice.id,
              amount,
              reason:
                refundReason,
            }),
          }
        );

      const result =
        (await response.json()) as {
          refunded?: boolean;
          refundId?: string;
          stripeStatus?: string;
          refundStatus?: string;
          refundedAmount?: number;
          remainingRefundableAmount?:
            number;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Could not create the refund."
        );
      }

      await loadInvoices(false);

      setRefundModalInvoiceId(
        null
      );

      setRefundAmount("");

      setSuccess(
        result.stripeStatus ===
          "pending"
          ? `Refund of ${formatCurrency(
              amount
            )} was created and is pending in Stripe.`
          : `Refund of ${formatCurrency(
              amount
            )} was created successfully.`
      );
    } catch (refundError) {
      setError(
        refundError instanceof Error
          ? refundError.message
          : "Could not create the refund."
      );
    } finally {
      setRefundingId(null);
    }
  }

  const refundModalProject =
    refundModalInvoiceId
      ? projects.find(
          (project) =>
            project.invoice?.id ===
            refundModalInvoiceId
        ) ?? null
      : null;

  const refundModalInvoice =
    refundModalProject?.invoice ??
    null;

  const refundModalTotal =
    Number(
      refundModalInvoice?.amount ??
        0
    );

  const refundModalAlreadyRefunded =
    Number(
      refundModalInvoice
        ?.refunded_amount ??
        0
    );

  const refundModalRemaining =
    Math.max(
      0,
      Math.round(
        (refundModalTotal -
          refundModalAlreadyRefunded) *
          100
      ) / 100
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow p-8">
          <p className="text-gray-600">
            Loading invoices...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">
              Project Invoices
            </h1>

            <p className="text-gray-600 mt-2">
              Send invoices for customer-approved
              quotes.
            </p>
          </div>

          <Link
            href="/requests"
            className="bg-black text-white px-6 py-3 rounded-lg text-center hover:bg-gray-800"
          >
            Back to My Requests
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-6">
            ✅ {success}
          </div>
        )}

        {projects.length === 0 ? (
          <section className="bg-white rounded-xl shadow p-10 text-center">
            <h2 className="text-2xl font-bold">
              No Invoice-Ready Projects
            </h2>

            <p className="text-gray-600 mt-3">
              A project will appear here after the
              customer accepts your quote.
            </p>

            <Link
              href="/requests"
              className="inline-block mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              View My Requests
            </Link>
          </section>
        ) : (
          <div className="space-y-6">
            {projects.map((project) => {
              const requestId =
                project.request.id;

              const isSending =
                sendingId === requestId;

              const invoiceIsPaid =
                project.invoice?.status ===
                "paid";

              const invoiceAmount =
                Number(
                  project.invoice?.amount ??
                    project.quote.price
                );

              const storedFeePercent =
                Number(
                  project.invoice
                    ?.platform_fee_percent
                );

              const feePercent =
                Number.isFinite(
                  storedFeePercent
                ) &&
                storedFeePercent > 0
                  ? storedFeePercent
                  : 5;

              const storedFeeAmount =
                Number(
                  project.invoice
                    ?.platform_fee_amount
                );

              const platformFeeAmount =
                Number.isFinite(
                  storedFeeAmount
                ) &&
                storedFeeAmount >= 0
                  ? storedFeeAmount
                  : Number.isFinite(
                        invoiceAmount
                      )
                    ? Math.round(
                        invoiceAmount *
                          (feePercent / 100) *
                          100
                      ) / 100
                    : 0;

              const storedNetAmount =
                Number(
                  project.invoice
                    ?.contractor_net_amount
                );

              const contractorNetAmount =
                Number.isFinite(
                  storedNetAmount
                ) &&
                storedNetAmount >= 0
                  ? storedNetAmount
                  : Number.isFinite(
                        invoiceAmount
                      )
                    ? Math.round(
                        (invoiceAmount -
                          platformFeeAmount) *
                          100
                      ) / 100
                    : 0;

              const refundedAmount =
                Number(
                  project.invoice
                    ?.refunded_amount ??
                    0
                );

              const remainingRefundableAmount =
                Math.max(
                  0,
                  Math.round(
                    (invoiceAmount -
                      refundedAmount) *
                      100
                  ) / 100
                );

              const refundStatus =
                project.invoice
                  ?.refund_status ??
                "none";

              const disputeStatus =
                project.invoice
                  ?.dispute_status ??
                "none";

              const activeDispute =
                hasActiveDispute(
                  disputeStatus
                );

              const disputeLost =
                disputeStatus === "lost";

              const disputeWon =
                disputeStatus === "won";

              const invoicePaymentLabel =
                project.invoice
                  ? getInvoicePaymentLabel(
                      project.invoice
                    )
                  : "Not Sent";

              return (
                <article
                  key={requestId}
                  className="bg-white rounded-xl shadow p-6 md:p-8"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {
                          project.request
                            .project_type
                        }
                      </h2>

                      <p className="text-gray-700 mt-2">
                        <strong>Customer:</strong>{" "}
                        {
                          project.request
                            .sender_name
                        }
                      </p>

                      <p className="text-gray-600 mt-1">
                        <strong>Location:</strong>{" "}
                        {
                          project.request
                            .project_location
                        }
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-semibold">
                        Quote Accepted
                      </span>

                      <span className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full font-semibold">
                        {formatProjectStatus(
                          project.request
                            .project_status
                        )}
                      </span>
                    </div>
                  </div>

                  <section className="grid md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-gray-50 border rounded-lg p-5">
                      <p className="text-sm text-gray-500">
                        Invoice Amount
                      </p>

                      <p className="text-2xl font-bold mt-1">
                        {formatCurrency(
                          project.quote.price
                        )}
                      </p>
                    </div>

                    <div className="bg-gray-50 border rounded-lg p-5">
                      <p className="text-sm text-gray-500">
                        Estimated Duration
                      </p>

                      <p className="text-xl font-bold mt-1">
                        {
                          project.quote
                            .estimated_duration_days
                        }{" "}
                        {project.quote
                          .estimated_duration_days ===
                        1
                          ? "day"
                          : "days"}
                      </p>
                    </div>

                    <div className="bg-gray-50 border rounded-lg p-5">
                      <p className="text-sm text-gray-500">
                        Current Invoice
                      </p>

                      <p className="text-xl font-bold mt-1">
                        {project.invoice
                          ? project.invoice
                              .invoice_number
                          : "Not sent"}
                      </p>
                    </div>
                  </section>

                  {project.invoice && (
                    <section className="mt-6 border rounded-xl p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-lg">
                            {
                              project.invoice
                                .invoice_number
                            }
                          </h3>

                          <p className="text-gray-500 mt-1">
                            Due{" "}
                            {formatDateOnly(
                              project.invoice
                                .due_date
                            )}
                          </p>
                        </div>

                        <span
                          className={`self-start px-4 py-2 rounded-full font-semibold ${invoicePaymentStatusClasses(
                            project.invoice
                          )}`}
                        >
                          {project.invoice.status ===
                          "paid"
                            ? invoicePaymentLabel
                            : formatInvoiceStatus(
                                project.invoice
                                  .status
                              )}
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3 mt-5 text-gray-700">
                        <p>
                          <strong>Amount:</strong>{" "}
                          {formatCurrency(
                            project.invoice.amount
                          )}
                        </p>

                        <p>
                          <strong>Sent:</strong>{" "}
                          {project.invoice.sent_at
                            ? formatDateTime(
                                project.invoice
                                  .sent_at
                              )
                            : "Not sent"}
                        </p>

                        {project.invoice.paid_at && (
                          <p>
                            <strong>Paid:</strong>{" "}
                            {formatDateTime(
                              project.invoice
                                .paid_at
                            )}
                          </p>
                        )}

                        {project.invoice
                          .payment_reference && (
                          <p>
                            <strong>
                              Payment Reference:
                            </strong>{" "}
                            {
                              project.invoice
                                .payment_reference
                            }
                          </p>
                        )}
                      </div>
                    </section>
                  )}

                  {project.invoice && (
                    <section className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-950 text-white px-5 py-4">
                        <h3 className="font-bold text-lg">
                          Payment Breakdown
                        </h3>

                        <p className="text-gray-300 text-sm mt-1">
                          Your earnings after the Contractor Platform service fee.
                        </p>
                      </div>

                      <div className="p-5">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="bg-gray-50 border rounded-lg p-4">
                            <p className="text-sm text-gray-500">
                              Invoice Total
                            </p>

                            <p className="text-xl font-bold mt-1 text-gray-950">
                              {formatCurrency(
                                project.invoice.amount
                              )}
                            </p>
                          </div>

                          <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                            <p className="text-sm text-red-700">
                              Platform Fee
                            </p>

                            <p className="text-xl font-bold mt-1 text-red-800">
                              -{" "}
                              {formatCurrency(
                                platformFeeAmount
                              )}
                            </p>

                            <p className="text-xs text-red-600 mt-1">
                              {formatPercentage(
                                feePercent
                              )} service fee
                            </p>
                          </div>

                          <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                            <p className="text-sm text-green-700">
                              Your Net Amount
                            </p>

                            <p className="text-xl font-bold mt-1 text-green-800">
                              {formatCurrency(
                                contractorNetAmount
                              )}
                            </p>

                            <p className="text-xs text-green-700 mt-1">
                              Amount allocated to your Stripe account
                            </p>
                          </div>

                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                            <p className="text-sm text-amber-700">
                              Refunded
                            </p>

                            <p className="text-xl font-bold mt-1 text-amber-900">
                              {formatCurrency(
                                refundedAmount
                              )}
                            </p>

                            <p className="text-xs text-amber-700 mt-1">
                              Returned to customer
                            </p>
                          </div>

                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                            <p className="text-sm text-blue-700">
                              Payment Status
                            </p>

                            <p className="text-xl font-bold mt-1 text-blue-900">
                              {invoicePaymentLabel}
                            </p>

                            <p className="text-xs text-blue-700 mt-1">
                              {activeDispute
                                ? "Stripe dispute requires attention"
                                : disputeLost
                                  ? "Chargeback resolved against this payment"
                                  : disputeWon
                                    ? "Dispute resolved in your favour"
                                    : refundStatus ===
                                        "full"
                                      ? "Customer fully refunded"
                                      : refundStatus ===
                                          "partial"
                                        ? "Customer partially refunded"
                                        : refundStatus ===
                                            "pending"
                                          ? "Refund is processing"
                                          : invoiceIsPaid
                                            ? "Payment confirmed by Stripe"
                                            : "Waiting for customer payment"}
                            </p>
                          </div>
                        </div>

                        {!invoiceIsPaid && (
                          <p className="text-sm text-gray-500 mt-4">
                            The fee and net amount shown above are based on the current{" "}
                            {formatPercentage(
                              feePercent
                            )} platform fee. Final payment values are confirmed by Stripe when the customer pays.
                          </p>
                        )}
                      </div>
                    </section>
                  )}

                  {invoiceIsPaid ? (
                    <section className="mt-6 space-y-4">
                      {activeDispute && (
                        <div className="bg-red-50 border border-red-200 text-red-800 p-5 rounded-xl">
                          <p className="font-bold text-lg">
                            ⚠ Stripe Dispute Active
                          </p>

                          <p className="mt-1">
                            Status:{" "}
                            {formatStripeState(
                              disputeStatus
                            )}
                            {project.invoice
                              ?.dispute_amount !=
                            null
                              ? ` · ${formatCurrency(
                                  project.invoice
                                    .dispute_amount
                                )}`
                              : ""}
                          </p>

                          {project.invoice
                            ?.dispute_reason && (
                            <p className="mt-1 text-sm">
                              Reason:{" "}
                              {formatStripeState(
                                project.invoice
                                  .dispute_reason
                              )}
                            </p>
                          )}

                          <p className="mt-3 text-sm">
                            Refunds are blocked while this dispute is active.
                          </p>
                        </div>
                      )}

                      {disputeLost && (
                        <div className="bg-red-50 border border-red-200 text-red-900 p-5 rounded-xl">
                          <p className="font-bold text-lg">
                            ⚠ Stripe Dispute Lost
                          </p>

                          <p className="mt-1">
                            The cardholder kept the disputed amount
                            {project.invoice?.dispute_amount != null
                              ? ` (${formatCurrency(
                                  project.invoice.dispute_amount
                                )})`
                              : ""}
                            .
                          </p>

                          <p className="mt-3 text-sm">
                            No additional refund can be issued for this payment because the disputed funds have already been returned through the chargeback process.
                          </p>
                        </div>
                      )}

                      {disputeWon && (
                        <div className="bg-green-50 border border-green-200 text-green-900 p-5 rounded-xl">
                          <p className="font-bold text-lg">
                            ✅ Stripe Dispute Won
                          </p>

                          <p className="mt-1">
                            Stripe closed the dispute in your favour and the disputed amount was restored.
                          </p>
                        </div>
                      )}

                      {refundStatus ===
                      "full" ? (
                        <div className="bg-purple-50 border border-purple-200 text-purple-900 p-5 rounded-xl">
                          <p className="font-bold text-lg">
                            ↩ Fully Refunded
                          </p>

                          <p className="mt-1">
                            {formatCurrency(
                              refundedAmount
                            )}{" "}
                            has been returned to the customer.
                          </p>
                        </div>
                      ) : refundStatus ===
                        "partial" ? (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-5 rounded-xl">
                          <p className="font-bold text-lg">
                            ↩ Partially Refunded
                          </p>

                          <p className="mt-1">
                            Refunded:{" "}
                            {formatCurrency(
                              refundedAmount
                            )}{" "}
                            · Remaining refundable:{" "}
                            {formatCurrency(
                              remainingRefundableAmount
                            )}
                          </p>
                        </div>
                      ) : refundStatus ===
                        "pending" ? (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-5 rounded-xl">
                          <p className="font-bold text-lg">
                            ⏳ Refund Processing
                          </p>

                          <p className="mt-1">
                            Stripe is processing a refund for this payment.
                          </p>
                        </div>
                      ) : refundStatus ===
                        "failed" ? (
                        <div className="bg-red-50 border border-red-200 text-red-800 p-5 rounded-xl">
                          <p className="font-bold text-lg">
                            ❌ Refund Failed
                          </p>

                          <p className="mt-1">
                            The last refund attempt failed. The payment remains recorded as paid.
                          </p>
                        </div>
                      ) : activeDispute ? (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-5 rounded-xl">
                          <p className="font-bold text-lg">
                            ⚠ Payment Received — Under Dispute
                          </p>

                          <p className="mt-1">
                            This payment was received successfully, but it is currently under Stripe dispute review.
                          </p>
                        </div>
                      ) : disputeLost || disputeWon ? (
                        null
                      ) : (
                        <div className="bg-green-50 border border-green-200 text-green-800 p-5 rounded-xl">
                          ✅ This invoice has been paid and
                          can no longer be changed.
                        </div>
                      )}

                      {remainingRefundableAmount >
                        0 &&
                        !activeDispute &&
                        !disputeLost &&
                        refundStatus !==
                          "pending" && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                project.invoice &&
                                openRefundModal(
                                  project.invoice
                                )
                              }
                              className="bg-gray-950 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800"
                            >
                              Refund Customer
                            </button>
                          </div>
                        )}
                    </section>
                  ) : (
                    <section className="mt-6 border border-blue-200 bg-blue-50 rounded-xl p-5">
                      <h3 className="font-bold text-lg">
                        {project.invoice
                          ? "Update & Resend Invoice"
                          : "Send Invoice"}
                      </h3>

                      <p className="text-gray-600 mt-1">
                        The amount is locked to the
                        customer-approved quote.
                      </p>

                      <div className="grid md:grid-cols-2 gap-5 mt-5">
                        <div>
                          <label
                            htmlFor={`due-date-${requestId}`}
                            className="block font-semibold mb-2"
                          >
                            Due Date
                          </label>

                          <input
                            id={`due-date-${requestId}`}
                            type="date"
                            min={getTodayDate()}
                            value={
                              dueDates[
                                requestId
                              ] ?? ""
                            }
                            onChange={(event) =>
                              setDueDates(
                                (currentDates) => ({
                                  ...currentDates,
                                  [requestId]:
                                    event.target
                                      .value,
                                })
                              )
                            }
                            className="w-full border rounded-lg px-4 py-3 bg-white"
                          />
                        </div>

                        <div>
                          <p className="block font-semibold mb-2">
                            Amount
                          </p>

                          <div className="w-full border rounded-lg px-4 py-3 bg-gray-100 font-bold">
                            {formatCurrency(
                              project.quote.price
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5">
                        <label
                          htmlFor={`description-${requestId}`}
                          className="block font-semibold mb-2"
                        >
                          Invoice Description
                        </label>

                        <textarea
                          id={`description-${requestId}`}
                          rows={5}
                          value={
                            descriptions[
                              requestId
                            ] ?? ""
                          }
                          onChange={(event) =>
                            setDescriptions(
                              (
                                currentDescriptions
                              ) => ({
                                ...currentDescriptions,
                                [requestId]:
                                  event.target
                                    .value,
                              })
                            )
                          }
                          placeholder="Describe the work covered by this invoice..."
                          className="w-full border rounded-lg px-4 py-3 bg-white resize-y"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isSending}
                        onClick={() =>
                          sendInvoice(
                            requestId,
                            project.invoice
                          )
                        }
                        className="mt-5 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {isSending
                          ? "Sending Invoice..."
                          : project.invoice
                            ? "Update & Resend Invoice"
                            : "Send Invoice"}
                      </button>
                    </section>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {refundModalInvoice && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget &&
              !refundingId
            ) {
              closeRefundModal();
            }
          }}
          className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-modal-title"
            className="w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="bg-gray-950 text-white px-5 py-4 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                    Stripe Refund
                  </p>

                  <h2
                    id="refund-modal-title"
                    className="text-xl font-bold mt-0.5"
                  >
                    Refund Customer
                  </h2>
                </div>

                <button
                  type="button"
                  disabled={Boolean(
                    refundingId
                  )}
                  onClick={
                    closeRefundModal
                  }
                  aria-label="Close refund window"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-lg"
                >
                  ×
                </button>
              </div>
            </div>

            <form
              onSubmit={issueRefund}
              className="p-5 overflow-y-auto"
            >
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 border rounded-xl p-3.5">
                  <p className="text-sm text-gray-500">
                    Invoice
                  </p>

                  <p className="font-bold mt-1">
                    {
                      refundModalInvoice
                        .invoice_number
                    }
                  </p>
                </div>

                <div className="bg-gray-50 border rounded-xl p-3.5">
                  <p className="text-sm text-gray-500">
                    Customer
                  </p>

                  <p className="font-bold mt-1">
                    {
                      refundModalProject
                        ?.request
                        .sender_name
                    }
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 mt-4">
                <div className="flex justify-between gap-4">
                  <span className="text-blue-800">
                    Original Payment
                  </span>

                  <strong className="text-blue-950">
                    {formatCurrency(
                      refundModalTotal
                    )}
                  </strong>
                </div>

                <div className="flex justify-between gap-4 mt-2">
                  <span className="text-blue-800">
                    Already Refunded
                  </span>

                  <strong className="text-blue-950">
                    {formatCurrency(
                      refundModalAlreadyRefunded
                    )}
                  </strong>
                </div>

                <div className="border-t border-blue-200 mt-3 pt-3 flex justify-between gap-4">
                  <span className="font-bold text-blue-900">
                    Maximum Refund
                  </span>

                  <strong className="text-blue-950 text-lg">
                    {formatCurrency(
                      refundModalRemaining
                    )}
                  </strong>
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="refund-amount"
                  className="block font-bold mb-1.5"
                >
                  Refund Amount (AUD)
                </label>

                <div className="flex gap-2">
                  <input
                    id="refund-amount"
                    type="number"
                    min="0.01"
                    max={
                      refundModalRemaining
                    }
                    step="0.01"
                    required
                    disabled={Boolean(
                      refundingId
                    )}
                    value={refundAmount}
                    onChange={(event) =>
                      setRefundAmount(
                        event.target.value
                      )
                    }
                    className="flex-1 min-w-0 border rounded-xl px-3.5 py-2.5"
                  />

                  <button
                    type="button"
                    disabled={Boolean(
                      refundingId
                    )}
                    onClick={() =>
                      setRefundAmount(
                        refundModalRemaining.toFixed(
                          2
                        )
                      )
                    }
                    className="border border-gray-300 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50"
                  >
                    Full
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="refund-reason"
                  className="block font-bold mb-1.5"
                >
                  Reason
                </label>

                <select
                  id="refund-reason"
                  disabled={Boolean(
                    refundingId
                  )}
                  value={refundReason}
                  onChange={(event) =>
                    setRefundReason(
                      event.target.value as
                        | "requested_by_customer"
                        | "duplicate"
                        | "other"
                    )
                  }
                  className="w-full border rounded-xl px-3.5 py-2.5 bg-white"
                >
                  <option value="requested_by_customer">
                    Customer requested refund
                  </option>

                  <option value="duplicate">
                    Duplicate payment
                  </option>

                  <option value="other">
                    Other / goodwill refund
                  </option>
                </select>
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 mt-4 text-sm leading-5">
                <strong>
                  Important:
                </strong>{" "}
                This sends real refund instructions to Stripe. The customer receives the refund, the contractor transfer is reversed proportionally, and the related platform fee is also refunded proportionally.
              </div>

              <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t bg-white px-5 py-4">
                <button
                  type="button"
                  disabled={Boolean(
                    refundingId
                  )}
                  onClick={
                    closeRefundModal
                  }
                  className="px-5 py-2.5 rounded-xl border border-gray-300 font-bold hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={Boolean(
                    refundingId
                  )}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:bg-gray-400"
                >
                  {refundingId
                    ? "Creating Refund..."
                    : `Refund ${formatCurrency(
                        Number(
                          refundAmount ||
                            0
                        )
                      )}`}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");
  const day = String(now.getDate()).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}

function getDefaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(date.getDate()).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
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

function formatPercentage(
  value: string | number
) {
  const percentage = Number(value);

  if (!Number.isFinite(percentage)) {
    return `${value}%`;
  }

  return `${new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 2,
  }).format(percentage)}%`;
}

function formatDateOnly(value: string) {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return value;
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

function formatProjectStatus(
  status: ProjectStatus
) {
  if (status === "in_progress") {
    return "In Progress";
  }

  if (status === "completed") {
    return "Completed";
  }

  return "Not Started";
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

function getInvoicePaymentLabel(
  invoice: ProjectInvoiceRow
) {
  if (
    hasActiveDispute(
      invoice.dispute_status
    )
  ) {
    return "Disputed";
  }

  if (invoice.dispute_status === "lost") {
    return "Dispute Lost";
  }

  if (invoice.dispute_status === "won") {
    return "Dispute Won";
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

function invoicePaymentStatusClasses(
  invoice: ProjectInvoiceRow
) {
  if (
    hasActiveDispute(
      invoice.dispute_status
    ) ||
    invoice.dispute_status === "lost"
  ) {
    return "bg-red-100 text-red-800";
  }

  if (
    invoice.dispute_status === "won" ||
    invoice.dispute_status === "prevented"
  ) {
    return "bg-green-100 text-green-800";
  }

  if (
    invoice.dispute_status ===
    "warning_closed"
  ) {
    return "bg-gray-100 text-gray-800";
  }

  return invoiceStatusClasses(
    invoice.status
  );
}

function invoiceStatusClasses(
  status: InvoiceStatus
) {
  if (status === "paid") {
    return "bg-green-100 text-green-700";
  }

  if (status === "sent") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-gray-100 text-gray-700";
}