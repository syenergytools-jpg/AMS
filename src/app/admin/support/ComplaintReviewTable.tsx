"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveComplaint } from "../actions";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import { formatDate } from "@/lib/format";
import type { Complaint, ComplaintStatus, Profile } from "@/lib/types";
import { Loader2 } from "lucide-react";

const STATUS_STYLE: Record<ComplaintStatus, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
};

const STATUS_RANK: Record<ComplaintStatus, number> = { OPEN: 0, RESOLVED: 1 };

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function ComplaintReviewTable({
  complaints,
  employees,
}: {
  complaints: Complaint[];
  employees: Profile[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [viewing, setViewing] = useState<Complaint | null>(null);
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<string | null>(null);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const sorted = useMemo(
    () =>
      [...complaints].sort(
        (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.created_at.localeCompare(a.created_at)
      ),
    [complaints]
  );

  function openView(c: Complaint) {
    setViewing(c);
    setResolution("");
    setError(null);
  }

  function onResolve() {
    if (!viewing) return;
    setError(null);
    startTransition(async () => {
      const res = await resolveComplaint(viewing.id, resolution);
      if (res?.error) {
        setError(res.error);
      } else {
        setViewing(null);
        router.refresh();
      }
    });
  }

  if (complaints.length === 0) {
    return <div className="card px-6 py-12 text-center text-sm text-slate-400">No complaints raised yet.</div>;
  }

  return (
    <>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-6 py-3 font-medium">Employee</th>
              <th className="px-6 py-3 font-medium">Subject</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium">Raised</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map((c) => {
              const emp = employeeById.get(c.user_id);
              return (
                <tr
                  key={c.id}
                  onClick={() => openView(c)}
                  className="cursor-pointer text-slate-600 transition hover:bg-slate-50"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp?.full_name ?? "?"} src={emp?.avatar_url ?? null} size={32} />
                      <div className="font-medium text-navy">{emp?.full_name ?? "Unknown"}</div>
                    </div>
                  </td>
                  <td className="max-w-xs truncate px-6 py-3">{c.subject}</td>
                  <td className="px-6 py-3">{titleCase(c.category)}</td>
                  <td className="px-6 py-3">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-3">
                    <span className={`badge ${STATUS_STYLE[c.status]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {titleCase(c.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewing && (
        <Modal title={viewing.subject} onClose={() => setViewing(null)}>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Avatar
                  name={employeeById.get(viewing.user_id)?.full_name ?? "?"}
                  src={employeeById.get(viewing.user_id)?.avatar_url ?? null}
                  size={24}
                />
                <span className="font-medium text-navy">
                  {employeeById.get(viewing.user_id)?.full_name ?? "Unknown"}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {titleCase(viewing.category)} · Raised {formatDate(viewing.created_at)}
                {viewing.related_date ? ` · About ${formatDate(viewing.related_date)}` : ""}
              </span>
            </div>
            <div>
              <p className="label mb-1">Description</p>
              <p className="whitespace-pre-wrap text-slate-600">{viewing.description}</p>
            </div>

            {viewing.status === "RESOLVED" ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Your resolution
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-emerald-800">
                  {viewing.resolution || "Marked resolved."}
                </p>
              </div>
            ) : (
              <div>
                <label className="label">Resolution note (optional)</label>
                <textarea
                  rows={3}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="input resize-none"
                  placeholder="What was done / how this was fixed"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setViewing(null)} className="btn-ghost">
                Close
              </button>
              {viewing.status === "OPEN" && (
                <button type="button" onClick={onResolve} disabled={pending} className="btn-primary">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark resolved"}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
