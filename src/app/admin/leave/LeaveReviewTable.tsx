"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewLeaveRequest } from "../actions";
import { Avatar } from "@/components/Avatar";
import { formatDate } from "@/lib/format";
import type { LeaveRequest, LeaveStatus, Profile } from "@/lib/types";
import { Check, X, Loader2 } from "lucide-react";

const STATUS_STYLE: Record<LeaveStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
};

const STATUS_RANK: Record<LeaveStatus, number> = { PENDING: 0, APPROVED: 1, REJECTED: 2 };

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function LeaveReviewTable({ requests, employees }: { requests: LeaveRequest[]; employees: Profile[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const sorted = useMemo(
    () =>
      [...requests].sort(
        (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.created_at.localeCompare(a.created_at)
      ),
    [requests]
  );

  function act(id: string, approve: boolean) {
    setActingId(id);
    startTransition(async () => {
      await reviewLeaveRequest(id, approve);
      setActingId(null);
      router.refresh();
    });
  }

  if (requests.length === 0) {
    return <div className="card px-6 py-12 text-center text-sm text-slate-400">No leave requests yet.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-6 py-3 font-medium">Employee</th>
            <th className="px-6 py-3 font-medium">Dates</th>
            <th className="px-6 py-3 font-medium">Type</th>
            <th className="px-6 py-3 font-medium">Reason</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map((r) => {
            const emp = employeeById.get(r.user_id);
            const busy = pending && actingId === r.id;
            return (
              <tr key={r.id} className="text-slate-600">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={emp?.full_name ?? "?"} src={emp?.avatar_url ?? null} size={32} />
                    <div className="font-medium text-navy">{emp?.full_name ?? "Unknown"}</div>
                  </div>
                </td>
                <td className="px-6 py-3">
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
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => act(r.id, true)}
                        disabled={busy}
                        aria-label="Approve"
                        className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => act(r.id, false)}
                        disabled={busy}
                        aria-label="Reject"
                        className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
