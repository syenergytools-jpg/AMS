"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertAttendance } from "../actions";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatTime, hoursBetween, isoToPktTimeInput, todayISO } from "@/lib/format";
import type { Attendance } from "@/lib/types";
import { Loader2, Pencil, Plus } from "lucide-react";

interface EditState {
  date: string;
  checkIn: string;
  checkOut: string;
}

export function AttendanceEditor({ employeeId, history }: { employeeId: string; history: Attendance[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<EditState | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setModal({ date: "", checkIn: "", checkOut: "" });
    setError(null);
  }

  function openEdit(r: Attendance) {
    setModal({ date: r.work_date, checkIn: isoToPktTimeInput(r.check_in), checkOut: isoToPktTimeInput(r.check_out) });
    setError(null);
  }

  function closeModal() {
    setModal(null);
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setError(null);
    startTransition(async () => {
      const res = await upsertAttendance(employeeId, modal.date, modal.checkIn, modal.checkOut);
      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
        closeModal();
      }
    });
  }

  return (
    <div className="card overflow-hidden lg:col-span-2">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="font-semibold text-navy">Attendance history</h2>
          <p className="text-xs text-slate-400">Last 30 records</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add record
        </button>
      </div>

      {history.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-slate-400">No attendance recorded yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">In</th>
              <th className="px-6 py-3 font-medium">Out</th>
              <th className="px-6 py-3 font-medium">Hours</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {history.map((r) => (
              <tr key={r.id} className="text-slate-600">
                <td className="px-6 py-3 font-medium text-navy">{formatDate(r.work_date)}</td>
                <td className="px-6 py-3">{formatTime(r.check_in)}</td>
                <td className="px-6 py-3">{formatTime(r.check_out)}</td>
                <td className="px-6 py-3">{hoursBetween(r.check_in, r.check_out)}</td>
                <td className="px-6 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => openEdit(r)}
                    aria-label={`Edit ${r.work_date}`}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal && (
        <Modal title={modal.date ? "Edit attendance" : "Add attendance record"} onClose={closeModal}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                required
                max={todayISO()}
                value={modal.date}
                onChange={(e) => setModal({ ...modal, date: e.target.value })}
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Check-in</label>
                <input
                  type="time"
                  value={modal.checkIn}
                  onChange={(e) => setModal({ ...modal, checkIn: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Check-out</label>
                <input
                  type="time"
                  value={modal.checkOut}
                  onChange={(e) => setModal({ ...modal, checkOut: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
