"use client";

import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import type { WdRecord } from "@/lib/types";
import { formatDateId, todayWib } from "@/lib/dates";
import { Modal } from "@/components/modal";
import { Button, Field, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";

type ReturnProps = { record: WdRecord; onClose: () => void; onSaved: () => void };

export function WdReturnModal({ record, onClose, onSaved }: ReturnProps) {
  const toast = useToast();
  const [returnedAt, setReturnedAt] = useState(todayWib());
  const [durabilityReturn, setDurabilityReturn] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      await api(`/api/wd/${record.id}/return`, {
        method: "POST",
        body: {
          returnedAt,
          durabilityReturn:
            record.isWeapon && durabilityReturn.trim() !== "" ? Number(durabilityReturn) : null,
          returnNote,
        },
      });
      toast(`${record.code} dikembalikan`);
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setErrors(err.fields);
      else toast(err instanceof Error ? err.message : "Gagal menyimpan", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Kembalikan ${record.itemName}`} onClose={onClose}>
      <p className="mb-4 text-sm text-zinc-400">
        {record.borrowerName} · diambil {formatDateId(record.takenAt)}
        {record.serialNumber ? ` · SN ${record.serialNumber}` : ""}
      </p>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal pengembalian" error={errors.returnedAt}>
            <input
              className={inputClass}
              type="date"
              value={returnedAt}
              onChange={(e) => setReturnedAt(e.target.value)}
              autoFocus
            />
          </Field>
          <Field
            label={`Durab dikembalikan (%)${record.isWeapon ? "" : " — tidak perlu"}`}
            error={errors.durabilityReturn}
          >
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              value={durabilityReturn}
              onChange={(e) => setDurabilityReturn(e.target.value)}
              placeholder={record.durabilityStart !== null ? `Awal ${record.durabilityStart}%` : "—"}
              disabled={!record.isWeapon}
            />
          </Field>
        </div>
        <Field label="Catatan kondisi (opsional)" error={errors.returnNote}>
          <textarea
            className={`${inputClass} min-h-16 resize-y`}
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            placeholder="Contoh: baret halus, magasin lengkap"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Menyimpan…" : "Tandai kembali"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type LostProps = { record: WdRecord; onClose: () => void; onSaved: () => void };

export function WdLostModal({ record, onClose, onSaved }: LostProps) {
  const toast = useToast();
  const [lostReason, setLostReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      await api(`/api/wd/${record.id}/lost`, { method: "POST", body: { lostReason } });
      toast(`${record.code} ditandai hilang`);
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setErrors(err.fields);
      else toast(err instanceof Error ? err.message : "Gagal menyimpan", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Tandai hilang — ${record.code}`} onClose={onClose}>
      <p className="mb-4 text-sm text-zinc-400">
        {record.borrowerName} · {record.itemName}
        {record.serialNumber ? ` · SN ${record.serialNumber}` : ""}
      </p>
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Alasan hilang" error={errors.lostReason}>
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Contoh: hilang saat operasi, tidak dikembalikan"
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="danger" disabled={saving}>
            {saving ? "Menyimpan…" : "Tandai hilang"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
