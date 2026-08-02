"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "../../lib/api";

const genericMessage = "If an account exists for this email, password reset instructions have been sent.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setMessage("");
    try { await apiRequest("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }, false); setMessage(genericMessage); }
    catch { setMessage(genericMessage); }
    finally { setLoading(false); }
  };
  return <main className="flex min-h-screen items-center justify-center px-5"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Proxy Management</p>
    <h1 className="mt-3 text-3xl font-bold text-ink">Forgot password</h1>
    <p className="mt-2 text-sm text-slate-600">Enter the email associated with your school account.</p>
    <form className="mt-7 space-y-5" onSubmit={submit}><label className="block text-sm font-semibold text-slate-700">Email<input autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" onChange={(event) => setEmail(event.target.value)} required type="email" value={email}/></label>
      {message ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{message}</p> : null}
      <button className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={loading} type="submit">{loading ? "Sending…" : "Send reset instructions"}</button>
    </form><Link className="mt-5 block text-center text-sm font-semibold text-primary" href="/login">Back to sign in</Link>
  </section></main>;
}
