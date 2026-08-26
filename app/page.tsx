import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <p className="text-blue-300 font-semibold mb-4">
              Australian Contractor Marketplace
            </p>

            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Find the right contractor for your next project
            </h1>

            <p className="text-lg md:text-xl text-gray-300 mt-6 leading-8">
              Browse contractor profiles, view completed
              projects and send project requests directly
              through the platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-9">
              <Link
                href="/contractors"
                className="bg-blue-600 text-white px-7 py-4 rounded-lg text-center font-semibold hover:bg-blue-700"
              >
                Find Contractors
              </Link>

              <Link
                href="/auth"
                className="bg-white text-black px-7 py-4 rounded-lg text-center font-semibold hover:bg-gray-100"
              >
                Join as a Contractor
              </Link>
            </div>
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
              <div className="w-14 h-14 mx-auto rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
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
              <div className="w-14 h-14 mx-auto rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
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
              <div className="w-14 h-14 mx-auto rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
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