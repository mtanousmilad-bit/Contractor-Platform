"use client";

import {
  useEffect,
  useMemo,
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

type ContactRequest = {
  id: string;
  sender_id: string;
  contractor_id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;

  project_type: string;
  project_location: string;
  message: string;

  estimated_budget:
    | string
    | number
    | null;

  preferred_start: string | null;

  status: RequestStatus;
  project_status: ProjectStatus;

  project_started_at: string | null;
  project_completed_at: string | null;
  completion_confirmed_at: string | null;

  created_at: string;
  updated_at: string;
};

type ProjectQuote = {
  id: string;
  request_id: string;
  contractor_id: string;
  customer_id: string;

  price: number;
  scope_of_work: string;
  estimated_duration_days: number;

  status: QuoteStatus;

  sent_at: string;
  responded_at: string | null;
  updated_at: string;
};

type QuoteDraft = {
  price: string;
  scopeOfWork: string;
  estimatedDurationDays: string;
};

const emptyQuoteDraft: QuoteDraft = {
  price: "",
  scopeOfWork: "",
  estimatedDurationDays: "",
};

const filters: {
  value: RequestFilter;
  label: string;
}[] = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "new",
    label: "New",
  },
  {
    value: "read",
    label: "Read",
  },
  {
    value: "accepted",
    label: "Accepted",
  },
  {
    value: "in_progress",
    label: "In Progress",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "declined",
    label: "Declined",
  },
];

export default function RequestsPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [requests, setRequests] =
    useState<ContactRequest[]>([]);

  const [quotesByRequest, setQuotesByRequest] =
    useState<Record<string, ProjectQuote>>(
      {}
    );

  const [
    selectedFilter,
    setSelectedFilter,
  ] = useState<RequestFilter>("all");

  const [
    quoteFormRequestId,
    setQuoteFormRequestId,
  ] = useState<string | null>(null);

  const [quoteDrafts, setQuoteDrafts] =
    useState<Record<string, QuoteDraft>>(
      {}
    );

  const [
    busyRequestId,
    setBusyRequestId,
  ] = useState<string | null>(null);

  const [
    sendingQuoteRequestId,
    setSendingQuoteRequestId,
  ] = useState<string | null>(null);

  const [
    startModalRequestId,
    setStartModalRequestId,
  ] = useState<string | null>(null);

  const [
    completionModalRequestId,
    setCompletionModalRequestId,
  ] = useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    if (!startModalRequestId) {
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
        busyRequestId !==
          startModalRequestId
      ) {
        setStartModalRequestId(
          null
        );
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
    busyRequestId,
    startModalRequestId,
  ]);

  useEffect(() => {
    if (!completionModalRequestId) {
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
        busyRequestId !==
          completionModalRequestId
      ) {
        setCompletionModalRequestId(
          null
        );
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
    busyRequestId,
    completionModalRequestId,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (userError || !user) {
        router.replace("/auth");
        return;
      }

      const {
        data: requestData,
        error: requestError,
      } = await supabase
        .from("contact_requests")
        .select(`
          id,
          sender_id,
          contractor_id,
          sender_name,
          sender_email,
          sender_phone,
          project_type,
          project_location,
          message,
          estimated_budget,
          preferred_start,
          status,
          project_status,
          project_started_at,
          project_completed_at,
          completion_confirmed_at,
          created_at,
          updated_at
        `)
        .eq("contractor_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (!isMounted) {
        return;
      }

      if (requestError) {
        setError(requestError.message);
        setRequests([]);
        setLoading(false);
        return;
      }

      const loadedRequests =
        (requestData ??
          []) as ContactRequest[];

      setRequests(loadedRequests);

      if (loadedRequests.length > 0) {
        const requestIds =
          loadedRequests.map(
            (request) => request.id
          );

        const {
          data: quoteData,
          error: quoteError,
        } = await supabase
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
          .in("request_id", requestIds);

        if (!isMounted) {
          return;
        }

        if (quoteError) {
          console.error(
            "Could not load quotes:",
            quoteError.message
          );
        } else {
          const quoteMap: Record<
            string,
            ProjectQuote
          > = {};

          (
            (quoteData ??
              []) as ProjectQuote[]
          ).forEach((quote) => {
            quoteMap[quote.request_id] =
              quote;
          });

          setQuotesByRequest(quoteMap);
        }
      } else {
        setQuotesByRequest({});
      }

      setLoading(false);

      const realtimeChannel =
        supabase
          .channel(
            `contractor-requests-quotes-${user.id}`
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table:
                "contact_requests",
              filter:
                `contractor_id=eq.${user.id}`,
            },
            (payload) => {
              if (
                payload.eventType ===
                "DELETE"
              ) {
                const deletedRequest =
                  payload.old as {
                    id?: string;
                  };

                if (deletedRequest.id) {
                  setRequests(
                    (
                      currentRequests
                    ) =>
                      currentRequests.filter(
                        (request) =>
                          request.id !==
                          deletedRequest.id
                      )
                  );

                  setQuotesByRequest(
                    (currentQuotes) => {
                      const updatedQuotes = {
                        ...currentQuotes,
                      };

                      delete updatedQuotes[
                        deletedRequest.id!
                      ];

                      return updatedQuotes;
                    }
                  );
                }

                return;
              }

              const incomingRequest =
                payload.new as ContactRequest;

              setRequests(
                (currentRequests) => {
                  const exists =
                    currentRequests.some(
                      (request) =>
                        request.id ===
                        incomingRequest.id
                    );

                  if (exists) {
                    return currentRequests.map(
                      (request) =>
                        request.id ===
                        incomingRequest.id
                          ? incomingRequest
                          : request
                    );
                  }

                  return [
                    incomingRequest,
                    ...currentRequests,
                  ];
                }
              );
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table:
                "project_quotes",
              filter:
                `contractor_id=eq.${user.id}`,
            },
            (payload) => {
              if (
                payload.eventType ===
                "DELETE"
              ) {
                const deletedQuote =
                  payload.old as {
                    request_id?: string;
                  };

                if (
                  deletedQuote.request_id
                ) {
                setQuotesByRequest(
  (currentQuotes) => {
    const requestId =
      deletedQuote.request_id;

    if (!requestId) {
      return currentQuotes;
    }

    const updatedQuotes = {
      ...currentQuotes,
    };

    delete updatedQuotes[
      requestId
    ];

    return updatedQuotes;
  }
);
                }

                return;
              }

              const incomingQuote =
                payload.new as ProjectQuote;

              setQuotesByRequest(
                (currentQuotes) => ({
                  ...currentQuotes,
                  [incomingQuote.request_id]:
                    incomingQuote,
                })
              );
            }
          )
          .subscribe();

      return () => {
        void supabase.removeChannel(
          realtimeChannel
        );
      };
    }

    let realtimeCleanup:
      | (() => void)
      | undefined;

    void loadPage().then(
      (cleanupFunction) => {
        realtimeCleanup =
          cleanupFunction;
      }
    );

    return () => {
      isMounted = false;
      realtimeCleanup?.();
    };
  }, [router, supabase]);

  async function reloadRequest(
    requestId: string
  ) {
    const {
      data,
      error: reloadError,
    } = await supabase
      .from("contact_requests")
      .select(`
        id,
        sender_id,
        contractor_id,
        sender_name,
        sender_email,
        sender_phone,
        project_type,
        project_location,
        message,
        estimated_budget,
        preferred_start,
        status,
        project_status,
        project_started_at,
        project_completed_at,
        completion_confirmed_at,
        created_at,
        updated_at
      `)
      .eq("id", requestId)
      .maybeSingle();

    if (reloadError || !data) {
      throw new Error(
        reloadError?.message ??
          "Could not refresh the request."
      );
    }

    const updatedRequest =
      data as ContactRequest;

    setRequests(
      (currentRequests) =>
        currentRequests.map(
          (request) =>
            request.id === requestId
              ? updatedRequest
              : request
        )
    );
  }

  async function reloadQuote(
    requestId: string
  ) {
    const {
      data,
      error: quoteError,
    } = await supabase
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
      .eq("request_id", requestId)
      .maybeSingle();

    if (quoteError) {
      throw new Error(
        quoteError.message
      );
    }

    if (data) {
      setQuotesByRequest(
        (currentQuotes) => ({
          ...currentQuotes,
          [requestId]:
            data as ProjectQuote,
        })
      );
    }
  }

  async function updateStatus(
    requestId: string,
    newStatus: RequestStatus
  ) {
    setBusyRequestId(requestId);
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
        data: updatedRequest,
        error: updateError,
      } = await supabase
        .from("contact_requests")
        .update({
          status: newStatus,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq(
          "contractor_id",
          user.id
        )
        .select(`
          id,
          sender_id,
          contractor_id,
          sender_name,
          sender_email,
          sender_phone,
          project_type,
          project_location,
          message,
          estimated_budget,
          preferred_start,
          status,
          project_status,
          project_started_at,
          project_completed_at,
          completion_confirmed_at,
          created_at,
          updated_at
        `)
        .maybeSingle();

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }

      if (!updatedRequest) {
        throw new Error(
          "The request was not updated."
        );
      }

      setRequests(
        (currentRequests) =>
          currentRequests.map(
            (request) =>
              request.id === requestId
                ? (updatedRequest as ContactRequest)
                : request
          )
      );

      if (newStatus === "read") {
        setSuccess(
          "Request marked as read."
        );
      } else if (
        newStatus === "accepted"
      ) {
        setSuccess(
          "Request accepted. You can now send the customer a quote."
        );
      } else {
        setSuccess(
          "Request declined."
        );
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update the request."
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  function openStartModal(
    requestId: string
  ) {
    setError("");
    setSuccess("");
    setStartModalRequestId(
      requestId
    );
  }

  function closeStartModal() {
    if (
      busyRequestId ===
      startModalRequestId
    ) {
      return;
    }

    setStartModalRequestId(
      null
    );
  }

  async function startProject(
    requestId: string
  ) {
    setBusyRequestId(requestId);
    setError("");
    setSuccess("");

    try {
      const { error: startError } =
        await supabase.rpc(
          "start_project",
          {
            p_request_id:
              requestId,
          }
        );

      if (startError) {
        throw new Error(
          startError.message
        );
      }

      await reloadRequest(
        requestId
      );

      setStartModalRequestId(
        null
      );

      setSuccess(
        "Project started successfully. The customer can now see that work is in progress."
      );
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Could not start the project."
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  function openCompletionModal(
    requestId: string
  ) {
    setError("");
    setSuccess("");
    setCompletionModalRequestId(
      requestId
    );
  }

  function closeCompletionModal() {
    if (
      busyRequestId ===
      completionModalRequestId
    ) {
      return;
    }

    setCompletionModalRequestId(
      null
    );
  }

  async function completeProject(
    requestId: string
  ) {
    setBusyRequestId(requestId);
    setError("");
    setSuccess("");

    try {
      const {
        error: completeError,
      } = await supabase.rpc(
        "complete_project",
        {
          p_request_id:
            requestId,
        }
      );

      if (completeError) {
        throw new Error(
          completeError.message
        );
      }

      await reloadRequest(
        requestId
      );

      setCompletionModalRequestId(
        null
      );

      setSuccess(
        "Project marked as completed. The customer can now confirm completion."
      );
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Could not complete the project."
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  function openQuoteForm(
    requestId: string
  ) {
    const existingQuote =
      quotesByRequest[requestId];

    setError("");
    setSuccess("");

    setQuoteDrafts(
      (currentDrafts) => ({
        ...currentDrafts,

        [requestId]:
          existingQuote
            ? {
                price: String(
                  existingQuote.price
                ),

                scopeOfWork:
                  existingQuote.scope_of_work,

                estimatedDurationDays:
                  String(
                    existingQuote.estimated_duration_days
                  ),
              }
            : emptyQuoteDraft,
      })
    );

    setQuoteFormRequestId(
      requestId
    );
  }

  function updateQuoteDraft(
    requestId: string,
    field: keyof QuoteDraft,
    value: string
  ) {
    setQuoteDrafts(
      (currentDrafts) => ({
        ...currentDrafts,

        [requestId]: {
          ...(
            currentDrafts[
              requestId
            ] ?? emptyQuoteDraft
          ),

          [field]: value,
        },
      })
    );
  }

  async function sendQuote(
    event: FormEvent<HTMLFormElement>,
    requestId: string
  ) {
    event.preventDefault();

    const draft =
      quoteDrafts[requestId] ??
      emptyQuoteDraft;

    const price =
      Number(draft.price);

    const duration =
      Number(
        draft.estimatedDurationDays
      );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setError(
        "Please enter a valid quote price."
      );
      return;
    }

    if (
      draft.scopeOfWork.trim()
        .length < 5
    ) {
      setError(
        "Please enter the scope of work."
      );
      return;
    }

    if (
      !Number.isInteger(duration) ||
      duration < 1
    ) {
      setError(
        "Please enter a valid estimated duration in days."
      );
      return;
    }

    setSendingQuoteRequestId(
      requestId
    );

    setError("");
    setSuccess("");

    try {
      const {
        error: quoteError,
      } = await supabase.rpc(
        "send_project_quote",
        {
          p_request_id:
            requestId,

          p_price: price,

          p_scope_of_work:
            draft.scopeOfWork.trim(),

          p_estimated_duration_days:
            duration,
        }
      );

      if (quoteError) {
        throw new Error(
          quoteError.message
        );
      }

      await reloadQuote(requestId);

      setQuoteFormRequestId(
        null
      );

      setSuccess(
        "Quote sent successfully. Waiting for the customer to respond."
      );
    } catch (quoteError) {
      setError(
        quoteError instanceof Error
          ? quoteError.message
          : "Could not send the quote."
      );
    } finally {
      setSendingQuoteRequestId(
        null
      );
    }
  }

  const filteredRequests =
    useMemo(() => {
      if (
        selectedFilter === "all"
      ) {
        return requests;
      }

      if (
        selectedFilter ===
        "in_progress"
      ) {
        return requests.filter(
          (request) =>
            request.project_status ===
            "in_progress"
        );
      }

      if (
        selectedFilter ===
        "completed"
      ) {
        return requests.filter(
          (request) =>
            request.project_status ===
            "completed"
        );
      }

      if (
        selectedFilter ===
        "accepted"
      ) {
        return requests.filter(
          (request) =>
            request.status ===
              "accepted" &&
            request.project_status ===
              "not_started"
        );
      }

      return requests.filter(
        (request) =>
          request.status ===
          selectedFilter
      );
    }, [
      requests,
      selectedFilter,
    ]);

  function getFilterCount(
    filter: RequestFilter
  ) {
    if (filter === "all") {
      return requests.length;
    }

    if (
      filter === "in_progress"
    ) {
      return requests.filter(
        (request) =>
          request.project_status ===
          "in_progress"
      ).length;
    }

    if (filter === "completed") {
      return requests.filter(
        (request) =>
          request.project_status ===
          "completed"
      ).length;
    }

    if (filter === "accepted") {
      return requests.filter(
        (request) =>
          request.status ===
            "accepted" &&
          request.project_status ===
            "not_started"
      ).length;
    }

    return requests.filter(
      (request) =>
        request.status === filter
    ).length;
  }

  function requestStatusStyle(
    status: RequestStatus
  ) {
    if (status === "new") {
      return "bg-blue-100 text-blue-700";
    }

    if (status === "read") {
      return "bg-gray-200 text-gray-700";
    }

    if (status === "accepted") {
      return "bg-green-100 text-green-700";
    }

    return "bg-red-100 text-red-700";
  }

  function projectStatusStyle(
    status: ProjectStatus
  ) {
    if (
      status === "not_started"
    ) {
      return "bg-gray-100 text-gray-700";
    }

    if (
      status === "in_progress"
    ) {
      return "bg-orange-100 text-orange-700";
    }

    return "bg-green-100 text-green-700";
  }

  function quoteStatusStyle(
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

  function formatLabel(
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

  function formatDateTime(
  value: string
) {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-AU",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

  function formatDateOnly(
  value: string
) {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-AU",
    {
      dateStyle: "medium",
      timeZone: "UTC",
    }
  ).format(date);
}

  function formatCurrency(
    value: string | number
  ) {
    const numericValue =
      Number(value);

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return String(value);
    }

    return new Intl.NumberFormat(
      "en-AU",
      {
        style: "currency",
        currency: "AUD",
      }
    ).format(numericValue);
  }

  const startModalRequest =
    startModalRequestId
      ? requests.find(
          (request) =>
            request.id ===
            startModalRequestId
        ) ?? null
      : null;

  const isStartingFromModal =
    Boolean(
      startModalRequest &&
        busyRequestId ===
          startModalRequest.id
    );

  const completionModalRequest =
    completionModalRequestId
      ? requests.find(
          (request) =>
            request.id ===
            completionModalRequestId
        ) ?? null
      : null;

  const isCompletingFromModal =
    Boolean(
      completionModalRequest &&
        busyRequestId ===
          completionModalRequest.id
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow p-8">
          <p className="text-gray-600">
            Loading requests...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-8">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold">
              My Requests
            </h1>

            <p className="text-gray-600 mt-3">
              Manage enquiries, quotes
              and active projects.
            </p>
          </div>

          <Link
            href="/my-projects"
            className="bg-black text-white px-6 py-3 rounded-lg text-center font-semibold hover:bg-gray-800"
          >
            My Projects
          </Link>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-200 text-green-700 p-4 rounded-xl mb-6">
            ✅ {success}
          </div>
        )}

        <section className="bg-white rounded-2xl shadow p-4 mb-8">
          <div className="flex flex-wrap gap-2">
            {filters.map(
              (filter) => {
                const isSelected =
                  selectedFilter ===
                  filter.value;

                return (
                  <button
                    key={
                      filter.value
                    }
                    type="button"
                    onClick={() =>
                      setSelectedFilter(
                        filter.value
                      )
                    }
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {filter.label} (
                    {getFilterCount(
                      filter.value
                    )}
                    )
                  </button>
                );
              }
            )}
          </div>
        </section>

        {requests.length === 0 ? (
          <section className="bg-white rounded-2xl shadow p-10 text-center">
            <h2 className="text-2xl font-bold">
              No Requests Yet
            </h2>

            <p className="text-gray-600 mt-3">
              Customer project enquiries
              will appear here.
            </p>
          </section>
        ) : filteredRequests.length ===
          0 ? (
          <section className="bg-white rounded-2xl shadow p-10 text-center">
            <h2 className="text-2xl font-bold">
              No Requests Found
            </h2>

            <p className="text-gray-600 mt-3">
              There are no requests in
              this category.
            </p>
          </section>
        ) : (
          <section className="space-y-7">
            {filteredRequests.map(
              (request) => {
                const quote =
                  quotesByRequest[
                    request.id
                  ];

                const draft =
                  quoteDrafts[
                    request.id
                  ] ??
                  emptyQuoteDraft;

                const isBusy =
                  busyRequestId ===
                  request.id;

                const isSendingQuote =
                  sendingQuoteRequestId ===
                  request.id;

                const quoteFormOpen =
                  quoteFormRequestId ===
                  request.id;

                const projectNotStarted =
                  request.project_status ===
                  "not_started";

                const canSendQuote =
                  request.status ===
                    "accepted" &&
                  projectNotStarted &&
                  quote?.status !==
                    "accepted";

                return (
                  <article
                    key={request.id}
                    className="bg-white rounded-2xl shadow overflow-hidden"
                  >
                    <div className="p-6 md:p-8">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                        <div>
                          <h2 className="text-2xl font-bold">
                            {
                              request.project_type
                            }
                          </h2>

                          <p className="text-gray-500 mt-2">
                            Received{" "}
                            {formatDateTime(
                              request.created_at
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`px-4 py-2 rounded-full text-sm font-semibold ${requestStatusStyle(
                              request.status
                            )}`}
                          >
                            Request:{" "}
                            {formatLabel(
                              request.status
                            )}
                          </span>

                          {request.status ===
                            "accepted" && (
                            <span
                              className={`px-4 py-2 rounded-full text-sm font-semibold ${projectStatusStyle(
                                request.project_status
                              )}`}
                            >
                              Project:{" "}
                              {formatLabel(
                                request.project_status
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6 mt-7">
                        <section className="bg-gray-50 border rounded-xl p-5">
                          <h3 className="font-bold text-lg mb-4">
                            Customer Details
                          </h3>

                          <div className="space-y-3">
                            <p>
                              <strong>
                                Name:
                              </strong>{" "}
                              {
                                request.sender_name
                              }
                            </p>

                            <p className="break-all">
                              <strong>
                                Email:
                              </strong>{" "}
                              <a
                                href={`mailto:${request.sender_email}`}
                                className="text-blue-600 hover:underline"
                              >
                                {
                                  request.sender_email
                                }
                              </a>
                            </p>

                            <p>
                              <strong>
                                Phone:
                              </strong>{" "}
                              {request.sender_phone ??
                                "Not provided"}
                            </p>
                          </div>
                        </section>

                        <section className="bg-gray-50 border rounded-xl p-5">
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
                                Estimated
                                Budget:
                              </strong>{" "}
                              {request.estimated_budget !==
                                null &&
                              request.estimated_budget !==
                                ""
                                ? formatCurrency(
                                    request.estimated_budget
                                  )
                                : "Not provided"}
                            </p>

                            <p>
                              <strong>
                                Preferred
                                Start:
                              </strong>{" "}
                              {request.preferred_start
                                ? formatDateOnly(
                                    request.preferred_start
                                  )
                                : "Not provided"}
                            </p>
                          </div>
                        </section>
                      </div>

                      <section className="mt-6">
                        <h3 className="font-bold text-lg mb-3">
                          Project Details
                        </h3>

                        <div className="bg-gray-50 border rounded-xl p-5">
                          <p className="whitespace-pre-wrap leading-7">
                            {
                              request.message
                            }
                          </p>
                        </div>
                      </section>

                      {request.status ===
                        "accepted" && (
                        <section className="mt-7 border border-blue-200 bg-blue-50 rounded-2xl p-5 md:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                              <h3 className="text-xl font-bold">
                                Project Quote
                              </h3>

                              <p className="text-gray-600 mt-1">
                                Send the
                                customer your
                                price, scope
                                and estimated
                                duration.
                              </p>
                            </div>

                            {quote && (
                              <span
                                className={`px-4 py-2 rounded-full text-sm font-semibold self-start ${quoteStatusStyle(
                                  quote.status
                                )}`}
                              >
                                {formatLabel(
                                  quote.status
                                )}
                              </span>
                            )}
                          </div>

                          {quote ? (
                            <div className="bg-white border rounded-xl p-5 mt-5">
                              <div className="grid sm:grid-cols-2 gap-4">
                                <p>
                                  <strong>
                                    Quote
                                    Price:
                                  </strong>{" "}
                                  {formatCurrency(
                                    quote.price
                                  )}
                                </p>

                                <p>
                                  <strong>
                                    Estimated
                                    Duration:
                                  </strong>{" "}
                                  {
                                    quote.estimated_duration_days
                                  }{" "}
                                  {quote.estimated_duration_days ===
                                  1
                                    ? "day"
                                    : "days"}
                                </p>

                                <p>
                                  <strong>
                                    Sent:
                                  </strong>{" "}
                                  {formatDateTime(
                                    quote.sent_at
                                  )}
                                </p>

                                {quote.responded_at && (
                                  <p>
                                    <strong>
                                      Responded:
                                    </strong>{" "}
                                    {formatDateTime(
                                      quote.responded_at
                                    )}
                                  </p>
                                )}
                              </div>

                              <div className="mt-5">
                                <p className="font-bold">
                                  Scope of
                                  Work
                                </p>

                                <p className="whitespace-pre-wrap leading-7 mt-2 text-gray-700">
                                  {
                                    quote.scope_of_work
                                  }
                                </p>
                              </div>

                              {quote.status ===
                                "pending" && (
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mt-5">
                                  Waiting for
                                  the customer
                                  to accept or
                                  decline this
                                  quote.
                                </div>
                              )}

                              {quote.status ===
                                "accepted" && (
                                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mt-5">
                                  The customer
                                  accepted this
                                  quote.
                                </div>
                              )}

                              {quote.status ===
                                "declined" && (
                                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mt-5">
                                  The customer
                                  declined this
                                  quote. You
                                  can edit and
                                  resend it.
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-white border rounded-xl p-5 mt-5">
                              <p className="text-gray-600">
                                No quote has
                                been sent for
                                this request
                                yet.
                              </p>
                            </div>
                          )}

                          {canSendQuote &&
                            !quoteFormOpen && (
                              <button
                                type="button"
                                onClick={() =>
                                  openQuoteForm(
                                    request.id
                                  )
                                }
                                className="mt-5 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700"
                              >
                                {!quote
                                  ? "Send Quote"
                                  : quote.status ===
                                      "declined"
                                    ? "Edit & Resend Quote"
                                    : "Edit Quote"}
                              </button>
                            )}

                          {quoteFormOpen &&
                            canSendQuote && (
                              <form
                                onSubmit={(
                                  event
                                ) =>
                                  sendQuote(
                                    event,
                                    request.id
                                  )
                                }
                                className="bg-white border rounded-xl p-5 mt-5 space-y-5"
                              >
                                <h4 className="text-lg font-bold">
                                  {!quote
                                    ? "Create Quote"
                                    : "Update Quote"}
                                </h4>

                                <div className="grid md:grid-cols-2 gap-5">
                                  <div>
                                    <label
                                      htmlFor={`quote-price-${request.id}`}
                                      className="block font-semibold mb-2"
                                    >
                                      Quote
                                      Price
                                      (AUD) *
                                    </label>

                                    <input
                                      id={`quote-price-${request.id}`}
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      required
                                      value={
                                        draft.price
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateQuoteDraft(
                                          request.id,
                                          "price",
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      placeholder="e.g. 12500"
                                      className="w-full border rounded-lg px-4 py-3"
                                    />
                                  </div>

                                  <div>
                                    <label
                                      htmlFor={`quote-duration-${request.id}`}
                                      className="block font-semibold mb-2"
                                    >
                                      Estimated
                                      Duration
                                      (Days) *
                                    </label>

                                    <input
                                      id={`quote-duration-${request.id}`}
                                      type="number"
                                      min="1"
                                      max="3650"
                                      step="1"
                                      required
                                      value={
                                        draft.estimatedDurationDays
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateQuoteDraft(
                                          request.id,
                                          "estimatedDurationDays",
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      placeholder="e.g. 14"
                                      className="w-full border rounded-lg px-4 py-3"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label
                                    htmlFor={`quote-scope-${request.id}`}
                                    className="block font-semibold mb-2"
                                  >
                                    Scope of
                                    Work *
                                  </label>

                                  <textarea
                                    id={`quote-scope-${request.id}`}
                                    required
                                    minLength={5}
                                    maxLength={5000}
                                    rows={7}
                                    value={
                                      draft.scopeOfWork
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateQuoteDraft(
                                        request.id,
                                        "scopeOfWork",
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    placeholder="Describe the work included in this quote..."
                                    className="w-full border rounded-lg px-4 py-3 resize-y"
                                  />

                                  <p className="text-sm text-gray-500 mt-2">
                                    {
                                      draft
                                        .scopeOfWork
                                        .length
                                    }
                                    /5000
                                  </p>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3">
                                  <button
                                    type="submit"
                                    disabled={
                                      isSendingQuote
                                    }
                                    className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400"
                                  >
                                    {isSendingQuote
                                      ? "Sending..."
                                      : quote
                                        ? "Resend Quote"
                                        : "Send Quote"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      isSendingQuote
                                    }
                                    onClick={() =>
                                      setQuoteFormRequestId(
                                        null
                                      )
                                    }
                                    className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            )}
                        </section>
                      )}

                      {request.status ===
                        "accepted" && (
                        <section className="mt-7 bg-gray-50 border rounded-xl p-5">
                          <h3 className="font-bold text-lg">
                            Project Progress
                          </h3>

                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                Status
                              </p>

                              <p className="font-semibold mt-1">
                                {formatLabel(
                                  request.project_status
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-sm text-gray-500">
                                Started
                              </p>

                              <p className="font-semibold mt-1">
                                {request.project_started_at
                                  ? formatDateTime(
                                      request.project_started_at
                                    )
                                  : "Not started"}
                              </p>
                            </div>

                            <div>
                              <p className="text-sm text-gray-500">
                                Completed
                              </p>

                              <p className="font-semibold mt-1">
                                {request.project_completed_at
                                  ? formatDateTime(
                                      request.project_completed_at
                                    )
                                  : "Not completed"}
                              </p>
                            </div>
                          </div>

                          {request.completion_confirmed_at && (
                            <div className="bg-green-100 text-green-700 p-4 rounded-lg mt-5">
                              Customer
                              confirmed
                              completion on{" "}
                              {formatDateTime(
                                request.completion_confirmed_at
                              )}
                              .
                            </div>
                          )}
                        </section>
                      )}

                      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-7">
                        {request.status ===
                          "new" && (
                          <button
                            type="button"
                            disabled={
                              isBusy
                            }
                            onClick={() =>
                              updateStatus(
                                request.id,
                                "read"
                              )
                            }
                            className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 disabled:bg-gray-400"
                          >
                            {isBusy
                              ? "Updating..."
                              : "Mark as Read"}
                          </button>
                        )}

                        {(request.status ===
                          "new" ||
                          request.status ===
                            "read") && (
                          <button
                            type="button"
                            disabled={
                              isBusy
                            }
                            onClick={() =>
                              updateStatus(
                                request.id,
                                "accepted"
                              )
                            }
                            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
                          >
                            {isBusy
                              ? "Updating..."
                              : "Accept Request"}
                          </button>
                        )}

                        {request.status !==
                          "declined" &&
                          projectNotStarted && (
                            <button
                              type="button"
                              disabled={
                                isBusy
                              }
                              onClick={() =>
                                updateStatus(
                                  request.id,
                                  "declined"
                                )
                              }
                              className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400"
                            >
                              {isBusy
                                ? "Updating..."
                                : "Decline Request"}
                            </button>
                          )}

                        {request.status ===
                          "accepted" && (
                          <Link
                            href={`/messages/${request.id}`}
                            className="bg-purple-600 text-white px-6 py-3 rounded-lg text-center font-semibold hover:bg-purple-700"
                          >
                            Open Chat
                          </Link>
                        )}

                        {request.status ===
                          "accepted" &&
                          request.project_status ===
                            "not_started" && (
                            <button
                              type="button"
                              disabled={
                                isBusy
                              }
                              onClick={() =>
                                openStartModal(
                                  request.id
                                )
                              }
                              className="bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 disabled:bg-gray-400"
                            >
                              {isBusy
                                ? "Starting..."
                                : "Start Project"}
                            </button>
                          )}

                        {request.status ===
                          "accepted" &&
                          request.project_status ===
                            "in_progress" && (
                            <button
                              type="button"
                              disabled={
                                isBusy
                              }
                              onClick={() =>
                                openCompletionModal(
                                  request.id
                                )
                              }
                              className="bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 disabled:bg-gray-400"
                            >
                              {isBusy
                                ? "Completing..."
                                : "Mark Completed"}
                            </button>
                          )}

                        <a
                          href={`mailto:${request.sender_email}`}
                          className="bg-blue-600 text-white px-6 py-3 rounded-lg text-center font-semibold hover:bg-blue-700"
                        >
                          Email Customer
                        </a>

                        {request.sender_phone && (
                          <a
                            href={`tel:${request.sender_phone.replace(
                              /\s+/g,
                              ""
                            )}`}
                            className="bg-black text-white px-6 py-3 rounded-lg text-center font-semibold hover:bg-gray-800"
                          >
                            Call Customer
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </section>
        )}

        {startModalRequest && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-project-title"
            aria-describedby="start-project-description"
            onMouseDown={(event) => {
              if (
                event.target ===
                  event.currentTarget &&
                !isStartingFromModal
              ) {
                closeStartModal();
              }
            }}
          >
            <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
              <div className="relative border-b border-gray-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 px-6 py-7 sm:px-8">
                <button
                  type="button"
                  aria-label="Close start project confirmation"
                  disabled={
                    isStartingFromModal
                  }
                  onClick={
                    closeStartModal
                  }
                  className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-xl text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ×
                </button>

                <div className="flex items-start gap-4 pr-12">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-600/20">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      className="h-7 w-7"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 5v14l11-7L8 5Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-700">
                      Project start
                    </p>

                    <h2
                      id="start-project-title"
                      className="mt-1 text-2xl font-bold text-gray-950 sm:text-3xl"
                    >
                      Start this project?
                    </h2>

                    <p
                      id="start-project-description"
                      className="mt-2 leading-6 text-gray-600"
                    >
                      Confirm that you are ready to begin the agreed work for this project.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Project
                      </p>

                      <p className="mt-1 text-xl font-bold text-gray-950">
                        {
                          startModalRequest.project_type
                        }
                      </p>
                    </div>

                    <span className="self-start rounded-full bg-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700">
                      Not Started
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-gray-200 pt-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Customer
                      </p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {
                          startModalRequest.sender_name
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Location
                      </p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {
                          startModalRequest.project_location
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-800"
                    aria-hidden="true"
                  >
                    i
                  </div>

                  <div>
                    <p className="font-bold text-orange-900">
                      What happens next
                    </p>

                    <p className="mt-1 text-sm leading-6 text-orange-800">
                      The project status will change to In Progress and the start time will be recorded. The customer will be able to see that work has started.
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    autoFocus
                    disabled={
                      isStartingFromModal
                    }
                    onClick={
                      closeStartModal
                    }
                    className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-gray-800 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      isStartingFromModal
                    }
                    onClick={() =>
                      startProject(
                        startModalRequest.id
                      )
                    }
                    className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
                  >
                    {isStartingFromModal ? (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5 animate-spin"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            opacity="0.25"
                          />
                          <path
                            d="M21 12a9 9 0 0 0-9-9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </svg>

                        Starting...
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.25"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path
                            d="M8 5v14l11-7L8 5Z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>

                        Start Project
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {completionModalRequest && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-project-title"
            aria-describedby="complete-project-description"
            onMouseDown={(event) => {
              if (
                event.target ===
                  event.currentTarget &&
                !isCompletingFromModal
              ) {
                closeCompletionModal();
              }
            }}
          >
            <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
              <div className="relative border-b border-gray-100 bg-gradient-to-br from-green-50 via-white to-emerald-50 px-6 py-7 sm:px-8">
                <button
                  type="button"
                  aria-label="Close completion confirmation"
                  disabled={
                    isCompletingFromModal
                  }
                  onClick={
                    closeCompletionModal
                  }
                  className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-xl text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ×
                </button>

                <div className="flex items-start gap-4 pr-12">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-600 text-white shadow-lg shadow-green-600/20">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="h-7 w-7"
                      aria-hidden="true"
                    >
                      <path
                        d="m5 12 4 4L19 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-green-700">
                      Project completion
                    </p>

                    <h2
                      id="complete-project-title"
                      className="mt-1 text-2xl font-bold text-gray-950 sm:text-3xl"
                    >
                      Mark project as completed?
                    </h2>

                    <p
                      id="complete-project-description"
                      className="mt-2 leading-6 text-gray-600"
                    >
                      Confirm that the agreed work has been completed before updating the project status.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Project
                      </p>

                      <p className="mt-1 text-xl font-bold text-gray-950">
                        {
                          completionModalRequest.project_type
                        }
                      </p>
                    </div>

                    <span className="self-start rounded-full bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-700">
                      In Progress
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-gray-200 pt-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Customer
                      </p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {
                          completionModalRequest.sender_name
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Location
                      </p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {
                          completionModalRequest.project_location
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800"
                    aria-hidden="true"
                  >
                    !
                  </div>

                  <div>
                    <p className="font-bold text-amber-900">
                      Before you continue
                    </p>

                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      The project status will change to Completed. The customer will then be able to confirm completion from their account.
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    autoFocus
                    disabled={
                      isCompletingFromModal
                    }
                    onClick={
                      closeCompletionModal
                    }
                    className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-gray-800 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      isCompletingFromModal
                    }
                    onClick={() =>
                      completeProject(
                        completionModalRequest.id
                      )
                    }
                    className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3 font-bold text-white shadow-lg shadow-green-700/20 transition hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
                  >
                    {isCompletingFromModal ? (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5 animate-spin"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            opacity="0.25"
                          />
                          <path
                            d="M21 12a9 9 0 0 0-9-9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </svg>

                        Completing...
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path
                            d="m5 12 4 4L19 6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>

                        Mark Project Completed
                      </>
                    )}
                  </button>
                </div>

                <p className="mt-4 text-center text-xs text-gray-500">
                  Press Esc or click outside this window to cancel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}