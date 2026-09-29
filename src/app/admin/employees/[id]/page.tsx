import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { StatCard } from "@/components/StatCard";
import { MonthlyHoursChart } from "@/components/MonthlyHoursChart";
import { DeviceMappingForm } from "./DeviceMappingForm";
import { ShiftEditForm } from "./ShiftEditForm";
import { OffDaysEditForm } from "./OffDaysEditForm";
import { AttendanceEditor } from "./AttendanceEditor";
import { SalarySlipEditor } from "./SalarySlipEditor";
import { EmployeeLeaveHistory } from "./EmployeeLeaveHistory";
import { EmployeeProductivity } from "./EmployeeProductivity";
import { buildAttendanceHistory, buildMonthDayHours } from "@/lib/hours";
import { leaveDatesSet } from "@/lib/payroll";
import { productivityPercent, requiredProductiveHours } from "@/lib/productivity";
import {
  formatDate,
  formatHours,
  formatMonthLabel,
  formatOffDays,
  formatTimeOfDay,
  monthKeyOf,
  pktNow,
  shiftLengthHours,
  shiftMonthKey,
} from "@/lib/format";
import type { Attendance, LeaveRequest, Profile, ProductivitySession, SalarySlip, SiteActivity } from "@/lib/types";
import {
  ArrowLeft,
  IdCard,
  Phone,
  MapPin,
  Building2,
  Mail,
  Briefcase,
  Clock,
  CalendarCheck,
  CalendarOff,
  Target,
  TrendingUp,
  TrendingDown,
  Percent,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmployeeDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { month?: string };
}) {
  const supabase = createClient();

  const salaryLookback = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);

  const today = pktNow();
  const todayKey = today.toISOString().slice(0, 10);
  const currentMonthKey = monthKeyOf(today);
  const requestedMonth =
    searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : currentMonthKey;
  const monthKey = requestedMonth > currentMonthKey ? currentMonthKey : requestedMonth; // no browsing into the future
  const [hoursYear, hoursMonth] = monthKey.split("-").map(Number);
  const daysInHoursMonth = new Date(Date.UTC(hoursYear, hoursMonth, 0)).getUTCDate();
  const hoursMonthStart = `${monthKey}-01`;
  const hoursMonthEnd = `${monthKey}-${String(daysInHoursMonth).padStart(2, "0")}`;
  // Don't walk the attendance history into days that haven't happened yet
  // when the selected month is still in progress.
  const historyEnd = hoursMonthEnd > todayKey ? todayKey : hoursMonthEnd;

  const [
    { data: profileData },
    { data: slipData },
    { data: salaryAttData },
    { data: leaveData },
    { data: hoursAttData },
    { data: sessionsData },
    { data: sitesData },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", params.id).single(),
    supabase
      .from("salary_slips")
      .select("*")
      .eq("user_id", params.id)
      .order("month", { ascending: false }),
    // Wider window (not just the last 30 records) so the salary editor can
    // compute accurate hours-worked-vs-expected for whichever month it's editing.
    supabase
      .from("attendance")
      .select("*")
      .eq("user_id", params.id)
      .gte("work_date", salaryLookback),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", params.id)
      .order("start_date", { ascending: false }),
    // Exact calendar-month slice for the hours chart and the attendance
    // history list below, both scoped to the month selected above.
    supabase
      .from("attendance")
      .select("*")
      .eq("user_id", params.id)
      .gte("work_date", hoursMonthStart)
      .lte("work_date", hoursMonthEnd),
    // Same month window as the hours chart above, for the Productivity section.
    supabase
      .from("productivity_sessions")
      .select("*")
      .eq("user_id", params.id)
      .gte("work_date", hoursMonthStart)
      .lte("work_date", hoursMonthEnd)
      .order("work_date", { ascending: false }),
    supabase
      .from("site_activity")
      .select("*")
      .eq("user_id", params.id)
      .gte("work_date", hoursMonthStart)
      .lte("work_date", hoursMonthEnd),
  ]);

  if (!profileData) notFound();
  // Defensive default: guards against off_days being undefined right after
  // a deploy but before schema.sql has been re-run to add the column.
  const emp = { ...profileData, off_days: profileData.off_days ?? [0, 6] } as Profile;
  const slips = (slipData ?? []) as SalarySlip[];
  const attendanceForSalary = (salaryAttData ?? []) as Attendance[];
  const leaveRequests = (leaveData ?? []) as LeaveRequest[];
  const hoursAttendance = (hoursAttData ?? []) as Attendance[];
  const productivitySessions = (sessionsData ?? []) as ProductivitySession[];
  const productivitySites = (sitesData ?? []) as SiteActivity[];

  const approvedLeaveDates = leaveDatesSet(leaveRequests);
  const shiftHours = shiftLengthHours(emp.shift_start, emp.shift_end);
  const hoursDays = buildMonthDayHours(
    hoursAttendance,
    monthKey,
    shiftHours,
    todayKey,
    approvedLeaveDates,
    emp.off_days
  );
  const attendanceHistory = buildAttendanceHistory(
    hoursAttendance,
    approvedLeaveDates,
    emp.off_days,
    hoursMonthStart,
    historyEnd
  );

  const workingDaysTotal = hoursDays.filter((d) => !d.isRestDay).length;
  const leaveDaysTotal = hoursDays.filter((d) => d.status === "ON_LEAVE").length;
  const expectedHours = (workingDaysTotal - leaveDaysTotal) * shiftHours;
  const completedHours = hoursDays.reduce((sum, d) => sum + d.hours, 0);
  const completionPct = expectedHours > 0 ? Math.round((completedHours / expectedHours) * 100) : 0;

  const monthProductiveSeconds = productivitySessions.reduce((sum, s) => sum + s.total_productive_seconds, 0);
  const monthUnproductiveSeconds = productivitySessions.reduce((sum, s) => sum + s.total_unproductive_seconds, 0);
  const monthProductivityPct = productivityPercent(monthProductiveSeconds, monthUnproductiveSeconds);
  const productivityTargetHours = requiredProductiveHours(shiftHours);
  const productivityRequiredHours = (workingDaysTotal - leaveDaysTotal) * productivityTargetHours;

  const monthLabel = formatMonthLabel(monthKey);
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const nextMonthKey = shiftMonthKey(monthKey, 1);
  const nextDisabled = nextMonthKey > currentMonthKey;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> Back to employees
      </Link>

      {/* Monthly hours */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-navy">Monthly hours</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tracked against their {formatHours(shiftHours)} shift ({emp.shift_start.slice(0, 5)}–
              {emp.shift_end.slice(0, 5)}), off {formatOffDays(emp.off_days)}.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Link
              href={`/admin/employees/${emp.id}?month=${prevMonthKey}`}
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
                href={`/admin/employees/${emp.id}?month=${nextMonthKey}`}
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
          {hoursDays.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No working days in this month.</p>
          ) : (
            <MonthlyHoursChart data={hoursDays} targetHours={shiftHours} />
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Total tracked this month"
            value={formatHours((monthProductiveSeconds + monthUnproductiveSeconds) / 3600)}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Productive this month"
            value={formatHours(monthProductiveSeconds / 3600)}
            accent="text-emerald-600"
          />
          <StatCard
            icon={<TrendingDown className="h-5 w-5" />}
            label="Unproductive this month"
            value={formatHours(monthUnproductiveSeconds / 3600)}
            accent="text-amber-600"
          />
          <StatCard
            icon={<Percent className="h-5 w-5" />}
            label="Productivity this month"
            value={monthProductivityPct === null ? "—" : `${monthProductivityPct}%`}
            accent="text-brand-600"
          />
        </div>

        <EmployeeProductivity
          employeeId={emp.id}
          sessions={productivitySessions}
          sites={productivitySites}
          monthStart={hoursMonthStart}
          monthEnd={historyEnd}
          targetHours={productivityTargetHours}
          requiredHours={productivityRequiredHours}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile */}
        <div className="card p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar name={emp.full_name} src={emp.avatar_url} size={96} />
            <h1 className="mt-4 text-xl font-bold text-navy">{emp.full_name}</h1>
            <p className="text-sm text-slate-400">{emp.position || "Employee"}</p>
            {emp.role === "ADMIN" && (
              <span className="badge mt-2 bg-brand-50 text-brand-700">Administrator</span>
            )}
          </div>
          <dl className="mt-6 space-y-3.5 text-sm">
            <Row icon={<Mail className="h-4 w-4" />} label="Email" value={emp.email} />
            <Row icon={<IdCard className="h-4 w-4" />} label="CNIC" value={emp.cnic} />
            <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={emp.phone} />
            <Row icon={<Building2 className="h-4 w-4" />} label="Department" value={emp.department} />
            <Row icon={<Briefcase className="h-4 w-4" />} label="Position" value={emp.position} />
            <Row
              icon={<Clock className="h-4 w-4" />}
              label="Shift"
              value={`${formatTimeOfDay(emp.shift_start)} – ${formatTimeOfDay(emp.shift_end)}`}
            />
            <Row icon={<CalendarOff className="h-4 w-4" />} label="Rest days" value={formatOffDays(emp.off_days)} />
            <Row icon={<MapPin className="h-4 w-4" />} label="Address" value={emp.address} />
          </dl>

          <ShiftEditForm employeeId={emp.id} initialStart={emp.shift_start} initialEnd={emp.shift_end} />
          <OffDaysEditForm employeeId={emp.id} initialOffDays={emp.off_days} />
          <DeviceMappingForm employeeId={emp.id} initialValue={emp.device_user_id} />

          <p className="mt-4 border-t border-slate-50 pt-4 text-xs text-slate-400">
            Registered {formatDate(emp.created_at)}
          </p>
        </div>

        <AttendanceEditor employeeId={emp.id} entries={attendanceHistory} monthLabel={monthLabel} />
        <SalarySlipEditor
          employeeId={emp.id}
          slips={slips}
          attendance={attendanceForSalary}
          leaveRequests={leaveRequests}
          shiftStart={emp.shift_start}
          shiftEnd={emp.shift_end}
          offDays={emp.off_days}
        />
        <EmployeeLeaveHistory requests={leaveRequests} />
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="break-words text-slate-700">{value || "—"}</dd>
      </div>
    </div>
  );
}
