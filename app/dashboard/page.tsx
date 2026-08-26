"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType = "customer" | "contractor";

type DashboardStats = {
  projects: number;
  incomingRequests: number;
  newIncomingRequests: number;
  acceptedIncomingRequests: number;

  sentRequests: number;
  waitingSentRequests: number;
  acceptedSentRequests: number;
  declinedSentRequests: number;
};

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: number;
  href: string;
  linkText: string;
};

function StatCard({
  icon,
  label,
  value,
  href,
  linkText,
}: StatCardProps) {
  return (
    <Link
      href={href}
      className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition"
    >
      <div className="text-4xl">{icon}</div>

      <p className="text-gray-600 mt-5">
        {label}
      </p>

      <p className="text-4xl font-bold mt-2">
        {value}
      </p>

      <p className="text-blue-600 mt-4">
        {linkText} →
      </p>
    </Link>
  );
}

function formatEmailName(email: string | undefined) {
  if (!email) {
    return "User";
  }

  const emailName = email
    .split("@")[0]
    .replace(/[+._-]+/g, " ")
    .trim();

  return emailName
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

export default function DashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    createClient()
  );

  const [accountType, setAccountType] =
    useState<AccountType | null>(null);

  const [name, setName] = useState("");

  const [stats, setStats] =
    useState<DashboardStats>({
      projects: 0,
      incomingRequests: 0,
      newIncomingRequests: 0,
      acceptedIncomingRequests: 0,

      sentRequests: 0,
      waitingSentRequests: 0,
      acceptedSentRequests: 0,
      declinedSentRequests: 0,
    });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
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

      const [
        accountResult,
        profileResult,
      ] = await Promise.all([
        supabase
          .from("user_accounts")
          .select("account_type")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (
        accountResult.error ||
        !accountResult.data
      ) {
        setError(
          accountResult.error?.message ||
            "Your account type could not be found."
        );
        setLoading(false);
        return;
      }

      const currentAccountType =
        accountResult.data
          .account_type as AccountType;

      setAccountType(currentAccountType);

      setName(
        profileResult.data?.full_name ||
          formatEmailName(user.email)
      );

      if (
        currentAccountType === "contractor"
      ) {
        const [
          projectsResult,
          incomingResult,
          newIncomingResult,
          acceptedIncomingResult,
        ] = await Promise.all([
          supabase
            .from("projects")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("user_id", user.id),

          supabase
            .from("contact_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("contractor_id", user.id),

          supabase
            .from("contact_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("contractor_id", user.id)
            .eq("status", "new"),

          supabase
            .from("contact_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("contractor_id", user.id)
            .eq("status", "accepted"),
        ]);

        const contractorError =
          projectsResult.error ||
          incomingResult.error ||
          newIncomingResult.error ||
          acceptedIncomingResult.error;

        if (contractorError) {
          setError(contractorError.message);
        }

        setStats((currentStats) => ({
          ...currentStats,

          projects:
            projectsResult.count ?? 0,

          incomingRequests:
            incomingResult.count ?? 0,

          newIncomingRequests:
            newIncomingResult.count ?? 0,

          acceptedIncomingRequests:
            acceptedIncomingResult.count ?? 0,
        }));
      } else {
        const [
          sentResult,
          waitingResult,
          acceptedResult,
          declinedResult,
        ] = await Promise.all([
          supabase
            .from("contact_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("sender_id", user.id),

          supabase
            .from("contact_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("sender_id", user.id)
            .in("status", ["new", "read"]),

          supabase
            .from("contact_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("sender_id", user.id)
            .eq("status", "accepted"),

          supabase
            .from("contact_requests")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("sender_id", user.id)
            .eq("status", "declined"),
        ]);

        const customerError =
          sentResult.error ||
          waitingResult.error ||
          acceptedResult.error ||
          declinedResult.error;

        if (customerError) {
          setError(customerError.message);
        }

        setStats((currentStats) => ({
          ...currentStats,

          sentRequests:
            sentResult.count ?? 0,

          waitingSentRequests:
            waitingResult.count ?? 0,

          acceptedSentRequests:
            acceptedResult.count ?? 0,

          declinedSentRequests:
            declinedResult.count ?? 0,
        }));
      }

      setLoading(false);
    }

    void loadDashboard();
  }, [router, supabase]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow p-8">
            <p className="text-gray-600">
              Loading dashboard...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!accountType) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow p-8">
            <h1 className="text-2xl font-bold">
              Account Error
            </h1>

            <p className="text-red-600 mt-3">
              {error ||
                "Your account type is unavailable."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const isContractor =
    accountType === "contractor";

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <section className="mb-9">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-blue-600 font-semibold">
              Account Overview
            </p>

            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                isContractor
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {isContractor
                ? "Contractor Account"
                : "Customer Account"}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mt-3">
            Welcome back, {name}
          </h1>

          <p className="text-gray-600 text-lg mt-3">
            {isContractor
              ? "Manage your projects and customer enquiries."
              : "Find contractors and track your project requests."}
          </p>
        </section>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-7">
            ❌ {error}
          </div>
        )}

        {isContractor ? (
          <>
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                icon="🏗️"
                label="My Projects"
                value={stats.projects}
                href="/my-projects"
                linkText="View projects"
              />

              <StatCard
                icon="📥"
                label="Incoming Requests"
                value={
                  stats.incomingRequests
                }
                href="/requests"
                linkText="Manage requests"
              />

              <StatCard
                icon="🔔"
                label="New Requests"
                value={
                  stats.newIncomingRequests
                }
                href="/requests"
                linkText="View new requests"
              />

              <StatCard
                icon="✅"
                label="Accepted Requests"
                value={
                  stats.acceptedIncomingRequests
                }
                href="/requests"
                linkText="View accepted"
              />
            </section>

            <section className="bg-white border rounded-2xl p-7 md:p-8 shadow-sm mt-9">
              <h2 className="text-2xl font-bold">
                Contractor Quick Actions
              </h2>

              <p className="text-gray-600 mt-2">
                Manage your contractor account and
                showcase your work.
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap gap-4 mt-6">
                <Link
                  href="/projects"
                  className="bg-black text-white px-6 py-3 rounded-lg text-center hover:bg-gray-800"
                >
                  + Add New Project
                </Link>

                <Link
                  href="/my-projects"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg text-center hover:bg-blue-700"
                >
                  My Projects
                </Link>

                <Link
                  href="/requests"
                  className="bg-gray-200 px-6 py-3 rounded-lg text-center hover:bg-gray-300"
                >
                  Incoming Requests
                </Link>

                <Link
                  href="/profile"
                  className="bg-gray-200 px-6 py-3 rounded-lg text-center hover:bg-gray-300"
                >
                  Edit My Profile
                </Link>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                icon="📤"
                label="Sent Requests"
                value={stats.sentRequests}
                href="/sent-requests"
                linkText="View requests"
              />

              <StatCard
                icon="⏳"
                label="Waiting for Response"
                value={
                  stats.waitingSentRequests
                }
                href="/sent-requests"
                linkText="Track requests"
              />

              <StatCard
                icon="✅"
                label="Accepted Requests"
                value={
                  stats.acceptedSentRequests
                }
                href="/sent-requests"
                linkText="View accepted"
              />

              <StatCard
                icon="❌"
                label="Declined Requests"
                value={
                  stats.declinedSentRequests
                }
                href="/sent-requests"
                linkText="View declined"
              />
            </section>

            <section className="bg-white border rounded-2xl p-7 md:p-8 shadow-sm mt-9">
              <h2 className="text-2xl font-bold">
                Customer Quick Actions
              </h2>

              <p className="text-gray-600 mt-2">
                Find construction professionals and
                manage the requests you sent.
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap gap-4 mt-6">
                <Link
                  href="/contractors"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg text-center hover:bg-blue-700"
                >
                  Find Contractors
                </Link>

                <Link
                  href="/sent-requests"
                  className="bg-black text-white px-6 py-3 rounded-lg text-center hover:bg-gray-800"
                >
                  My Sent Requests
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}