"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AppBreakdownModal } from "@/components/AppBreakdownModal";
import { formatAppName, productivityPercent } from "@/lib/productivity";
import { formatHours } from "@/lib/format";
import type { AppActivity, Profile, ProductivitySession } from "@/lib/types";

export function ProductivityOverviewTable({
  employees,
  sessions,
  apps,
}: {
  employees: Profile[];
  sessions: ProductivitySession[];
  apps: AppActivity[];
}) {
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const sessionByUser = useMemo(() => new Map(sessions.map((s) => [s.user_id, s])), [sessions]);
  const appsByUser = useMemo(() => {
    const map = new Map<string, AppActivity[]>();
    for (const a of apps) {
      const list = map.get(a.user_id);
      if (list) list.push(a);
      else map.set(a.user_id, [a]);
    }
    return map;
  }, [apps]);

  // App with the most total time per user, from the desktop agent's
  // app_activity rows for the selected date.
  const topAppByUser = useMemo(() => {
    const bestTotal = new Map<string, number>();
    const bestName = new Map<string, string>();
    for (const a of apps) {
      const total = a.productive_seconds + a.unproductive_seconds;
      if (total > (bestTotal.get(a.user_id) ?? -1)) {
        bestTotal.set(a.user_id, total);
        bestName.set(a.user_id, a.app_name);
      }
    }
    return bestName;
  }, [apps]);

  // Tracked first, then not-tracked — each group keeps the incoming
  // alphabetical order since Array.sort is stable.
  const sorted = useMemo(() => {
    function rank(emp: Profile) {
      return sessionByUser.has(emp.id) ? 0 : 1;
    }
    return [...employees].sort((a, b) => rank(a) - rank(b));
  }, [employees, sessionByUser]);

  if (employees.length === 0) {
    return <div className="card px-6 py-12 text-center text-sm text-slate-400">No employees registered yet.</div>;
  }

  const viewingEmployee = viewingUserId ? (employees.find((e) => e.id === viewingUserId) ?? null) : null;
  const viewingApps = viewingUserId ? (appsByUser.get(viewingUserId) ?? []) : [];

  return (
    <>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-6 py-3 font-medium">Employee</th>
              <th className="px-6 py-3 font-medium">Department</th>
              <th className="px-6 py-3 font-medium">Total tracked</th>
              <th className="px-6 py-3 font-medium">Productive</th>
              <th className="px-6 py-3 font-medium">Unproductive</th>
              <th className="px-6 py-3 font-medium">Productivity</th>
              <th className="px-6 py-3 font-medium">Top App</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map((emp) => {
              const s = sessionByUser.get(emp.id);
              const pct = s ? productivityPercent(s.total_productive_seconds, s.total_unproductive_seconds) : null;
              const topApp = topAppByUser.get(emp.id);
              return (
                <tr
                  key={emp.id}
                  onClick={() => s && setViewingUserId(emp.id)}
                  className={`text-slate-600 ${s ? "cursor-pointer hover:bg-slate-50" : ""}`}
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.full_name} src={emp.avatar_url} size={32} />
                      <div>
                        <div className="font-medium text-navy">{emp.full_name}</div>
                        <div className="text-xs text-slate-400">{emp.position || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">{emp.department || "—"}</td>
                  <td className="px-6 py-3 font-medium text-navy">
                    {s ? formatHours((s.total_productive_seconds + s.total_unproductive_seconds) / 3600) : "—"}
                  </td>
                  <td className="px-6 py-3 text-emerald-600">
                    {s ? formatHours(s.total_productive_seconds / 3600) : "—"}
                  </td>
                  <td className="px-6 py-3 text-amber-600">
                    {s ? formatHours(s.total_unproductive_seconds / 3600) : "—"}
                  </td>
                  <td className="px-6 py-3 font-medium text-navy">{pct === null ? "—" : `${pct}%`}</td>
                  <td className="px-6 py-3 text-slate-500">{topApp ? formatAppName(topApp) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewingEmployee && (
        <AppBreakdownModal
          title={`Apps — ${viewingEmployee.full_name}`}
          apps={viewingApps}
          onClose={() => setViewingUserId(null)}
        />
      )}
    </>
  );
}
