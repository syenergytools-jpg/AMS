import { requireAdmin } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { LeaveReviewTable } from "./LeaveReviewTable";
import type { LeaveRequest, Profile } from "@/lib/types";
import { Clock3, CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLeavePage() {
  await requireAdmin();
  const supabase = createClient();

  const [{ data: requestsData }, { data: profilesData }] = await Promise.all([
    supabase.from("leave_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("role", "EMPLOYEE"),
  ]);

  const requests = (requestsData ?? []) as LeaveRequest[];
  const employees = (profilesData ?? []) as Profile[];

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Leave</h1>
        <p className="mt-1 text-sm text-slate-500">Review time-off requests from your team.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Pending" value={pendingCount} accent="text-amber-600" />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Approved"
          value={approvedCount}
          accent="text-emerald-600"
        />
        <StatCard icon={<XCircle className="h-5 w-5" />} label="Rejected" value={rejectedCount} accent="text-red-500" />
      </div>

      <LeaveReviewTable requests={requests} employees={employees} />
    </div>
  );
}
