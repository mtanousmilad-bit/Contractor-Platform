"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CustomerProfileForm = {
  full_name: string;
  phone: string;
  location: string;
};

const emptyProfile: CustomerProfileForm = {
  full_name: "",
  phone: "",
  location: "",
};

export default function CustomerProfilePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [profile, setProfile] =
    useState<CustomerProfileForm>(emptyProfile);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadCustomerProfile() {
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

      setEmail(user.email ?? "");

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

      if (accountData?.account_type !== "customer") {
        router.replace("/dashboard");
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("customer_profiles")
        .select(`
          full_name,
          phone,
          location
        `)
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (profileData) {
        setProfile({
          full_name: profileData.full_name ?? "",
          phone: profileData.phone ?? "",
          location: profileData.location ?? "",
        });
      } else {
        const emailName = user.email
          ?.split("@")[0]
          .split("+")[0]
          .replace(/[._-]+/g, " ")
          .trim();

        setProfile({
          full_name: emailName ?? "",
          phone: "",
          location: "",
        });
      }

      setLoading(false);
    }

    void loadCustomerProfile();
  }, [router, supabase]);

  async function handleSave(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!profile.full_name.trim()) {
      setError("Please enter your full name.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please log in again.");
      }

      const { error: saveError } = await supabase
        .from("customer_profiles")
        .upsert(
          {
            id: user.id,
            full_name: profile.full_name.trim(),
            phone: profile.phone.trim() || null,
            location: profile.location.trim() || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          }
        );

      if (saveError) {
        throw new Error(saveError.message);
      }

      setProfile((currentProfile) => ({
        full_name: currentProfile.full_name.trim(),
        phone: currentProfile.phone.trim(),
        location: currentProfile.location.trim(),
      }));

      setMessage("Customer profile saved successfully!");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your customer profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8">
          <p className="text-gray-600">
            Loading customer profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">
              My Customer Profile
            </h1>

            <p className="text-gray-600 mt-2">
              Save your contact details for future project
              requests.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="bg-gray-200 px-5 py-3 rounded-lg text-center hover:bg-gray-300"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow p-6 md:p-8">
          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
              ❌ {error}
            </div>
          )}

          {message && (
            <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-6">
              ✅ {message}
            </div>
          )}

          <form
            onSubmit={handleSave}
            className="space-y-5"
          >
            <div>
              <label className="block font-medium mb-2">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                disabled
                className="w-full border p-3 rounded-lg bg-gray-100 text-gray-500"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">
                Full Name *
              </label>

              <input
                type="text"
                value={profile.full_name}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    full_name: event.target.value,
                  })
                }
                placeholder="Your full name"
                required
                className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">
                Phone Number
              </label>

              <input
                type="tel"
                value={profile.phone}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    phone: event.target.value,
                  })
                }
                placeholder="04xx xxx xxx"
                className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">
                Location
              </label>

              <input
                type="text"
                value={profile.location}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    location: event.target.value,
                  })
                }
                placeholder="Example: Parramatta, NSW"
                className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
            >
              {saving
                ? "Saving Profile..."
                : "Save Customer Profile"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}