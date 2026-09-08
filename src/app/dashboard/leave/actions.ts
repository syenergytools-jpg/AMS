"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notify";
import { formatDate } from "@/lib/format";

const LEAVE_TYPES = ["SICK", "CASUAL", "ANNUAL", "OTHER"];

/** Employee submits a leave request for a date range. Starts out PENDING. */
export async function requestLeave(startDate: string, endDate: string, leaveType: string, reason: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (!startDate || !endDate) return { error: "Pick a start and end date." };
  if (endDate < startDate) return { error: "End date must be on or after the start date." };

  const type = LEAVE_TYPES.includes(leaveType) ? leaveType : "CASUAL";

  const { data: overlapping } = await supabase
    .from("leave_requests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["PENDING", "APPROVED"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);
  if (overlapping && overlapping.length > 0) {
    return { error: "You already have a request covering some of these dates." };
  }

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    start_date: startDate,
    end_date: endDate,
    leave_type: type,
    reason: reason.trim() || null,
  });

  if (error) return { error: error.message };

  const employeeName = (user.user_metadata as { full_name?: string } | null)?.full_name || user.email || "An employee";
  await notifyAdmins(
    "LEAVE_REQUESTED",
    `${employeeName} requested leave for ${formatDate(startDate)} – ${formatDate(endDate)}.`,
    "/admin/leave"
  );

  revalidatePath("/dashboard/leave");
  return { ok: true };
}

/** Withdraw a request that hasn't been reviewed yet. */
export async function cancelLeaveRequest(requestId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("leave_requests")
    .delete()
    .eq("id", requestId)
    .eq("user_id", user.id)
    .eq("status", "PENDING");

  if (error) return { error: error.message };
  revalidatePath("/dashboard/leave");
  return { ok: true };
}
