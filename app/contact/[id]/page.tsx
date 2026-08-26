"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Contractor = {
  id: string;
  full_name: string;
  company_name: string | null;
  trade: string;
  location: string;
};

type CustomerProfile = {
  full_name: string;
  phone: string | null;
  location: string | null;
};

export default function ContactContractorPage() {
  const params = useParams<{ id: string }>();
  const contractorId = params.id;

  const router = useRouter();
  const [supabase] = useState(() =>
    createClient()
  );

  const [contractor, setContractor] =
    useState<Contractor | null>(null);

  const [senderName, setSenderName] =
    useState("");

  const [senderEmail, setSenderEmail] =
    useState("");

  const [senderPhone, setSenderPhone] =
    useState("");

  const [projectType, setProjectType] =
    useState("");

  const [
    projectLocation,
    setProjectLocation,
  ] = useState("");

  const [
    estimatedBudget,
    setEstimatedBudget,
  ] = useState("");

  const [
    preferredStart,
    setPreferredStart,
  ] = useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [success, setSuccess] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadPage() {
      if (!contractorId) {
        return;
      }

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

      if (user.id === contractorId) {
        setError(
          "You cannot send a contact request to your own profile."
        );

        setLoading(false);
        return;
      }

      setSenderEmail(user.email ?? "");

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
        router.replace("/dashboard");
        return;
      }

      const {
        data: contractorData,
        error: contractorError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          company_name,
          trade,
          location
        `)
        .eq("id", contractorId)
        .maybeSingle();

      if (
        contractorError ||
        !contractorData
      ) {
        setError(
          "Contractor profile could not be found."
        );

        setLoading(false);
        return;
      }

      setContractor(contractorData);

      const {
        data: customerProfile,
        error: customerProfileError,
      } = await supabase
        .from("customer_profiles")
        .select(`
          full_name,
          phone,
          location
        `)
        .eq("id", user.id)
        .maybeSingle();

      if (customerProfileError) {
        console.error(
          "Customer profile could not be loaded:",
          customerProfileError.message
        );
      }

      if (customerProfile) {
        const savedProfile =
          customerProfile as CustomerProfile;

        setSenderName(
          savedProfile.full_name ?? ""
        );

        setSenderPhone(
          savedProfile.phone ?? ""
        );

        setProjectLocation(
          savedProfile.location ?? ""
        );
      } else {
        const emailName =
          user.email
            ?.split("@")[0]
            .split("+")[0]
            .replace(/[._-]+/g, " ")
            .trim() ?? "";

        setSenderName(emailName);
      }

      setLoading(false);
    }

    void loadPage();
  }, [contractorId, router, supabase]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !senderName.trim() ||
      !senderEmail.trim() ||
      !projectType ||
      !projectLocation.trim() ||
      !estimatedBudget ||
      !preferredStart ||
      !message.trim()
    ) {
      setError(
        "Please complete all required fields."
      );

      setSuccess("");
      return;
    }

    setSending(true);
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

      if (user.id === contractorId) {
        throw new Error(
          "You cannot contact your own contractor profile."
        );
      }

      const {
        data: accountData,
        error: accountError,
      } = await supabase
        .from("user_accounts")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (accountError) {
        throw new Error(
          accountError.message
        );
      }

      if (
        accountData?.account_type !==
        "customer"
      ) {
        throw new Error(
          "Only customer accounts can send project requests."
        );
      }

      const { error: insertError } =
        await supabase
          .from("contact_requests")
          .insert({
            sender_id: user.id,
            contractor_id: contractorId,

            sender_name:
              senderName.trim(),

            sender_email:
              senderEmail.trim(),

            sender_phone:
              senderPhone.trim() || null,

            project_type: projectType,

            project_location:
              projectLocation.trim(),

            estimated_budget:
              estimatedBudget,

            preferred_start:
              preferredStart,

            message: message.trim(),
          });

      if (insertError) {
        throw new Error(
          insertError.message
        );
      }

      setProjectType("");
      setEstimatedBudget("");
      setPreferredStart("");
      setMessage("");

      setSuccess(
        "✅ Your contact request was sent successfully!"
      );
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send your request."
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8">
          <p className="text-gray-600">
            Loading contact form...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/contractors/${contractorId}`}
          className="inline-block mb-6 text-blue-600 hover:underline"
        >
          ← Back to Contractor Profile
        </Link>

        <div className="bg-white rounded-xl shadow p-6 md:p-8">
          <h1 className="text-3xl font-bold">
            Contact Contractor
          </h1>

          <p className="text-gray-600 mt-2">
            Send your project details directly
            to the contractor.
          </p>

          {contractor && (
            <div className="bg-gray-50 border rounded-lg p-4 mt-5">
              <p className="font-bold text-lg">
                {contractor.full_name}
              </p>

              {contractor.company_name && (
                <p className="text-gray-600">
                  {contractor.company_name}
                </p>
              )}

              <p className="text-gray-600 mt-1">
                🛠️ {contractor.trade}
              </p>

              <p className="text-gray-600">
                📍 {contractor.location}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-lg mt-6">
              ❌ {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 text-green-700 p-4 rounded-lg mt-6">
              {success}
            </div>
          )}

          {contractor && (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 mt-7"
            >
              <div>
                <label className="block font-medium mb-2">
                  Your Name *
                </label>

                <input
                  type="text"
                  value={senderName}
                  onChange={(event) =>
                    setSenderName(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Email Address *
                </label>

                <input
                  type="email"
                  value={senderEmail}
                  disabled
                  className="w-full border p-3 rounded-lg bg-gray-100 text-gray-500"
                />
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Phone Number
                </label>

                <input
                  type="tel"
                  value={senderPhone}
                  onChange={(event) =>
                    setSenderPhone(
                      event.target.value
                    )
                  }
                  placeholder="04xx xxx xxx"
                  className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Project Type *
                </label>

                <select
                  value={projectType}
                  onChange={(event) =>
                    setProjectType(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border p-3 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Select Project Type
                  </option>

                  <option value="New Build">
                    New Build
                  </option>

                  <option value="Renovation">
                    Renovation
                  </option>

                  <option value="Extension">
                    Extension
                  </option>

                  <option value="Repair">
                    Repair
                  </option>

                  <option value="Commercial Construction">
                    Commercial Construction
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Project Location *
                </label>

                <input
                  type="text"
                  value={projectLocation}
                  onChange={(event) =>
                    setProjectLocation(
                      event.target.value
                    )
                  }
                  placeholder="Example: Parramatta, NSW"
                  required
                  className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />

                <p className="text-sm text-gray-500 mt-2">
                  Your saved location is added
                  automatically, but you can change
                  it for this project.
                </p>
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Estimated Budget *
                </label>

                <select
                  value={estimatedBudget}
                  onChange={(event) =>
                    setEstimatedBudget(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border p-3 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Select Estimated Budget
                  </option>

                  <option value="Under $10,000">
                    Under $10,000
                  </option>

                  <option value="$10,000 - $50,000">
                    $10,000 - $50,000
                  </option>

                  <option value="$50,000 - $100,000">
                    $50,000 - $100,000
                  </option>

                  <option value="$100,000 - $250,000">
                    $100,000 - $250,000
                  </option>

                  <option value="$250,000+">
                    $250,000+
                  </option>

                  <option value="Not Sure">
                    Not Sure
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Preferred Start Date *
                </label>

                <select
                  value={preferredStart}
                  onChange={(event) =>
                    setPreferredStart(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border p-3 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Select Preferred Start
                  </option>

                  <option value="ASAP">
                    ASAP
                  </option>

                  <option value="Within 1 Month">
                    Within 1 Month
                  </option>

                  <option value="1-3 Months">
                    1–3 Months
                  </option>

                  <option value="3-6 Months">
                    3–6 Months
                  </option>

                  <option value="6+ Months">
                    6+ Months
                  </option>

                  <option value="Flexible">
                    Flexible
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-2">
                  Project Details *
                </label>

                <textarea
                  value={message}
                  onChange={(event) =>
                    setMessage(
                      event.target.value
                    )
                  }
                  placeholder="Describe the work you need, scope and important details..."
                  required
                  className="w-full border p-3 rounded-lg h-36 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
              >
                {sending
                  ? "Sending Request..."
                  : "Send Contact Request"}
              </button>

              <Link
                href="/customer-profile"
                className="block text-center text-blue-600 hover:underline"
              >
                Update My Customer Details
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}