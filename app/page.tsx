import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="flex-1 bg-gray-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-amber-400" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid lg:grid-cols-[1.05fr_0.95fr] items-center gap-12">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-amber-300 font-semibold mb-5 uppercase tracking-[0.16em] text-sm">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" aria-hidden="true" />
              Australian Construction Marketplace
            </p>

            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Find trusted contractors across Australia
            </h1>

            <p className="text-lg md:text-xl text-gray-300 mt-6 leading-8">
              Compare local construction professionals, view
              completed work and send your project request—all
              in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-9">
              <Link
                href="/contractors"
                className="bg-amber-400 text-slate-950 px-7 py-4 rounded-lg text-center font-bold hover:bg-amber-300 transition-colors"
              >
                Find Contractors
              </Link>

              <Link
                href="/auth"
                className="border border-white/40 bg-white/10 text-white px-7 py-4 rounded-lg text-center font-semibold hover:bg-white/20 transition-colors"
              >
                Join as a Contractor
              </Link>
            </div>
          </div>

          <div className="relative lg:justify-self-end w-full max-w-xl">
            <div className="absolute -inset-5 rounded-[2rem] bg-amber-400/15 blur-2xl" aria-hidden="true" />
            <Image
              src="/construction-hero.svg"
              alt="Construction professional working beside an Australian building project"
              width={1200}
              height={900}
              priority
              className="relative w-full h-auto rounded-3xl border border-white/15 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">
            Everything you need in one place
          </h2>

          <p className="text-gray-600 text-lg mt-4">
            A simple way for customers and construction
            professionals to connect.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-7 mt-12">
          <article className="bg-white border rounded-2xl p-7 shadow-sm">
            <div className="text-4xl">🔎</div>

            <h3 className="text-2xl font-bold mt-5">
              Find Contractors
            </h3>

            <p className="text-gray-600 mt-3 leading-7">
              Search contractors by name, trade, company,
              services and location.
            </p>
          </article>

          <article className="bg-white border rounded-2xl p-7 shadow-sm">
            <div className="text-4xl">🏗️</div>

            <h3 className="text-2xl font-bold mt-5">
              View Previous Work
            </h3>

            <p className="text-gray-600 mt-3 leading-7">
              Review contractor profiles, experience,
              services and completed projects.
            </p>
          </article>

          <article className="bg-white border rounded-2xl p-7 shadow-sm">
            <div className="text-4xl">📩</div>

            <h3 className="text-2xl font-bold mt-5">
              Send Project Requests
            </h3>

            <p className="text-gray-600 mt-3 leading-7">
              Contact contractors and track whether your
              request is new, read, accepted or declined.
            </p>
          </article>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white border-y">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-xl font-bold">
                1
              </div>

              <h3 className="text-xl font-bold mt-5">
                Browse
              </h3>

              <p className="text-gray-600 mt-2">
                Search for a contractor who matches your
                project requirements.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-xl font-bold">
                2
              </div>

              <h3 className="text-xl font-bold mt-5">
                Contact
              </h3>

              <p className="text-gray-600 mt-2">
                Send the contractor your project details,
                location and contact information.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-xl font-bold">
                3
              </div>

              <h3 className="text-xl font-bold mt-5">
                Connect
              </h3>

              <p className="text-gray-600 mt-2">
                Track the request and connect when the
                contractor accepts it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contractor Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-slate-900 text-white rounded-2xl p-8 md:p-12 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold">
              Are you a contractor?
            </h2>

            <p className="text-gray-300 text-lg mt-4">
              Create your professional profile, showcase
              previous projects and receive customer
              enquiries.
            </p>
          </div>

          <Link
            href="/auth"
            className="bg-blue-600 text-white px-7 py-4 rounded-lg text-center font-semibold hover:bg-blue-700 whitespace-nowrap"
          >
            Create an Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="font-bold">
            Contractor Platform
          </p>

          <p className="text-gray-400 text-sm">
            Connect customers with construction
            professionals.
          </p>
        </div>
      </footer>
    </main>
  );
}
