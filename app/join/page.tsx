"use client";

import { useState } from "react";

export default function Join() {
  const [step, setStep] = useState(1);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">

      <div className="bg-white w-full max-w-xl p-8 rounded-xl shadow">

        <h1 className="text-3xl font-bold mb-2">
          Join as a Contractor
        </h1>

        <p className="text-gray-600 mb-6">
          Create your professional profile
        </p>


        {/* Progress Bar */}
        <div className="mb-8">

          <div className="flex justify-between text-sm mb-2">
            <span>Step {step} of 3</span>

            <span>
              {step === 1 && "Basic Information"}
              {step === 2 && "Business Details"}
              {step === 3 && "Profile Setup"}
            </span>
          </div>


          <div className="w-full bg-gray-200 rounded-full h-3">

            <div
              className="bg-black h-3 rounded-full transition-all"
              style={{
                width: `${(step / 3) * 100}%`,
              }}
            />

          </div>

        </div>



        {step === 1 && (
          <div className="space-y-4">

            <h2 className="text-xl font-bold">
              Basic Information
            </h2>

            <input
              placeholder="Full Name"
              className="w-full border p-3 rounded-lg"
            />

            <input
              placeholder="Company Name"
              className="w-full border p-3 rounded-lg"
            />

            <input
              placeholder="Phone Number"
              className="w-full border p-3 rounded-lg"
            />

            <input
              placeholder="Email Address"
              className="w-full border p-3 rounded-lg"
            />

          </div>
        )}



        {step === 2 && (
          <div className="space-y-4">

            <h2 className="text-xl font-bold">
              Business Details
            </h2>


            <select className="w-full border p-3 rounded-lg">
              <option>Select Trade</option>
              <option>Bricklayer</option>
              <option>Carpenter</option>
              <option>Electrician</option>
              <option>Plumber</option>
              <option>Landscaper</option>
              <option>Builder</option>
            </select>


            <input
              placeholder="ABN"
              className="w-full border p-3 rounded-lg"
            />


            <input
              placeholder="Licence Number"
              className="w-full border p-3 rounded-lg"
            />

          </div>
        )}



        {step === 3 && (
  <div className="space-y-4">

    <h2 className="text-xl font-bold">
      Profile Setup
    </h2>

    <textarea
      placeholder="Describe your services and experience..."
      className="w-full border p-3 rounded-lg h-32"
    />


    <input
      placeholder="Service Area (Example: Western Sydney)"
      className="w-full border p-3 rounded-lg"
    />


    <div>
      <label className="block mb-2 font-medium">
        Profile Photo / Company Logo
      </label>

      <input
        type="file"
        className="w-full border p-3 rounded-lg"
      />
    </div>


    <div>
      <label className="block mb-2 font-medium">
        Previous Project Photos
      </label>

      <input
        type="file"
        multiple
        className="w-full border p-3 rounded-lg"
      />
    </div>


    <select className="w-full border p-3 rounded-lg">
      <option>Select Services</option>
      <option>Residential Construction</option>
      <option>Commercial Projects</option>
      <option>Renovations</option>
      <option>Maintenance</option>
      <option>New Builds</option>
    </select>

  </div>
)}




        <div className="flex justify-between mt-8">


          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="border px-6 py-3 rounded-lg"
            >
              Back
            </button>
          )}



          {step < 3 ? (

            <button
              onClick={() => setStep(step + 1)}
              className="bg-black text-white px-6 py-3 rounded-lg ml-auto"
            >
              Next
            </button>

          ) : (

            <button
              className="bg-black text-white px-6 py-3 rounded-lg ml-auto"
            >
              Create Profile
            </button>

          )}


        </div>


      </div>

    </main>
  );
}