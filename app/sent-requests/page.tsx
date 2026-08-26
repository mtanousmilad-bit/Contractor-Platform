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

type RequestStatus =
  | "new"
  | "read"
  | "accepted"
  | "declined";

type ProjectStatus =
  | "not_started"
  | "in_progress"
  | "completed";

type QuoteStatus =
  | "pending"
  | "accepted"
  | "declined";

type RequestFilter =
  | "all"
  | "new"
  | "read"
  | "accepted"
  | "in_progress"
  | "completed"
  | "declined";

const filterOptions: {
  label: string;
  value: RequestFilter;
}[] = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Read", value: "read" },
  { label: "Accepted", value: "accepted" },
  {
    label: "In Progress",
    value: "in_progress",
  },
  {
    label: "Completed",
    value: "completed",
  },
  {
    label: "Declined",
    value: "declined",
  },
];

type ContractorProfile = {
  id: string;
  full_name: string;
  company_name: string | null;
  trade: string;
  location: string;
  avatar_url: string | null;
};

type ReviewRow = {
  request_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

type ProjectQuote = {
  id: string;
  request_id: string;
  contractor_id: string;
  customer_id: string;
  price: string | number;
  scope_of_work: string;
  estimated_duration_days: number;
  status: QuoteStatus;
  sent_at: string;
  responded_at: string | null;
  updated_at: string;
};

type ContactRequestRow = {
  id: string;
  contractor_id: string;
  project_type: string;
  project_location: string;
  estimated_budget: string | null;
  preferred_start: string | null;
  message: string;
  status: RequestStatus;
  project_status: ProjectStatus;
  project_started_at: string | null;
  project_completed_at: string | null;
  completion_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SentRequest = ContactRequestRow & {
  contractor: ContractorProfile | null;
  review: ReviewRow | null;
  quote: ProjectQuote | null;
};

export default function SentRequestsPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [userId, setUserId] =
    useState<string | null>(null);

  const [requests, setRequests] =
    useState<SentRequest[]>([]);

  const [
    selectedFilter,
    setSelectedFilter,
  ] = useState<RequestFilter>("all");

  const [loading, setLoading] =
    useState(true);

  const [cancellingId, setCancellingId] =
    useState<string | null>(null);

  const [confirmingId, setConfirmingId] =
    useState<string | null>(null);

  const [
    respondingQuoteRequestId,
    setRespondingQuoteRequestId,
  ] = useState<string | null>(null);

  const [
    reviewRequestId,
    setReviewRequestId,
  ] = useState<string | null>(null);

  const [reviewRating, setReviewRating] =
    useState(5);

  const [reviewComment, setReviewComment] =
    useState("");

  const [submittingReview, setSubmittingReview] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] =
    useState("");

  const loadSentRequests = useCallback(
    async (
      showLoader = false,
      markNotificationsSeen = false
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
        router.replace("/auth");
        return;
      }

      setUserId(user.id);
if (markNotificationsSeen) {
  const [
    requestSeenResult,
    quoteSeenResult,
  ] = await Promise.all([
    supabase.rpc(
      "mark_customer_notifications_seen"
    ),

    supabase.rpc(
      "mark_customer_quotes_seen"
    ),
  ]);

  if (requestSeenResult.error) {
    console.error(
      "Could not mark request notifications as seen:",
      requestSeenResult.error.message
    );
  }

  if (quoteSeenResult.error) {
    console.error(
      "Could not mark quote notifications as seen:",
      quoteSeenResult.error.message
    );
  }

  window.dispatchEvent(
    new Event(
      "customer-notifications-seen"
    )
  );

  window.dispatchEvent(
    new Event(
      "customer-quotes-seen"
    )
  );
}

      const {
        data: requestData,
        error: requestError,
      } = await supabase
        .from("contact_requests")
        .select(`
          id,
          contractor_id,
          project_type,
          project_location,
          estimated_budget,
          preferred_start,
          message,
          status,
          project_status,
          project_started_at,
          project_completed_at,
          completion_confirmed_at,
          created_at,
          updated_at
        `)
        .eq("sender_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (requestError) {
        setError(requestError.message);
        setRequests([]);
        setLoading(false);
        return;
      }

      const requestRows = (
        requestData ?? []
      ).map((request) => ({
        ...request,

        project_status:
          request.project_status ??
          "not_started",

        project_started_at:
          request.project_started_at ??
          null,

        project_completed_at:
          request.project_completed_at ??
          null,

        completion_confirmed_at:
          request.completion_confirmed_at ??
          null,
      })) as ContactRequestRow[];

      if (requestRows.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const requestIds = requestRows.map(
        (request) => request.id
      );

      const contractorIds = [
        ...new Set(
          requestRows.map(
            (request) =>
              request.contractor_id
          )
        ),
      ];

      const [
        contractorResult,
        reviewResult,
        quoteResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(`
            id,
            full_name,
            company_name,
            trade,
            location,
            avatar_url
          `)
          .in("id", contractorIds),

        supabase
          .from("reviews")
          .select(`
            request_id,
            rating,
            comment,
            created_at
          `)
          .in("request_id", requestIds),

        supabase
          .from("project_quotes")
          .select(`
            id,
            request_id,
            contractor_id,
            customer_id,
            price,
            scope_of_work,
            estimated_duration_days,
            status,
            sent_at,
            responded_at,
            updated_at
          `)
          .in("request_id", requestIds),
      ]);

      if (contractorResult.error) {
        console.error(
          "Could not load contractor profiles:",
          contractorResult.error.message
        );
      }

      if (reviewResult.error) {
        console.error(
          "Could not load reviews:",
          reviewResult.error.message
        );
      }

      if (quoteResult.error) {
        console.error(
          "Could not load project quotes:",
          quoteResult.error.message
        );
      }

      const contractors =
        (contractorResult.data ??
          []) as ContractorProfile[];

      const reviews =
        (reviewResult.data ??
          []) as ReviewRow[];

      const quotes =
        (quoteResult.data ??
          []) as ProjectQuote[];

      const combinedRequests: SentRequest[] =
        requestRows.map((request) => ({
          ...request,

          contractor:
            contractors.find(
              (contractor) =>
                contractor.id ===
                request.contractor_id
            ) ?? null,

          review:
            reviews.find(
              (review) =>
                review.request_id ===
                request.id
            ) ?? null,

          quote:
            quotes.find(
              (quote) =>
                quote.request_id ===
                request.id
            ) ?? null,
        }));

      setRequests(combinedRequests);
      setLoading(false);
    },
    [router, supabase]
  );

  useEffect(() => {
    void loadSentRequests(true, true);
  }, [loadSentRequests]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(
        `customer-project-progress-${userId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_requests",
          filter: `sender_id=eq.${userId}`,
        },
        () => {
          window.setTimeout(() => {
            void loadSentRequests(
              false,
              false
            );
          }, 150);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_quotes",
          filter: `customer_id=eq.${userId}`,
        },
        () => {
          window.setTimeout(() => {
            void loadSentRequests(
              false,
              false
            );
          }, 150);
        }
      )
      .subscribe(
        (status, channelError) => {
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          ) {
            console.error(
              "Sent requests realtime error:",
              channelError
            );
          }
        }
      );

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [
    loadSentRequests,
    supabase,
    userId,
  ]);

  async function cancelRequest(
    requestId: string
  ) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this request?"
    );

    if (!confirmed) {
      return;
    }

    setCancellingId(requestId);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth");
        return;
      }

      const {
        data: deletedRequest,
        error: deleteError,
      } = await supabase
        .from("contact_requests")
        .delete()
        .eq("id", requestId)
        .eq("sender_id", user.id)
        .in("status", ["new", "read"])
        .select("id")
        .maybeSingle();

      if (deleteError) {
        throw new Error(
          deleteError.message
        );
      }

      if (!deletedRequest) {
        throw new Error(
          "This request could not be cancelled. It may already be accepted or declined."
        );
      }

      setRequests((currentRequests) =>
        currentRequests.filter(
          (request) =>
            request.id !== requestId
        )
      );

      setSuccess(
        "Request cancelled successfully."
      );
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Could not cancel this request."
      );
    } finally {
      setCancellingId(null);
    }
  }

  async function respondToQuote(
    requestId: string,
    decision: "accepted" | "declined"
  ) {
    const actionLabel =
      decision === "accepted"
        ? "accept"
        : "decline";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} this quote?`
    );

    if (!confirmed) {
      return;
    }

    setRespondingQuoteRequestId(
      requestId
    );
    setError("");
    setSuccess("");

    try {
      const { error: responseError } =
        await supabase.rpc(
          "respond_to_project_quote",
          {
            p_request_id: requestId,
            p_decision: decision,
          }
        );

      if (responseError) {
        throw new Error(
          responseError.message
        );
      }

      await loadSentRequests(
        false,
        false
      );

      setSuccess(
        decision === "accepted"
          ? "Quote accepted successfully. The contractor can now start the project."
          : "Quote declined. The contractor can update and resend it."
      );
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : "Could not respond to this quote."
      );
    } finally {
      setRespondingQuoteRequestId(
        null
      );
    }
  }

  async function confirmCompletion(
    requestId: string
  ) {
    const confirmed = window.confirm(
      "Confirm that this project has been completed?"
    );

    if (!confirmed) {
      return;
    }

    setConfirmingId(requestId);
    setError("");
    setSuccess("");

    try {
      const { error: confirmError } =
        await supabase.rpc(
          "confirm_project_completion",
          {
            p_request_id: requestId,
          }
        );

      if (confirmError) {
        throw new Error(
          confirmError.message
        );
      }

      await loadSentRequests(
        false,
        false
      );

      setSuccess(
        "Project completion confirmed. You can now leave a review."
      );
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Could not confirm project completion."
      );
    } finally {
      setConfirmingId(null);
    }
  }

  function openReviewForm(
    requestId: string
  ) {
    setReviewRequestId(requestId);
    setReviewRating(5);
    setReviewComment("");
    setError("");
    setSuccess("");
  }

  function closeReviewForm() {
    setReviewRequestId(null);
    setReviewRating(5);
    setReviewComment("");
  }

  async function submitReview(
    event: FormEvent<HTMLFormElement>,
    requestId: string
  ) {
    event.preventDefault();

    if (
      reviewRating < 1 ||
      reviewRating > 5
    ) {
      setError(
        "Please select a rating between 1 and 5 stars."
      );
      return;
    }

    if (reviewComment.length > 1000) {
      setError(
        "Review comment must be 1000 characters or less."
      );
      return;
    }

    setSubmittingReview(true);
    setError("");
    setSuccess("");

    try {
      const { error: reviewError } =
        await supabase.rpc(
          "submit_project_review",
          {
            p_request_id: requestId,
            p_rating: reviewRating,
            p_comment: reviewComment,
          }
        );

      if (reviewError) {
        throw new Error(
          reviewError.message
        );
      }

      await loadSentRequests(
        false,
        false
      );

      closeReviewForm();

      setSuccess(
        "Thank you. Your review was submitted successfully."
      );
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Could not submit your review."
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  function formatStatus(
    status: string
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

  function getDisplayStatus(
    request: SentRequest
  ) {
    if (
      request.status === "accepted" &&
      request.project_status ===
        "in_progress"
    ) {
      return "In Progress";
    }

    if (
      request.status === "accepted" &&
      request.project_status ===
        "completed"
    ) {
      return "Completed";
    }

    return formatStatus(
      request.status
    );
  }

  function getDisplayStatusClasses(
    request: SentRequest
  ) {
    if (
      request.status === "accepted" &&
      request.project_status ===
        "in_progress"
    ) {
      return "bg-purple-100 text-purple-700";
    }

    if (
      request.status === "accepted" &&
      request.project_status ===
        "completed"
    ) {
      return "bg-green-100 text-green-700";
    }

    if (request.status === "new") {
      return "bg-blue-100 text-blue-700";
    }

    if (request.status === "read") {
      return "bg-gray-200 text-gray-700";
    }

    if (
      request.status === "accepted"
    ) {
      return "bg-amber-100 text-amber-700";
    }

    return "bg-red-100 text-red-700";
  }

  function quoteStatusClasses(
    status: QuoteStatus
  ) {
    if (status === "pending") {
      return "bg-yellow-100 text-yellow-800";
    }

    if (status === "accepted") {
      return "bg-green-100 text-green-700";
    }

    return "bg-red-100 text-red-700";
  }

  function formatCurrency(
    value: string | number
  ) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return String(value);
    }

    return new Intl.NumberFormat(
      "en-AU",
      {
        style: "currency",
        currency: "AUD",
      }
    ).format(amount);
  }

  function projectProgressClasses(
    status: ProjectStatus
  ) {
    if (status === "in_progress") {
      return "bg-purple-100 text-purple-700";
    }

    if (status === "completed") {
      return "bg-green-100 text-green-700";
    }

    return "bg-amber-100 text-amber-700";
  }

  function projectProgressMessage(
    status: ProjectStatus
  ) {
    if (status === "in_progress") {
      return "The contractor has started work on your project.";
    }

    if (status === "completed") {
      return "The contractor has marked this project as completed.";
    }

    return "Your request has been accepted and the project is waiting to begin.";
  }

  function requestStatusMessage(
    request: SentRequest
  ) {
    if (request.status === "new") {
      return "Your request has been sent and is waiting for the contractor.";
    }

    if (request.status === "read") {
      return "The contractor has viewed your request.";
    }

    if (
      request.status === "accepted" &&
      request.project_status ===
        "in_progress"
    ) {
      return "Work on your project is currently in progress.";
    }

    if (
      request.status === "accepted" &&
      request.project_status ===
        "completed" &&
      request.completion_confirmed_at
    ) {
      return "You confirmed that this project has been completed.";
    }

    if (
      request.status === "accepted" &&
      request.project_status ===
        "completed"
    ) {
      return "The contractor marked this project as completed. Please confirm completion.";
    }

    if (
      request.status === "accepted" &&
      request.quote?.status === "pending"
    ) {
      return "The contractor sent you a quote. Review the price and scope below.";
    }

    if (
      request.status === "accepted" &&
      request.quote?.status === "accepted"
    ) {
      return "You accepted the quote. The contractor can now start the project.";
    }

    if (
      request.status === "accepted" &&
      request.quote?.status === "declined"
    ) {
      return "You declined the quote. The contractor can update and resend it.";
    }

    if (
      request.status === "accepted"
    ) {
      return "The contractor accepted your request. Waiting for a project quote.";
    }

    return "The contractor declined your request.";
  }

  function formatDate(date: string) {
    const parsedDate = new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return "Date unavailable";
    }

    return new Intl.DateTimeFormat(
      "en-AU",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(parsedDate);
  }

  function matchesFilter(
    request: SentRequest,
    filter: RequestFilter
  ) {
    if (filter === "all") {
      return true;
    }

    if (filter === "in_progress") {
      return (
        request.status === "accepted" &&
        request.project_status ===
          "in_progress"
      );
    }

    if (filter === "completed") {
      return (
        request.status === "accepted" &&
        request.project_status ===
          "completed"
      );
    }

    if (filter === "accepted") {
      return (
        request.status === "accepted" &&
        request.project_status ===
          "not_started"
      );
    }

    return request.status === filter;
  }

  function getFilterCount(
    filter: RequestFilter
  ) {
    return requests.filter((request) =>
      matchesFilter(request, filter)
    ).length;
  }

  const filteredRequests =
    requests.filter((request) =>
      matchesFilter(
        request,
        selectedFilter
      )
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-8">
          <p className="text-gray-600">
            Loading your sent requests...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">
              My Sent Requests
            </h1>

            <p className="text-gray-600 mt-2">
              Track requests, project progress
              and reviews.
            </p>
          </div>

          <Link
            href="/contractors"
            className="bg-black text-white px-6 py-3 rounded-lg text-center hover:bg-gray-800"
          >
            Find Contractors
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

        {requests.length > 0 && (
          <section className="bg-white rounded-xl shadow p-4 mb-6">
            <div className="flex flex-wrap gap-3">
              {filterOptions.map(
                (option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedFilter(
                        option.value
                      );
                      setError("");
                      setSuccess("");
                    }}
                    className={`px-5 py-2 rounded-lg font-medium transition ${
                      selectedFilter ===
                      option.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {option.label} (
                    {getFilterCount(
                      option.value
                    )}
                    )
                  </button>
                )
              )}
            </div>
          </section>
        )}

        {requests.length === 0 ? (
          <section className="bg-white rounded-xl shadow p-10 text-center">
            <h2 className="text-2xl font-bold">
              No Sent Requests
            </h2>

            <p className="text-gray-600 mt-3">
              You have not contacted any
              contractors yet.
            </p>

            <Link
              href="/contractors"
              className="inline-block mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Browse Contractors
            </Link>
          </section>
        ) : filteredRequests.length === 0 ? (
          <section className="bg-white rounded-xl shadow p-10 text-center">
            <h2 className="text-2xl font-bold">
              No Matching Requests
            </h2>

            <p className="text-gray-600 mt-3">
              There are no requests matching
              this filter.
            </p>

            <button
              type="button"
              onClick={() =>
                setSelectedFilter("all")
              }
              className="mt-6 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
            >
              View All Requests
            </button>
          </section>
        ) : (
          <div className="space-y-6">
            {filteredRequests.map(
              (request) => {
                const isCancelling =
                  cancellingId === request.id;

                const isConfirming =
                  confirmingId === request.id;

                const isRespondingToQuote =
                  respondingQuoteRequestId ===
                  request.id;

                const canCancel =
                  request.status === "new" ||
                  request.status === "read";

                const canConfirmCompletion =
                  request.status ===
                    "accepted" &&
                  request.project_status ===
                    "completed" &&
                  !request.completion_confirmed_at;

                const canLeaveReview =
                  request.status ===
                    "accepted" &&
                  request.project_status ===
                    "completed" &&
                  Boolean(
                    request.completion_confirmed_at
                  ) &&
                  !request.review;

                return (
                  <article
                    key={request.id}
                    className="bg-white rounded-xl shadow p-6 md:p-8"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                      <div className="flex items-center gap-4">
                        {request.contractor
                          ?.avatar_url ? (
                          <img
                            src={
                              request
                                .contractor
                                .avatar_url
                            }
                            alt={
                              request
                                .contractor
                                .full_name
                            }
                            className="w-20 h-20 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm text-center">
                            No Photo
                          </div>
                        )}

                        <div>
                          <h2 className="text-2xl font-bold">
                            {
                              request.project_type
                            }
                          </h2>

                          <p className="text-gray-700 mt-1">
                            Contractor:{" "}
                            {request.contractor
                              ?.full_name ??
                              "Contractor profile unavailable"}
                          </p>

                          {request.contractor
                            ?.company_name && (
                            <p className="text-gray-500">
                              {
                                request
                                  .contractor
                                  .company_name
                              }
                            </p>
                          )}

                          <p className="text-gray-500 mt-1">
                            Sent{" "}
                            {formatDate(
                              request.created_at
                            )}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-4 py-2 rounded-full font-semibold self-start ${getDisplayStatusClasses(
                          request
                        )}`}
                      >
                        {getDisplayStatus(
                          request
                        )}
                      </span>
                    </div>

                    <div
                      className={`mt-6 p-4 rounded-lg ${getDisplayStatusClasses(
                        request
                      )}`}
                    >
                      {requestStatusMessage(
                        request
                      )}
                    </div>

                    {request.status ===
                      "accepted" && (
                      <section className="mt-6 border border-blue-200 bg-blue-50 rounded-xl p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-lg">
                              Project Quote
                            </h3>

                            <p className="text-gray-600 mt-1">
                              Review the contractor&apos;s
                              price, scope of work and
                              estimated duration.
                            </p>
                          </div>

                          {request.quote && (
                            <span
                              className={`self-start px-4 py-2 rounded-full font-semibold ${quoteStatusClasses(
                                request.quote.status
                              )}`}
                            >
                              {formatStatus(
                                request.quote.status
                              )}
                            </span>
                          )}
                        </div>

                        {request.quote ? (
                          <div className="bg-white border rounded-xl p-5 mt-5">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <p>
                                <strong>
                                  Quote Price:
                                </strong>{" "}
                                {formatCurrency(
                                  request.quote.price
                                )}
                              </p>

                              <p>
                                <strong>
                                  Estimated Duration:
                                </strong>{" "}
                                {request.quote
                                  .estimated_duration_days}{" "}
                                {request.quote
                                  .estimated_duration_days ===
                                1
                                  ? "day"
                                  : "days"}
                              </p>

                              <p>
                                <strong>Sent:</strong>{" "}
                                {formatDate(
                                  request.quote.sent_at
                                )}
                              </p>

                              {request.quote
                                .responded_at && (
                                <p>
                                  <strong>
                                    Responded:
                                  </strong>{" "}
                                  {formatDate(
                                    request.quote
                                      .responded_at
                                  )}
                                </p>
                              )}
                            </div>

                            <div className="mt-5">
                              <p className="font-bold">
                                Scope of Work
                              </p>

                              <p className="text-gray-700 whitespace-pre-wrap leading-7 mt-2">
                                {request.quote
                                  .scope_of_work}
                              </p>
                            </div>

                            {request.quote.status ===
                              "pending" && (
                              <div className="mt-5">
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg">
                                  Please accept or
                                  decline this quote
                                  before work begins.
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                                  <button
                                    type="button"
                                    disabled={
                                      isRespondingToQuote
                                    }
                                    onClick={() =>
                                      respondToQuote(
                                        request.id,
                                        "accepted"
                                      )
                                    }
                                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
                                  >
                                    {isRespondingToQuote
                                      ? "Updating..."
                                      : "Accept Quote"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      isRespondingToQuote
                                    }
                                    onClick={() =>
                                      respondToQuote(
                                        request.id,
                                        "declined"
                                      )
                                    }
                                    className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400"
                                  >
                                    {isRespondingToQuote
                                      ? "Updating..."
                                      : "Decline Quote"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {request.quote.status ===
                              "accepted" && (
                              <div className="mt-5 bg-green-100 border border-green-200 text-green-700 p-4 rounded-lg">
                                ✅ You accepted this
                                quote.
                              </div>
                            )}

                            {request.quote.status ===
                              "declined" && (
                              <div className="mt-5 bg-red-100 border border-red-200 text-red-700 p-4 rounded-lg">
                                You declined this quote.
                                The contractor can update
                                and resend it.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-white border rounded-xl p-5 mt-5 text-gray-600">
                            The contractor has not sent
                            a quote yet.
                          </div>
                        )}
                      </section>
                    )}

                    {request.status ===
                      "accepted" && (
                      <section className="mt-6 border rounded-xl p-5 bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-lg">
                              Project Progress
                            </h3>

                            <p className="text-gray-600 mt-1">
                              {projectProgressMessage(
                                request.project_status
                              )}
                            </p>
                          </div>

                          <span
                            className={`self-start px-4 py-2 rounded-full font-semibold ${projectProgressClasses(
                              request.project_status
                            )}`}
                          >
                            {formatStatus(
                              request.project_status
                            )}
                          </span>
                        </div>

                        {request.project_started_at && (
                          <p className="text-sm text-gray-500 mt-4">
                            Started:{" "}
                            {formatDate(
                              request.project_started_at
                            )}
                          </p>
                        )}

                        {request.project_completed_at && (
                          <p className="text-sm text-gray-500 mt-2">
                            Completed:{" "}
                            {formatDate(
                              request.project_completed_at
                            )}
                          </p>
                        )}

                        {request.completion_confirmed_at && (
                          <div className="mt-4 bg-green-100 text-green-700 rounded-lg p-4">
                            ✅ Completion confirmed on{" "}
                            {formatDate(
                              request.completion_confirmed_at
                            )}
                          </div>
                        )}
                      </section>
                    )}

                    {request.review && (
                      <section className="mt-6 border border-yellow-200 bg-yellow-50 rounded-xl p-5">
                        <h3 className="font-bold text-lg">
                          Your Review
                        </h3>

                        <div className="flex items-center gap-3 mt-3">
                          <div className="text-2xl text-yellow-500">
                            {"★".repeat(
                              request.review.rating
                            )}
                            <span className="text-gray-300">
                              {"★".repeat(
                                5 -
                                  request.review
                                    .rating
                              )}
                            </span>
                          </div>

                          <span className="font-semibold">
                            {
                              request.review
                                .rating
                            }
                            /5
                          </span>
                        </div>

                        <p className="text-gray-700 mt-3 whitespace-pre-line">
                          {request.review.comment ||
                            "No written comment provided."}
                        </p>

                        <p className="text-sm text-gray-500 mt-3">
                          Submitted{" "}
                          {formatDate(
                            request.review
                              .created_at
                          )}
                        </p>
                      </section>
                    )}

                    {reviewRequestId ===
                      request.id &&
                      canLeaveReview && (
                        <form
                          onSubmit={(event) =>
                            submitReview(
                              event,
                              request.id
                            )
                          }
                          className="mt-6 border border-purple-200 bg-purple-50 rounded-xl p-5"
                        >
                          <h3 className="text-xl font-bold">
                            Leave a Review
                          </h3>

                          <p className="text-gray-600 mt-1">
                            Rate your experience
                            with this contractor.
                          </p>

                          <div className="mt-5">
                            <label className="block font-semibold mb-2">
                              Rating
                            </label>

                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map(
                                (star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() =>
                                      setReviewRating(
                                        star
                                      )
                                    }
                                    className={`text-4xl transition ${
                                      star <=
                                      reviewRating
                                        ? "text-yellow-500"
                                        : "text-gray-300 hover:text-yellow-300"
                                    }`}
                                    aria-label={`${star} star rating`}
                                  >
                                    ★
                                  </button>
                                )
                              )}
                            </div>

                            <p className="text-sm text-gray-600 mt-2">
                              Selected:{" "}
                              {reviewRating}/5
                            </p>
                          </div>

                          <div className="mt-5">
                            <label
                              htmlFor={`review-${request.id}`}
                              className="block font-semibold mb-2"
                            >
                              Comment
                              <span className="font-normal text-gray-500">
                                {" "}
                                (optional)
                              </span>
                            </label>

                            <textarea
                              id={`review-${request.id}`}
                              value={reviewComment}
                              onChange={(event) =>
                                setReviewComment(
                                  event.target
                                    .value
                                )
                              }
                              maxLength={1000}
                              rows={5}
                              placeholder="Tell others about your experience..."
                              className="w-full border rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />

                            <p className="text-sm text-gray-500 text-right mt-1">
                              {
                                reviewComment.length
                              }
                              /1000
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 mt-5">
                            <button
                              type="submit"
                              disabled={
                                submittingReview
                              }
                              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                            >
                              {submittingReview
                                ? "Submitting..."
                                : "Submit Review"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                submittingReview
                              }
                              onClick={
                                closeReviewForm
                              }
                              className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 disabled:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                    <div className="grid md:grid-cols-2 gap-6 mt-6">
                      <section className="bg-gray-50 border rounded-lg p-5">
                        <h3 className="font-bold text-lg mb-4">
                          Project Information
                        </h3>

                        <div className="space-y-3">
                          <p>
                            <strong>
                              Type:
                            </strong>{" "}
                            {
                              request.project_type
                            }
                          </p>

                          <p>
                            <strong>
                              Location:
                            </strong>{" "}
                            {
                              request.project_location
                            }
                          </p>

                          <p>
                            <strong>
                              Estimated Budget:
                            </strong>{" "}
                            {request.estimated_budget ||
                              "Not provided"}
                          </p>

                          <p>
                            <strong>
                              Preferred Start:
                            </strong>{" "}
                            {request.preferred_start ||
                              "Not provided"}
                          </p>
                        </div>
                      </section>

                      <section className="bg-gray-50 border rounded-lg p-5">
                        <h3 className="font-bold text-lg mb-4">
                          Contractor Information
                        </h3>

                        {request.contractor ? (
                          <div className="space-y-3">
                            <p>
                              <strong>
                                Trade:
                              </strong>{" "}
                              {
                                request
                                  .contractor
                                  .trade
                              }
                            </p>

                            <p>
                              <strong>
                                Service Area:
                              </strong>{" "}
                              {
                                request
                                  .contractor
                                  .location
                              }
                            </p>
                          </div>
                        ) : (
                          <p className="text-gray-500">
                            Contractor information
                            is unavailable.
                          </p>
                        )}
                      </section>
                    </div>

                    <section className="mt-6">
                      <h3 className="font-bold text-lg mb-3">
                        Your Project Details
                      </h3>

                      <div className="bg-gray-50 border rounded-lg p-5">
                        <p className="whitespace-pre-line text-gray-700 leading-7">
                          {request.message}
                        </p>
                      </div>
                    </section>

                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-7">
                      {canConfirmCompletion && (
                        <button
                          type="button"
                          disabled={isConfirming}
                          onClick={() =>
                            confirmCompletion(
                              request.id
                            )
                          }
                          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                        >
                          {isConfirming
                            ? "Confirming..."
                            : "Confirm Completion"}
                        </button>
                      )}

                      {canLeaveReview &&
                        reviewRequestId !==
                          request.id && (
                          <button
                            type="button"
                            onClick={() =>
                              openReviewForm(
                                request.id
                              )
                            }
                            className="bg-yellow-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-400"
                          >
                            ⭐ Leave a Review
                          </button>
                        )}

                      {request.status ===
                        "accepted" && (
                        <Link
                          href={`/messages/${request.id}`}
                          className="bg-purple-600 text-white px-6 py-3 rounded-lg text-center hover:bg-purple-700"
                        >
                          Open Chat
                        </Link>
                      )}

                      {request.contractor && (
                        <Link
                          href={`/contractors/${request.contractor_id}`}
                          className="bg-blue-600 text-white px-6 py-3 rounded-lg text-center hover:bg-blue-700"
                        >
                          View Contractor
                        </Link>
                      )}

                      <Link
                        href="/contractors"
                        className="bg-gray-200 px-6 py-3 rounded-lg text-center hover:bg-gray-300"
                      >
                        Browse More Contractors
                      </Link>

                      {canCancel && (
                        <button
                          type="button"
                          disabled={
                            isCancelling
                          }
                          onClick={() =>
                            cancelRequest(
                              request.id
                            )
                          }
                          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                        >
                          {isCancelling
                            ? "Cancelling..."
                            : "Cancel Request"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>
    </main>
  );
}