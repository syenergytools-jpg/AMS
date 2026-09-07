import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { StatCard } from "@/components/StatCard";
import { MonthlyHoursChart } from "./MonthlyHoursChart";
import { STATUS_COLOR, STATUS_LABEL, type DayHours, type DayStatus } from "./status";
import {
  formatHours,
  formatMonthLabel,
  hoursDecimal,
  isWorkingDay,
  monthKeyOf,
  pktNow,
  shiftLengthHours,
  shiftMonthKey,
} from "@/lib/format";
import { leaveDatesSet } from "@/lib/payroll";
import type { Attendance, LeaveRequest } from "@/lib/types";
import { CalendarCheck, CalendarOff, Clock, Target, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MonthlyHoursPage({
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

  const [{ data: rows }, { data: leaveData }] = await Promise.all([
    supabase
      .from("attendance")
      .select("*")
      .eq("user_id", profile.id)
      .gte("work_date", monthStart)
      .lte("work_date", monthEnd),
    supabase.from("leave_requests").select("*").eq("user_id", profile.id).eq("status", "APPROVED"),
  ]);

  const byDate = new Map((rows ?? []).map((r) => [r.work_date, r as Attendance]));
  const leaveDates = leaveDatesSet((leaveData ?? []) as LeaveRequest[]);
  const shiftHours = shiftLengthHours(profile.shift_start, profile.shift_end);

  const days: DayHours[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, month - 1, d));
    if (!isWorkingDay(dateObj)) continue;

    const dateStr = `${monthKey}-${String(d).padStart(2, "0")}`;
    const rec = byDate.get(dateStr);
    const hasCheckedIn = !!rec?.check_in;
    const hasCheckedOut = !!rec?.check_out;
    const inProgress = hasCheckedIn && !hasCheckedOut;
    const hours = hasCheckedOut ? hoursDecimal(rec!.check_in, rec!.check_out) : 0;

    let status: DayStatus;
    if (dateStr > todayKey) status = "UPCOMING";
    else if (leaveDates.has(dateStr)) status = "ON_LEAVE"; // excused — takes priority over absent/partial
    else if (!hasCheckedIn) status = "ABSENT";
    else if (inProgress) status = "PARTIAL"; // checked in, not out yet — not final, not "absent"
    else if (hours >= shiftHours) status = "MET";
    else status = "PARTIAL";

    days.push({
      date: dateStr,
      label: dateObj.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", timeZone: "UTC" }),
      hours: Math.round(hours * 100) / 100,
      status,
      inProgress,
    });
  }

  const workingDaysTotal = days.length;
  const leaveDaysTotal = days.filter((d) => d.status === "ON_LEAVE").length;
  const expectedHours = (workingDaysTotal - leaveDaysTotal) * shiftHours;
  const completedHours = days.reduce((sum, d) => sum + d.hours, 0);
  const completionPct = expectedHours > 0 ? Math.round((completedHours / expectedHours) * 100) : 0;

  const monthLabel = formatMonthLabel(monthKey);
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const nextMonthKey = shiftMonthKey(monthKey, 1);
  const nextDisabled = nextMonthKey > currentMonthKey;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Monthly hours</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tracked against your {formatHours(shiftHours)} shift ({profile.shift_start.slice(0, 5)}–
            {profile.shift_end.slice(0, 5)}), Mon–Fri.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <Link
            href={`/dashboard/hours?month=${prevMonthKey}`}
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
              href={`/dashboard/hours?month=${nextMonthKey}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-navy"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<CalendarCheck className="h-5 w-5" />} label="Working days" value={workingDaysTotal} />
        {leaveDaysTotal > 0 && (
          <StatCard
            icon={<CalendarOff className="h-5 w-5" />}
            label="On leave"
            value={leaveDaysTotal}
            accent="text-brand-600"
          />
        )}
        <StatCard icon={<Target className="h-5 w-5" />} label="Expected hours" value={formatHours(expectedHours)} />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Hours completed"
          value={formatHours(completedHours)}
          accent="text-brand-600"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Completion"
          value={`${completionPct}%`}
          accent="text-brand-600"
        />
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-navy">Hours per day</h2>
        {days.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No working days in this month.</p>
        ) : (
          <div className="mt-4">
            <MonthlyHoursChart data={days} targetHours={shiftHours} />
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-navy">Daily breakdown</h2>
        </div>
        {days.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">Nothing to show yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Day</th>
                <th className="px-6 py-3 font-medium">Hours</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {days.map((d) => (
                <tr key={d.date} className="text-slate-600">
                  <td className="px-6 py-3 font-medium text-navy">{d.label}</td>
                  <td className="px-6 py-3">
                    {d.status === "UPCOMING" || d.status === "ON_LEAVE"
                      ? "—"
                      : d.inProgress
                        ? "In progress"
                        : formatHours(d.hours)}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className="badge"
                      style={{ background: `${STATUS_COLOR[d.status]}1a`, color: STATUS_COLOR[d.status] }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {STATUS_LABEL[d.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        &quot;Working days&quot; assumes a Mon–Fri week — adjust this if your team works a different schedule.
      </p>
    </div>
  );
}
