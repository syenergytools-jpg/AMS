import { getCurrentProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { LeaveRequestForm } from "./LeaveRequestForm";
import type { LeaveRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", profile.id)
    .order("start_date", { ascending: false });

  const requests = (data ?? []) as LeaveRequest[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Leave</h1>
        <p className="mt-1 text-sm text-slate-500">Request time off and track your requests.</p>
      </div>
      <LeaveRequestForm requests={requests} />
    </div>
  );
}
