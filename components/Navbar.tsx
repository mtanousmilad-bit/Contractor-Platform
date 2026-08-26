"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType =
  | "customer"
  | "contractor";

type NavLink = {
  label: string;
  href: string;
  badgeType?:
    | "requests"
    | "customer-notifications"
    | "customer-invoices"
    | "contractor-invoices"
    | "messages";
};

const publicLinks: NavLink[] = [
  {
    label: "Find Contractors",
    href: "/contractors",
  },
];

const contractorLinks: NavLink[] = [
  {
    label: "Find Contractors",
    href: "/contractors",
  },
  {
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    label: "My Projects",
    href: "/my-projects",
  },
  {
    label: "Invoices",
    href: "/invoices",
    badgeType: "contractor-invoices",
  },
  {
    label: "My Requests",
    href: "/requests",
    badgeType: "requests",
  },
  {
    label: "Messages",
    href: "/messages",
    badgeType: "messages",
  },
  {
    label: "My Profile",
    href: "/profile",
  },
];

const customerLinks: NavLink[] = [
  {
    label: "Find Contractors",
    href: "/contractors",
  },
  {
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    label: "Sent Requests",
    href: "/sent-requests",
    badgeType:
      "customer-notifications",
  },
  {
    label: "My Invoices",
    href: "/my-invoices",
    badgeType: "customer-invoices",
  },
  {
    label: "♥ Saved Contractors",
    href: "/saved-contractors",
  },
  {
    label: "Messages",
    href: "/messages",
    badgeType: "messages",
  },
  {
    label: "My Profile",
    href: "/customer-profile",
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const [
    accountType,
    setAccountType,
  ] = useState<AccountType | null>(
    null
  );

  const [
    newRequestCount,
    setNewRequestCount,
  ] = useState(0);

  const [
    customerNotificationCount,
    setCustomerNotificationCount,
  ] = useState(0);

  const [
    customerQuoteNotificationCount,
    setCustomerQuoteNotificationCount,
  ] = useState(0);

  const [
    customerInvoiceNotificationCount,
    setCustomerInvoiceNotificationCount,
  ] = useState(0);

  const [
    contractorQuoteNotificationCount,
    setContractorQuoteNotificationCount,
  ] = useState(0);

  const [
    contractorInvoiceNotificationCount,
    setContractorInvoiceNotificationCount,
  ] = useState(0);

  const [
    unreadMessageCount,
    setUnreadMessageCount,
  ] = useState(0);

  const [
    latestUnreadRequestId,
    setLatestUnreadRequestId,
  ] = useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const resetNavbar = useCallback(() => {
    setIsLoggedIn(false);
    setAccountType(null);
    setNewRequestCount(0);
    setCustomerNotificationCount(0);
    setCustomerQuoteNotificationCount(0);
    setCustomerInvoiceNotificationCount(0);
    setContractorQuoteNotificationCount(0);
    setContractorInvoiceNotificationCount(0);
    setUnreadMessageCount(0);
    setLatestUnreadRequestId(null);
  }, []);

  const refreshNavbar =
    useCallback(async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        resetNavbar();
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      const {
        data: accountData,
        error: accountError,
      } = await supabase
        .from("user_accounts")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (accountError) {
        console.error(
          "Could not load account type:",
          accountError.message
        );

        setAccountType(null);
      }

      const loadedAccountType =
        (accountData?.account_type ??
          null) as AccountType | null;

      setAccountType(
        loadedAccountType
      );

      const [
        unreadMessagesResult,
        latestUnreadResult,
      ] = await Promise.all([
        supabase
          .from("messages")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "recipient_id",
            user.id
          )
          .is("read_at", null),

        supabase
          .from("messages")
          .select(
            "request_id, created_at"
          )
          .eq(
            "recipient_id",
            user.id
          )
          .is("read_at", null)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle(),
      ]);

      if (
        unreadMessagesResult.error
      ) {
        console.error(
          "Could not load unread messages:",
          unreadMessagesResult.error
            .message
        );

        setUnreadMessageCount(0);
      } else {
        setUnreadMessageCount(
          unreadMessagesResult.count ?? 0
        );
      }

      if (latestUnreadResult.error) {
        console.error(
          "Could not load latest unread chat:",
          latestUnreadResult.error
            .message
        );

        setLatestUnreadRequestId(
          null
        );
      } else {
        setLatestUnreadRequestId(
          latestUnreadResult.data
            ?.request_id ?? null
        );
      }

      if (
        loadedAccountType ===
        "contractor"
      ) {
        const [
          newRequestsResult,
          quoteResponsesResult,
          invoicePaymentsResult,
        ] = await Promise.all([
          supabase
            .from("contact_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "contractor_id",
              user.id
            )
            .eq("status", "new"),

          supabase
            .from("project_quotes")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "contractor_id",
              user.id
            )
            .eq(
              "contractor_seen",
              false
            )
            .in("status", [
              "accepted",
              "declined",
            ]),

          supabase
            .from("project_invoices")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "contractor_id",
              user.id
            )
            .eq(
              "contractor_seen",
              false
            )
            .eq("status", "paid"),
        ]);

        if (newRequestsResult.error) {
          console.error(
            "Could not load new requests:",
            newRequestsResult.error.message
          );

          setNewRequestCount(0);
        } else {
          setNewRequestCount(
            newRequestsResult.count ?? 0
          );
        }

        if (quoteResponsesResult.error) {
          console.error(
            "Could not load contractor quote notifications:",
            quoteResponsesResult.error.message
          );

          setContractorQuoteNotificationCount(
            0
          );
        } else {
          setContractorQuoteNotificationCount(
            quoteResponsesResult.count ?? 0
          );
        }

        if (invoicePaymentsResult.error) {
          console.error(
            "Could not load contractor payment notifications:",
            invoicePaymentsResult.error.message
          );

          setContractorInvoiceNotificationCount(
            0
          );
        } else {
          setContractorInvoiceNotificationCount(
            invoicePaymentsResult.count ?? 0
          );
        }

        setCustomerNotificationCount(
          0
        );
        setCustomerQuoteNotificationCount(
          0
        );
        setCustomerInvoiceNotificationCount(
          0
        );
      } else if (
        loadedAccountType ===
        "customer"
      ) {
        const [
          requestNotificationResult,
          quoteNotificationResult,
          invoiceNotificationResult,
        ] = await Promise.all([
          supabase
            .from("contact_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "sender_id",
              user.id
            )
            .eq(
              "customer_seen",
              false
            )
            .in("status", [
              "accepted",
              "declined",
            ]),

          supabase
            .from("project_quotes")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "customer_id",
              user.id
            )
            .eq(
              "customer_seen",
              false
            )
            .eq("status", "pending"),

          supabase
            .from("project_invoices")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "customer_id",
              user.id
            )
            .eq(
              "customer_seen",
              false
            )
            .in("status", [
              "sent",
              "paid",
            ]),
        ]);

        if (
          requestNotificationResult.error
        ) {
          console.error(
            "Could not load customer request notifications:",
            requestNotificationResult.error
              .message
          );

          setCustomerNotificationCount(
            0
          );
        } else {
          setCustomerNotificationCount(
            requestNotificationResult.count ??
              0
          );
        }

        if (
          quoteNotificationResult.error
        ) {
          console.error(
            "Could not load customer quote notifications:",
            quoteNotificationResult.error
              .message
          );

          setCustomerQuoteNotificationCount(
            0
          );
        } else {
          setCustomerQuoteNotificationCount(
            quoteNotificationResult.count ??
              0
          );
        }

        if (
          invoiceNotificationResult.error
        ) {
          console.error(
            "Could not load customer invoice notifications:",
            invoiceNotificationResult.error
              .message
          );

          setCustomerInvoiceNotificationCount(
            0
          );
        } else {
          setCustomerInvoiceNotificationCount(
            invoiceNotificationResult.count ??
              0
          );
        }

        setNewRequestCount(0);
        setContractorQuoteNotificationCount(
          0
        );
        setContractorInvoiceNotificationCount(
          0
        );
      } else {
        setNewRequestCount(0);
        setCustomerNotificationCount(
          0
        );
        setCustomerQuoteNotificationCount(
          0
        );
        setCustomerInvoiceNotificationCount(
          0
        );
        setContractorQuoteNotificationCount(
          0
        );
        setContractorInvoiceNotificationCount(
          0
        );
      }

      setLoading(false);
    }, [
      resetNavbar,
      supabase,
    ]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (
      pathname !== "/requests" ||
      accountType !== "contractor"
    ) {
      return;
    }

    async function markQuoteResponsesSeen() {
      const { error } = await supabase.rpc(
        "mark_contractor_quotes_seen"
      );

      if (error) {
        console.error(
          "Could not mark contractor quote notifications as seen:",
          error.message
        );
        return;
      }

      setContractorQuoteNotificationCount(
        0
      );

      window.dispatchEvent(
        new Event(
          "contractor-quotes-seen"
        )
      );
    }

    void markQuoteResponsesSeen();
  }, [
    accountType,
    pathname,
    supabase,
  ]);

  useEffect(() => {
    if (
      pathname !== "/my-invoices" ||
      accountType !== "customer"
    ) {
      return;
    }

    async function markInvoicesSeen() {
      const { error } = await supabase.rpc(
        "mark_customer_invoices_seen"
      );

      if (error) {
        console.error(
          "Could not mark customer invoices as seen:",
          error.message
        );
        return;
      }

      setCustomerInvoiceNotificationCount(
        0
      );

      window.dispatchEvent(
        new Event(
          "customer-invoices-seen"
        )
      );
    }

    void markInvoicesSeen();
  }, [
    accountType,
    pathname,
    supabase,
  ]);

  useEffect(() => {
    if (
      pathname !== "/invoices" ||
      accountType !== "contractor"
    ) {
      return;
    }

    async function markPaymentsSeen() {
      const { error } = await supabase.rpc(
        "mark_contractor_invoices_seen"
      );

      if (error) {
        console.error(
          "Could not mark contractor payment notifications as seen:",
          error.message
        );
        return;
      }

      setContractorInvoiceNotificationCount(
        0
      );

      window.dispatchEvent(
        new Event(
          "contractor-invoices-seen"
        )
      );
    }

    void markPaymentsSeen();
  }, [
    accountType,
    pathname,
    supabase,
  ]);

  useEffect(() => {
    void refreshNavbar();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        () => {
          void refreshNavbar();
        }
      );

    const realtimeChannel =
      supabase
        .channel(
          "navbar-live-notifications"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "contact_requests",
          },
          () => {
            void refreshNavbar();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
          },
          () => {
            void refreshNavbar();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "project_quotes",
          },
          () => {
            void refreshNavbar();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "project_invoices",
          },
          () => {
            void refreshNavbar();
          }
        )
        .subscribe();

    function handleWindowFocus() {
      void refreshNavbar();
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refreshNavbar();
      }
    }

    function handleChatSeen() {
      void refreshNavbar();
    }

    function handleCustomerNotificationsSeen() {
      void refreshNavbar();
    }

    function handleContractorQuotesSeen() {
      void refreshNavbar();
    }

    function handleCustomerInvoicesSeen() {
      void refreshNavbar();
    }

    function handleContractorInvoicesSeen() {
      void refreshNavbar();
    }

    window.addEventListener(
      "focus",
      handleWindowFocus
    );

    window.addEventListener(
      "chat-messages-seen",
      handleChatSeen
    );

    window.addEventListener(
      "customer-notifications-seen",
      handleCustomerNotificationsSeen
    );

    window.addEventListener(
      "customer-quotes-seen",
      handleCustomerNotificationsSeen
    );

    window.addEventListener(
      "contractor-quotes-seen",
      handleContractorQuotesSeen
    );

    window.addEventListener(
      "customer-invoices-seen",
      handleCustomerInvoicesSeen
    );

    window.addEventListener(
      "contractor-invoices-seen",
      handleContractorInvoicesSeen
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      authListener.subscription.unsubscribe();

      void supabase.removeChannel(
        realtimeChannel
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus
      );

      window.removeEventListener(
        "chat-messages-seen",
        handleChatSeen
      );

      window.removeEventListener(
        "customer-notifications-seen",
        handleCustomerNotificationsSeen
      );

      window.removeEventListener(
        "customer-quotes-seen",
        handleCustomerNotificationsSeen
      );

      window.removeEventListener(
        "contractor-quotes-seen",
        handleContractorQuotesSeen
      );

      window.removeEventListener(
        "customer-invoices-seen",
        handleCustomerInvoicesSeen
      );

      window.removeEventListener(
        "contractor-invoices-seen",
        handleContractorInvoicesSeen
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    refreshNavbar,
    supabase,
  ]);

  async function handleLogout() {
    setLoggingOut(true);

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Logout failed:",
        error.message
      );

      setLoggingOut(false);
      return;
    }

    resetNavbar();
    setMobileMenuOpen(false);

    router.replace("/auth");
    router.refresh();
  }

  function isActiveLink(
    href: string
  ) {
    if (href === "/dashboard") {
      return (
        pathname === "/dashboard"
      );
    }

    if (href === "/") {
      return pathname === "/";
    }

    return (
      pathname === href ||
      pathname.startsWith(
        `${href}/`
      )
    );
  }

  function getBadgeCount(
    badgeType:
      | NavLink["badgeType"]
      | undefined
  ) {
    if (
      badgeType === "requests"
    ) {
      return (
        newRequestCount +
        contractorQuoteNotificationCount
      );
    }

    if (
      badgeType ===
      "customer-notifications"
    ) {
      return (
        customerNotificationCount +
        customerQuoteNotificationCount
      );
    }

    if (
      badgeType === "customer-invoices"
    ) {
      return customerInvoiceNotificationCount;
    }

    if (
      badgeType === "contractor-invoices"
    ) {
      return contractorInvoiceNotificationCount;
    }

    if (
      badgeType === "messages"
    ) {
      return unreadMessageCount;
    }

    return 0;
  }

  function badgeColour(
    badgeType:
      | NavLink["badgeType"]
      | undefined
  ) {
    if (
      badgeType === "messages"
    ) {
      return "bg-purple-600";
    }

    return "bg-red-600";
  }

  function handleBadgeClick(
    event:
      React.MouseEvent<HTMLSpanElement>,
    badgeType:
      | NavLink["badgeType"]
      | undefined
  ) {
    if (
      badgeType !== "messages" ||
      !latestUnreadRequestId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setMobileMenuOpen(false);

    router.push(
      `/messages/${latestUnreadRequestId}`
    );
  }

  function handleBadgeKeyDown(
    event:
      React.KeyboardEvent<HTMLSpanElement>,
    badgeType:
      | NavLink["badgeType"]
      | undefined
  ) {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    if (
      badgeType !== "messages" ||
      !latestUnreadRequestId
    ) {
      return;
    }

    event.preventDefault();

    setMobileMenuOpen(false);

    router.push(
      `/messages/${latestUnreadRequestId}`
    );
  }

  function renderNavLink(
    link: NavLink,
    mobile = false
  ) {
    const active =
      isActiveLink(link.href);

    const badgeCount =
      getBadgeCount(
        link.badgeType
      );

    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={() =>
          setMobileMenuOpen(false)
        }
        className={`relative flex items-center gap-2 rounded-lg font-medium transition ${
          mobile
            ? "w-full px-4 py-3"
            : "px-4 py-3"
        } ${
          active
            ? "bg-blue-600 text-white"
            : "text-gray-800 hover:bg-gray-100"
        }`}
      >
        <span>{link.label}</span>

        {badgeCount > 0 && (
          <span
            role={
              link.badgeType ===
                "messages" &&
              latestUnreadRequestId
                ? "button"
                : undefined
            }
            tabIndex={
              link.badgeType ===
                "messages" &&
              latestUnreadRequestId
                ? 0
                : undefined
            }
            title={
              link.badgeType ===
                "messages" &&
              latestUnreadRequestId
                ? "Open latest unread chat"
                : undefined
            }
            onClick={(event) =>
              handleBadgeClick(
                event,
                link.badgeType
              )
            }
            onKeyDown={(event) =>
              handleBadgeKeyDown(
                event,
                link.badgeType
              )
            }
            className={`min-w-6 h-6 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center ${badgeColour(
              link.badgeType
            )}`}
          >
            {badgeCount > 99
              ? "99+"
              : badgeCount}
          </span>
        )}
      </Link>
    );
  }

  if (pathname === "/auth") {
    return null;
  }

  const links: NavLink[] =
    accountType === "contractor"
      ? contractorLinks
      : accountType === "customer"
        ? customerLinks
        : publicLinks;

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="min-h-20 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-xl md:text-2xl font-bold whitespace-nowrap"
          >
            Contractor Platform
          </Link>

          <nav className="hidden xl:flex items-center gap-1">
            {links.map((link) =>
              renderNavLink(link)
            )}
          </nav>

          <div className="hidden xl:flex items-center">
            {!loading &&
              (isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={
                    loggingOut
                  }
                  className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400"
                >
                  {loggingOut
                    ? "Logging Out..."
                    : "Log Out"}
                </button>
              ) : (
                <Link
                  href="/auth"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
                >
                  Log In
                </Link>
              ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setMobileMenuOpen(
                (current) =>
                  !current
              )
            }
            aria-label="Open navigation menu"
            aria-expanded={
              mobileMenuOpen
            }
            className="xl:hidden w-11 h-11 border rounded-lg flex items-center justify-center text-2xl"
          >
            {mobileMenuOpen
              ? "✕"
              : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="xl:hidden border-t py-4">
            <nav className="flex flex-col gap-2">
              {links.map((link) =>
                renderNavLink(
                  link,
                  true
                )
              )}

              {!loading &&
                (isLoggedIn ? (
                  <button
                    type="button"
                    onClick={
                      handleLogout
                    }
                    disabled={
                      loggingOut
                    }
                    className="w-full bg-red-600 text-white px-4 py-3 rounded-lg font-semibold text-left hover:bg-red-700 disabled:bg-gray-400"
                  >
                    {loggingOut
                      ? "Logging Out..."
                      : "Log Out"}
                  </button>
                ) : (
                  <Link
                    href="/auth"
                    onClick={() =>
                      setMobileMenuOpen(
                        false
                      )
                    }
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold"
                  >
                    Log In
                  </Link>
                ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}