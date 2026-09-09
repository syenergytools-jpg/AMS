"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitComplaint } from "./actions";
import { Modal } from "@/components/Modal";
import { formatDate } from "@/lib/format";
import type { Complaint, ComplaintCategory } from "@/lib/types";
import { Loader2 } from "lucide-react";

const CATEGORIES: { value: ComplaintCategory; label: string }[] = [
  { value: "ATTENDANCE", label: "Attendance" },
  { value: "SALARY", label: "Salary" },
  { value: "LEAVE", label: "Leave" },
  { value: "OTHER", label: "Other" },
];

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
};

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function SupportForm({ complaints }: { complaints: Complaint[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<ComplaintCategory>("ATTENDANCE");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [relatedDate, setRelatedDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [viewing, setViewing] = useState<Complaint | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await submitComplaint(category, subject, description, relatedDate);
      if (res?.error) {
        setError(res.error);
      } else {
        setSaved(true);
        setSubject("");
        setDescription("");
        setRelatedDate("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="card p-6">
        <h2 className="font-semibold text-navy">Raise a complaint</h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Related date (optional)</label>
              <input
                type="date"
                value={relatedDate}
                onChange={(e) => setRelatedDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Subject</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input"
              placeholder="e.g. Checkout not recording on Sept 8"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input resize-none"
              placeholder="What happened, and what you expected instead"
            />
          </div>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit complaint"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {saved && !error && <p className="text-xs text-emerald-600">Complaint submitted.</p>}
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-navy">Your complaints</h2>
        </div>
        {complaints.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No complaints raised yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Subject</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Raised</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {complaints.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setViewing(c)}
                  className="cursor-pointer text-slate-600 transition hover:bg-slate-50"
                >
                  <td className="max-w-xs truncate px-6 py-3 font-medium text-navy">{c.subject}</td>
                  <td className="px-6 py-3">{titleCase(c.category)}</td>
                  <td className="px-6 py-3">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-3">
                    <span className={`badge ${STATUS_STYLE[c.status]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {titleCase(c.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewing && (
        <Modal title={viewing.subject} onClose={() => setViewing(null)}>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${STATUS_STYLE[viewing.status]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {titleCase(viewing.status)}
              </span>
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
                  Admin resolution
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-emerald-800">
                  {viewing.resolution || "Marked resolved."}
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-amber-100 bg-amber-50 p-3.5 text-amber-700">
                Still open — an admin hasn&apos;t resolved this yet.
              </p>
            )}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setViewing(null)} className="btn-ghost">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
