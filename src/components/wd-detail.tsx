"use client";

import { useState } from "react";
import type { WdRecord } from "@/lib/types";
import { WD_STATUS_OPTIONS } from "@/lib/types";
import { formatDateId } from "@/lib/dates";
import { formatWdText } from "@/lib/wd-format";
import { Modal } from "@/components/modal";
import { Badge, Button } from "@/components/ui";
import { IconCopy, IconCheck } from "@/components/icons";
import { useToast } from "@/components/toast";

export function WdDetailModal({ record, onClose }: { record: WdRecord; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const status = WD_STATUS_OPTIONS.find((s) => s.value === record.status);

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatWdText(record));
      setCopied(true);
      toast("Format WD disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Gagal menyalin", "error");
    }
  }

  const late = record.isOverdue || (record.status === "DIKEMBALIKAN" && record.daysLate > 0);

  return (
    <Modal title={record.code} onClose={onClose} size="lg">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
        <Badge className={status?.className}>{status?.label}</Badge>
        <span>Diambil {formatDateId(record.takenAt)}</span>
        {record.returnedAt && <span>· Kembali {formatDateId(record.returnedAt)}</span>}
        {record.isWeapon && <span>· Senjata</span>}
      </div>

      <pre className="overflow-x-auto rounded-field border border-line bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-ink">
        {formatWdText(record)}
      </pre>

      {record.isWeapon && record.dueAt && (
        <p className={`mt-2.5 text-[11.5px] ${late ? "text-bad" : "text-ink-3"}`}>
          <span className="text-ink-3">Tenggat kembali:</span> {formatDateId(record.dueAt)}
          {record.isOverdue
            ? ` · terlambat ${record.daysLate} hari`
            : record.status === "DIPINJAM"
              ? record.daysLeft === 0
                ? " · hari ini"
                : ` · sisa ${record.daysLeft} hari`
              : record.status === "DIKEMBALIKAN" && record.daysLate > 0
                ? ` · dikembalikan terlambat ${record.daysLate} hari`
                : ""}
        </p>
      )}

      {record.returnNote && (
        <p className="mt-2 text-[11.5px] text-ink-2">
          <span className="text-ink-3">Catatan kondisi:</span> {record.returnNote}
        </p>
      )}
      {record.lostReason && (
        <p className="mt-2 text-[11.5px] text-bad">
          <span className="opacity-70">Alasan hilang:</span> {record.lostReason}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Tutup</Button>
        <Button variant="primary" onClick={copy}>
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {copied ? "Tersalin" : "Salin format"}
        </Button>
      </div>
    </Modal>
  );
}
