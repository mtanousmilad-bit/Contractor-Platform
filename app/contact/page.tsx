 export default function Contact() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">

      <div className="bg-white w-full max-w-xl rounded-xl shadow p-8">

        <h1 className="text-3xl font-bold mb-2">
          Request a Quote
        </h1>

        <p className="text-gray-600 mb-8">
          Send your project details to the contractor.
        </p>


        <form className="space-y-4">


          <input
            value="Milad Construction"
            readOnly
            className="w-full border p-3 rounded-lg bg-gray-100"
          />


          <input
            placeholder="Your Name"
            className="w-full border p-3 rounded-lg"
          />


          <input
            type="email"
            placeholder="Email Address"
            className="w-full border p-3 rounded-lg"
          />


          <input
            type="tel"
            placeholder="Phone Number"
            className="w-full border p-3 rounded-lg"
          />



          <select className="w-full border p-3 rounded-lg">

            <option>
              Project Type
            </option>

            <option>
              New Build
            </option>

            <option>
              Renovation
            </option>

            <option>
              Extension
            </option>

            <option>
              Repairs
            </option>

            <option>
              Commercial Construction
            </option>

          </select>




          <select className="w-full border p-3 rounded-lg">

            <option>
              Estimated Budget
            </option>

            <option>
              Under $10,000
            </option>

            <option>
              $10,000 - $50,000
            </option>

            <option>
              $50,000 - $100,000
            </option>

            <option>
              $100,000+
            </option>

          </select>




          <select className="w-full border p-3 rounded-lg">

            <option>
              When do you want to start?
            </option>

            <option>
              ASAP
            </option>

            <option>
              Within 1 Month
            </option>

            <option>
              1-3 Months
            </option>

            <option>
              3+ Months
            </option>

          </select>




          <textarea
            placeholder="Describe your project..."
            className="w-full border p-3 rounded-lg h-32"
          />



          <button
            type="submit"
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            Send Request
          </button>


        </form>


      </div>

    </main>
  );
}