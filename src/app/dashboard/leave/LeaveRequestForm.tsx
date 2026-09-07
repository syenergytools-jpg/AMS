"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestLeave, cancelLeaveRequest } from "./actions";
import { formatDate } from "@/lib/format";
import type { LeaveRequest, LeaveType } from "@/lib/types";
import { Loader2, X } from "lucide-react";

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "CASUAL", label: "Casual" },
  { value: "SICK", label: "Sick" },
  { value: "ANNUAL", label: "Annual" },
  { value: "OTHER", label: "Other" },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
};

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function LeaveRequestForm({ requests }: { requests: LeaveRequest[] }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("CASUAL");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await requestLeave(startDate, endDate, leaveType, reason);
      if (res?.error) {
        setError(res.error);
      } else {
        setSaved(true);
        setStartDate("");
        setEndDate("");
        setReason("");
        router.refresh();
      }
    });
  }

  function onCancel(id: string) {
    setCancelingId(id);
    startTransition(async () => {
      await cancelLeaveRequest(id);
      setCancelingId(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="card p-6">
        <h2 className="font-semibold text-navy">Request leave</h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Start date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">End date</label>
              <input
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="input"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Reason (optional)</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input resize-none"
              placeholder="e.g. family event, feeling unwell"
            />
          </div>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {saved && !error && <p className="text-xs text-emerald-600">Request submitted.</p>}
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-navy">Your requests</h2>
        </div>
        {requests.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No leave requests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Dates</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Reason</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {requests.map((r) => (
                <tr key={r.id} className="text-slate-600">
                  <td className="px-6 py-3 font-medium text-navy">
                    {formatDate(r.start_date)}
                    {r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ""}
                  </td>
                  <td className="px-6 py-3">{titleCase(r.leave_type)}</td>
                  <td className="max-w-xs truncate px-6 py-3 text-slate-500">{r.reason || "—"}</td>
                  <td className="px-6 py-3">
                    <span className={`badge ${STATUS_STYLE[r.status]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {titleCase(r.status)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {r.status === "PENDING" && (
                      <button
                        onClick={() => onCancel(r.id)}
                        disabled={pending && cancelingId === r.id}
                        aria-label="Cancel request"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
