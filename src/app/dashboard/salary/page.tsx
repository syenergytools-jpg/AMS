import Link from "next/link";
import { getCurrentProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { SalarySlipView } from "./SalarySlipView";
import { formatMonthLabel, isWorkingDay, monthKeyOf, pktNow, shiftMonthKey } from "@/lib/format";
import { leaveDatesSet } from "@/lib/payroll";
import type { Attendance, LeaveRequest, SalarySlip } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalarySlipPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const today = pktNow();
  const todayKey = today.toISOString().slice(0, 10);
  const currentMonthKey = monthKeyOf(today);
  const requested = searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : currentMonthKey;
  const monthKey = requested > currentMonthKey ? currentMonthKey : requested; // no browsing into the future
  const [year, month] = monthKey.split("-").map(Number);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${String(daysInMonth).padStart(2, "0")}`;

  const [{ data: slipData }, { data: attData }, { data: leaveData }] = await Promise.all([
    supabase
      .from("salary_slips")
      .select("*")
      .eq("user_id", profile.id)
      .eq("month", monthStart)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("*")
      .eq("user_id", profile.id)
      .gte("work_date", monthStart)
      .lte("work_date", monthEnd),
    supabase.from("leave_requests").select("*").eq("user_id", profile.id).eq("status", "APPROVED"),
  ]);

  const slip = (slipData as SalarySlip | null) ?? null;
  const byDate = new Map(((attData ?? []) as Attendance[]).map((a) => [a.work_date, a]));
  const leaveDates = leaveDatesSet((leaveData ?? []) as LeaveRequest[]);

  let workingDays = 0;
  let present = 0;
  let late = 0;
  let absent = 0;
  let onLeave = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, month - 1, d));
    if (!isWorkingDay(dateObj)) continue;
    const dateStr = `${monthKey}-${String(d).padStart(2, "0")}`;
    if (dateStr > todayKey) continue; // don't count days that haven't happened yet
    workingDays++;
    if (leaveDates.has(dateStr)) {
      onLeave++;
      continue;
    }
    const rec = byDate.get(dateStr);
    if (!rec?.check_in) absent++;
    else if (rec.status === "LATE") late++;
    else present++;
  }

  const monthLabel = formatMonthLabel(monthKey);
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const nextMonthKey = shiftMonthKey(monthKey, 1);
  const nextDisabled = nextMonthKey > currentMonthKey;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Salary slip</h1>
          <p className="mt-1 text-sm text-slate-500">View or download your monthly salary slip.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <Link
            href={`/dashboard/salary?month=${prevMonthKey}`}
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
              href={`/dashboard/salary?month=${nextMonthKey}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-navy"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <SalarySlipView
        profile={profile}
        slip={slip}
        monthLabel={monthLabel}
        monthKey={monthKey}
        attendanceSummary={{ workingDays, present, late, absent, onLeave }}
      />
    </div>
  );
}
