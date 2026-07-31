export function PageFeedback({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  onRetry: () => void;
}) {
  if (loading)
    return <p className="rounded-xl bg-white p-6 text-slate-600">Loading…</p>;
  if (error)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        <p>{error}</p>
        <button
          className="mt-3 font-semibold underline"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  if (empty)
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        No records match the current filters.
      </p>
    );
  return null;
}
