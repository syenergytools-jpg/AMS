import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { Avatar } from "@/components/Avatar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatTime, hoursBetween } from "@/lib/format";
import type { Attendance, Profile } from "@/lib/types";
import { Users, UserCheck, Clock3, UserX, CalendarOff, LifeBuoy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const admin = await requireAdmin();
  const supabase = createClient();
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() + 5 * 3600 * 1000 - 86_400_000).toISOString().slice(0, 10);

  const [{ data: profilesData }, { data: attendanceData }, { count: pendingLeaveCount }, { count: openComplaintCount }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "EMPLOYEE")
        .order("full_name"),
      // Also pull yesterday's rows — an evening/night shift that started
      // before midnight is filed under yesterday's work_date, so a
      // today-only fetch would miss anyone still mid-shift after midnight.
      supabase.from("attendance").select("*").in("work_date", [yesterday, today]),
      supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "OPEN"),
    ]);

  const employees = (profilesData ?? []) as Profile[];
  const attendance = (attendanceData ?? []) as Attendance[];

  const recordsByUser = new Map<string, Attendance[]>();
  for (const a of attendance) {
    const list = recordsByUser.get(a.user_id);
    if (list) list.push(a);
    else recordsByUser.set(a.user_id, [a]);
  }

  // Per employee: an open shift (still checked in) takes priority over
  // whatever's dated today, since that's the one actually relevant right
  // now regardless of which calendar day it started on.
  function currentRecordFor(userId: string): Attendance | undefined {
    const recs = recordsByUser.get(userId);
    if (!recs) return undefined;
    return recs.find((r) => r.check_in && !r.check_out) ?? recs.find((r) => r.work_date === today);
  }

  const byUser = new Map(employees.map((e) => [e.id, currentRecordFor(e.id)]));

  const presentCount = employees.filter((e) => byUser.get(e.id)?.check_in).length;
  const lateCount = employees.filter((e) => byUser.get(e.id)?.status === "LATE").length;
  const absentCount = employees.length - presentCount;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Hi, {admin.full_name.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-sm text-slate-500">{formatDate(today)}</p>
      </div>

      {!!pendingLeaveCount && (
        <Link
          href="/admin/leave"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
        >
          <CalendarOff className="h-4 w-4 shrink-0" />
          {pendingLeaveCount} leave {pendingLeaveCount === 1 ? "request" : "requests"} waiting for your review
          <span className="ml-auto font-semibold">Review →</span>
        </Link>
      )}

      {!!openComplaintCount && (
        <Link
          href="/admin/support"
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-800 transition hover:bg-red-100"
        >
          <LifeBuoy className="h-4 w-4 shrink-0" />
          {openComplaintCount} open {openComplaintCount === 1 ? "complaint" : "complaints"} waiting for your review
          <span className="ml-auto font-semibold">Review →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Employees" value={employees.length} icon={<Users className="h-5 w-5" />} />
        <StatCard
          label="Present today"
          value={presentCount}
          accent="text-emerald-600"
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Late today"
          value={lateCount}
          accent="text-amber-600"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          label="Not in yet"
          value={absentCount < 0 ? 0 : absentCount}
          accent="text-red-500"
          icon={<UserX className="h-5 w-5" />}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-navy">Today&apos;s attendance</h2>
          <Link href="/admin/employees" className="text-sm font-semibold text-brand-600 hover:underline">
            View all employees →
          </Link>
        </div>

        {employees.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">
            No employees registered yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Employee</th>
                <th className="px-6 py-3 font-medium">Department</th>
                <th className="px-6 py-3 font-medium">Check-in</th>
                <th className="px-6 py-3 font-medium">Check-out</th>
                <th className="px-6 py-3 font-medium">Hours</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map((emp) => {
                const rec = byUser.get(emp.id);
                return (
                  <tr key={emp.id} className="text-slate-600">
                    <td className="px-6 py-3">
                      <Link
                        href={`/admin/employees/${emp.id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <Avatar name={emp.full_name} src={emp.avatar_url} size={34} />
                        <div>
                          <div className="font-medium text-navy">{emp.full_name}</div>
                          <div className="text-xs text-slate-400">{emp.position || "—"}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-3">{emp.department || "—"}</td>
                    <td className="px-6 py-3">{formatTime(rec?.check_in ?? null)}</td>
                    <td className="px-6 py-3">{formatTime(rec?.check_out ?? null)}</td>
                    <td className="px-6 py-3">
                      {hoursBetween(rec?.check_in ?? null, rec?.check_out ?? null)}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={rec?.check_in ? rec.status : "NOT_IN"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
