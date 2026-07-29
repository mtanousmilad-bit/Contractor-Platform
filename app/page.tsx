export default function Home() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold text-gray-900 mb-4">
        ContractorHub
      </h1>

      <p className="text-xl text-gray-600 text-center max-w-2xl mb-8">
        A platform helping new contractors connect, manage projects,
        and grow their construction business.
      </p>

      <div className="flex gap-4">
        <button className="bg-black text-white px-6 py-3 rounded-lg">
          Join as Contractor
        </button>

        <button className="border border-gray-300 px-6 py-3 rounded-lg">
          Find Contractors
        </button>
      </div>
    </main>
  );
}