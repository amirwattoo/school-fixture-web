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
import { readableEnum, type Teacher } from "../../lib/school-types";

const teacherSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  employeeCode: z.string().trim().min(1, "Employee code is required"),
  whatsappNumber: z
    .string()
    .trim()
    .refine(
      (value) =>
        !value ||
        /^\+923\d{9}$/.test(value.replace(/[\s\-()[\]]/g, "")) ||
        /^(?:03|3|923)\d{9}$/.test(value.replace(/[\s\-()[\]]/g, "")),
      "Enter a Pakistani number such as 03001234567",
    ),
  specializationText: z.string(),
  teachingLevel: z.enum(["LOWER", "HIGHER", "BOTH"]),
});

type TeacherForm = z.infer<typeof teacherSchema>;

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Teacher | null | undefined>();

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (activeFilter) query.set("isActive", activeFilter);
    if (levelFilter) query.set("teachingLevel", levelFilter);
    try {
      const data = await apiRequest<{ teachers: Teacher[] }>(
        `/teachers?${query.toString()}`,
      );
      setTeachers(data.teachers);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load teachers",
      );
    } finally {
      setLoading(false);
    }
  }, [activeFilter, levelFilter, search]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const disableTeacher = async (teacher: Teacher) => {
    if (!window.confirm(`Disable ${teacher.name}?`)) return;
    try {
      await apiRequest(`/teachers/${teacher.id}`, { method: "DELETE" });
      invalidateApiCache("/teachers");
      await loadTeachers();
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : "Unable to disable teacher",
      );
    }
  };

  return (
    <DashboardShell>
      <PageHeader
        addLabel="Add teacher"
        description="Manage non-login teacher records and teaching specializations."
        onAdd={() => setEditing(null)}
        title="Teachers"
      />
      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <input
          aria-label="Search teachers"
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
        <select
          className={inputClass}
          onChange={(event) => setLevelFilter(event.target.value)}
          value={levelFilter}
        >
          <option value="">All teaching levels</option>
          <option value="LOWER">Lower</option>
          <option value="HIGHER">Higher</option>
          <option value="BOTH">Both</option>
        </select>
      </div>

      <PageFeedback
        empty={!teachers.length}
        error={error}
        loading={loading}
        onRetry={loadTeachers}
      />
      {!loading && !error && teachers.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Name",
                  "Code",
                  "WhatsApp",
                  "Subjects",
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
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td className="px-4 py-3 font-semibold text-ink">
                    {teacher.name}
                  </td>
                  <td className="px-4 py-3">{teacher.employeeCode}</td>
                  <td className="px-4 py-3">
                    {teacher.whatsappNumber ?? "Not provided"}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    {teacher.subjectSpecializations.join(", ") || "None"}
                  </td>
                  <td className="px-4 py-3">
                    {readableEnum(teacher.teachingLevel)}
                  </td>
                  <td className="px-4 py-3">
                    <Status active={teacher.isActive} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      className={linkButton}
                      onClick={() => setEditing(teacher)}
                      type="button"
                    >
                      Edit
                    </button>
                    {teacher.isActive ? (
                      <button
                        className={`${linkButton} ml-3 text-red-700`}
                        onClick={() => void disableTeacher(teacher)}
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
        <TeacherModal
          teacher={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await loadTeachers();
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

function TeacherModal({
  teacher,
  onClose,
  onSaved,
}: {
  teacher: Teacher | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: teacher?.name ?? "",
      employeeCode: teacher?.employeeCode ?? "",
      whatsappNumber: teacher?.whatsappNumber ?? "",
      specializationText: teacher?.subjectSpecializations.join(", ") ?? "",
      teachingLevel: teacher?.teachingLevel ?? "LOWER",
    },
  });

  const submit = async (values: TeacherForm) => {
    setServerError("");
    try {
      await apiRequest(teacher ? `/teachers/${teacher.id}` : "/teachers", {
        method: teacher ? "PATCH" : "POST",
        body: JSON.stringify({
          name: values.name,
          employeeCode: values.employeeCode,
          whatsappNumber: values.whatsappNumber,
          subjectSpecializations: values.specializationText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          teachingLevel: values.teachingLevel,
        }),
      });
      invalidateApiCache("/teachers");
      await onSaved();
    } catch (submitError) {
      setServerError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save teacher",
      );
    }
  };

  return (
    <Modal onClose={onClose} title={teacher ? "Edit teacher" : "Add teacher"}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit(submit)}
      >
        <Field error={errors.name?.message} label="Name">
          <input className={inputClass} {...register("name")} />
        </Field>
        <Field error={errors.employeeCode?.message} label="Employee code">
          <input className={inputClass} {...register("employeeCode")} />
        </Field>
        <Field error={errors.whatsappNumber?.message} label="WhatsApp number">
          <input
            className={inputClass}
            placeholder="03001234567 or +923001234567"
            {...register("whatsappNumber")}
          />
        </Field>
        <Field error={errors.teachingLevel?.message} label="Teaching level">
          <select className={inputClass} {...register("teachingLevel")}>
            <option value="LOWER">Lower</option>
            <option value="HIGHER">Higher</option>
            <option value="BOTH">Both</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field
            error={errors.specializationText?.message}
            label="Subject specializations (comma separated)"
          >
            <input
              className={inputClass}
              placeholder="Mathematics, Physics"
              {...register("specializationText")}
            />
          </Field>
        </div>
        {serverError ? (
          <p className="sm:col-span-2 text-sm text-red-700">{serverError}</p>
        ) : null}
        <FormActions
          isSubmitting={isSubmitting}
          onCancel={onClose}
          submitLabel={teacher ? "Save changes" : "Add teacher"}
        />
      </form>
    </Modal>
  );
}
