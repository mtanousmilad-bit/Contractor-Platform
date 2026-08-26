"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType = "customer" | "contractor";

export default function AuthPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [isLogin, setIsLogin] = useState(true);
  const [accountType, setAccountType] =
    useState<AccountType>("customer");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      if (isLogin) {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) {
          setMessage(error.message);
          setMessageType("error");
          return;
        }

        router.push("/dashboard");
        router.refresh();
        return;
      }

      const { data, error } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              account_type: accountType,
            },
          },
        });

      if (error) {
        setMessage(error.message);
        setMessageType("error");
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setMessage(
        `Account created as a ${accountType}. Check your email to confirm your account.`
      );
      setMessageType("success");
      setPassword("");
    } catch {
      setMessage(
        "Something went wrong. Please try again."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setIsLogin((currentValue) => !currentValue);
    setMessage("");
    setMessageType("");
    setPassword("");
    setAccountType("customer");
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-xl shadow p-8">
        <h1 className="text-3xl font-bold mb-2">
          {isLogin
            ? "Welcome Back"
            : "Create Account"}
        </h1>

        <p className="text-gray-600 mb-8">
          {isLogin
            ? "Log in to access your account."
            : "Choose how you want to use the platform."}
        </p>

        {message && (
          <div
            className={`p-4 rounded-lg mb-5 ${
              messageType === "error"
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {messageType === "error" ? "❌ " : "✅ "}
            {message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {!isLogin && (
            <div>
              <p className="font-semibold mb-3">
                Account Type
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setAccountType("customer")
                  }
                  className={`border-2 rounded-xl p-4 text-left transition ${
                    accountType === "customer"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span className="text-2xl">👤</span>

                  <span className="block font-bold mt-2">
                    Customer
                  </span>

                  <span className="block text-sm text-gray-600 mt-1">
                    Find and contact contractors
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setAccountType("contractor")
                  }
                  className={`border-2 rounded-xl p-4 text-left transition ${
                    accountType === "contractor"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span className="text-2xl">🏗️</span>

                  <span className="block font-bold mt-2">
                    Contractor
                  </span>

                  <span className="block text-sm text-gray-600 mt-1">
                    Showcase work and receive requests
                  </span>
                </button>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block font-medium mb-2"
            >
              Email Address
            </label>

            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
              className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-medium mb-2"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete={
                isLogin
                  ? "current-password"
                  : "new-password"
              }
              required
              minLength={6}
              className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
          >
            {loading
              ? "Please wait..."
              : isLogin
                ? "Log In"
                : `Sign Up as ${
                    accountType === "customer"
                      ? "Customer"
                      : "Contractor"
                  }`}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          disabled={loading}
          className="w-full mt-5 text-blue-600 hover:underline disabled:text-gray-400"
        >
          {isLogin
            ? "Don’t have an account? Sign Up"
            : "Already have an account? Log In"}
        </button>
      </div>
    </main>
  );
}