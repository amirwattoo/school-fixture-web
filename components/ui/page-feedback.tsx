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
    return (
      <div
        aria-label="Loading"
        className="grid animate-pulse gap-3 rounded-xl bg-white p-5"
      >
        <span className="h-3 w-1/3 rounded bg-slate-200" />
        <span className="h-3 w-2/3 rounded bg-slate-100" />
      </div>
    );
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
