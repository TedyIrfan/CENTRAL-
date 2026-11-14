"use client";

import { useState } from "react";
import type { WdRecord } from "@/lib/types";
import { WD_STATUS_OPTIONS } from "@/lib/types";
import { formatDateId } from "@/lib/dates";
import { formatWdText } from "@/lib/wd-format";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
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

  return (
    <Modal title={record.code} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${status?.className}`}>
          {status?.label}
        </span>
        <span>Diambil {formatDateId(record.takenAt)}</span>
        {record.returnedAt && <span>· Kembali {formatDateId(record.returnedAt)}</span>}
        {record.isWeapon && <span>· Senjata</span>}
      </div>

      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black p-4 font-mono text-xs leading-relaxed text-zinc-200">
        {formatWdText(record)}
      </pre>

      {record.returnNote && (
        <p className="mt-3 text-xs text-zinc-400">
          <span className="text-zinc-500">Catatan kondisi:</span> {record.returnNote}
        </p>
      )}
      {record.lostReason && (
        <p className="mt-3 text-xs text-rose-300">
          <span className="text-rose-400/70">Alasan hilang:</span> {record.lostReason}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Tutup</Button>
        <Button variant="primary" onClick={copy}>
          {copied ? "Tersalin" : "Salin format"}
        </Button>
      </div>
    </Modal>
  );
}
