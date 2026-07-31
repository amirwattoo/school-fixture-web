export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-emerald-100";
export const primaryButton =
  "rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";
export const secondaryButton =
  "rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50";
export const linkButton = "text-sm font-semibold text-primary hover:underline";

export function PageHeader({
  title,
  description,
  onAdd,
  addLabel,
}: {
  title: string;
  description: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <button className={primaryButton} onClick={onAdd} type="button">
        {addLabel}
      </button>
    </div>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <span className="mt-1 block font-normal">{children}</span>
      {error ? (
        <span className="mt-1 block text-xs text-red-700">{error}</span>
      ) : null}
    </label>
  );
}

export function FormActions({
  isSubmitting,
  onCancel,
  submitLabel,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 sm:col-span-2">
      <button className={secondaryButton} onClick={onCancel} type="button">
        Cancel
      </button>
      <button className={primaryButton} disabled={isSubmitting} type="submit">
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

export function Status({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-200 text-slate-600"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}
