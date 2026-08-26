"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType =
  | "customer"
  | "contractor";

type ContractorProfileRow = {
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

type ReviewRow = {
  contractor_id: string;
  rating: number;
};

type SavedContractorRow = {
  contractor_id: string;
};

type ContractorCard =
  ContractorProfileRow & {
    averageRating: number;
    reviewCount: number;
  };

export default function ContractorsPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [contractors, setContractors] =
    useState<ContractorCard[]>([]);

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(null);

  const [
    accountType,
    setAccountType,
  ] = useState<AccountType | null>(null);

  const [
    savedContractorIds,
    setSavedContractorIds,
  ] = useState<string[]>([]);

  const [
    savingContractorId,
    setSavingContractorId,
  ] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [
    selectedTrade,
    setSelectedTrade,
  ] = useState("all");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadContractors() {
      setLoading(true);
      setError("");

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
          location,
          bio,
          avatar_url,
          years_experience,
          services
        `)
        .order("full_name", {
          ascending: true,
        });

      if (!isMounted) {
        return;
      }

      if (profileError) {
        setError(profileError.message);
        setContractors([]);
        setLoading(false);
        return;
      }

      const profiles =
        (profileData ??
          []) as ContractorProfileRow[];

      let reviews: ReviewRow[] = [];

      if (profiles.length > 0) {
        const contractorIds =
          profiles.map(
            (profile) => profile.id
          );

        const {
          data: reviewData,
          error: reviewError,
        } = await supabase
          .from("reviews")
          .select(`
            contractor_id,
            rating
          `)
          .in(
            "contractor_id",
            contractorIds
          );

        if (!isMounted) {
          return;
        }

        if (reviewError) {
          console.error(
            "Could not load contractor ratings:",
            reviewError.message
          );
        } else {
          reviews =
            (reviewData ??
              []) as ReviewRow[];
        }
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (userError) {
        console.error(
          "Could not load current user:",
          userError.message
        );
      }

      setCurrentUserId(
        user?.id ?? null
      );

      if (user) {
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
          console.error(
            "Could not load account type:",
            accountError.message
          );

          setAccountType(null);
        } else {
          const loadedAccountType =
            (accountData?.account_type ??
              null) as AccountType | null;

          setAccountType(
            loadedAccountType
          );

          if (
            loadedAccountType ===
            "customer"
          ) {
            const {
              data: savedData,
              error: savedError,
            } = await supabase
              .from(
                "saved_contractors"
              )
              .select("contractor_id")
              .eq(
                "customer_id",
                user.id
              );

            if (!isMounted) {
              return;
            }

            if (savedError) {
              console.error(
                "Could not load saved contractors:",
                savedError.message
              );

              setSavedContractorIds(
                []
              );
            } else {
              const savedRows =
                (savedData ??
                  []) as SavedContractorRow[];

              setSavedContractorIds(
                savedRows.map(
                  (saved) =>
                    saved.contractor_id
                )
              );
            }
          } else {
            setSavedContractorIds(
              []
            );
          }
        }
      } else {
        setAccountType(null);
        setSavedContractorIds([]);
      }

      const contractorsWithRatings:
        ContractorCard[] =
        profiles.map((profile) => {
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
            averageRating,
            reviewCount,
          };
        });

      setContractors(
        contractorsWithRatings
      );

      setLoading(false);
    }

    void loadContractors();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function toggleSavedContractor(
    contractorId: string
  ) {
    setError("");

    if (!currentUserId) {
      router.push("/auth");
      return;
    }

    if (accountType !== "customer") {
      setError(
        "Only customer accounts can save contractors."
      );
      return;
    }

    const isAlreadySaved =
      savedContractorIds.includes(
        contractorId
      );

    setSavingContractorId(
      contractorId
    );

    try {
      if (isAlreadySaved) {
        const { error: deleteError } =
          await supabase
            .from(
              "saved_contractors"
            )
            .delete()
            .eq(
              "customer_id",
              currentUserId
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

        setSavedContractorIds(
          (currentIds) =>
            currentIds.filter(
              (id) =>
                id !== contractorId
            )
        );
      } else {
        const { error: insertError } =
          await supabase
            .from(
              "saved_contractors"
            )
            .insert({
              customer_id:
                currentUserId,

              contractor_id:
                contractorId,
            });

        if (insertError) {
          throw new Error(
            insertError.message
          );
        }

        setSavedContractorIds(
          (currentIds) => [
            ...currentIds,
            contractorId,
          ]
        );
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update saved contractors."
      );
    } finally {
      setSavingContractorId(
        null
      );
    }
  }

  const tradeOptions = [
    "Builder",
    "Carpenter",
    "Electrician",
    "Plumber",
    "Painter",
    "Tiler",
    "Landscaper",
    "Concreter",
    "Roofer",
    "Other",
  ];

  const filteredContractors =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return contractors.filter(
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
      contractors,
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
      <div
        className="flex items-center gap-0.5 text-lg"
        aria-label={`${rating.toFixed(
          1
        )} out of 5 stars`}
      >
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
            Loading contractors...
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
              Find Contractors
            </h1>

            <p className="text-gray-600 mt-3">
              Browse contractor profiles,
              ratings, services and previous
              work.
            </p>
          </div>

          {accountType ===
            "customer" && (
            <Link
              href="/saved-contractors"
              className="bg-red-600 text-white px-6 py-3 rounded-lg text-center font-semibold hover:bg-red-700"
            >
              ♥ Saved Contractors (
              {
                savedContractorIds.length
              }
              )
            </Link>
          )}
        </section>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6">
            ❌ {error}
          </div>
        )}

        <section className="bg-white rounded-2xl shadow p-5 md:p-6 mb-8">
          <div className="grid md:grid-cols-[1fr_260px] gap-4">
            <div>
              <label
                htmlFor="contractor-search"
                className="block font-semibold mb-2"
              >
                Search
              </label>

              <input
                id="contractor-search"
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search by name, company, trade, location or service..."
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="trade-filter"
                className="block font-semibold mb-2"
              >
                Trade
              </label>

              <select
                id="trade-filter"
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
                {contractors.length}
              </strong>{" "}
              contractors
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

        {contractors.length ===
        0 ? (
          <section className="bg-white rounded-2xl shadow p-10 text-center">
            <h2 className="text-2xl font-bold">
              No Contractors Yet
            </h2>

            <p className="text-gray-600 mt-3">
              Contractor profiles will
              appear here once they are
              created.
            </p>
          </section>
        ) : filteredContractors.length ===
          0 ? (
          <section className="bg-white rounded-2xl shadow p-10 text-center">
            <div className="text-5xl">
              🔍
            </div>

            <h2 className="text-2xl font-bold mt-4">
              No Contractors Found
            </h2>

            <p className="text-gray-600 mt-3">
              No contractors match your
              current search or trade
              filter.
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

                const isSaved =
                  savedContractorIds.includes(
                    contractor.id
                  );

                const isSaving =
                  savingContractorId ===
                  contractor.id;

                return (
                  <article
                    key={contractor.id}
                    className="relative bg-white rounded-2xl shadow overflow-hidden flex flex-col hover:shadow-lg transition"
                  >
                    {accountType !==
                      "contractor" && (
                      <button
                        type="button"
                        disabled={
                          isSaving
                        }
                        onClick={() =>
                          toggleSavedContractor(
                            contractor.id
                          )
                        }
                        title={
                          isSaved
                            ? "Remove from saved contractors"
                            : "Save contractor"
                        }
                        aria-label={
                          isSaved
                            ? `Remove ${contractor.full_name} from saved contractors`
                            : `Save ${contractor.full_name}`
                        }
                        className={`absolute top-4 right-4 z-10 w-11 h-11 rounded-full border flex items-center justify-center text-2xl transition disabled:opacity-50 ${
                          isSaved
                            ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                            : "bg-white border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200"
                        }`}
                      >
                        {isSaving
                          ? "…"
                          : isSaved
                            ? "♥"
                            : "♡"}
                      </button>
                    )}

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