"use client";

import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import { STATUS_OPTIONS, type GroupMember, type MemberStatus, type Position } from "@/lib/types";
import { Modal } from "@/components/modal";
import { Button, Field, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";

export type EditingMember = GroupMember & { positionId: number };

export function MemberForm({
  positions,
  member,
  defaultPositionId,
  onClose,
  onSaved,
}: {
  positions: Position[];
  member?: EditingMember;
  defaultPositionId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(member?.name ?? "");
  const [positionId, setPositionId] = useState<number | "">(
    member?.positionId ?? defaultPositionId ?? positions[0]?.id ?? "",
  );

  const [hex, setHex] = useState(member?.hex ?? "");
  const [discordId, setDiscordId] = useState(member?.discordId ?? "");
  const [status, setStatus] = useState<MemberStatus>(member?.status ?? "AKTIF");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const willDemote =
    !!member &&
    status === "DITURUNKAN" &&
    member.status !== "DITURUNKAN" &&
    positionId === member.positionId;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = { name, positionId, hex, discordId, status };
    try {
      if (member) {
        await api(`/api/members/${member.id}`, { method: "PATCH", body });
        toast(`${name.trim()} diperbarui`);
      } else {
        await api("/api/members", { method: "POST", body });
        toast(`${name.trim()} ditambahkan`);
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
    <Modal title={member ? "Edit anggota" : "Tambah anggota"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama" error={errors.name}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Nama anggota"
          />
        </Field>
        <Field label="Jabatan" error={errors.positionId}>
          <select
            className={inputClass}
            value={positionId}
            onChange={(e) => setPositionId(Number(e.target.value))}
          >
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Steam Hex"
          error={errors.hex}
          hint="Awalan steam: ditambahkan otomatis jika tidak diisi"
        >
          <input
            className={`${inputClass} font-mono`}
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            placeholder="steam:110000112345678"
          />
        </Field>
        <Field label="ID Discord" error={errors.discordId} hint="Opsional, angka 15-20 digit">
          <input
            className={`${inputClass} font-mono`}
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="123456789012345678"
          />
        </Field>
        <Field
          label="Status"
          error={errors.status}
          hint={willDemote ? "Jabatan akan otomatis turun satu tingkat." : undefined}
        >
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as MemberStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
