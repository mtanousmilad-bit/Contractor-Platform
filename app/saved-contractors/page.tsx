"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ContractorProfile = {
  id: string;
  full_name: string;
  company_name: string | null;
  trade: string;
  location: string;
  bio: string | null;
  avatar_url: string | null;
  years_experience: number | null;
  services: string | null;
};

type SavedContractorRow = {
  contractor_id: string;
  created_at: string;
};

type ReviewRow = {
  contractor_id: string;
  rating: number;
};

type SavedContractor = ContractorProfile & {
  savedAt: string;
  averageRating: number;
  reviewCount: number;
};

export default function SavedContractorsPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [
    savedContractors,
    setSavedContractors,
  ] = useState<SavedContractor[]>([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [
    selectedTrade,
    setSelectedTrade,
  ] = useState("all");

  const [
    removingContractorId,
    setRemovingContractorId,
  ] = useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSavedContractors() {
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
        data: savedData,
        error: savedError,
      } = await supabase
        .from("saved_contractors")
        .select(`
          contractor_id,
          created_at
        `)
        .eq("customer_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (!isMounted) {
        return;
      }

      if (savedError) {
        setError(savedError.message);
        setLoading(false);
        return;
      }

      const savedRows =
        (savedData ??
          []) as SavedContractorRow[];

      if (savedRows.length === 0) {
        setSavedContractors([]);
        setLoading(false);
        return;
      }

      const contractorIds =
        savedRows.map(
          (saved) =>
            saved.contractor_id
        );

      const [
        profilesResult,
        reviewsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(`
            id,
            full_name,
            company_name,
            trade,
            location,
            bio,
            avatar_url,
            years_experience,
            services
          `)
          .in("id", contractorIds),

        supabase
          .from("reviews")
          .select(`
            contractor_id,
            rating
          `)
          .in(
            "contractor_id",
            contractorIds
          ),
      ]);

      if (!isMounted) {
        return;
      }

      if (profilesResult.error) {
        setError(
          profilesResult.error.message
        );
        setLoading(false);
        return;
      }

      if (reviewsResult.error) {
        console.error(
          "Could not load reviews:",
          reviewsResult.error.message
        );
      }

      const profiles =
        (profilesResult.data ??
          []) as ContractorProfile[];

      const reviews =
        (reviewsResult.data ??
          []) as ReviewRow[];

      const combined:
        SavedContractor[] =
        savedRows
          .map((savedRow) => {
            const profile =
              profiles.find(
                (contractor) =>
                  contractor.id ===
                  savedRow.contractor_id
              );

            if (!profile) {
              return null;
            }

            const contractorReviews =
              reviews.filter(
                (review) =>
                  review.contractor_id ===
                  profile.id
              );

            const reviewCount =
              contractorReviews.length;

            const totalRating =
              contractorReviews.reduce(
                (total, review) =>
                  total +
                  review.rating,
                0
              );

            const averageRating =
              reviewCount === 0
                ? 0
                : totalRating /
                  reviewCount;

            return {
              ...profile,
              savedAt:
                savedRow.created_at,
              averageRating,
              reviewCount,
            };
          })
          .filter(
            (
              contractor
            ): contractor is SavedContractor =>
              contractor !== null
          );

      setSavedContractors(combined);
      setLoading(false);
    }

    void loadSavedContractors();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  async function removeSavedContractor(
    contractorId: string
  ) {
    const confirmed =
      window.confirm(
        "Remove this contractor from your saved list?"
      );

    if (!confirmed) {
      return;
    }

    setRemovingContractorId(
      contractorId
    );

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

      const { error: deleteError } =
        await supabase
          .from("saved_contractors")
          .delete()
          .eq(
            "customer_id",
            user.id
          )
          .eq(
            "contractor_id",
            contractorId
          );

      if (deleteError) {
        throw new Error(
          deleteError.message
        );
      }

      setSavedContractors(
        (currentContractors) =>
          currentContractors.filter(
            (contractor) =>
              contractor.id !==
              contractorId
          )
      );

      window.dispatchEvent(
        new Event(
          "saved-contractors-updated"
        )
      );

      setSuccess(
        "Contractor removed from your saved list."
      );
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove this contractor."
      );
    } finally {
      setRemovingContractorId(
        null
      );
    }
  }

  const tradeOptions = useMemo(() => {
    return [
      ...new Set(
        savedContractors.map(
          (contractor) =>
            contractor.trade
        )
      ),
    ].sort((first, second) =>
      first.localeCompare(second)
    );
  }, [savedContractors]);

  const filteredContractors =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return savedContractors.filter(
        (contractor) => {
          const matchesTrade =
            selectedTrade ===
              "all" ||
            contractor.trade ===
              selectedTrade;

          const matchesSearch =
            normalizedSearch.length ===
              0 ||
            contractor.full_name
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            (
              contractor.company_name ??
              ""
            )
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            contractor.trade
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            contractor.location
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            (
              contractor.services ??
              ""
            )
              .toLowerCase()
              .includes(
                normalizedSearch
              );

          return (
            matchesTrade &&
            matchesSearch
          );
        }
      );
    }, [
      savedContractors,
      searchTerm,
      selectedTrade,
    ]);

  function getInitial(
    name: string
  ) {
    return (
      name
        .trim()
        .charAt(0)
        .toUpperCase() || "C"
    );
  }

  function getServices(
    services: string | null
  ) {
    if (!services) {
      return [];
    }

    return services
      .split(/[\n,;]+/)
      .map((service) =>
        service.trim()
      )
      .filter(Boolean)
      .slice(0, 3);
  }

  function renderStars(
    rating: number
  ) {
    const roundedRating =
      Math.round(rating);

    return (
      <div className="flex items-center gap-0.5 text-lg">
        {[1, 2, 3, 4, 5].map(
          (star) => (
            <span
              key={star}
              className={
                star <=
                roundedRating
                  ? "text-yellow-500"
                  : "text-gray-300"
              }
            >
              ★
            </span>
          )
        )}
      </div>
    );
  }

  function clearFilters() {
    setSearchTerm("");
    setSelectedTrade("all");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow p-8">
          <p className="text-gray-600">
            Loading saved contractors...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-8">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold">
              ♥ Saved Contractors
            </h1>

            <p className="text-gray-600 mt-3">
              Contractors you saved for
              future projects.
            </p>
          </div>

          <Link
            href="/contractors"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg text-center font-semibold hover:bg-blue-700"
          >
            Find More Contractors
          </Link>
        </section>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6">
            ✅ {success}
          </div>
        )}

        {savedContractors.length >
          0 && (
          <section className="bg-white rounded-2xl shadow p-5 md:p-6 mb-8">
            <div className="grid md:grid-cols-[1fr_260px] gap-4">
              <div>
                <label
                  htmlFor="saved-search"
                  className="block font-semibold mb-2"
                >
                  Search
                </label>

                <input
                  id="saved-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search saved contractors..."
                  className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="saved-trade"
                  className="block font-semibold mb-2"
                >
                  Trade
                </label>

                <select
                  id="saved-trade"
                  value={selectedTrade}
                  onChange={(event) =>
                    setSelectedTrade(
                      event.target.value
                    )
                  }
                  className="w-full border rounded-lg px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">
                    All Trades
                  </option>

                  {tradeOptions.map(
                    (trade) => (
                      <option
                        key={trade}
                        value={trade}
                      >
                        {trade}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5">
              <p className="text-gray-600">
                Showing{" "}
                <strong>
                  {
                    filteredContractors.length
                  }
                </strong>{" "}
                of{" "}
                <strong>
                  {
                    savedContractors.length
                  }
                </strong>{" "}
                saved contractors
              </p>

              {(searchTerm ||
                selectedTrade !==
                  "all") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-blue-600 font-semibold hover:underline self-start"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </section>
        )}

        {savedContractors.length ===
        0 ? (
          <section className="bg-white rounded-2xl shadow p-10 text-center">
            <div className="text-6xl">
              ♡
            </div>

            <h2 className="text-2xl font-bold mt-5">
              No Saved Contractors
            </h2>

            <p className="text-gray-600 mt-3">
              Save contractors you may want
              to contact for future
              projects.
            </p>

            <Link
              href="/contractors"
              className="inline-block mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Browse Contractors
            </Link>
          </section>
        ) : filteredContractors.length ===
          0 ? (
          <section className="bg-white rounded-2xl shadow p-10 text-center">
            <div className="text-5xl">
              🔍
            </div>

            <h2 className="text-2xl font-bold mt-4">
              No Results Found
            </h2>

            <p className="text-gray-600 mt-3">
              No saved contractors match
              your search.
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
          <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredContractors.map(
              (contractor) => {
                const services =
                  getServices(
                    contractor.services
                  );

                const isRemoving =
                  removingContractorId ===
                  contractor.id;

                return (
                  <article
                    key={contractor.id}
                    className="relative bg-white rounded-2xl shadow overflow-hidden flex flex-col hover:shadow-lg transition"
                  >
                    <button
                      type="button"
                      disabled={
                        isRemoving
                      }
                      onClick={() =>
                        removeSavedContractor(
                          contractor.id
                        )
                      }
                      title="Remove from saved contractors"
                      className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center text-2xl hover:bg-red-100 disabled:opacity-50"
                    >
                      {isRemoving
                        ? "…"
                        : "♥"}
                    </button>

                    <div className="p-6 flex-1">
                      <div className="flex items-start gap-4 pr-10">
                        {contractor.avatar_url ? (
                          <img
                            src={
                              contractor.avatar_url
                            }
                            alt={
                              contractor.full_name
                            }
                            className="w-20 h-20 rounded-xl object-cover border"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-3xl font-bold shrink-0">
                            {getInitial(
                              contractor.full_name
                            )}
                          </div>
                        )}

                        <div className="min-w-0">
                          <h2 className="text-xl font-bold truncate">
                            {
                              contractor.full_name
                            }
                          </h2>

                          {contractor.company_name && (
                            <p className="text-gray-500 truncate mt-1">
                              {
                                contractor.company_name
                              }
                            </p>
                          )}

                          <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold mt-2">
                            {
                              contractor.trade
                            }
                          </span>
                        </div>
                      </div>

                      <div className="mt-5">
                        {contractor.reviewCount >
                        0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {renderStars(
                              contractor.averageRating
                            )}

                            <span className="font-bold">
                              {contractor.averageRating.toFixed(
                                1
                              )}
                            </span>

                            <span className="text-sm text-gray-500">
                              (
                              {
                                contractor.reviewCount
                              }{" "}
                              {contractor.reviewCount ===
                              1
                                ? "review"
                                : "reviews"}
                              )
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {renderStars(0)}

                            <span className="text-sm text-gray-500">
                              No reviews yet
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 mt-5 text-gray-600">
                        <p>
                          📍{" "}
                          {
                            contractor.location
                          }
                        </p>

                        {contractor.years_experience !==
                          null && (
                          <p>
                            🛠️{" "}
                            {
                              contractor.years_experience
                            }{" "}
                            years experience
                          </p>
                        )}
                      </div>

                      {contractor.bio && (
                        <p className="text-gray-700 mt-4 leading-7 line-clamp-3">
                          {contractor.bio}
                        </p>
                      )}

                      {services.length >
                        0 && (
                        <div className="flex flex-wrap gap-2 mt-5">
                          {services.map(
                            (service) => (
                              <span
                                key={
                                  service
                                }
                                className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm"
                              >
                                {service}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t p-5 grid grid-cols-2 gap-3">
                      <Link
                        href={`/contractors/${contractor.id}`}
                        className="bg-blue-600 text-white px-4 py-3 rounded-lg text-center font-semibold hover:bg-blue-700"
                      >
                        View Profile
                      </Link>

                      <Link
                        href={`/contact/${contractor.id}`}
                        className="bg-black text-white px-4 py-3 rounded-lg text-center font-semibold hover:bg-gray-800"
                      >
                        Contact
                      </Link>
                    </div>
                  </article>
                );
              }
            )}
          </section>
        )}
      </div>
    </main>
  );
}