"use client";

import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import { VAULT_STATUS_OPTIONS, type VaultItem, type VaultStatus } from "@/lib/types";
import { Modal } from "@/components/modal";
import { Button, Field, inputClass, selectClass } from "@/components/ui";
import { useToast } from "@/components/toast";

type Props = {
  item?: VaultItem;
  suggestions: string[];
  onClose: () => void;
  onSaved: () => void;
};

export function VaultFormModal({ item, suggestions, onClose, onSaved }: Props) {
  const toast = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [isWeapon, setIsWeapon] = useState(item?.isWeapon ?? true);
  const [serialNumber, setSerialNumber] = useState(item?.serialNumber ?? "");
  const [durability, setDurability] = useState(
    item?.durability !== null && item?.durability !== undefined ? String(item.durability) : "",
  );
  const [status, setStatus] = useState<VaultStatus>(item?.status ?? "SIAP");
  const [note, setNote] = useState(item?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);

    const body = {
      name,
      isWeapon,
      serialNumber: isWeapon ? serialNumber : null,
      durability: durability.trim() === "" ? null : Number(durability),
      status,
      note,
    };

    try {
      if (item) {
        await api(`/api/berangkas/${item.id}`, { method: "PATCH", body });
        toast(`${item.name} diperbarui`);
      } else {
        await api("/api/berangkas", { method: "POST", body });
        toast(`${name.trim()} ditambahkan ke Berangkas`);
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
    <Modal title={item ? `Edit ${item.name}` : "Tambah barang ke Berangkas"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama barang" error={errors.name}>
            <input
              className={inputClass}
              list="vault-name-suggestions"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: DA, Pistol"
              autoFocus
            />
            <datalist id="vault-name-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Status" error={errors.status}>
            <select
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as VaultStatus)}
            >
              {VAULT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-ink"
            checked={isWeapon}
            onChange={(e) => setIsWeapon(e.target.checked)}
          />
          Senjata — wajib SN
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SN / serial number" error={errors.serialNumber}>
            <input
              className={`${inputClass} font-mono`}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder={isWeapon ? "Serial number" : "Tidak perlu untuk barang ini"}
              disabled={!isWeapon}
            />
          </Field>
          <Field label="Durab (%)" error={errors.durability}>
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              value={durability}
              onChange={(e) => setDurability(e.target.value)}
              placeholder="Opsional"
              disabled={!isWeapon}
            />
          </Field>
        </div>

        <Field label="Catatan (opsional)" error={errors.note}>
          <textarea
            className={`${inputClass} min-h-[60px] resize-y`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: barang tidak di Renzo / luting mapendos"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Menyimpan…" : item ? "Simpan" : "Tambah"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
