"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import type { Position } from "@/lib/types";
import { Modal } from "@/components/modal";
import { Button, inputClass } from "@/components/ui";
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
      <h1 className="text-2xl font-bold tracking-tight">Jabatan</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Urutan dari atas ke bawah adalah hierarki. Jabatan baru masuk di paling bawah.
      </p>

      <form onSubmit={add} className="mb-6">
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Nama jabatan baru"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" variant="primary" className="shrink-0">
            + Tambah
          </Button>
        </div>
        {newError && <p className="mt-1 text-xs text-rose-400">{newError}</p>}
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-950/50 p-4 text-sm text-rose-200">
          {error}{" "}
          <button className="underline" onClick={load}>
            Coba lagi
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Memuat…</p>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
          {positions.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-zinc-400">
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
                    />
                    <Button type="submit" variant="primary">
                      Simpan
                    </Button>
                    <Button type="button" onClick={() => setEditId(null)}>
                      Batal
                    </Button>
                  </div>
                  {editError && <p className="mt-1 text-xs text-rose-400">{editError}</p>}
                </form>
              ) : (
                <>
                  <div className="flex-1">
                    <span className="font-semibold">{p.name}</span>
                    <span className="ml-2 text-xs text-zinc-500">{p.memberCount} anggota</span>
                  </div>
                  <Button
                    onClick={() => {
                      setEditId(p.id);
                      setEditName(p.name);
                      setEditError(null);
                    }}
                  >
                    Ubah
                  </Button>
                  <Button
                    onClick={() => setDeleting(p)}
                    disabled={p.memberCount > 0}
                    title={p.memberCount > 0 ? "Masih dipakai anggota" : "Hapus jabatan"}
                  >
                    Hapus
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <Modal title="Hapus jabatan?" onClose={() => setDeleting(null)}>
          <p className="text-sm text-zinc-300">
            Jabatan <b>{deleting.name}</b> akan dihapus.
          </p>
          <div className="mt-5 flex justify-end gap-2">
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
