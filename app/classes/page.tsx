"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DashboardShell } from "../../components/dashboard-shell";
import {
  Field,
  FormActions,
  inputClass,
  linkButton,
  PageHeader,
  Status,
} from "../../components/ui/forms";
import { Modal } from "../../components/ui/modal";
import { PageFeedback } from "../../components/ui/page-feedback";
import { apiRequest, invalidateApiCache } from "../../lib/api";
import { type ClassSection, readableEnum } from "../../lib/school-types";

const classSchema = z.object({
  gradeNumber: z.number().int().positive().max(20),
  section: z.string().trim().min(1, "Section is required").max(10),
});
type ClassForm = z.infer<typeof classSchema>;

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [gradeFilter, setGradeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ClassSection | null | undefined>();

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    if (gradeFilter) query.set("gradeNumber", gradeFilter);
    if (activeFilter) query.set("isActive", activeFilter);
    try {
      const data = await apiRequest<{ classSections: ClassSection[] }>(
        `/class-sections?${query.toString()}`,
      );
      setClasses(data.classSections);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load classes",
      );
    } finally {
      setLoading(false);
    }
  }, [activeFilter, gradeFilter]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const disableClass = async (classSection: ClassSection) => {
    if (!window.confirm(`Disable ${classSection.name}?`)) return;
    try {
      await apiRequest(`/class-sections/${classSection.id}`, {
        method: "DELETE",
      });
      invalidateApiCache("/class-sections");
      await loadClasses();
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : "Unable to disable class",
      );
    }
  };

  return (
    <DashboardShell>
      <PageHeader
        addLabel="Add class"
        description="Teaching level and display name are derived by the backend."
        onAdd={() => setEditing(null)}
        title="Classes"
      />
      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <input
          className={inputClass}
          min="1"
          onChange={(event) => setGradeFilter(event.target.value)}
          placeholder="Filter by grade"
          type="number"
          value={gradeFilter}
        />
        <select
          className={inputClass}
          onChange={(event) => setActiveFilter(event.target.value)}
          value={activeFilter}
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <PageFeedback
        empty={!classes.length}
        error={error}
        loading={loading}
        onRetry={loadClasses}
      />
      {!loading && !error && classes.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Class",
                  "Grade",
                  "Section",
                  "Level",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th className="px-4 py-3" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.map((classSection) => (
                <tr key={classSection.id}>
                  <td className="px-4 py-3 font-semibold">
                    {classSection.name}
                  </td>
                  <td className="px-4 py-3">
                    {classSection.gradeNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">{classSection.section}</td>
                  <td className="px-4 py-3">
                    {readableEnum(classSection.teachingLevel)}
                  </td>
                  <td className="px-4 py-3">
                    <Status active={classSection.isActive} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {classSection.gradeNumber !== null ? (
                      <button
                        className={linkButton}
                        onClick={() => setEditing(classSection)}
                        type="button"
                      >
                        Edit
                      </button>
                    ) : null}
                    {classSection.isActive ? (
                      <button
                        className={`${linkButton} ml-3 text-red-700`}
                        onClick={() => void disableClass(classSection)}
                        type="button"
                      >
                        Disable
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {editing !== undefined ? (
        <ClassModal
          classSection={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await loadClasses();
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

function ClassModal({
  classSection,
  onClose,
  onSaved,
}: {
  classSection: ClassSection | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      gradeNumber: classSection?.gradeNumber ?? 6,
      section: classSection?.section ?? "A",
    },
  });

  const submit = async (values: ClassForm) => {
    setServerError("");
    try {
      await apiRequest(
        classSection ? `/class-sections/${classSection.id}` : "/class-sections",
        {
          method: classSection ? "PATCH" : "POST",
          body: JSON.stringify(values),
        },
      );
      invalidateApiCache("/class-sections");
      await onSaved();
    } catch (submitError) {
      setServerError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save class",
      );
    }
  };

  return (
    <Modal onClose={onClose} title={classSection ? "Edit class" : "Add class"}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit(submit)}
      >
        <Field error={errors.gradeNumber?.message} label="Grade number">
          <input
            className={inputClass}
            min="1"
            type="number"
            {...register("gradeNumber", { valueAsNumber: true })}
          />
        </Field>
        <Field error={errors.section?.message} label="Section">
          <input className={inputClass} {...register("section")} />
        </Field>
        <p className="sm:col-span-2 text-sm text-slate-500">
          Grades 9 to 12 are Higher; all other numbered grades are Lower.
        </p>
        {serverError ? (
          <p className="sm:col-span-2 text-sm text-red-700">{serverError}</p>
        ) : null}
        <FormActions
          isSubmitting={isSubmitting}
          onCancel={onClose}
          submitLabel={classSection ? "Save changes" : "Add class"}
        />
      </form>
    </Modal>
  );
}
