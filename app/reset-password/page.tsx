"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        setError("Your reset session has expired. Request a new reset link.");
      } else setReady(true);
    }).catch(() => {
      if (active) setError("Unable to verify your session. Request a new reset link.");
    });
    return () => { active = false; };
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || loading) return;
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      setPassword("");
      setConfirmation("");
      setSaved(true);
    } catch {
      setError("Unable to update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-xl shadow p-8">
        <h1 className="text-3xl font-bold mb-6">Reset Password</h1>
        {error && <p role="alert" className="bg-red-100 text-red-700 rounded-lg p-4 mb-5">{error}</p>}
        {saved ? (
          <div role="status">
            <p className="bg-green-100 text-green-800 rounded-lg p-4">Your password has been updated.</p>
            <Link href="/dashboard" className="block mt-5 text-blue-600 hover:underline">Continue to your account</Link>
          </div>
        ) : ready ? (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block font-medium mb-2">New Password</label>
              <input id="password" type="password" autoComplete="new-password" required minLength={6}
                value={password} disabled={loading} onChange={(e) => setPassword(e.target.value)}
                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="confirmation" className="block font-medium mb-2">Confirm New Password</label>
              <input id="confirmation" type="password" autoComplete="new-password" required minLength={6}
                value={confirmation} disabled={loading} onChange={(e) => setConfirmation(e.target.value)}
                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <button disabled={loading} className="w-full bg-black text-white py-3 rounded-lg disabled:bg-gray-400">
              {loading ? "Saving..." : "Save New Password"}
            </button>
          </form>
        ) : !error ? <p role="status">Checking your reset link...</p> : null}
        {!saved && <Link href="/forgot-password" className="block mt-5 text-blue-600 hover:underline">Request a new reset link</Link>}
      </div>
    </main>
  );
}
