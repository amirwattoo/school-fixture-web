"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { apiRequest } from "../../lib/api";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); if (password !== confirmation) { setError("Passwords do not match."); return; } setLoading(true); try { await apiRequest("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword: password }) }, false); setDone(true); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to reset password"); } finally { setLoading(false); } };
  return <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-soft"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Proxy Management</p><h1 className="mt-3 text-3xl font-bold text-ink">Reset password</h1>
    {done ? <div className="mt-6"><p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Your password has been reset. Existing sessions were signed out.</p><Link className="mt-5 block text-center font-semibold text-primary" href="/login">Sign in</Link></div> : <form className="mt-7 space-y-4" onSubmit={submit}>
      {!token ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">This reset link is incomplete.</p> : null}
      <label className="block text-sm font-semibold">New password<input autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" minLength={10} onChange={(event) => setPassword(event.target.value)} required type="password" value={password}/></label>
      <label className="block text-sm font-semibold">Confirm password<input autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" minLength={10} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation}/></label>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}<button className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={loading || !token} type="submit">{loading ? "Resetting…" : "Reset password"}</button></form>}
  </section>;
}
export default function ResetPasswordPage() { return <main className="flex min-h-screen items-center justify-center px-5"><Suspense fallback={<p>Loading Proxy Management…</p>}><ResetForm/></Suspense></main>; }
