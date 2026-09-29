"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProductivitySession, updateProductivitySession } from "../actions";
import { ProductivityChart, type ChartRow } from "@/components/ProductivityChart";
import { Modal } from "@/components/Modal";
import { SiteBreakdownModal } from "@/components/SiteBreakdownModal";
import { StatCard } from "@/components/StatCard";
import { productivityPercent } from "@/lib/productivity";
import { formatDate, formatHours } from "@/lib/format";
import type { ProductivitySession, SiteActivity } from "@/lib/types";
import { AlertTriangle, Loader2, Pencil, Percent, Target, Trash2, TrendingUp } from "lucide-react";

interface EditState {
  workDate: string;
  productiveH: number;
  productiveM: number;
  unproductiveH: number;
  unproductiveM: number;
}

export function EmployeeProductivity({
  employeeId,
  sessions,
  sites,
  monthStart,
  monthEnd,
  targetHours,
  requiredHours,
}: {
  employeeId: string;
  sessions: ProductivitySession[];
  sites: SiteActivity[];
  monthStart: string;
  monthEnd: string;
  /** Productive hours expected per working day, based on this employee's own shift. */
  targetHours: number;
  /** targetHours × working days in the selected month (already excludes rest/leave days). */
  requiredHours: number;
}) {
  const router = useRouter();
  const [viewingDate, setViewingDate] = useState<string | null>(null);
  const [modal, setModal] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductivitySession | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const sitesForViewing = viewingDate ? sites.filter((s) => s.work_date === viewingDate) : [];
  const trackedHours = sessions.reduce((sum, s) => sum + s.total_productive_seconds, 0) / 3600;
  const completionPct = requiredHours > 0 ? Math.round((trackedHours / requiredHours) * 100) : 0;

  // One bar per calendar day in the selected month (zero-filled), so the
  // admin sees the daily shape at a glance — the table below still only
  // lists days with a real session, for exact figures.
  const chartData = useMemo<ChartRow[]>(() => {
    const byDate = new Map(sessions.map((s) => [s.work_date, s]));
    const rows: ChartRow[] = [];
    const start = Date.parse(`${monthStart}T00:00:00Z`);
    const end = Date.parse(`${monthEnd}T00:00:00Z`);
    for (let t = start; t <= end; t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      const s = byDate.get(date);
      rows.push({
        date,
        label: new Date(t).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", timeZone: "UTC" }),
        productiveHours: (s?.total_productive_seconds ?? 0) / 3600,
        unproductiveHours: (s?.total_unproductive_seconds ?? 0) / 3600,
        pct: s ? productivityPercent(s.total_productive_seconds, s.total_unproductive_seconds) : null,
        flagged: s?.flagged_suspicious ?? false,
      });
    }
    return rows;
  }, [sessions, monthStart, monthEnd]);

  function openEdit(s: ProductivitySession) {
    setModal({
      workDate: s.work_date,
      productiveH: Math.floor(s.total_productive_seconds / 3600),
      productiveM: Math.floor((s.total_productive_seconds % 3600) / 60),
      unproductiveH: Math.floor(s.total_unproductive_seconds / 3600),
      unproductiveM: Math.floor((s.total_unproductive_seconds % 3600) / 60),
    });
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
    const productiveSeconds = modal.productiveH * 3600 + modal.productiveM * 60;
    const unproductiveSeconds = modal.unproductiveH * 3600 + modal.unproductiveM * 60;
    startTransition(async () => {
      const res = await updateProductivitySession(employeeId, modal.workDate, productiveSeconds, unproductiveSeconds);
      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
        closeModal();
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteProductivitySession(employeeId, deleteTarget.work_date);
      if (res?.error) {
        setDeleteError(res.error);
      } else {
        router.refresh();
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="font-semibold text-navy">Productivity</h2>
        <p className="text-xs text-slate-400">Browser activity tracked for the month selected above.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 border-b border-slate-100 p-6 sm:grid-cols-3">
        <StatCard icon={<Target className="h-5 w-5" />} label="Required this month" value={formatHours(requiredHours)} />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Tracked productive"
          value={formatHours(trackedHours)}
          accent="text-emerald-600"
        />
        <StatCard
          icon={<Percent className="h-5 w-5" />}
          label="Target completion"
          value={`${completionPct}%`}
          accent="text-brand-600"
        />
      </div>

      {chartData.length > 0 && (
        <div className="border-b border-slate-100 p-6">
          <ProductivityChart data={chartData} />
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-slate-400">No activity tracked this month.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Total tracked</th>
              <th className="px-6 py-3 font-medium">Productive</th>
              <th className="px-6 py-3 font-medium">Unproductive</th>
              <th className="px-6 py-3 font-medium">Productivity</th>
              <th className="px-6 py-3 font-medium">vs Target</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sessions.map((s) => {
              const pct = productivityPercent(s.total_productive_seconds, s.total_unproductive_seconds);
              const diff = s.total_productive_seconds / 3600 - targetHours;
              return (
                <tr
                  key={s.id}
                  onClick={() => setViewingDate(s.work_date)}
                  className="cursor-pointer text-slate-600 hover:bg-slate-50"
                >
                  <td className="px-6 py-3 font-medium text-navy">{formatDate(s.work_date)}</td>
                  <td className="px-6 py-3 font-medium text-navy">
                    {formatHours((s.total_productive_seconds + s.total_unproductive_seconds) / 3600)}
                  </td>
                  <td className="px-6 py-3 text-emerald-600">{formatHours(s.total_productive_seconds / 3600)}</td>
                  <td className="px-6 py-3 text-amber-600">{formatHours(s.total_unproductive_seconds / 3600)}</td>
                  <td className="px-6 py-3 font-medium text-navy">{pct === null ? "—" : `${pct}%`}</td>
                  <td className={`px-6 py-3 font-medium ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {diff >= 0 ? "+" : "−"}
                    {formatHours(Math.abs(diff))}
                  </td>
                  <td className="px-6 py-3">
                    {s.flagged_suspicious ? (
                      <span className="badge bg-red-50 text-red-700">
                        <AlertTriangle className="h-3 w-3" /> Flagged
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(s);
                        }}
                        aria-label={`Edit ${s.work_date}`}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(s);
                          setDeleteError(null);
                        }}
                        aria-label={`Delete ${s.work_date}`}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {viewingDate && (
        <SiteBreakdownModal
          title={`Sites — ${formatDate(viewingDate)}`}
          sites={sitesForViewing}
          onClose={() => setViewingDate(null)}
        />
      )}

      {modal && (
        <Modal title={`Edit productivity — ${formatDate(modal.workDate)}`} onClose={closeModal}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Productive time</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={modal.productiveH}
                  onChange={(e) => setModal({ ...modal, productiveH: Math.max(0, Number(e.target.value) || 0) })}
                  className="input"
                />
                <span className="shrink-0 text-xs text-slate-400">h</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={modal.productiveM}
                  onChange={(e) =>
                    setModal({ ...modal, productiveM: Math.min(59, Math.max(0, Number(e.target.value) || 0)) })
                  }
                  className="input"
                />
                <span className="shrink-0 text-xs text-slate-400">m</span>
              </div>
            </div>
            <div>
              <label className="label">Unproductive time</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={modal.unproductiveH}
                  onChange={(e) => setModal({ ...modal, unproductiveH: Math.max(0, Number(e.target.value) || 0) })}
                  className="input"
                />
                <span className="shrink-0 text-xs text-slate-400">h</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={modal.unproductiveM}
                  onChange={(e) =>
                    setModal({ ...modal, unproductiveM: Math.min(59, Math.max(0, Number(e.target.value) || 0)) })
                  }
                  className="input"
                />
                <span className="shrink-0 text-xs text-slate-400">m</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              This corrects the tracker&apos;s recorded totals for the day — it doesn&apos;t change the per-site
              breakdown.
            </p>
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

      {deleteTarget && (
        <Modal title="Delete productivity session" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-slate-600">
            Delete the tracked session for <strong className="text-navy">{formatDate(deleteTarget.work_date)}</strong>?
            This can&apos;t be undone.
          </p>
          {deleteError && <p className="mt-2 text-xs text-red-600">{deleteError}</p>}
          <div className="flex justify-end gap-2 pt-5">
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
