export default function ContractorProfile() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">

      <div className="max-w-4xl mx-auto">

        <div className="bg-white rounded-xl shadow p-8">

          <div className="flex items-center gap-6 mb-8">

            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
              Photo
            </div>

            <div>
              <h1 className="text-3xl font-bold">
                Milad Construction
              </h1>

              <p className="text-gray-600">
                Bricklayer • Western Sydney, NSW
              </p>
            </div>

          </div>


          <div className="grid md:grid-cols-2 gap-6">


            <div>
              <h2 className="text-xl font-bold mb-2">
                Business Details
              </h2>

              <p>
                Business Type: Sole Trader
              </p>

              <p>
                Experience: 5+ Years
              </p>

              <p>
                ABN: 00 000 000 000
              </p>

              <p>
                Licence: Available
              </p>

            </div>



            <div>
              <h2 className="text-xl font-bold mb-2">
                Services
              </h2>

              <ul className="list-disc ml-5">
                <li>Bricklaying</li>
                <li>Renovations</li>
                <li>Residential Projects</li>
                <li>Construction Works</li>
              </ul>

            </div>


          </div>


          <div className="mt-8">

            <h2 className="text-xl font-bold mb-3">
              About
            </h2>

            <p className="text-gray-600">
              Experienced construction professional providing quality
              building services across Sydney. Focused on reliable work,
              safety, and client satisfaction.
            </p>

          </div>


          <div className="mt-8">

            <h2 className="text-xl font-bold mb-3">
              Projects
            </h2>


            <div className="grid md:grid-cols-3 gap-4">

              <div className="h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                Project 1
              </div>

              <div className="h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                Project 2
              </div>

              <div className="h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                Project 3
              </div>

            </div>

          </div>


        </div>

      </div>

    </main>
  );
}