export default function Home() {
return (
<main className="min-h-screen bg-gray-50">
<section className="flex flex-col items-center justify-center text-center px-8 py-24">
<h1 className="text-5xl font-bold text-gray-900 mb-6">
Build Your Future in Construction
</h1>

<p className="text-xl text-gray-600 max-w-2xl mb-8">
ContractorHub connects new contractors with clients,
opportunities, and tools to grow their construction business.
</p>

<div className="flex gap-4">
<button className="bg-black text-white px-8 py-3 rounded-lg">
Join as Contractor
</button>

<button className="border border-gray-300 px-8 py-3 rounded-lg bg-white">
Find a Contractor
</button>
</div>
</section>

<section className="grid md:grid-cols-3 gap-6 px-8 pb-20">
<div className="bg-white p-6 rounded-xl shadow">
<h2 className="text-xl font-bold mb-2">
Create Your Profile
</h2>
<p>
Showcase your skills, services, and previous projects.
</p>
</div>

<div className="bg-white p-6 rounded-xl shadow">
<h2 className="text-xl font-bold mb-2">
Find Opportunities
</h2>
<p>
Connect with clients looking for construction professionals.
</p>
</div>

<div className="bg-white p-6 rounded-xl shadow">
<h2 className="text-xl font-bold mb-2">
Grow Your Business
</h2>
<p>
Build your reputation and expand your network.
</p>
</div>
</section>
</main>
);
}