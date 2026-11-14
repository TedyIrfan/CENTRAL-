"use client";

import { useState } from "react";
import type { Activity } from "@/lib/types";
import { formatDateId } from "@/lib/dates";
import { formatActivityText } from "@/lib/kegiatan-format";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";

export function ActivityDetailModal({
  activity,
  onClose,
}: {
  activity: Activity;
  onClose: () => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatActivityText(activity));
      setCopied(true);
      toast("Format kegiatan disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Gagal menyalin", "error");
    }
  }

  return (
    <Modal title={activity.code} onClose={onClose} size="lg">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span>{formatDateId(activity.activityDate)}</span>
        <span>·</span>
        <span>
          {activity.participants.length} peserta
        </span>
      </div>

      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black p-4 font-mono text-xs leading-relaxed text-zinc-200">
        {formatActivityText(activity)}
      </pre>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Tutup</Button>
        <Button variant="primary" onClick={copy}>
          {copied ? "Tersalin" : "Salin format"}
        </Button>
      </div>
    </Modal>
  );
}
