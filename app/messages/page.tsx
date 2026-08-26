"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType =
  | "customer"
  | "contractor";

type ConversationFilter =
  | "all"
  | "unread";

type RequestRow = {
  id: string;
  sender_id: string;
  contractor_id: string;
  sender_name: string;
  project_type: string;
  status: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  request_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type ContractorProfile = {
  id: string;
  full_name: string;
  company_name: string | null;
  trade: string | null;
  avatar_url: string | null;
};

type Conversation = {
  requestId: string;
  projectType: string;
  otherPersonName: string;
  otherPersonSubtitle: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

export default function MessagesInboxPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [userId, setUserId] =
    useState<string | null>(null);

  const [accountType, setAccountType] =
    useState<AccountType | null>(null);

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [
    selectedFilter,
    setSelectedFilter,
  ] = useState<ConversationFilter>("all");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [authLoading, setAuthLoading] =
    useState(true);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentAccount() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth");
        return;
      }

      const {
        data: accountData,
        error: accountError,
      } = await supabase
        .from("user_accounts")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (
        accountError ||
        !accountData?.account_type
      ) {
        setError(
          accountError?.message ??
            "Could not determine your account type."
        );

        setAuthLoading(false);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      setAccountType(
        accountData.account_type as AccountType
      );

      setAuthLoading(false);
    }

    void loadCurrentAccount();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const loadConversations = useCallback(
    async (showLoader = false) => {
      if (!userId || !accountType) {
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      setError("");

      const ownerColumn =
        accountType === "contractor"
          ? "contractor_id"
          : "sender_id";

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
          project_type,
          status,
          created_at
        `)
        .eq(ownerColumn, userId)
        .eq("status", "accepted")
        .order("created_at", {
          ascending: false,
        });

      if (requestError) {
        setError(requestError.message);
        setConversations([]);
        setLoading(false);
        return;
      }

      const requests =
        (requestData ?? []) as RequestRow[];

      if (requests.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const requestIds = requests.map(
        (request) => request.id
      );

      const {
        data: messageData,
        error: messageError,
      } = await supabase
        .from("messages")
        .select(`
          id,
          request_id,
          sender_id,
          recipient_id,
          body,
          read_at,
          created_at
        `)
        .in("request_id", requestIds)
        .order("created_at", {
          ascending: false,
        });

      if (messageError) {
        setError(messageError.message);
        setConversations([]);
        setLoading(false);
        return;
      }

      const messages =
        (messageData ?? []) as MessageRow[];

      let contractorProfiles:
        ContractorProfile[] = [];

      if (accountType === "customer") {
        const contractorIds = [
          ...new Set(
            requests.map(
              (request) =>
                request.contractor_id
            )
          ),
        ];

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(`
            id,
            full_name,
            company_name,
            trade,
            avatar_url
          `)
          .in("id", contractorIds);

        if (profileError) {
          console.error(
            "Could not load contractor profiles:",
            profileError.message
          );
        } else {
          contractorProfiles =
            (profileData ??
              []) as ContractorProfile[];
        }
      }

      const conversationRows: Conversation[] =
        requests.map((request) => {
          const requestMessages =
            messages.filter(
              (message) =>
                message.request_id ===
                request.id
            );

          const latestMessage =
            requestMessages[0] ?? null;

          const unreadCount =
            requestMessages.filter(
              (message) =>
                message.recipient_id ===
                  userId &&
                message.read_at === null
            ).length;

          const lastMessageText =
            latestMessage
              ? `${
                  latestMessage.sender_id ===
                  userId
                    ? "You: "
                    : ""
                }${latestMessage.body}`
              : "No messages yet — open the chat to start.";

          if (
            accountType === "contractor"
          ) {
            return {
              requestId: request.id,
              projectType:
                request.project_type,

              otherPersonName:
                request.sender_name ||
                "Customer",

              otherPersonSubtitle:
                "Customer",

              avatarUrl: null,

              lastMessage:
                lastMessageText,

              lastMessageAt:
                latestMessage?.created_at ??
                request.created_at,

              unreadCount,
            };
          }

          const contractor =
            contractorProfiles.find(
              (profile) =>
                profile.id ===
                request.contractor_id
            ) ?? null;

          return {
            requestId: request.id,

            projectType:
              request.project_type,

            otherPersonName:
              contractor?.full_name ||
              "Contractor",

            otherPersonSubtitle:
              contractor?.company_name ||
              contractor?.trade ||
              "Contractor",

            avatarUrl:
              contractor?.avatar_url ??
              null,

            lastMessage:
              lastMessageText,

            lastMessageAt:
              latestMessage?.created_at ??
              request.created_at,

            unreadCount,
          };
        });

      conversationRows.sort(
        (
          firstConversation,
          secondConversation
        ) =>
          new Date(
            secondConversation.lastMessageAt
          ).getTime() -
          new Date(
            firstConversation.lastMessageAt
          ).getTime()
      );

      setConversations(conversationRows);
      setLoading(false);
    },
    [
      accountType,
      supabase,
      userId,
    ]
  );

  useEffect(() => {
    if (
      authLoading ||
      !userId ||
      !accountType
    ) {
      return;
    }

    void loadConversations(true);

    const requestFilter =
      accountType === "contractor"
        ? `contractor_id=eq.${userId}`
        : `sender_id=eq.${userId}`;

    const channel = supabase
      .channel(
        `messages-inbox-${accountType}-${userId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          window.setTimeout(() => {
            void loadConversations(false);
          }, 150);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_requests",
          filter: requestFilter,
        },
        () => {
          window.setTimeout(() => {
            void loadConversations(false);
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
              "Messages inbox realtime error:",
              channelError
            );
          }
        }
      );

    function refreshInbox() {
      void loadConversations(false);
    }

    window.addEventListener(
      "focus",
      refreshInbox
    );

    window.addEventListener(
      "chat-messages-seen",
      refreshInbox
    );

    return () => {
      window.removeEventListener(
        "focus",
        refreshInbox
      );

      window.removeEventListener(
        "chat-messages-seen",
        refreshInbox
      );

      void supabase.removeChannel(
        channel
      );
    };
  }, [
    accountType,
    authLoading,
    loadConversations,
    supabase,
    userId,
  ]);

  function formatConversationTime(
    date: string
  ) {
    const messageDate = new Date(date);
    const today = new Date();

    const isToday =
      messageDate.toDateString() ===
      today.toDateString();

    if (isToday) {
      return new Intl.DateTimeFormat(
        "en-AU",
        {
          hour: "numeric",
          minute: "2-digit",
        }
      ).format(messageDate);
    }

    return new Intl.DateTimeFormat(
      "en-AU",
      {
        day: "numeric",
        month: "short",
      }
    ).format(messageDate);
  }

  function getInitial(name: string) {
    return (
      name.trim().charAt(0).toUpperCase() ||
      "U"
    );
  }

  const unreadConversationsCount =
    conversations.filter(
      (conversation) =>
        conversation.unreadCount > 0
    ).length;

  const normalizedSearch =
    searchTerm.trim().toLowerCase();

  const filteredConversations =
    conversations.filter(
      (conversation) => {
        const matchesFilter =
          selectedFilter === "all" ||
          conversation.unreadCount > 0;

        const matchesSearch =
          normalizedSearch.length === 0 ||
          conversation.otherPersonName
            .toLowerCase()
            .includes(normalizedSearch) ||
          conversation.otherPersonSubtitle
            .toLowerCase()
            .includes(normalizedSearch) ||
          conversation.projectType
            .toLowerCase()
            .includes(normalizedSearch) ||
          conversation.lastMessage
            .toLowerCase()
            .includes(normalizedSearch);

        return (
          matchesFilter &&
          matchesSearch
        );
      }
    );

  function clearFilters() {
    setSelectedFilter("all");
    setSearchTerm("");
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 md:p-8">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow p-8">
          <p className="text-gray-600">
            Loading messages...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">
              Messages
            </h1>

            <p className="text-gray-600 mt-2">
              View all your project
              conversations.
            </p>
          </div>

          <Link
            href={
              accountType === "contractor"
                ? "/requests"
                : "/sent-requests"
            }
            className="bg-black text-white px-6 py-3 rounded-lg text-center hover:bg-gray-800"
          >
            Back to Requests
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
            ❌ {error}
          </div>
        )}

        {conversations.length > 0 && (
          <section className="bg-white rounded-2xl shadow p-4 md:p-5 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFilter("all")
                  }
                  className={`px-5 py-2 rounded-lg font-medium transition ${
                    selectedFilter === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All ({conversations.length})
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedFilter(
                      "unread"
                    )
                  }
                  className={`px-5 py-2 rounded-lg font-medium transition ${
                    selectedFilter ===
                    "unread"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Unread (
                  {unreadConversationsCount})
                </button>
              </div>

              <div className="flex-1 md:ml-auto">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search conversations..."
                  className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>
        )}

        {conversations.length === 0 ? (
          <section className="bg-white rounded-2xl shadow p-10 text-center">
            <div className="text-5xl">
              💬
            </div>

            <h2 className="text-2xl font-bold mt-4">
              No Conversations Yet
            </h2>

            <p className="text-gray-600 mt-3">
              A conversation becomes available
              after a project request is
              accepted.
            </p>

            <Link
              href={
                accountType === "contractor"
                  ? "/requests"
                  : "/sent-requests"
              }
              className="inline-block mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              View Requests
            </Link>
          </section>
        ) : filteredConversations.length ===
          0 ? (
          <section className="bg-white rounded-2xl shadow p-10 text-center">
            <div className="text-5xl">
              🔍
            </div>

            <h2 className="text-2xl font-bold mt-4">
              No Conversations Found
            </h2>

            <p className="text-gray-600 mt-3">
              No conversations match your
              search or selected filter.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
            >
              Clear Filters
            </button>
          </section>
        ) : (
          <section className="bg-white rounded-2xl shadow overflow-hidden">
            {filteredConversations.map(
              (
                conversation,
                index
              ) => (
                <Link
                  key={
                    conversation.requestId
                  }
                  href={`/messages/${conversation.requestId}`}
                  className={`flex items-center gap-4 p-5 md:p-6 hover:bg-gray-50 transition ${
                    index !==
                    filteredConversations.length -
                      1
                      ? "border-b"
                      : ""
                  }`}
                >
                  <div className="shrink-0">
                    {conversation.avatarUrl ? (
                      <img
                        src={
                          conversation.avatarUrl
                        }
                        alt={
                          conversation.otherPersonName
                        }
                        className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover border"
                      />
                    ) : (
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xl font-bold">
                        {getInitial(
                          conversation.otherPersonName
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2
                          className={`text-lg truncate ${
                            conversation.unreadCount >
                            0
                              ? "font-bold text-black"
                              : "font-semibold text-gray-800"
                          }`}
                        >
                          {
                            conversation.otherPersonName
                          }
                        </h2>

                        <p className="text-sm text-gray-500 truncate">
                          {
                            conversation.otherPersonSubtitle
                          }
                          {" • "}
                          {
                            conversation.projectType
                          }
                        </p>
                      </div>

                      <span className="text-xs md:text-sm text-gray-400 whitespace-nowrap">
                        {formatConversationTime(
                          conversation.lastMessageAt
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-2">
                      <p
                        className={`truncate ${
                          conversation.unreadCount >
                          0
                            ? "font-semibold text-gray-900"
                            : "text-gray-500"
                        }`}
                      >
                        {
                          conversation.lastMessage
                        }
                      </p>

                      {conversation.unreadCount >
                        0 && (
                        <span className="shrink-0 min-w-7 h-7 px-2 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {conversation.unreadCount >
                          99
                            ? "99+"
                            : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            )}
          </section>
        )}
      </div>
    </main>
  );
}