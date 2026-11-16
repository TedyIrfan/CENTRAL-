"use client";

import { useState } from "react";
import type { Activity } from "@/lib/types";
import { formatDateId } from "@/lib/dates";
import { formatActivityText } from "@/lib/kegiatan-format";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { IconCheck, IconCopy } from "@/components/icons";
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
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
        <span className="tnum">{formatDateId(activity.activityDate)}</span>
        <span>·</span>
        <span className="tnum">{activity.participants.length} peserta</span>
      </div>

      <pre className="overflow-x-auto rounded-field border border-line bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-ink">
        {formatActivityText(activity)}
      </pre>

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
