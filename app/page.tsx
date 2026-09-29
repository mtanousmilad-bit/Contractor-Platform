import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="flex-1 bg-gray-50">
      {/* Hero Section */}
      <section className="relative min-h-[690px] overflow-hidden bg-slate-950 text-white flex items-center">
        <Image
          src="/construction-hero-premium.png"
          alt="Construction professionals reviewing plans on a major Australian project"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[68%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/10" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/20" aria-hidden="true" />
        <div className="absolute inset-y-0 left-0 w-2 bg-amber-400" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-3 text-amber-300 font-bold mb-6 uppercase tracking-[0.2em] text-xs md:text-sm">
              <span className="h-px w-10 bg-amber-400" aria-hidden="true" />
              Australia&apos;s Construction Network
            </p>

            <h1 className="text-5xl md:text-7xl lg:text-[5.25rem] font-black leading-[0.98] tracking-[-0.045em]">
              Build with the
              <span className="block text-amber-400">right people.</span>
            </h1>

            <p className="max-w-2xl text-lg md:text-xl text-slate-200 mt-7 leading-8">
              Connect with proven construction professionals,
              review real project experience and move your next
              project forward with confidence.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <Link
                href="/contractors"
                className="bg-amber-400 text-slate-950 px-8 py-4 rounded-md text-center font-black hover:bg-amber-300 transition-colors shadow-[0_12px_35px_rgba(251,191,36,0.2)]"
              >
                Find a Contractor
              </Link>

              <Link
                href="/auth?mode=signup&type=contractor"
                className="border border-white/50 bg-slate-950/40 backdrop-blur-sm text-white px-8 py-4 rounded-md text-center font-bold hover:bg-white hover:text-slate-950 transition-colors"
              >
                Grow Your Business
              </Link>
            </div>

            <div className="grid grid-cols-3 max-w-xl mt-14 border-t border-white/20 pt-6 text-sm text-slate-300">
              <div><strong className="block text-white text-lg">Local</strong> professionals</div>
              <div className="border-l border-white/20 pl-5"><strong className="block text-white text-lg">Real</strong> project work</div>
              <div className="border-l border-white/20 pl-5"><strong className="block text-white text-lg">Direct</strong> connections</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-amber-600 font-bold uppercase tracking-[0.18em] text-xs">Built for better projects</p>
          <h2 className="text-3xl md:text-5xl font-black mt-3 tracking-tight">
            A stronger way to connect
          </h2>

          <p className="text-gray-600 text-lg mt-4">
            A simple way for customers and construction
            professionals to connect.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-7 mt-12">
          <article className="bg-white border-t-4 border-t-amber-400 border-x border-b rounded-xl p-8 shadow-sm">
            <div className="text-sm font-black tracking-[0.18em] text-amber-600">01 / DISCOVER</div>

            <h3 className="text-2xl font-bold mt-5">
              Find Contractors
            </h3>

            <p className="text-gray-600 mt-3 leading-7">
              Search contractors by name, trade, company,
              services and location.
            </p>
          </article>

          <article className="bg-white border-t-4 border-t-amber-400 border-x border-b rounded-xl p-8 shadow-sm">
            <div className="text-sm font-black tracking-[0.18em] text-amber-600">02 / EVALUATE</div>

            <h3 className="text-2xl font-bold mt-5">
              View Previous Work
            </h3>

            <p className="text-gray-600 mt-3 leading-7">
              Review contractor profiles, experience,
              services and completed projects.
            </p>
          </article>

          <article className="bg-white border-t-4 border-t-amber-400 border-x border-b rounded-xl p-8 shadow-sm">
            <div className="text-sm font-black tracking-[0.18em] text-amber-600">03 / CONNECT</div>

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
        <div className="relative overflow-hidden bg-slate-950 text-white rounded-xl p-8 md:p-12 flex flex-col md:flex-row md:items-center md:justify-between gap-8 border-l-8 border-amber-400 shadow-xl">
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
            className="bg-amber-400 text-slate-950 px-7 py-4 rounded-md text-center font-black hover:bg-amber-300 whitespace-nowrap"
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
