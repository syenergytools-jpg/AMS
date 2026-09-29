import { getCurrentProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { ProductivityTrendSection } from "./ProductivityTrendSection";
import { TodayApps } from "./TodayApps";
import { formatDate, formatHours, formatMonthLabel, pktNow, shiftLengthHours } from "@/lib/format";
import { buildMonthProductivityDays, productivityPercent, requiredProductiveHours } from "@/lib/productivity";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/hours";
import { leaveDatesSet } from "@/lib/payroll";
import type { AppActivity, LeaveRequest, ProductivitySession } from "@/lib/types";
import { Clock, Percent, Target, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProductivityPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const todayKey = pktNow().toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);
  const monthStart = `${monthKey}-01`;
  const sevenDayStart = new Date(Date.parse(`${todayKey}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  // One fetch wide enough for both the "last 7 days" and "month to date"
  // views — the 7-day window can spill into the previous month early in a
  // new month, so this covers whichever start is earlier.
  const fetchStart = monthStart < sevenDayStart ? monthStart : sevenDayStart;

  const [{ data: sessionsData }, { data: appsData }, { data: leaveData }] = await Promise.all([
    supabase
      .from("productivity_sessions")
      .select("*")
      .eq("user_id", profile.id)
      .gte("work_date", fetchStart)
      .lte("work_date", todayKey)
      .order("work_date", { ascending: false }),
    supabase.from("app_activity").select("*").eq("user_id", profile.id).eq("work_date", todayKey),
    supabase.from("leave_requests").select("*").eq("user_id", profile.id).eq("status", "APPROVED"),
  ]);

  const sessions = (sessionsData ?? []) as ProductivitySession[];
  const todayApps = (appsData ?? []) as AppActivity[];
  const today = sessions.find((s) => s.work_date === todayKey) ?? null;

  const todayTotalSeconds = (today?.total_productive_seconds ?? 0) + (today?.total_unproductive_seconds ?? 0);
  const todayPct = today ? productivityPercent(today.total_productive_seconds, today.total_unproductive_seconds) : null;

  const monthSessions = sessions.filter((s) => s.work_date >= monthStart);
  const monthProductiveSeconds = monthSessions.reduce((sum, s) => sum + s.total_productive_seconds, 0);
  const monthUnproductiveSeconds = monthSessions.reduce((sum, s) => sum + s.total_unproductive_seconds, 0);
  const monthTotalSeconds = monthProductiveSeconds + monthUnproductiveSeconds;
  const monthPct = productivityPercent(monthProductiveSeconds, monthUnproductiveSeconds);
  const monthLabel = formatMonthLabel(monthKey);

  const leaveDates = leaveDatesSet((leaveData ?? []) as LeaveRequest[]);
  const shiftHours = shiftLengthHours(profile.shift_start, profile.shift_end);
  const targetHours = requiredProductiveHours(shiftHours);
  const productivityDays = buildMonthProductivityDays(
    monthSessions,
    monthKey,
    targetHours,
    todayKey,
    leaveDates,
    profile.off_days
  );
  const workingDaysTotal = productivityDays.filter((d) => !d.isRestDay).length;
  const leaveDaysTotal = productivityDays.filter((d) => d.status === "ON_LEAVE").length;
  const requiredHoursTotal = (workingDaysTotal - leaveDaysTotal) * targetHours;
  const targetCompletionPct =
    requiredHoursTotal > 0 ? Math.round((monthProductiveSeconds / 3600 / requiredHoursTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Productivity</h1>
        <p className="mt-1 text-sm text-slate-500">Your app activity while working, tracked automatically.</p>
      </div>

      {today?.flagged_suspicious && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Today&apos;s session was flagged for review{today.flag_reason ? `: ${today.flag_reason}` : "."}</p>
            <p className="mt-1 text-amber-700">
              These are statistical anomalies (uniform input timing, minimal mouse movement, key-only activity, or
              rapid tab switching) for a human to review — not proof of misconduct. False positives happen.
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Today</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Total tracked today"
            value={formatHours(todayTotalSeconds / 3600)}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Productive today"
            value={formatHours((today?.total_productive_seconds ?? 0) / 3600)}
            accent="text-emerald-600"
          />
          <StatCard
            icon={<TrendingDown className="h-5 w-5" />}
            label="Unproductive today"
            value={formatHours((today?.total_unproductive_seconds ?? 0) / 3600)}
            accent="text-amber-600"
          />
          <StatCard
            icon={<Percent className="h-5 w-5" />}
            label="Productivity today"
            value={todayPct === null ? "—" : `${todayPct}%`}
            accent="text-brand-600"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{monthLabel}</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={<Clock className="h-5 w-5" />} label="Total tracked this month" value={formatHours(monthTotalSeconds / 3600)} />
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
            value={monthPct === null ? "—" : `${monthPct}%`}
            accent="text-brand-600"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Monthly target</h2>
        <p className="mb-3 text-sm text-slate-500">
          Based on your {formatHours(shiftHours)} shift, you&apos;re expected to track {formatHours(targetHours)} of
          productive time on working days.
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={<Target className="h-5 w-5" />} label="Required this month" value={formatHours(requiredHoursTotal)} />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Tracked productive"
            value={formatHours(monthProductiveSeconds / 3600)}
            accent="text-emerald-600"
          />
          <StatCard
            icon={<Percent className="h-5 w-5" />}
            label="Target completion"
            value={`${targetCompletionPct}%`}
            accent="text-brand-600"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-navy">Daily breakdown</h2>
        </div>
        {productivityDays.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No working days in this month.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Productive hours</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {productivityDays.map((d) => (
                <tr key={d.date} className="text-slate-600">
                  <td className="px-6 py-3 font-medium text-navy">{formatDate(d.date)}</td>
                  <td className="px-6 py-3">
                    {d.status === "UPCOMING" || d.status === "ON_LEAVE" || d.status === "REST_DAY"
                      ? "—"
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

      <ProductivityTrendSection sessions={sessions} todayKey={todayKey} monthLabel={monthLabel} />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-navy">Today&apos;s apps</h2>
        </div>
        <div className="p-4">
          <TodayApps apps={todayApps} />
        </div>
      </div>
    </div>
  );
}
