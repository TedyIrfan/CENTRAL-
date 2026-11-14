"use client";

import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import type { WdRecord } from "@/lib/types";
import { todayWib, toDateInput } from "@/lib/dates";
import { Modal } from "@/components/modal";
import { MemberPicker, type MemberOption } from "@/components/member-picker";
import { Button, Field, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";

export type { MemberOption };

type Props = {
  members: MemberOption[];
  suggestions: string[];
  record?: WdRecord;
  onClose: () => void;
  onSaved: () => void;
};

export function WdFormModal({ members, suggestions, record, onClose, onSaved }: Props) {
  const toast = useToast();
  const [memberId, setMemberId] = useState<number | "">(record?.memberId ?? "");
  const [itemName, setItemName] = useState(record?.itemName ?? "");
  const [isWeapon, setIsWeapon] = useState(record?.isWeapon ?? true);
  const [serialNumber, setSerialNumber] = useState(record?.serialNumber ?? "");
  const [qty, setQty] = useState(String(record?.qty ?? 1));
  const [durabilityStart, setDurabilityStart] = useState(
    record?.durabilityStart !== null && record?.durabilityStart !== undefined
      ? String(record.durabilityStart)
      : "100",
  );
  const [takenAt, setTakenAt] = useState(
    record ? toDateInput(record.takenAt) : todayWib(),
  );
  const [purpose, setPurpose] = useState(record?.purpose ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);

    const body = {
      memberId: memberId === "" ? null : Number(memberId),
      itemName,
      isWeapon,
      serialNumber: isWeapon ? serialNumber : null,
      qty: qty.trim() === "" ? null : Number(qty),
      durabilityStart: isWeapon ? (durabilityStart.trim() === "" ? null : Number(durabilityStart)) : null,
      takenAt,
      purpose,
    };

    try {
      if (record) {
        await api(`/api/wd/${record.id}`, { method: "PATCH", body });
        toast(`${record.code} diperbarui`);
      } else {
        const res = await api<{ data: WdRecord }>("/api/wd", { method: "POST", body });
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
    <Modal title={record ? `Edit ${record.code}` : "Ambil barang (WD)"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <MemberPicker
            members={sorted}
            value={memberId}
            onChange={setMemberId}
            error={errors.memberId}
            autoFocus
          />
          <Field label="Jenis barang" error={errors.itemName}>
            <input
              className={inputClass}
              list="wd-item-suggestions"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Contoh: Pistol, Amunisi"
            />
            <datalist id="wd-item-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-white"
            checked={isWeapon}
            onChange={(e) => setIsWeapon(e.target.checked)}
          />
          Senjata (wajib SN &amp; durab)
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SN" error={errors.serialNumber}>
            <input
              className={`${inputClass} font-mono`}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder={isWeapon ? "Serial number senjata" : "Tidak perlu untuk barang ini"}
              disabled={!isWeapon}
            />
          </Field>
          <Field label="Durab awal (%)" error={errors.durabilityStart}>
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              value={durabilityStart}
              onChange={(e) => setDurabilityStart(e.target.value)}
              disabled={!isWeapon}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qty (PCS)" error={errors.qty}>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Tanggal pengambilan" error={errors.takenAt}>
            <input
              className={inputClass}
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Keperluan" error={errors.purpose}>
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Contoh: Jaga wilayah / operasi"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Menyimpan…" : record ? "Simpan" : "Catat WD"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
