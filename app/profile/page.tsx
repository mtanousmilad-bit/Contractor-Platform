"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProfileForm = {
  full_name: string;
  company_name: string;
  trade: string;
  location: string;
  phone: string;
  bio: string;
  years_experience: string;
  services: string;
  avatar_url: string | null;
};

type StripeConnectStatus = {
  connected: boolean;
  accountId?: string;
  detailsSubmitted?: boolean;
  transfersStatus?: string;
  payoutsEnabled?: boolean;
  ready?: boolean;
};

const emptyProfile: ProfileForm = {
  full_name: "",
  company_name: "",
  trade: "",
  location: "",
  phone: "",
  bio: "",
  years_experience: "",
  services: "",
  avatar_url: null,
};

export default function ProfilePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [profile, setProfile] =
    useState<ProfileForm>(emptyProfile);

  const [email, setEmail] = useState("");
  const [avatarFile, setAvatarFile] =
    useState<File | null>(null);

  const [fileInputKey, setFileInputKey] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [stripeStatus, setStripeStatus] =
    useState<StripeConnectStatus>({
      connected: false,
    });

  const [stripeStatusLoading, setStripeStatusLoading] =
    useState(true);

  const [stripeConnecting, setStripeConnecting] =
    useState(false);

  const [stripeMessage, setStripeMessage] =
    useState("");

  const loadStripeStatus = useCallback(
    async () => {
      setStripeStatusLoading(true);

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
          "/api/stripe/connect/status",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const result =
          (await response.json()) as
            StripeConnectStatus & {
              error?: string;
            };

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Could not load Stripe account status."
          );
        }

        setStripeStatus(result);
      } catch (stripeError) {
        console.error(
          "Stripe status error:",
          stripeError
        );

        setStripeStatus({
          connected: false,
        });
      } finally {
        setStripeStatusLoading(false);
      }
    },
    [supabase]
  );

  const startStripeOnboarding = useCallback(
    async () => {
      setStripeConnecting(true);
      setStripeMessage("");
      setError("");

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
          "/api/stripe/connect/onboard",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

        const result =
          (await response.json()) as {
            url?: string;
            error?: string;
          };

        if (!response.ok || !result.url) {
          throw new Error(
            result.error ??
              "Could not start Stripe onboarding."
          );
        }

        window.location.assign(result.url);
      } catch (stripeError) {
        setError(
          stripeError instanceof Error
            ? stripeError.message
            : "Could not start Stripe onboarding."
        );

        setStripeConnecting(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void loadStripeStatus();
  }, [loadStripeStatus]);

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const stripeAction =
      params.get("stripe");

    if (stripeAction === "return") {
      setStripeMessage(
        "Stripe setup returned to your profile. Checking your account status..."
      );

      void loadStripeStatus().then(() => {
        window.history.replaceState(
          {},
          "",
          "/profile"
        );
      });
    }

    if (stripeAction === "refresh") {
      setStripeMessage(
        "Your Stripe setup link expired. Opening a new secure setup link..."
      );

      window.history.replaceState(
        {},
        "",
        "/profile"
      );

      void startStripeOnboarding();
    }
  }, [
    loadStripeStatus,
    startStripeOnboarding,
  ]);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
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

      setEmail(user.email ?? "");

      const {
        data,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          `
            full_name,
            company_name,
            trade,
            location,
            phone,
            bio,
            years_experience,
            services,
            avatar_url
          `
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setProfile({
          full_name: data.full_name ?? "",
          company_name: data.company_name ?? "",
          trade: data.trade ?? "",
          location: data.location ?? "",
          phone: data.phone ?? "",
          bio: data.bio ?? "",

          years_experience:
            data.years_experience !== null &&
            data.years_experience !== undefined
              ? String(data.years_experience)
              : "",

          services: data.services ?? "",
          avatar_url: data.avatar_url ?? null,
        });
      }

      setLoading(false);
    }

    void loadProfile();
  }, [router, supabase]);

  function getAvatarPath(
    avatarUrl: string | null
  ) {
    if (!avatarUrl) return null;

    const marker =
      "/storage/v1/object/public/profile-images/";

    const path = avatarUrl.split(marker)[1];

    if (!path) return null;

    return decodeURIComponent(
      path.split("?")[0]
    );
  }

  async function handleSave(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (
      !profile.full_name.trim() ||
      !profile.trade.trim() ||
      !profile.location.trim()
    ) {
      setError(
        "Please enter your name, trade and location."
      );

      setMessage("");
      return;
    }

    if (avatarFile) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (!allowedTypes.includes(avatarFile.type)) {
        setError(
          "Please select a JPG, PNG or WebP image."
        );

        setMessage("");
        return;
      }

      if (avatarFile.size > 5 * 1024 * 1024) {
        setError(
          "Profile photo must be smaller than 5 MB."
        );

        setMessage("");
        return;
      }
    }

    const yearsExperience =
      profile.years_experience.trim() === ""
        ? null
        : Number(profile.years_experience);

    if (
      yearsExperience !== null &&
      (
        !Number.isInteger(yearsExperience) ||
        yearsExperience < 0 ||
        yearsExperience > 80
      )
    ) {
      setError(
        "Please enter a valid number of years of experience."
      );

      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    let newAvatarPath: string | null = null;
    let newAvatarUrl = profile.avatar_url;

    const oldAvatarPath = getAvatarPath(
      profile.avatar_url
    );

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Please log in again."
        );
      }

      if (avatarFile) {
        const extension =
          avatarFile.type === "image/png"
            ? "png"
            : avatarFile.type === "image/webp"
              ? "webp"
              : "jpg";

        newAvatarPath =
          `${user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } =
          await supabase.storage
            .from("profile-images")
            .upload(
              newAvatarPath,
              avatarFile,
              {
                contentType: avatarFile.type,
                cacheControl: "3600",
                upsert: false,
              }
            );

        if (uploadError) {
          throw new Error(
            uploadError.message
          );
        }

        const { data: publicUrlData } =
          supabase.storage
            .from("profile-images")
            .getPublicUrl(newAvatarPath);

        newAvatarUrl =
          publicUrlData.publicUrl;
      }

      const { error: saveError } =
        await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,

              full_name:
                profile.full_name.trim(),

              company_name:
                profile.company_name.trim() ||
                null,

              trade: profile.trade.trim(),

              location:
                profile.location.trim(),

              phone:
                profile.phone.trim() || null,

              bio:
                profile.bio.trim() || null,

              years_experience:
                yearsExperience,

              services:
                profile.services.trim() ||
                null,

              avatar_url: newAvatarUrl,

              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: "id",
            }
          );

      if (saveError) {
        if (newAvatarPath) {
          await supabase.storage
            .from("profile-images")
            .remove([newAvatarPath]);
        }

        throw new Error(
          saveError.message
        );
      }

      if (
        avatarFile &&
        oldAvatarPath &&
        oldAvatarPath !== newAvatarPath
      ) {
        const {
          error: oldAvatarDeleteError,
        } = await supabase.storage
          .from("profile-images")
          .remove([oldAvatarPath]);

        if (oldAvatarDeleteError) {
          console.error(
            "Old profile photo deletion failed:",
            oldAvatarDeleteError.message
          );
        }
      }

      setProfile((currentProfile) => ({
        ...currentProfile,

        full_name:
          currentProfile.full_name.trim(),

        company_name:
          currentProfile.company_name.trim(),

        trade:
          currentProfile.trade.trim(),

        location:
          currentProfile.location.trim(),

        phone:
          currentProfile.phone.trim(),

        bio:
          currentProfile.bio.trim(),

        services:
          currentProfile.services.trim(),

        avatar_url: newAvatarUrl,
      }));

      setAvatarFile(null);
      setFileInputKey(
        (currentKey) => currentKey + 1
      );

      setMessage(
        "✅ Profile saved successfully!"
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-8">
          <p className="text-gray-600">
            Loading profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">
              My Profile
            </h1>

            <p className="text-gray-600 mt-2">
              Update your contractor and business details.
            </p>
          </div>

          <Link
            href="/my-projects"
            className="bg-gray-200 px-5 py-3 rounded-lg text-center hover:bg-gray-300"
          >
            Back to Projects
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow p-8">
          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
              ❌ {error}
            </div>
          )}

          {message && (
            <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-6">
              {message}
            </div>
          )}

          <section className="mb-8 border rounded-xl p-5 bg-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  Stripe Payments
                </h2>

                <p className="text-gray-600 mt-1">
                  Connect your Stripe account so customer payments can be transferred to you.
                </p>

                {stripeMessage && (
                  <p className="text-blue-700 mt-3 text-sm">
                    {stripeMessage}
                  </p>
                )}

                {!stripeStatusLoading && (
                  <div className="mt-4">
                    {!stripeStatus.connected ? (
                      <p className="text-amber-700 font-semibold">
                        Stripe account not connected yet.
                      </p>
                    ) : stripeStatus.ready ? (
                      <div>
                        <p className="text-green-700 font-bold">
                          ✅ Stripe account connected and ready.
                        </p>

                        <p className="text-sm text-gray-600 mt-1">
                          Transfers: {stripeStatus.transfersStatus ?? "unknown"} · Payouts enabled
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-amber-700 font-bold">
                          Stripe setup is not complete yet.
                        </p>

                        <p className="text-sm text-gray-600 mt-1">
                          Transfers: {stripeStatus.transfersStatus ?? "pending"} ·
                          Payouts: {stripeStatus.payoutsEnabled ? "enabled" : "not enabled yet"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={
                  stripeConnecting ||
                  stripeStatusLoading ||
                  stripeStatus.ready
                }
                onClick={() =>
                  void startStripeOnboarding()
                }
                className="shrink-0 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {stripeConnecting
                  ? "Opening Stripe..."
                  : stripeStatus.ready
                    ? "Stripe Connected"
                    : stripeStatus.connected
                      ? "Continue Stripe Setup"
                      : "Connect Stripe Account"}
              </button>
            </div>
          </section>

          <form
            onSubmit={handleSave}
            className="space-y-5"
          >
            <div className="flex flex-col items-center mb-8">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-36 h-36 rounded-full object-cover border-4 border-gray-100 shadow"
                />
              ) : (
                <div className="w-36 h-36 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 border-4 border-gray-100">
                  Profile Photo
                </div>
              )}

              <div className="w-full mt-5">
                <label className="block font-medium mb-2">
                  Profile Photo
                </label>

                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    setAvatarFile(
                      e.target.files?.[0] ??
                        null
                    );

                    setMessage("");
                    setError("");
                  }}
                  className="w-full border p-3 rounded-lg"
                />

                <p className="text-sm text-gray-500 mt-2">
                  JPG, PNG or WebP. Maximum size:
                  5 MB.
                </p>

                {avatarFile && (
                  <p className="text-sm text-blue-600 mt-2">
                    New photo selected:{" "}
                    {avatarFile.name}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block font-medium mb-2">
                Email Address
              </label>

              <input
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
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    full_name:
                      e.target.value,
                  })
                }
                placeholder="Your full name"
                required
                className="w-full border p-3 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">
                Company Name
              </label>

              <input
                value={profile.company_name}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    company_name:
                      e.target.value,
                  })
                }
                placeholder="Your company name"
                className="w-full border p-3 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">
                Trade / Specialisation *
              </label>

              <select
                value={profile.trade}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    trade: e.target.value,
                  })
                }
                required
                className="w-full border p-3 rounded-lg"
              >
                <option value="" disabled>
                  Select Trade
                </option>

                <option value="Builder">
                  Builder
                </option>

                <option value="Carpenter">
                  Carpenter
                </option>

                <option value="Electrician">
                  Electrician
                </option>

                <option value="Plumber">
                  Plumber
                </option>

                <option value="Painter">
                  Painter
                </option>

                <option value="Tiler">
                  Tiler
                </option>

                <option value="Landscaper">
                  Landscaper
                </option>

                <option value="Concreter">
                  Concreter
                </option>

                <option value="Roofer">
                  Roofer
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-2">
                Location *
              </label>

              <input
                value={profile.location}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    location:
                      e.target.value,
                  })
                }
                placeholder="Sydney, NSW"
                required
                className="w-full border p-3 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">
                Years of Experience
              </label>

              <input
                type="number"
                min="0"
                max="80"
                value={
                  profile.years_experience
                }
                onChange={(e) =>
                  setProfile({
                    ...profile,

                    years_experience:
                      e.target.value,
                  })
                }
                placeholder="Example: 10"
                className="w-full border p-3 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">
                Phone Number
              </label>

              <input
                type="tel"
                value={profile.phone}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    phone: e.target.value,
                  })
                }
                placeholder="04xx xxx xxx"
                className="w-full border p-3 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">
                Services You Provide
              </label>

              <textarea
                value={profile.services}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    services:
                      e.target.value,
                  })
                }
                placeholder="Renovations, extensions, bathroom upgrades..."
                className="w-full border p-3 rounded-lg h-28"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">
                About You
              </label>

              <textarea
                value={profile.bio}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    bio: e.target.value,
                  })
                }
                placeholder="Describe your experience and business..."
                className="w-full border p-3 rounded-lg h-32"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
            >
              {saving
                ? "Uploading and Saving..."
                : "Save Profile"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}