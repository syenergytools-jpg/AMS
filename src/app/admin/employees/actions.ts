"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { isLateCheckIn } from "@/lib/format";

/**
 * Links an employee to the numeric user ID their fingerprint was enrolled
 * under on the ZKTeco terminal, so the device sync script knows whose
 * attendance row a punch belongs to. Pass an empty string to unlink.
 */
export async function setDeviceUserId(employeeId: string, deviceUserId: string) {
  await requireAdmin();
  const supabase = createClient();
  const value = deviceUserId.trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({ device_user_id: value })
    .eq("id", employeeId);

  if (error) {
    const msg =
      error.code === "23505"
        ? "That device ID is already assigned to another employee."
        : error.message;
    return { error: msg };
  }

  revalidatePath(`/admin/employees/${employeeId}`);
  return { ok: true };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Builds a UTC ISO timestamp from a PKT (UTC+5) work date + wall-clock time. */
function pktToISOString(workDate: string, time: string): string {
  return new Date(`${workDate}T${time}:00+05:00`).toISOString();
}

/**
 * Admin correction for an employee's check-in/check-out on a given day.
 * Upserts the attendance row (creates it if the employee never punched at
 * all that day) and recomputes LATE/PRESENT/ABSENT from the new check-in
 * time, the same way the check-in button and the device sync do.
 * Pass an empty string for either time to leave/clear it.
 */
export async function upsertAttendance(
  employeeId: string,
  workDate: string,
  checkInTime: string,
  checkOutTime: string
) {
  await requireAdmin();
  const supabase = createClient();

  if (!workDate) return { error: "Pick a date." };
  if (checkOutTime && !checkInTime) return { error: "Set a check-in time first." };
  if (checkInTime && checkOutTime && timeToMinutes(checkOutTime) <= timeToMinutes(checkInTime)) {
    return { error: "Check-out must be after check-in." };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("shift_start")
    .eq("id", employeeId)
    .single();
  if (profileErr || !profile) return { error: "Employee not found." };

  const check_in = checkInTime ? pktToISOString(workDate, checkInTime) : null;
  const check_out = checkOutTime ? pktToISOString(workDate, checkOutTime) : null;
  const status = !checkInTime ? "ABSENT" : isLateCheckIn(checkInTime, profile.shift_start) ? "LATE" : "PRESENT";

  const { error } = await supabase
    .from("attendance")
    .upsert(
      { user_id: employeeId, work_date: workDate, check_in, check_out, status },
      { onConflict: "user_id,work_date" }
    );

  if (error) return { error: error.message };
  revalidatePath(`/admin/employees/${employeeId}`);
  return { ok: true };
}
