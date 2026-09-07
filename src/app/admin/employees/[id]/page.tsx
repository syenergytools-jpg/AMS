import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { DeviceMappingForm } from "./DeviceMappingForm";
import { AttendanceEditor } from "./AttendanceEditor";
import { SalarySlipEditor } from "./SalarySlipEditor";
import { EmployeeLeaveHistory } from "./EmployeeLeaveHistory";
import { formatDate, formatTimeOfDay } from "@/lib/format";
import type { Attendance, LeaveRequest, Profile, SalarySlip } from "@/lib/types";
import { ArrowLeft, IdCard, Phone, MapPin, Building2, Mail, Briefcase, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmployeeDetail({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const salaryLookback = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: profileData }, { data: attData }, { data: slipData }, { data: salaryAttData }, { data: leaveData }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", params.id).single(),
      supabase
        .from("attendance")
        .select("*")
        .eq("user_id", params.id)
        .order("work_date", { ascending: false })
        .limit(30),
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
    ]);

  if (!profileData) notFound();
  const emp = profileData as Profile;
  const history = (attData ?? []) as Attendance[];
  const slips = (slipData ?? []) as SalarySlip[];
  const attendanceForSalary = (salaryAttData ?? []) as Attendance[];
  const leaveRequests = (leaveData ?? []) as LeaveRequest[];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> Back to employees
      </Link>

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
            <Row icon={<MapPin className="h-4 w-4" />} label="Address" value={emp.address} />
          </dl>

          <DeviceMappingForm employeeId={emp.id} initialValue={emp.device_user_id} />

          <p className="mt-4 border-t border-slate-50 pt-4 text-xs text-slate-400">
            Registered {formatDate(emp.created_at)}
          </p>
        </div>

        <AttendanceEditor employeeId={emp.id} history={history} />
        <SalarySlipEditor
          employeeId={emp.id}
          slips={slips}
          attendance={attendanceForSalary}
          leaveRequests={leaveRequests}
          shiftStart={emp.shift_start}
          shiftEnd={emp.shift_end}
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
