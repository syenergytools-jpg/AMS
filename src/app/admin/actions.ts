"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { notifyUser } from "@/lib/notify";
import { formatDate } from "@/lib/format";

/**
 * Admin creates or edits an employee's salary slip for a given month
 * ("YYYY-MM"). Upserts on (user_id, month) so re-saving the same month
 * corrects it rather than creating a duplicate. Used both from an
 * employee's own profile page and from the company-wide Salary page.
 */
export async function upsertSalarySlip(
  employeeId: string,
  month: string,
  basicSalary: number,
  allowances: number,
  deductions: number,
  note: string
) {
  await requireAdmin();
  const supabase = createClient();

  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Pick a month." };
  if ([basicSalary, allowances, deductions].some((n) => !Number.isFinite(n) || n < 0)) {
    return { error: "Amounts must be zero or greater." };
  }

  const { error } = await supabase.from("salary_slips").upsert(
    {
      user_id: employeeId,
      month: `${month}-01`,
      basic_salary: basicSalary,
      allowances,
      deductions,
      note: note.trim() || null,
    },
    { onConflict: "user_id,month" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/salary");
  return { ok: true };
}

/** Admin approves or rejects a leave request. */
export async function reviewLeaveRequest(requestId: string, approve: boolean) {
  const admin = await requireAdmin();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      status: approve ? "APPROVED" : "REJECTED",
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("user_id, start_date, end_date")
    .single();

  if (error) return { error: error.message };

  if (data) {
    await notifyUser(
      data.user_id,
      approve ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
      `Your leave request for ${formatDate(data.start_date)} – ${formatDate(data.end_date)} was ${
        approve ? "approved" : "rejected"
      }.`,
      "/dashboard/leave"
    );
  }

  revalidatePath("/admin/leave");
  return { ok: true };
}
