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
import { apiRequest } from "../../lib/api";
import type { Subject } from "../../lib/school-types";

const subjectSchema = z.object({
  name: z.string().trim().min(2, "Subject name is required"),
  code: z.string().trim().min(1, "Subject code is required"),
});
type SubjectForm = z.infer<typeof subjectSchema>;

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Subject | null | undefined>();

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (activeFilter) query.set("isActive", activeFilter);
    try {
      const data = await apiRequest<{ subjects: Subject[] }>(
        `/subjects?${query.toString()}`,
      );
      setSubjects(data.subjects);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load subjects",
      );
    } finally {
      setLoading(false);
    }
  }, [activeFilter, search]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  const disableSubject = async (subject: Subject) => {
    if (!window.confirm(`Disable ${subject.name}?`)) return;
    try {
      await apiRequest(`/subjects/${subject.id}`, { method: "DELETE" });
      await loadSubjects();
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : "Unable to disable subject",
      );
    }
  };

  return (
    <DashboardShell>
      <PageHeader
        addLabel="Add subject"
        description="Maintain the normalized subject catalog used by the timetable."
        onAdd={() => setEditing(null)}
        title="Subjects"
      />
      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <input
          aria-label="Search subjects"
          className={inputClass}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or code"
          value={search}
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
        empty={!subjects.length}
        error={error}
        loading={loading}
        onRetry={loadSubjects}
      />
      {!loading && !error && subjects.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Name", "Code", "Status", "Actions"].map((heading) => (
                  <th className="px-4 py-3" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map((subject) => (
                <tr key={subject.id}>
                  <td className="px-4 py-3 font-semibold">{subject.name}</td>
                  <td className="px-4 py-3">{subject.code}</td>
                  <td className="px-4 py-3">
                    <Status active={subject.isActive} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      className={linkButton}
                      onClick={() => setEditing(subject)}
                      type="button"
                    >
                      Edit
                    </button>
                    {subject.isActive ? (
                      <button
                        className={`${linkButton} ml-3 text-red-700`}
                        onClick={() => void disableSubject(subject)}
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
        <SubjectModal
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await loadSubjects();
          }}
          subject={editing}
        />
      ) : null}
    </DashboardShell>
  );
}

function SubjectModal({
  subject,
  onClose,
  onSaved,
}: {
  subject: Subject | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: subject?.name ?? "", code: subject?.code ?? "" },
  });

  const submit = async (values: SubjectForm) => {
    setServerError("");
    try {
      await apiRequest(subject ? `/subjects/${subject.id}` : "/subjects", {
        method: subject ? "PATCH" : "POST",
        body: JSON.stringify(values),
      });
      await onSaved();
    } catch (submitError) {
      setServerError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save subject",
      );
    }
  };

  return (
    <Modal onClose={onClose} title={subject ? "Edit subject" : "Add subject"}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit(submit)}
      >
        <Field error={errors.name?.message} label="Name">
          <input className={inputClass} {...register("name")} />
        </Field>
        <Field error={errors.code?.message} label="Code">
          <input className={inputClass} {...register("code")} />
        </Field>
        {serverError ? (
          <p className="sm:col-span-2 text-sm text-red-700">{serverError}</p>
        ) : null}
        <FormActions
          isSubmitting={isSubmitting}
          onCancel={onClose}
          submitLabel={subject ? "Save changes" : "Add subject"}
        />
      </form>
    </Modal>
  );
}
