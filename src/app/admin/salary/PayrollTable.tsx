"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { SalaryForm } from "../SalaryForm";
import { deleteSalarySlip } from "../employees/actions";
import { Modal } from "@/components/Modal";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import type { Attendance, LeaveRequest, Profile, SalarySlip } from "@/lib/types";
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";

function netPay(s: { basic_salary: number; allowances: number; deductions: number }) {
  return s.basic_salary + s.allowances - s.deductions;
}

export function PayrollTable({
  employees,
  month,
  slips,
  attendance,
  leaveRequests,
}: {
  employees: Profile[];
  month: string;
  slips: SalarySlip[];
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ employeeName: string; slip: SalarySlip } | null>(null);
  const [deleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteSalarySlip(deleteTarget.slip.user_id, deleteTarget.slip.id);
      if (res?.error) {
        setDeleteError(res.error);
      } else {
        router.refresh();
        setDeleteTarget(null);
      }
    });
  }

  const slipThisMonthByUser = useMemo(() => {
    const map = new Map<string, SalarySlip>();
    for (const s of slips) {
      if (s.month.slice(0, 7) === month) map.set(s.user_id, s);
    }
    return map;
  }, [slips, month]);

  // `slips` is ordered newest-first, so the first non-this-month slip per
  // user is the most recent prior one — used to carry forward basic/allowances.
  const previousSlipByUser = useMemo(() => {
    const map = new Map<string, SalarySlip>();
    for (const s of slips) {
      if (s.month.slice(0, 7) === month) continue;
      if (!map.has(s.user_id)) map.set(s.user_id, s);
    }
    return map;
  }, [slips, month]);

  const attendanceByUser = useMemo(() => {
    const map = new Map<string, Attendance[]>();
    for (const a of attendance) {
      if (!map.has(a.user_id)) map.set(a.user_id, []);
      map.get(a.user_id)!.push(a);
    }
    return map;
  }, [attendance]);

  const leaveByUser = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    for (const lr of leaveRequests) {
      if (!map.has(lr.user_id)) map.set(lr.user_id, []);
      map.get(lr.user_id)!.push(lr);
    }
    return map;
  }, [leaveRequests]);

  if (employees.length === 0) {
    return (
      <div className="card px-6 py-12 text-center text-sm text-slate-400">No employees registered yet.</div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-6 py-3 font-medium">Employee</th>
            <th className="px-6 py-3 font-medium">Basic</th>
            <th className="px-6 py-3 font-medium">Allowances</th>
            <th className="px-6 py-3 font-medium">Deductions</th>
            <th className="px-6 py-3 font-medium">Net pay</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {employees.map((emp) => {
            const slip = slipThisMonthByUser.get(emp.id);
            const isOpen = expanded === emp.id;
            return (
              <Fragment key={emp.id}>
                <tr className="text-slate-600">
                  <td className="px-6 py-3">
                    <Link href={`/admin/employees/${emp.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar name={emp.full_name} src={emp.avatar_url} size={32} />
                      <div>
                        <div className="font-medium text-navy">{emp.full_name}</div>
                        <div className="text-xs text-slate-400">{emp.position || "—"}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-3">{slip ? formatCurrency(slip.basic_salary) : "—"}</td>
                  <td className="px-6 py-3">{slip ? formatCurrency(slip.allowances) : "—"}</td>
                  <td className="px-6 py-3">{slip ? formatCurrency(slip.deductions) : "—"}</td>
                  <td className="px-6 py-3 font-semibold text-navy">{slip ? formatCurrency(netPay(slip)) : "—"}</td>
                  <td className="px-6 py-3">
                    {slip ? (
                      <span className="badge bg-emerald-50 text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> Paid
                      </span>
                    ) : (
                      <span className="badge bg-amber-50 text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setExpanded(isOpen ? null : emp.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
                      >
                        {slip ? "Edit" : "Add"}
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      {slip && (
                        <button
                          onClick={() => setDeleteTarget({ employeeName: emp.full_name, slip })}
                          aria-label={`Delete ${emp.full_name}'s salary slip`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={7} className="bg-slate-50 px-6 py-5">
                      <SalaryForm
                        employeeId={emp.id}
                        month={month}
                        shiftStart={emp.shift_start}
                        shiftEnd={emp.shift_end}
                        offDays={emp.off_days}
                        attendance={attendanceByUser.get(emp.id) ?? []}
                        leaveRequests={leaveByUser.get(emp.id) ?? []}
                        existingSlip={slip}
                        previousSlip={previousSlipByUser.get(emp.id)}
                        onSaved={() => setExpanded(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {deleteTarget && (
        <Modal title="Delete salary slip" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-slate-600">
            Delete <strong className="text-navy">{deleteTarget.employeeName}</strong>&apos;s{" "}
            <strong className="text-navy">{formatMonthLabel(deleteTarget.slip.month.slice(0, 7))}</strong> salary
            slip ({formatCurrency(netPay(deleteTarget.slip))} net pay)? This can&apos;t be undone.
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
