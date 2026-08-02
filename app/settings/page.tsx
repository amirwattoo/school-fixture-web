"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "../../components/dashboard-shell";
import { PageFeedback } from "../../components/ui/page-feedback";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../components/auth-provider";
import type { WhatsAppProviderStatus } from "../../lib/school-types";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [provider, setProvider] = useState<WhatsAppProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  useEffect(() => {
    if (user) { setName(user.name); setEmail(user.email); }
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ provider: WhatsAppProviderStatus }>(
        "/whatsapp-notifications/provider-status",
      );
      setProvider(data.provider);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load provider settings",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-ink">Settings</h2>
        <p className="mt-1 text-sm text-slate-600">
          Read-only environment configuration. Secrets are never displayed.
        </p>
      </div>
      <PageFeedback
        empty={false}
        error={error}
        loading={loading}
        onRetry={load}
      />
      <section className="mb-5 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-ink">Account profile</h3>
        <p className="mt-1 text-sm text-slate-600">Update the signed-in administrator’s name or login email. Other schools are never affected.</p>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); setSavingProfile(true); setProfileMessage(""); try { const data = await apiRequest<{ user: NonNullable<typeof user> }>("/auth/profile", { method: "PATCH", body: JSON.stringify({ name, email }) }); updateUser(data.user); setProfileMessage("Profile updated."); } catch (caught) { setProfileMessage(caught instanceof Error ? caught.message : "Unable to update profile"); } finally { setSavingProfile(false); } }}>
          <label className="text-sm font-semibold">Name<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" onChange={(event) => setName(event.target.value)} required value={name}/></label>
          <label className="text-sm font-semibold">Email<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" onChange={(event) => setEmail(event.target.value)} required type="email" value={email}/></label>
          {profileMessage ? <p className="text-sm text-primary sm:col-span-2" role="status">{profileMessage}</p> : null}
          <button className="rounded-xl bg-primary px-4 py-2 font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:w-fit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</button>
        </form>
      </section>
      {provider && !loading && !error ? (
        <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-ink">WhatsApp workflow</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ["Workflow", provider.provider],
              ["Mode", provider.mode],
              ["Configuration ready", provider.configured ? "Yes" : "No"],
              ["Automatic delivery", provider.automaticDelivery ? "Yes" : "No"],
              ["Delivery confirmation", provider.deliveryConfirmation],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="mt-1 font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </DashboardShell>
  );
}
