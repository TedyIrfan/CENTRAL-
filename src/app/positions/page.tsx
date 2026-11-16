"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import type { Position } from "@/lib/types";
import { Modal } from "@/components/modal";
import { Button, IconButton, PageHeader, Panel, inputClass } from "@/components/ui";
import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from "@/components/icons";
import { useToast } from "@/components/toast";

export default function PositionsPage() {
  const toast = useToast();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<Position | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Position[] }>("/api/positions");
      setPositions(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setNewError(null);
    try {
      await api("/api/positions", { method: "POST", body: { name: newName } });
      toast(`Jabatan "${newName.trim()}" ditambahkan`);
      setNewName("");
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields?.name) setNewError(err.fields.name);
      else toast(err instanceof Error ? err.message : "Gagal menambah", "error");
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (editId === null) return;
    setEditError(null);
    try {
      await api(`/api/positions/${editId}`, { method: "PATCH", body: { name: editName } });
      toast("Jabatan diperbarui");
      setEditId(null);
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields?.name) setEditError(err.fields.name);
      else toast(err instanceof Error ? err.message : "Gagal menyimpan", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/positions/${deleting.id}`, { method: "DELETE" });
      toast(`Jabatan "${deleting.name}" dihapus`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menghapus", "error");
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Jabatan"
        description="Urutan atas ke bawah adalah hierarki. Jabatan baru masuk paling bawah."
      />

      <form onSubmit={add} className="mb-3">
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Nama jabatan baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Nama jabatan baru"
          />
          <Button type="submit" variant="primary">
            <IconPlus size={14} /> Tambah
          </Button>
        </div>
        {newError && <p className="mt-1 text-[11.5px] text-bad">{newError}</p>}
      </form>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-field border border-bad/25 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          {error}
          <button type="button" className="underline" onClick={load}>
            coba lagi
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-ink-3">Memuat…</p>
      ) : (
        <Panel>
          <ul>
            {positions.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3 border-b border-line/60 px-3 py-2 last:border-0"
              >
                <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] text-ink-3">
                  {i + 1}
                </span>

                {editId === p.id ? (
                  <form onSubmit={saveEdit} className="flex-1">
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        aria-label="Nama jabatan"
                      />
                      <IconButton label="Simpan nama" type="submit">
                        <IconCheck size={14} />
                      </IconButton>
                      <IconButton label="Batal" onClick={() => setEditId(null)}>
                        <IconX size={14} />
                      </IconButton>
                    </div>
                    {editError && <p className="mt-1 text-[11.5px] text-bad">{editError}</p>}
                  </form>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="text-[13px] font-medium">{p.name}</span>
                      <span className="tnum ml-2 text-[11px] text-ink-3">
                        {p.memberCount} anggota
                      </span>
                    </div>
                    <IconButton
                      label="Ubah nama jabatan"
                      onClick={() => {
                        setEditId(p.id);
                        setEditName(p.name);
                        setEditError(null);
                      }}
                    >
                      <IconPencil size={14} />
                    </IconButton>
                    <IconButton
                      label={
                        p.memberCount > 0 ? "Masih dipakai anggota" : "Hapus jabatan"
                      }
                      tone="danger"
                      disabled={p.memberCount > 0}
                      onClick={() => setDeleting(p)}
                    >
                      <IconTrash size={14} />
                    </IconButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {deleting && (
        <Modal title="Hapus jabatan?" onClose={() => setDeleting(null)}>
          <p className="text-[13px] text-ink-2">
            Jabatan <b className="text-ink">{deleting.name}</b> akan dihapus.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setDeleting(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete}>
              Hapus
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
