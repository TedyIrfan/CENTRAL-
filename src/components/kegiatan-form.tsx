"use client";

import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import type { Activity } from "@/lib/types";
import { todayWib, toDateInput } from "@/lib/dates";
import { Modal } from "@/components/modal";
import { ParticipantPicker, type ParticipantDraft } from "@/components/participant-picker";
import type { MemberOption } from "@/components/member-picker";
import { Button, Field, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";

type Props = {
  members: MemberOption[];
  suggestions: string[];
  activity?: Activity;
  onClose: () => void;
  onSaved: () => void;
};

export function ActivityFormModal({ members, suggestions, activity, onClose, onSaved }: Props) {
  const toast = useToast();
  const [activityDate, setActivityDate] = useState(
    activity ? toDateInput(activity.activityDate) : todayWib(),
  );
  const [title, setTitle] = useState(activity?.title ?? "");
  const [negotiation, setNegotiation] = useState(activity?.negotiation ?? "");
  const [participants, setParticipants] = useState<ParticipantDraft[]>(
    activity?.participants.map((p) => ({ memberId: p.memberId, name: p.name })) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);

    const body = {
      activityDate,
      title,
      negotiation,
      participants: participants.map((p) => ({ memberId: p.memberId, name: p.name })),
    };

    try {
      if (activity) {
        await api(`/api/activities/${activity.id}`, { method: "PATCH", body });
        toast(`${activity.code} diperbarui`);
      } else {
        const res = await api<{ data: Activity }>("/api/activities", { method: "POST", body });
        toast(`${res.data.code} dicatat`);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setErrors(err.fields);
      else toast(err instanceof Error ? err.message : "Gagal menyimpan", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={activity ? `Edit ${activity.code}` : "Catat kegiatan"} onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal kegiatan" error={errors.activityDate}>
            <input
              className={inputClass}
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
            />
          </Field>
          <Field label="Kegiatan" error={errors.title}>
            <input
              className={inputClass}
              list="activity-suggestions"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Penyandaraan Japapride"
              autoFocus
            />
            <datalist id="activity-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field
          label="Negosiasi (opsional)"
          error={errors.negotiation}
          hint="Contoh: Menang 1JT Umer"
        >
          <input
            className={inputClass}
            value={negotiation}
            onChange={(e) => setNegotiation(e.target.value)}
            placeholder="Kosongkan jika tidak ada negosiasi"
          />
        </Field>

        <ParticipantPicker
          members={sorted}
          value={participants}
          onChange={setParticipants}
          error={errors.participants}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Menyimpan…" : activity ? "Simpan" : "Catat kegiatan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
