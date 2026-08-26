"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ContractorProfile = {
  id: string;
  full_name: string;
  company_name: string | null;
  trade: string;
  location: string;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  years_experience: number | null;
  services: string | null;
};

type PublicProject = {
  id: string;
  name: string;
  type: string;
  location: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export default function ContractorDetailsPage() {
  const params = useParams<{ id: string }>();
  const contractorId = params.id;

  const [supabase] = useState(() =>
    createClient()
  );

  const [contractor, setContractor] =
    useState<ContractorProfile | null>(null);

  const [projects, setProjects] =
    useState<PublicProject[]>([]);

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadContractorPage() {
      if (!contractorId) {
        return;
      }

      setLoading(true);
      setError("");

      const [
        profileResult,
        projectsResult,
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
            phone,
            bio,
            avatar_url,
            years_experience,
            services
          `)
          .eq("id", contractorId)
          .maybeSingle(),

        supabase
          .from("projects")
          .select(`
            id,
            name,
            type,
            location,
            description,
            image_url,
            created_at
          `)
          .eq("user_id", contractorId)
          .eq("is_public", true)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("reviews")
          .select(`
            id,
            reviewer_name,
            rating,
            comment,
            created_at
          `)
          .eq(
            "contractor_id",
            contractorId
          )
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (!isMounted) {
        return;
      }

      if (
        profileResult.error ||
        !profileResult.data
      ) {
        setError(
          profileResult.error?.message ??
            "Contractor profile could not be found."
        );

        setLoading(false);
        return;
      }

      setContractor(
        profileResult.data as ContractorProfile
      );

      if (projectsResult.error) {
        console.error(
          "Could not load contractor projects:",
          projectsResult.error.message
        );

        setProjects([]);
      } else {
        setProjects(
          (projectsResult.data ??
            []) as PublicProject[]
        );
      }

      if (reviewsResult.error) {
        console.error(
          "Could not load contractor reviews:",
          reviewsResult.error.message
        );

        setReviews([]);
      } else {
        setReviews(
          (reviewsResult.data ??
            []) as Review[]
        );
      }

      setLoading(false);
    }

    void loadContractorPage();

    return () => {
      isMounted = false;
    };
  }, [
    contractorId,
    supabase,
  ]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) {
      return 0;
    }

    const totalRating = reviews.reduce(
      (total, review) =>
        total + review.rating,
      0
    );

    return totalRating / reviews.length;
  }, [reviews]);

  const ratingBreakdown = useMemo(() => {
    return [5, 4, 3, 2, 1].map(
      (rating) => {
        const count = reviews.filter(
          (review) =>
            review.rating === rating
        ).length;

        const percentage =
          reviews.length === 0
            ? 0
            : Math.round(
                (count / reviews.length) *
                  100
              );

        return {
          rating,
          count,
          percentage,
        };
      }
    );
  }, [reviews]);

  function getServices() {
    if (!contractor?.services) {
      return [];
    }

    return contractor.services
      .split(/[\n,;]+/)
      .map((service) => service.trim())
      .filter(Boolean);
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat(
      "en-AU",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    ).format(new Date(date));
  }

  function renderStars(
    rating: number,
    sizeClass = "text-xl"
  ) {
    const roundedRating =
      Math.round(rating);

    return (
      <div
        className={`flex items-center gap-1 ${sizeClass}`}
        aria-label={`${rating.toFixed(
          1
        )} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map(
          (star) => (
            <span
              key={star}
              className={
                star <= roundedRating
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

  function getInitial(name: string) {
    return (
      name.trim().charAt(0).toUpperCase() ||
      "C"
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow p-8">
          <p className="text-gray-600">
            Loading contractor profile...
          </p>
        </div>
      </main>
    );
  }

  if (error || !contractor) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-10 text-center">
          <h1 className="text-3xl font-bold">
            Contractor Not Found
          </h1>

          <p className="text-red-600 mt-4">
            {error ||
              "This contractor profile is unavailable."}
          </p>

          <Link
            href="/contractors"
            className="inline-block mt-7 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            Back to Contractors
          </Link>
        </div>
      </main>
    );
  }

  const services = getServices();

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/contractors"
            className="inline-flex items-center gap-2 text-blue-600 font-medium hover:underline"
          >
            ← Back to Contractors
          </Link>
        </div>

        <section className="bg-white rounded-2xl shadow p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            <div className="flex flex-col sm:flex-row gap-6">
              {contractor.avatar_url ? (
                <img
                  src={contractor.avatar_url}
                  alt={contractor.full_name}
                  className="w-36 h-36 md:w-44 md:h-44 rounded-2xl object-cover border shadow-sm"
                />
              ) : (
                <div className="w-36 h-36 md:w-44 md:h-44 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-5xl font-bold">
                  {getInitial(
                    contractor.full_name
                  )}
                </div>
              )}

              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  {contractor.full_name}
                </h1>

                {contractor.company_name && (
                  <p className="text-xl text-gray-600 mt-2">
                    {contractor.company_name}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-semibold">
                    {contractor.trade}
                  </span>

                  <span className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full">
                    📍 {contractor.location}
                  </span>

                  {contractor.years_experience !==
                    null && (
                    <span className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full">
                      {
                        contractor.years_experience
                      }{" "}
                      years experience
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-5">
                  {reviews.length > 0 ? (
                    <>
                      {renderStars(
                        averageRating,
                        "text-2xl"
                      )}

                      <span className="text-xl font-bold">
                        {averageRating.toFixed(
                          1
                        )}
                      </span>

                      <span className="text-gray-500">
                        ({reviews.length}{" "}
                        {reviews.length === 1
                          ? "review"
                          : "reviews"}
                        )
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-500">
                      No reviews yet
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:min-w-56">
              <Link
                href={`/contact/${contractor.id}`}
                className="bg-blue-600 text-white px-7 py-3 rounded-lg text-center font-semibold hover:bg-blue-700"
              >
                Contact Contractor
              </Link>

              {contractor.phone && (
                <a
                  href={`tel:${contractor.phone.replace(
                    /\s+/g,
                    ""
                  )}`}
                  className="bg-black text-white px-7 py-3 rounded-lg text-center font-semibold hover:bg-gray-800"
                >
                  Call Contractor
                </a>
              )}
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-2xl shadow p-6 md:p-8">
              <h2 className="text-2xl font-bold">
                About
              </h2>

              <p className="text-gray-700 leading-8 mt-4 whitespace-pre-line">
                {contractor.bio ||
                  "This contractor has not added a business description yet."}
              </p>
            </section>

            <section className="bg-white rounded-2xl shadow p-6 md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Public Projects
                  </h2>

                  <p className="text-gray-500 mt-1">
                    Previous work shared by
                    this contractor.
                  </p>
                </div>

                <span className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full font-semibold">
                  {projects.length}
                </span>
              </div>

              {projects.length === 0 ? (
                <div className="bg-gray-50 border rounded-xl p-8 text-center mt-6">
                  <p className="text-gray-600">
                    No public projects have
                    been added yet.
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-5 mt-6">
                  {projects.map(
                    (project) => (
                      <article
                        key={project.id}
                        className="border rounded-xl overflow-hidden bg-white"
                      >
                        {project.image_url ? (
                          <img
                            src={
                              project.image_url
                            }
                            alt={project.name}
                            className="w-full h-52 object-cover"
                          />
                        ) : (
                          <div className="w-full h-52 bg-gray-100 flex items-center justify-center text-gray-400">
                            No Project Image
                          </div>
                        )}

                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xl font-bold">
                              {project.name}
                            </h3>

                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm whitespace-nowrap">
                              {project.type}
                            </span>
                          </div>

                          <p className="text-gray-500 mt-2">
                            📍{" "}
                            {project.location}
                          </p>

                          {project.description && (
                            <p className="text-gray-700 mt-4 leading-7 whitespace-pre-line">
                              {
                                project.description
                              }
                            </p>
                          )}
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">
                    Customer Reviews
                  </h2>

                  <p className="text-gray-500 mt-1">
                    Reviews from completed
                    projects.
                  </p>
                </div>

                {reviews.length > 0 && (
                  <div className="flex items-center gap-2">
                    {renderStars(
                      averageRating
                    )}

                    <span className="font-bold">
                      {averageRating.toFixed(
                        1
                      )}
                    </span>
                  </div>
                )}
              </div>

              {reviews.length === 0 ? (
                <div className="bg-gray-50 border rounded-xl p-8 text-center mt-6">
                  <div className="text-4xl">
                    ⭐
                  </div>

                  <h3 className="text-xl font-bold mt-3">
                    No Reviews Yet
                  </h3>

                  <p className="text-gray-600 mt-2">
                    Reviews will appear after
                    customers complete and
                    confirm their projects.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 mt-6">
                  {reviews.map(
                    (review) => (
                      <article
                        key={review.id}
                        className="border rounded-xl p-5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold text-lg">
                              {getInitial(
                                review.reviewer_name
                              )}
                            </div>

                            <div>
                              <h3 className="font-bold">
                                {
                                  review.reviewer_name
                                }
                              </h3>

                              <p className="text-sm text-gray-500">
                                {formatDate(
                                  review.created_at
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {renderStars(
                              review.rating
                            )}

                            <span className="font-semibold">
                              {review.rating}/5
                            </span>
                          </div>
                        </div>

                        <p className="text-gray-700 leading-7 mt-4 whitespace-pre-line">
                          {review.comment ||
                            "The customer left a rating without a written comment."}
                        </p>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-xl font-bold">
                Services
              </h2>

              {services.length === 0 ? (
                <p className="text-gray-500 mt-4">
                  No services listed.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-4">
                  {services.map(
                    (service) => (
                      <span
                        key={service}
                        className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-2 rounded-lg"
                      >
                        {service}
                      </span>
                    )
                  )}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-xl font-bold">
                Rating Summary
              </h2>

              {reviews.length === 0 ? (
                <p className="text-gray-500 mt-4">
                  No ratings available yet.
                </p>
              ) : (
                <>
                  <div className="text-center py-6">
                    <div className="text-5xl font-bold">
                      {averageRating.toFixed(
                        1
                      )}
                    </div>

                    <div className="flex justify-center mt-3">
                      {renderStars(
                        averageRating,
                        "text-2xl"
                      )}
                    </div>

                    <p className="text-gray-500 mt-2">
                      Based on{" "}
                      {reviews.length}{" "}
                      {reviews.length === 1
                        ? "review"
                        : "reviews"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {ratingBreakdown.map(
                      (item) => (
                        <div
                          key={
                            item.rating
                          }
                          className="flex items-center gap-3"
                        >
                          <span className="w-8 text-sm">
                            {item.rating} ★
                          </span>

                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-500 rounded-full"
                              style={{
                                width: `${item.percentage}%`,
                              }}
                            />
                          </div>

                          <span className="w-8 text-right text-sm text-gray-500">
                            {item.count}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="bg-blue-600 text-white rounded-2xl shadow p-6">
              <h2 className="text-xl font-bold">
                Ready to start?
              </h2>

              <p className="text-blue-100 mt-3 leading-7">
                Send this contractor your
                project details, location,
                preferred start date and
                estimated budget.
              </p>

              <Link
                href={`/contact/${contractor.id}`}
                className="block bg-white text-blue-700 text-center px-6 py-3 rounded-lg font-bold mt-5 hover:bg-blue-50"
              >
                Send Project Request
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}