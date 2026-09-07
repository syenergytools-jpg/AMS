"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEmployeeShift } from "../actions";
import { shiftTimeOptions } from "@/lib/format";
import { Clock, Loader2 } from "lucide-react";

const SHIFT_OPTIONS = shiftTimeOptions();

export function ShiftEditForm({
  employeeId,
  initialStart,
  initialEnd,
}: {
  employeeId: string;
  initialStart: string;
  initialEnd: string;
}) {
  const router = useRouter();
  const [start, setStart] = useState(initialStart.slice(0, 5));
  const [end, setEnd] = useState(initialEnd.slice(0, 5));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    if (end <= start) {
      setError("Shift end must be after shift start.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateEmployeeShift(employeeId, start, end);
      if (res?.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 border-t border-slate-50 pt-4">
      <label className="label flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> Shift time
      </label>
      <p className="mb-2 text-xs text-slate-400">
        Changes apply going forward — past attendance already has its Late/Present status
        locked in, but salary calculations always use the current shift time, even when
        reopening a past month.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setSaved(false);
            setError(null);
          }}
          className="input"
        >
          {SHIFT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-xs text-slate-400">to</span>
        <select
          value={end}
          onChange={(e) => {
            setEnd(e.target.value);
            setSaved(false);
            setError(null);
          }}
          className="input"
        >
          {SHIFT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="btn-ghost shrink-0">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {saved && !error && <p className="mt-1.5 text-xs text-emerald-600">Saved.</p>}
    </form>
  );
}
