"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertSalarySlip } from "./actions";
import { formatCurrency, formatHours, pktNow } from "@/lib/format";
import { summarizeMonth, autoDeduction, leaveDatesSet } from "@/lib/payroll";
import type { Attendance, LeaveRequest, SalarySlip } from "@/lib/types";
import { Loader2, Clock, Target, TrendingDown, CalendarCheck, CalendarOff, RefreshCw } from "lucide-react";

/**
 * The actual salary editing UI: attendance-vs-target breakdown, an
 * auto-calculated deduction suggestion, and the basic/allowances/deductions
 * inputs. Shared by the per-employee profile page and the company-wide
 * Salary page so editing behaves identically from either place.
 */
export function SalaryForm({
  employeeId,
  month,
  shiftStart,
  shiftEnd,
  attendance,
  leaveRequests = [],
  existingSlip,
  previousSlip,
  onSaved,
}: {
  employeeId: string;
  month: string;
  shiftStart: string;
  shiftEnd: string;
  attendance: Attendance[];
  leaveRequests?: LeaveRequest[];
  existingSlip?: SalarySlip;
  previousSlip?: SalarySlip;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const todayKey = useMemo(() => pktNow().toISOString().slice(0, 10), []);
  const seed = existingSlip ?? previousSlip;

  const [basicSalary, setBasicSalary] = useState(seed ? String(seed.basic_salary) : "");
  const [allowances, setAllowances] = useState(seed ? String(seed.allowances) : "");
  // Deductions never carry forward — last month's shortfall has nothing to do with this one.
  const [deductions, setDeductions] = useState(existingSlip ? String(existingSlip.deductions) : "");
  const [note, setNote] = useState(existingSlip?.note ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const leaveDates = useMemo(() => leaveDatesSet(leaveRequests), [leaveRequests]);
  const summary = useMemo(
    () => summarizeMonth(attendance, month, shiftStart, shiftEnd, todayKey, leaveDates),
    [attendance, month, shiftStart, shiftEnd, todayKey, leaveDates]
  );

  const basicSalaryNum = Number(basicSalary) || 0;
  const suggestedDeduction = autoDeduction(basicSalaryNum, summary.expectedHours, summary.hoursShort);
  const hourlyRate = summary.expectedHours > 0 ? basicSalaryNum / summary.expectedHours : 0;
  const netPay = basicSalaryNum + (Number(allowances) || 0) - (Number(deductions) || 0);
  const workedRatio =
    summary.expectedHours > 0 ? Math.min(100, (summary.actualHours / summary.expectedHours) * 100) : 100;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await upsertSalarySlip(
        employeeId,
        month,
        basicSalaryNum,
        Number(allowances) || 0,
        Number(deductions) || 0,
        note
      );
      if (res?.error) {
        setError(res.error);
      } else {
        setSaved(true);
        router.refresh();
        onSaved?.();
      }
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Attendance this month</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat icon={<CalendarCheck className="h-4 w-4" />} label="Working days" value={summary.workingDays} />
          <MiniStat
            icon={<CalendarOff className="h-4 w-4" />}
            label="On leave"
            value={summary.leaveDays}
            accent={summary.leaveDays > 0 ? "text-brand-600" : "text-navy"}
          />
          <MiniStat icon={<Clock className="h-4 w-4" />} label="Hours worked" value={formatHours(summary.actualHours)} />
          <MiniStat icon={<Target className="h-4 w-4" />} label="Expected" value={formatHours(summary.expectedHours)} />
          <MiniStat
            icon={<TrendingDown className="h-4 w-4" />}
            label="Short"
            value={formatHours(summary.hoursShort)}
            accent={summary.hoursShort > 0 ? "text-red-600" : "text-emerald-600"}
          />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${summary.hoursShort > 0 ? "bg-amber-400" : "bg-emerald-500"}`}
            style={{ width: `${workedRatio}%` }}
          />
        </div>

        {summary.leaveDays > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
            <CalendarOff className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-semibold">
                {summary.leaveDays} approved leave {summary.leaveDays === 1 ? "day" : "days"}
              </span>{" "}
              excluded from expected hours this month — not counted toward the deduction below.
            </span>
          </div>
        )}

        {summary.hoursShort > 0 && basicSalaryNum > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <span>
              Suggested deduction: <span className="font-semibold">{formatCurrency(suggestedDeduction)}</span>{" "}
              ({formatHours(summary.hoursShort)} short × {formatCurrency(hourlyRate)}/hour)
            </span>
            <button
              type="button"
              onClick={() => setDeductions(String(suggestedDeduction))}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100"
            >
              <RefreshCw className="h-3 w-3" /> Use this
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Basic salary</label>
          <input
            type="number"
            min={0}
            step="1"
            required
            value={basicSalary}
            onChange={(e) => setBasicSalary(e.target.value)}
            className="input w-32"
          />
        </div>
        <div>
          <label className="label">Allowances</label>
          <input
            type="number"
            min={0}
            step="1"
            value={allowances}
            onChange={(e) => setAllowances(e.target.value)}
            className="input w-32"
          />
        </div>
        <div>
          <label className="label">Deductions</label>
          <input
            type="number"
            min={0}
            step="1"
            value={deductions}
            onChange={(e) => setDeductions(e.target.value)}
            className="input w-32"
          />
        </div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>

      <div className="mt-2">
        <input
          type="text"
          placeholder="Note (optional) — e.g. reason for a deduction or bonus"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
        />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2.5">
        <span className="text-sm font-medium text-emerald-700">Net pay</span>
        <span className="text-lg font-bold text-emerald-700">{formatCurrency(netPay)}</span>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {saved && !error && <p className="mt-2 text-xs text-emerald-600">Saved.</p>}
    </form>
  );
}

function MiniStat({
  icon,
  label,
  value,
  accent = "text-navy",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0">
        <div className={`truncate text-sm font-bold ${accent}`}>{value}</div>
        <div className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      </div>
    </div>
  );
}
