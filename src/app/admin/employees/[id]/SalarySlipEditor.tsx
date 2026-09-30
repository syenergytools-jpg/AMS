"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SalaryForm } from "../../SalaryForm";
import { deleteSalarySlip } from "../actions";
import { Modal } from "@/components/Modal";
import { formatCurrency, formatHours, formatMonthLabel, pktNow } from "@/lib/format";
import { summarizeMonth, leaveDatesSet } from "@/lib/payroll";
import type { Attendance, LeaveRequest, SalarySlip } from "@/lib/types";
import { Loader2, Pencil, Trash2 } from "lucide-react";

function netPay(s: { basic_salary: number; allowances: number; deductions: number }) {
  return s.basic_salary + s.allowances - s.deductions;
}

export function SalarySlipEditor({
  employeeId,
  slips,
  attendance,
  leaveRequests,
  shiftStart,
  shiftEnd,
  offDays,
}: {
  employeeId: string;
  slips: SalarySlip[];
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
  shiftStart: string;
  shiftEnd: string;
  offDays?: number[];
}) {
  const router = useRouter();
  const todayKey = useMemo(() => pktNow().toISOString().slice(0, 10), []);
  const leaveDates = useMemo(() => leaveDatesSet(leaveRequests), [leaveRequests]);
  const [month, setMonth] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SalarySlip | null>(null);
  const [deleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // `slips` is ordered newest-first, so the first one that isn't the
  // selected month is the most recent prior slip to carry forward from.
  const existingSlip = slips.find((s) => s.month.slice(0, 7) === month);
  const previousSlip = slips.find((s) => s.month.slice(0, 7) !== month);

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteSalarySlip(employeeId, deleteTarget.id);
      if (res?.error) {
        setDeleteError(res.error);
      } else {
        router.refresh();
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="card overflow-hidden lg:col-span-3">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="font-semibold text-navy">Salary</h2>
        <p className="text-xs text-slate-400">
          Deductions can be calculated from attendance — short one full shift&apos;s worth of hours costs one
          day&apos;s pay, proportionally.
        </p>
      </div>

      <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
        <div>
          <label className="label">Month</label>
          <input
            type="month"
            required
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input w-48"
          />
        </div>

        {month && (
          <div className="mt-4">
            <SalaryForm
              key={month}
              employeeId={employeeId}
              month={month}
              shiftStart={shiftStart}
              shiftEnd={shiftEnd}
              offDays={offDays}
              attendance={attendance}
              leaveRequests={leaveRequests}
              existingSlip={existingSlip}
              previousSlip={previousSlip}
            />
          </div>
        )}
      </div>

      {slips.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-slate-400">No salary slips yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-6 py-3 font-medium">Month</th>
              <th className="px-6 py-3 font-medium">Basic</th>
              <th className="px-6 py-3 font-medium">Allowances</th>
              <th className="px-6 py-3 font-medium">Deductions</th>
              <th className="px-6 py-3 font-medium">Hours vs target</th>
              <th className="px-6 py-3 font-medium">Net pay</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {slips.map((s) => {
              const slipMonthKey = s.month.slice(0, 7);
              const hist = summarizeMonth(attendance, slipMonthKey, shiftStart, shiftEnd, todayKey, leaveDates, offDays);
              return (
                <tr key={s.id} className="text-slate-600">
                  <td className="px-6 py-3 font-medium text-navy">{formatMonthLabel(slipMonthKey)}</td>
                  <td className="px-6 py-3">{formatCurrency(s.basic_salary)}</td>
                  <td className="px-6 py-3">{formatCurrency(s.allowances)}</td>
                  <td className="px-6 py-3">{formatCurrency(s.deductions)}</td>
                  <td className="px-6 py-3">
                    {hist.hoursShort > 0 ? (
                      <span className="text-amber-600">-{formatHours(hist.hoursShort)}</span>
                    ) : hist.hoursExtra > 0 ? (
                      <span className="text-emerald-600">+{formatHours(hist.hoursExtra)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-semibold text-navy">{formatCurrency(netPay(s))}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setMonth(slipMonthKey)}
                        aria-label={`Edit ${slipMonthKey}`}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(s);
                          setDeleteError(null);
                        }}
                        aria-label={`Delete ${slipMonthKey}`}
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

      {deleteTarget && (
        <Modal title="Delete salary slip" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-slate-600">
            Delete the <strong className="text-navy">{formatMonthLabel(deleteTarget.month.slice(0, 7))}</strong> salary
            slip ({formatCurrency(netPay(deleteTarget))} net pay)? This can&apos;t be undone.
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
