"use client";

import dynamic from "next/dynamic";
import { formatCurrency } from "@/lib/format";
import type { Profile, SalarySlip } from "@/lib/types";
import type { AttendanceSummary } from "./SalarySlipPDF";
import { Wallet } from "lucide-react";

// @react-pdf/renderer touches browser-only APIs at import time, so the
// download button must never be part of the server-rendered bundle.
const SalarySlipDownloadButton = dynamic(
  () => import("./SalarySlipPDF").then((m) => m.SalarySlipDownloadButton),
  {
    ssr: false,
    loading: () => (
      <button className="btn-primary" disabled>
        Preparing…
      </button>
    ),
  }
);

export function SalarySlipView({
  profile,
  slip,
  monthLabel,
  monthKey,
  attendanceSummary,
}: {
  profile: Profile;
  slip: SalarySlip | null;
  monthLabel: string;
  monthKey: string;
  attendanceSummary: AttendanceSummary;
}) {
  if (!slip) {
    return (
      <div className="card px-6 py-16 text-center">
        <Wallet className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-400">
          No salary slip has been issued for {monthLabel} yet.
        </p>
      </div>
    );
  }

  const netPay = slip.basic_salary + slip.allowances - slip.deductions;

  return (
    <div className="card p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <p className="text-sm font-semibold text-navy">Evolut Ecommerce Solutions</p>
          <p className="text-xs text-slate-400">Jhelum, Pakistan</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-navy">Salary Slip</p>
          <p className="text-xs text-slate-400">{monthLabel}</p>
        </div>
      </div>

      <div className="grid gap-6 border-b border-slate-100 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Employee</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <DetailRow label="Name" value={profile.full_name} />
            <DetailRow label="Position" value={profile.position || "—"} />
            <DetailRow label="Department" value={profile.department || "—"} />
            <DetailRow label="CNIC" value={profile.cnic || "—"} />
          </dl>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Attendance this month
          </p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <DetailRow label="Working days" value={String(attendanceSummary.workingDays)} />
            <DetailRow label="Present" value={String(attendanceSummary.present)} />
            <DetailRow label="Late" value={String(attendanceSummary.late)} />
            <DetailRow label="On leave" value={String(attendanceSummary.onLeave)} />
            <DetailRow label="Absent" value={String(attendanceSummary.absent)} />
          </dl>
        </div>
      </div>

      <div className="py-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Earnings &amp; deductions
        </p>
        <div className="mt-3 divide-y divide-slate-50 text-sm">
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Basic salary</span>
            <span className="font-medium text-navy">{formatCurrency(slip.basic_salary)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Allowances</span>
            <span className="font-medium text-navy">{formatCurrency(slip.allowances)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Deductions</span>
            <span className="font-medium text-navy">-{formatCurrency(slip.deductions)}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
          <span className="text-sm font-medium text-emerald-700">Net Pay</span>
          <span className="text-xl font-bold text-emerald-700">{formatCurrency(netPay)}</span>
        </div>
        {slip.note && (
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Note:</span> {slip.note}
          </p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <SalarySlipDownloadButton
          profile={profile}
          slip={slip}
          monthLabel={monthLabel}
          monthKey={monthKey}
          attendanceSummary={attendanceSummary}
        />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}
