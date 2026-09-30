"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
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

/**
 * Admin changes an employee's shift start/end time — e.g. after they move
 * to a different shift. Only affects going forward: past attendance rows
 * already have their PRESENT/LATE/ABSENT status locked in from whatever
 * shift time was in effect when they were recorded. Salary calculations,
 * however, always read the employee's *current* shift time when computed —
 * even for a past month — so editing this can change an already-viewed
 * month's expected-hours/deduction suggestion the next time it's opened.
 */
export async function updateEmployeeShift(employeeId: string, shiftStart: string, shiftEnd: string) {
  await requireAdmin();
  const supabase = createClient();

  const timeRe = /^\d{2}:\d{2}$/;
  if (!timeRe.test(shiftStart) || !timeRe.test(shiftEnd)) {
    return { error: "Invalid time." };
  }
  // shift_end <= shift_start is a legitimate overnight shift (e.g. 3 PM to
  // 2 AM) — shiftLengthHours/isLateCheckIn/upsertAttendance already treat
  // it that way (wrapping to the next day), so this only rejects the one
  // genuinely nonsensical case: identical start and end.
  if (shiftStart === shiftEnd) {
    return { error: "Shift start and end can't be the same time." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ shift_start: shiftStart, shift_end: shiftEnd })
    .eq("id", employeeId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/salary");
  return { ok: true };
}

/**
 * Admin sets which weekdays an employee is normally off (0=Sun..6=Sat) —
 * e.g. someone who rests on weekdays and works the weekend instead of the
 * standard Sat+Sun. Affects every "working days"/expected-hours
 * calculation (Monthly Hours, salary) going forward.
 */
export async function updateEmployeeOffDays(employeeId: string, offDays: number[]) {
  await requireAdmin();
  const supabase = createClient();

  const cleaned = Array.from(new Set(offDays)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (cleaned.length === 7) {
    return { error: "At least one day has to be a working day." };
  }

  const { error } = await supabase.from("profiles").update({ off_days: cleaned }).eq("id", employeeId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/salary");
  revalidatePath("/dashboard/hours");
  return { ok: true };
}

/** Builds a UTC ISO timestamp from a PKT (UTC+5) work date + wall-clock time. */
function pktToISOString(workDate: string, time: string): string {
  return new Date(`${workDate}T${time}:00+05:00`).toISOString();
}

function addOneDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("shift_start, shift_end")
    .eq("id", employeeId)
    .single();
  if (profileErr || !profile) return { error: "Employee not found." };

  // A check-out clock-time at or before the check-in clock-time normally
  // means a typo — but for an employee whose own shift is registered as
  // overnight (shift_end <= shift_start, e.g. 10 PM - 6 AM), it legitimately
  // means the checkout lands on the following calendar day.
  const crossesMidnight = !!(checkInTime && checkOutTime && timeToMinutes(checkOutTime) <= timeToMinutes(checkInTime));
  const employeeIsOvernightShift = timeToMinutes(profile.shift_end) <= timeToMinutes(profile.shift_start);

  if (crossesMidnight && !employeeIsOvernightShift) {
    return { error: "Check-out must be after check-in." };
  }

  const check_in = checkInTime ? pktToISOString(workDate, checkInTime) : null;
  const check_out = checkOutTime
    ? pktToISOString(crossesMidnight ? addOneDay(workDate) : workDate, checkOutTime)
    : null;
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

/**
 * Admin removes an attendance record entirely (as opposed to clearing its
 * times via upsertAttendance, which leaves an ABSENT row behind) — e.g. a
 * duplicate device punch or a mistaken manual entry.
 */
export async function deleteAttendance(employeeId: string, workDate: string) {
  await requireAdmin();
  const supabase = createClient();

  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("user_id", employeeId)
    .eq("work_date", workDate);

  if (error) return { error: error.message };
  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/salary");
  return { ok: true };
}

/**
 * Admin correction for a day's tracked productive/unproductive time — the
 * tracker writes these normally, but admins can fix an obviously wrong
 * value (e.g. a stuck timer inflating one day's hours) the same way they
 * can correct attendance. Only the two duration fields are editable here;
 * tab_switch_count and the flagged/reason fields are tracker-computed
 * signals, not "time," and stay out of admin's hands.
 */
export async function updateProductivitySession(
  employeeId: string,
  workDate: string,
  productiveSeconds: number,
  unproductiveSeconds: number
) {
  await requireAdmin();
  const supabase = createClient();

  if (!workDate) return { error: "Missing date." };
  if (
    !Number.isFinite(productiveSeconds) ||
    !Number.isFinite(unproductiveSeconds) ||
    productiveSeconds < 0 ||
    unproductiveSeconds < 0
  ) {
    return { error: "Time can't be negative." };
  }

  const { error } = await supabase
    .from("productivity_sessions")
    .update({ total_productive_seconds: productiveSeconds, total_unproductive_seconds: unproductiveSeconds })
    .eq("user_id", employeeId)
    .eq("work_date", workDate);

  if (error) return { error: error.message };
  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/productivity");
  return { ok: true };
}

/** Admin removes a day's tracked productivity session entirely — e.g. a session that shouldn't have been recorded at all. */
export async function deleteProductivitySession(employeeId: string, workDate: string) {
  await requireAdmin();
  const supabase = createClient();

  const { error } = await supabase
    .from("productivity_sessions")
    .delete()
    .eq("user_id", employeeId)
    .eq("work_date", workDate);

  if (error) return { error: error.message };
  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/productivity");
  return { ok: true };
}

/**
 * Admin deletes a salary slip entirely — e.g. one added for the wrong month
 * by mistake. Unlike attendance/productivity_sessions, salary_slips has no
 * delete RLS policy (admins only get insert/update), so this goes through
 * the service-role client instead of the session-scoped one.
 */
export async function deleteSalarySlip(employeeId: string, slipId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("salary_slips").delete().eq("id", slipId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/salary");
  return { ok: true };
}
