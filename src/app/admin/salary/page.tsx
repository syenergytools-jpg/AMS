import Link from "next/link";
import { requireAdmin } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { PayrollTable } from "./PayrollTable";
import { formatCurrency, formatMonthLabel, monthKeyOf, pktNow, shiftMonthKey } from "@/lib/format";
import type { Attendance, LeaveRequest, Profile, SalarySlip } from "@/lib/types";
import { Users, CheckCircle2, Clock3, Wallet, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSalaryPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  await requireAdmin();
  const supabase = createClient();

  const currentMonthKey = monthKeyOf(pktNow());
  const requested = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : currentMonthKey;
  const monthKey = requested > currentMonthKey ? currentMonthKey : requested; // no browsing into the future

  const salaryLookback = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: profilesData }, { data: slipsData }, { data: attData }, { data: leaveData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "EMPLOYEE").order("full_name"),
    // Every slip, every employee — the table figures out per-employee "this
    // month" vs. "most recent prior" (for carry-forward) on the client.
    supabase.from("salary_slips").select("*").order("month", { ascending: false }),
    supabase.from("attendance").select("*").gte("work_date", salaryLookback),
    supabase.from("leave_requests").select("*").eq("status", "APPROVED"),
  ]);

  const employees = (profilesData ?? []) as Profile[];
  const slips = (slipsData ?? []) as SalarySlip[];
  const attendance = (attData ?? []) as Attendance[];
  const leaveRequests = (leaveData ?? []) as LeaveRequest[];

  const slipsThisMonth = slips.filter((s) => s.month.slice(0, 7) === monthKey);
  const paidCount = slipsThisMonth.length;
  const totalPayroll = slipsThisMonth.reduce((sum, s) => sum + s.basic_salary + s.allowances - s.deductions, 0);

  const monthLabel = formatMonthLabel(monthKey);
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const nextMonthKey = shiftMonthKey(monthKey, 1);
  const nextDisabled = nextMonthKey > currentMonthKey;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Salary</h1>
          <p className="mt-1 text-sm text-slate-500">Who&apos;s been paid this month, and who&apos;s still pending.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <Link
            href={`/admin/salary?month=${prevMonthKey}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-navy"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[9rem] text-center text-sm font-semibold text-navy">{monthLabel}</span>
          {nextDisabled ? (
            <span className="flex h-8 w-8 items-center justify-center text-slate-200">
              <ChevronRight className="h-4 w-4" />
            </span>
          ) : (
            <Link
              href={`/admin/salary?month=${nextMonthKey}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-navy"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Employees" value={employees.length} />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Paid"
          value={paidCount}
          accent="text-emerald-600"
        />
        <StatCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Pending"
          value={employees.length - paidCount}
          accent="text-amber-600"
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Paid out"
          value={formatCurrency(totalPayroll)}
          accent="text-brand-600"
        />
      </div>

      <PayrollTable
        employees={employees}
        month={monthKey}
        slips={slips}
        attendance={attendance}
        leaveRequests={leaveRequests}
      />
    </div>
  );
}
