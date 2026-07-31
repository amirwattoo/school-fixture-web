"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "../../components/dashboard-shell";
import { inputClass, linkButton } from "../../components/ui/forms";
import { PageFeedback } from "../../components/ui/page-feedback";
import { apiRequest } from "../../lib/api";
import { localDateValue } from "../../lib/date";
import {
  readableEnum,
  type Pagination,
  type Teacher,
  type WhatsAppNotification,
  type WhatsAppStatus,
} from "../../lib/school-types";

const statuses: Array<WhatsAppStatus | ""> = [
  "",
  "READY",
  "OPENED",
  "MANUALLY_CONFIRMED",
];

const badgeClass: Record<WhatsAppStatus, string> = {
  READY: "bg-amber-100 text-amber-900",
  OPENED: "bg-blue-100 text-blue-900",
  MANUALLY_CONFIRMED: "bg-emerald-100 text-emerald-900",
};

const localTime = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

const validatedClickToChatUrl = (value: string | null) => {
  if (!value) throw new Error("No WhatsApp Click-to-Chat URL is available.");
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "wa.me" ||
      !/^\/923\d{9}$/.test(url.pathname) ||
      !url.searchParams.get("text")
    ) {
      throw new Error("Malformed URL");
    }
    return url.toString();
  } catch {
    throw new Error("The generated WhatsApp URL is malformed.");
  }
};

export default function WhatsAppStatusPage() {
  const [date, setDate] = useState(localDateValue());
  const [status, setStatus] = useState<WhatsAppStatus | "">("");
  const [teacherId, setTeacherId] = useState("");
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>(
    [],
  );
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ pageSize: "100" });
    if (date) query.set("date", date);
    if (status) query.set("status", status);
    if (teacherId) query.set("teacherId", teacherId);
    try {
      const [notificationData, teacherData] = await Promise.all([
        apiRequest<{
          notifications: WhatsAppNotification[];
          pagination: Pagination;
        }>(`/whatsapp-notifications?${query.toString()}`),
        apiRequest<{ teachers: Teacher[] }>("/teachers?isActive=true"),
      ]);
      setNotifications(notificationData.notifications);
      setPagination(notificationData.pagination);
      setTeachers(teacherData.teachers);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load WhatsApp notifications",
      );
    } finally {
      setLoading(false);
    }
  }, [date, status, teacherId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWhatsApp = async (notification: WhatsAppNotification) => {
    setError("");
    setFeedback("");
    if (notification.clickToChatError) {
      setError(notification.clickToChatError.message);
      return;
    }
    let url: string;
    try {
      url = validatedClickToChatUrl(notification.clickToChatUrl);
    } catch (urlError) {
      setError(
        urlError instanceof Error
          ? urlError.message
          : "The generated WhatsApp URL is malformed.",
      );
      return;
    }
    const openedWindow = window.open(url, "_blank");
    if (!openedWindow) {
      setError(
        "WhatsApp could not open because the browser blocked the new tab. Allow popups and try again.",
      );
      return;
    }
    openedWindow.opener = null;
    setWorkingId(notification.id);
    try {
      await apiRequest(`/whatsapp-notifications/${notification.id}/opened`, {
        method: "POST",
      });
      setFeedback(
        `WhatsApp opened for ${notification.teacher.name}. Confirm manually after sending.`,
      );
      await load();
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "WhatsApp opened, but its status could not be updated.",
      );
    } finally {
      setWorkingId("");
    }
  };

  const copyMessage = async (notification: WhatsAppNotification) => {
    setError("");
    setFeedback("");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(notification.message);
      setFeedback(`Message copied for ${notification.teacher.name}.`);
    } catch {
      setError(
        "The message could not be copied. Allow clipboard access and try again.",
      );
    }
  };

  const confirmSent = async (notification: WhatsAppNotification) => {
    setWorkingId(notification.id);
    setError("");
    setFeedback("");
    try {
      await apiRequest(`/whatsapp-notifications/${notification.id}/confirm`, {
        method: "POST",
      });
      setFeedback(
        `Message to ${notification.teacher.name} marked as sent manually.`,
      );
      await load();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "The message could not be confirmed.",
      );
    } finally {
      setWorkingId("");
    }
  };

  return (
    <DashboardShell>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-ink">WhatsApp Click-to-Chat</h2>
        <p className="mt-1 text-sm text-slate-600">
          Open each prepared message in WhatsApp, send it yourself, then confirm
          it manually.
        </p>
      </div>
      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          Date
          <input
            className={`${inputClass} mt-1`}
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select
            className={`${inputClass} mt-1`}
            onChange={(event) =>
              setStatus(event.target.value as WhatsAppStatus | "")
            }
            value={status}
          >
            {statuses.map((item) => (
              <option key={item || "ALL"} value={item}>
                {item ? readableEnum(item) : "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Teacher
          <select
            className={`${inputClass} mt-1`}
            onChange={(event) => setTeacherId(event.target.value)}
            value={teacherId}
          >
            <option value="">All teachers</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {feedback ? (
        <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {feedback}
        </p>
      ) : null}
      <PageFeedback
        empty={!notifications.length}
        error={error}
        loading={loading}
        onRetry={load}
      />
      {!loading && !error && notifications.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {notifications.map((notification) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              key={notification.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-ink">
                    {notification.teacher.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {notification.normalizedDestination || "No valid number"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass[notification.status]}`}
                >
                  {readableEnum(notification.status)}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Date / period</dt>
                  <dd className="font-semibold">
                    {notification.fixture.date.slice(0, 10)} · Period{" "}
                    {notification.fixture.periodNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Class</dt>
                  <dd className="font-semibold">
                    {notification.fixture.classSection.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Opened</dt>
                  <dd>{localTime(notification.openedAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Manually confirmed</dt>
                  <dd>{localTime(notification.manuallyConfirmedAt)}</dd>
                </div>
              </dl>
              {notification.clickToChatError ? (
                <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">
                  {notification.clickToChatError.message}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className={linkButton}
                  disabled={
                    workingId === notification.id ||
                    Boolean(notification.clickToChatError)
                  }
                  onClick={() => void openWhatsApp(notification)}
                  type="button"
                >
                  Open WhatsApp
                </button>
                <button
                  className={linkButton}
                  onClick={() => void copyMessage(notification)}
                  type="button"
                >
                  Copy Message
                </button>
                <button
                  className={linkButton}
                  disabled={
                    workingId === notification.id ||
                    notification.status === "MANUALLY_CONFIRMED"
                  }
                  onClick={() => void confirmSent(notification)}
                  type="button"
                >
                  Mark as Sent
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {pagination ? (
        <p className="mt-4 text-xs text-slate-500">
          Showing {notifications.length} of {pagination.total} notifications.
        </p>
      ) : null}
    </DashboardShell>
  );
}
