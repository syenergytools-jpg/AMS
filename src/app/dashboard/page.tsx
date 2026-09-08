import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { AttendanceWidget } from "./AttendanceWidget";
import { EditProfileButton } from "./EditProfileButton";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { formatDate, formatTime, formatTimeOfDay, hoursBetween } from "@/lib/format";
import type { Attendance } from "@/lib/types";
import {
  IdCard,
  Phone,
  MapPin,
  Building2,
  CalendarDays,
  Clock,
} from "lucide-react";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", profile.id)
    .order("work_date", { ascending: false })
    .limit(14);

  const history = (rows ?? []) as Attendance[];
  const todayRecord = history.find((r) => r.work_date === today) ?? null;

  const presentDays = history.filter((r) => r.status !== "ABSENT").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">
          Hi, {profile.full_name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">{formatDate(today)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttendanceWidget today={todayRecord} />
        </div>

        {/* Profile card */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={profile.full_name} src={profile.avatar_url} size={52} />
              <div>
                <div className="font-semibold text-navy">{profile.full_name}</div>
                <div className="text-sm text-slate-400">
                  {profile.position || "Employee"}
                </div>
              </div>
            </div>
            <EditProfileButton profile={profile} />
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <Detail icon={<IdCard className="h-4 w-4" />} value={profile.cnic} />
            <Detail icon={<Phone className="h-4 w-4" />} value={profile.phone} />
            <Detail icon={<Building2 className="h-4 w-4" />} value={profile.department} />
            <Detail
              icon={<Clock className="h-4 w-4" />}
              value={`Shift ${formatTimeOfDay(profile.shift_start)} – ${formatTimeOfDay(profile.shift_end)}`}
            />
            <Detail icon={<MapPin className="h-4 w-4" />} value={profile.address} />
          </dl>
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-navy">
            <CalendarDays className="h-4 w-4 text-slate-400" /> Recent attendance
          </div>
          <span className="text-sm text-slate-400">{presentDays} present (last 14)</span>
        </div>
        {history.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">
            No attendance yet — check in above to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Check-in</th>
                <th className="px-6 py-3 font-medium">Check-out</th>
                <th className="px-6 py-3 font-medium">Hours</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map((r) => (
                <tr key={r.id} className="text-slate-600">
                  <td className="px-6 py-3 font-medium text-navy">{formatDate(r.work_date)}</td>
                  <td className="px-6 py-3">{formatTime(r.check_in)}</td>
                  <td className="px-6 py-3">{formatTime(r.check_out)}</td>
                  <td className="px-6 py-3">{hoursBetween(r.check_in, r.check_out)}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Detail({ icon, value }: { icon: React.ReactNode; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 text-slate-600">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <span>{value}</span>
    </div>
  );
}
