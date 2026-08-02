"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../../components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: sessionLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionLoading && user) router.replace("/dashboard");
  }, [router, sessionLoading, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-soft sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Proxy Management
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Secure fixture, attendance, and timetable administration
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input
              autoComplete="username"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-emerald-100"
              disabled={submitting}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>

          <div className="-mt-2 text-right">
            <Link className="text-sm font-semibold text-primary hover:underline" href="/forgot-password">Forgot password?</Link>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Password
            <span className="mt-2 flex overflow-hidden rounded-xl border border-slate-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-emerald-100">
              <input
                autoComplete="current-password"
                className="min-w-0 flex-1 px-4 py-3 font-normal outline-none"
                disabled={submitting}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                className="px-4 text-sm font-semibold text-primary"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>

          {error ? (
            <p
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting || sessionLoading}
            type="submit"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <footer className="mt-8 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">
          <p>Developed by M. Aamir Wattoo</p>
          <p>CI, FGPS &amp; College No. 2</p>
        </footer>
      </section>
    </main>
  );
}
