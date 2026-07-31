"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "../../components/dashboard-shell";
import { PageFeedback } from "../../components/ui/page-feedback";
import { apiRequest } from "../../lib/api";
import type { WhatsAppProviderStatus } from "../../lib/school-types";

export default function SettingsPage() {
  const [provider, setProvider] = useState<WhatsAppProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
