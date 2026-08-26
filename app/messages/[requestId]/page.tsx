"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import type {
  RealtimeChannel,
  User,
} from "@supabase/supabase-js";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RequestInfo = {
  id: string;
  sender_id: string;
  contractor_id: string;
  sender_name: string;
  project_type: string;
  status: string;
};

type ContractorProfile = {
  full_name: string;
  company_name: string | null;
  trade: string | null;
};

type ChatMessage = {
  id: string;
  request_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type ViewerRole =
  | "customer"
  | "contractor";

export default function MessagesPage() {
  const params =
    useParams<{ requestId: string }>();

  const router = useRouter();
  const requestId = params.requestId;

  const [supabase] = useState(() =>
    createClient()
  );

  const [currentUser, setCurrentUser] =
    useState<User | null>(null);

  const [request, setRequest] =
    useState<RequestInfo | null>(null);

  const [viewerRole, setViewerRole] =
    useState<ViewerRole | null>(null);

  const [
    otherPersonName,
    setOtherPersonName,
  ] = useState("User");

  const [
    otherPersonSubtitle,
    setOtherPersonSubtitle,
  ] = useState("");

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [newMessage, setNewMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const [sendError, setSendError] =
    useState("");

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const markChatMessagesAsSeen =
    useCallback(
      async (viewerId: string) => {
        const { error: seenError } =
          await supabase.rpc(
            "mark_chat_messages_seen",
            {
              p_request_id: requestId,
            }
          );

        if (seenError) {
          console.error(
            "Could not mark chat messages as seen:",
            seenError.message
          );

          return;
        }

        const readTime =
          new Date().toISOString();

        setMessages(
          (currentMessages) =>
            currentMessages.map(
              (message) =>
                message.recipient_id ===
                  viewerId &&
                !message.read_at
                  ? {
                      ...message,
                      read_at: readTime,
                    }
                  : message
            )
        );

        window.dispatchEvent(
          new CustomEvent(
            "chat-messages-seen",
            {
              detail: {
                requestId,
              },
            }
          )
        );
      },
      [requestId, supabase]
    );

  useEffect(() => {
    let isMounted = true;

    let realtimeChannel:
      | RealtimeChannel
      | null = null;

    async function loadChat() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth");
        return;
      }

      if (!isMounted) {
        return;
      }

      setCurrentUser(user);

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
          status
        `)
        .eq("id", requestId)
        .maybeSingle();

      if (
        requestError ||
        !requestData
      ) {
        if (isMounted) {
          setError(
            requestError?.message ??
              "This request was not found."
          );

          setLoading(false);
        }

        return;
      }

      const requestRow =
        requestData as RequestInfo;

      const isCustomer =
        requestRow.sender_id ===
        user.id;

      const isContractor =
        requestRow.contractor_id ===
        user.id;

      if (
        !isCustomer &&
        !isContractor
      ) {
        if (isMounted) {
          setError(
            "You do not have permission to view this chat."
          );

          setLoading(false);
        }

        return;
      }

      if (
        requestRow.status !==
        "accepted"
      ) {
        if (isMounted) {
          setError(
            "Chat becomes available after the contractor accepts the request."
          );

          setLoading(false);
        }

        return;
      }

      if (!isMounted) {
        return;
      }

      setRequest(requestRow);

      setViewerRole(
        isContractor
          ? "contractor"
          : "customer"
      );

      if (isContractor) {
        setOtherPersonName(
          requestRow.sender_name ||
            "Customer"
        );

        setOtherPersonSubtitle(
          "Customer"
        );
      } else {
        const {
          data: contractorData,
          error: contractorError,
        } = await supabase
          .from("profiles")
          .select(`
            full_name,
            company_name,
            trade
          `)
          .eq(
            "id",
            requestRow.contractor_id
          )
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (contractorError) {
          console.error(
            "Could not load contractor:",
            contractorError.message
          );

          setOtherPersonName(
            "Contractor"
          );

          setOtherPersonSubtitle(
            "Contractor"
          );
        } else {
          const contractor =
            contractorData as
              | ContractorProfile
              | null;

          setOtherPersonName(
            contractor?.full_name ||
              "Contractor"
          );

          setOtherPersonSubtitle(
            contractor?.company_name ||
              contractor?.trade ||
              "Contractor"
          );
        }
      }

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
        .eq(
          "request_id",
          requestId
        )
        .order("created_at", {
          ascending: true,
        });

      if (messageError) {
        if (isMounted) {
          setError(
            messageError.message
          );

          setLoading(false);
        }

        return;
      }

      if (!isMounted) {
        return;
      }

      setMessages(
        (messageData ??
          []) as ChatMessage[]
      );

      setLoading(false);

      if (
        document.visibilityState ===
        "visible"
      ) {
        await markChatMessagesAsSeen(
          user.id
        );
      }

      realtimeChannel = supabase
        .channel(
          `messages-${requestId}-${user.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              `request_id=eq.${requestId}`,
          },
          (payload) => {
            const incomingMessage =
              payload.new as ChatMessage;

            setMessages(
              (currentMessages) => {
                const alreadyExists =
                  currentMessages.some(
                    (message) =>
                      message.id ===
                      incomingMessage.id
                  );

                if (alreadyExists) {
                  return currentMessages;
                }

                return [
                  ...currentMessages,
                  incomingMessage,
                ];
              }
            );

            const messageIsForViewer =
              incomingMessage.recipient_id ===
              user.id;

            if (
              messageIsForViewer &&
              document.visibilityState ===
                "visible"
            ) {
              void markChatMessagesAsSeen(
                user.id
              );
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter:
              `request_id=eq.${requestId}`,
          },
          (payload) => {
            const updatedMessage =
              payload.new as ChatMessage;

            setMessages(
              (currentMessages) =>
                currentMessages.map(
                  (message) =>
                    message.id ===
                    updatedMessage.id
                      ? updatedMessage
                      : message
                )
            );
          }
        )
        .subscribe((status) => {
          if (
            status ===
              "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          ) {
            console.error(
              "Chat realtime connection failed."
            );
          }
        });

      function handleVisibilityChange() {
  if (
    document.visibilityState ===
      "visible" &&
    user
  ) {
    void markChatMessagesAsSeen(
      user.id
    );
  }
}

      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
      };
    }

    let removeVisibilityListener:
      | (() => void)
      | undefined;

    void loadChat().then(
      (cleanupFunction) => {
        removeVisibilityListener =
          cleanupFunction;
      }
    );

    return () => {
      isMounted = false;

      removeVisibilityListener?.();

      if (realtimeChannel) {
        void supabase.removeChannel(
          realtimeChannel
        );
      }
    };
  }, [
    markChatMessagesAsSeen,
    requestId,
    router,
    supabase,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );
  }, [messages]);

  async function handleSendMessage(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const messageBody =
      newMessage.trim();

    if (
      !messageBody ||
      !currentUser ||
      !request ||
      sending
    ) {
      return;
    }

    if (
      messageBody.length > 2000
    ) {
      setSendError(
        "Message must be 2000 characters or less."
      );

      return;
    }

    setSending(true);
    setSendError("");

    const {
      data: insertedMessage,
      error: insertError,
    } = await supabase
      .from("messages")
      .insert({
        request_id: request.id,
        sender_id:
          currentUser.id,
        body: messageBody,
      })
      .select(`
        id,
        request_id,
        sender_id,
        recipient_id,
        body,
        read_at,
        created_at
      `)
      .single();

    if (insertError) {
      setSendError(
        insertError.message
      );

      setSending(false);
      return;
    }

    const sentMessage =
      insertedMessage as ChatMessage;

    setMessages(
      (currentMessages) => {
        const alreadyExists =
          currentMessages.some(
            (message) =>
              message.id ===
              sentMessage.id
          );

        if (alreadyExists) {
          return currentMessages;
        }

        return [
          ...currentMessages,
          sentMessage,
        ];
      }
    );

    setNewMessage("");
    setSending(false);
  }

  function formatMessageTime(
    date: string
  ) {
    return new Intl.DateTimeFormat(
      "en-AU",
      {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }
    ).format(new Date(date));
  }

  const backHref =
    viewerRole === "contractor"
      ? "/requests"
      : "/sent-requests";

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 md:p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8">
          <p className="text-gray-600">
            Loading chat...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 md:p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-8 text-center">
          <h1 className="text-2xl font-bold">
            Chat Unavailable
          </h1>

          <p className="text-red-600 mt-4">
            {error}
          </p>

          <Link
            href={backHref}
            className="inline-block mt-6 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            Go Back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <section className="bg-white rounded-2xl shadow overflow-hidden">
          <header className="border-b p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">
                  Chat with{" "}
                  {otherPersonName}
                </h1>

                <p className="text-gray-500 mt-1">
                  {otherPersonSubtitle}
                </p>

                <p className="text-sm text-gray-500 mt-1">
                  Project:{" "}
                  {request?.project_type}
                </p>
              </div>

              <Link
                href={backHref}
                className="bg-gray-200 px-5 py-3 rounded-lg text-center hover:bg-gray-300"
              >
                Back to Requests
              </Link>
            </div>
          </header>

          <div className="h-[55vh] overflow-y-auto bg-gray-50 p-4 md:p-6">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <h2 className="text-xl font-bold">
                    No Messages Yet
                  </h2>

                  <p className="text-gray-500 mt-2">
                    Send the first message
                    about this project.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(
                  (message) => {
                    const isMyMessage =
                      message.sender_id ===
                      currentUser?.id;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          isMyMessage
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                            isMyMessage
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-white border text-gray-900 rounded-bl-md"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {message.body}
                          </p>

                          <div
                            className={`flex items-center gap-2 text-xs mt-2 ${
                              isMyMessage
                                ? "text-blue-100"
                                : "text-gray-400"
                            }`}
                          >
                            <span>
                              {formatMessageTime(
                                message.created_at
                              )}
                            </span>

                            {isMyMessage && (
                              <span>
                                •{" "}
                                {message.read_at
                                  ? "Seen"
                                  : "Sent"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}

                <div
                  ref={messagesEndRef}
                />
              </div>
            )}
          </div>

          <footer className="border-t p-4 md:p-6">
            {sendError && (
              <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">
                ❌ {sendError}
              </div>
            )}

            <form
              onSubmit={
                handleSendMessage
              }
              className="flex flex-col sm:flex-row gap-3"
            >
              <textarea
                value={newMessage}
                onChange={(event) =>
                  setNewMessage(
                    event.target.value
                  )
                }
                placeholder="Write a message..."
                maxLength={2000}
                rows={2}
                disabled={sending}
                className="flex-1 border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />

              <button
                type="submit"
                disabled={
                  sending ||
                  !newMessage.trim()
                }
                className="bg-blue-600 text-white px-7 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-400"
              >
                {sending
                  ? "Sending..."
                  : "Send"}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-2 text-right">
              {newMessage.length}/2000
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}