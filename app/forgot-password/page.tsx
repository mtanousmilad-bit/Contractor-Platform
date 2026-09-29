"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  return <Suspense fallback={<p role="status" className="p-8">Loading...</p>}><ForgotPasswordForm /></Suspense>;
}

function ForgotPasswordForm() {
  const params = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const displayedError = error || (!sent && params.has("error")
    ? "That reset link is invalid or expired. Request a new link below." : "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        setError(error.code === "over_email_send_rate_limit" || error.status === 429
          ? "Too many email requests. Please wait before trying again."
          : "We could not send a reset email. Please try again later.");
        return;
      }
      setSent(true);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-xl shadow p-8">
        <h1 className="text-3xl font-bold mb-3">Forgot Password?</h1>
        <p className="text-gray-600 mb-6">Enter your account email to request a reset link.</p>
        {displayedError && <p role="alert" className="bg-red-100 text-red-700 rounded-lg p-4 mb-5">{displayedError}</p>}
        {sent ? (
          <p role="status" className="bg-green-100 text-green-800 rounded-lg p-4">
            If an account exists for this email, you will receive a reset link. Check your inbox and spam folder. Open the link in this browser.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block font-medium mb-2">Email Address</label>
              <input id="email" type="email" autoComplete="email" required disabled={loading}
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <button disabled={loading} className="w-full bg-black text-white py-3 rounded-lg disabled:bg-gray-400">
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}
        <Link href="/auth" className="block text-center mt-5 text-blue-600 hover:underline">Back to Log In</Link>
      </div>
    </main>
  );
}
