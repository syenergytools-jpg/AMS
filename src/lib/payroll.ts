import { hoursDecimal, isWorkingDay, shiftLengthHours } from "./format";
import type { Attendance, LeaveRequest } from "./types";

export interface MonthAttendanceSummary {
  workingDays: number;
  leaveDays: number;
  expectedHours: number;
  actualHours: number;
  hoursShort: number;
  /** Hours worked beyond expectedHours — the mirror of hoursShort, never both positive at once. */
  hoursExtra: number;
}

/** Expands approved leave requests into a set of "YYYY-MM-DD" dates they cover. */
export function leaveDatesSet(leaveRequests: LeaveRequest[]): Set<string> {
  const dates = new Set<string>();
  for (const lr of leaveRequests) {
    if (lr.status !== "APPROVED") continue;
    for (let t = Date.parse(`${lr.start_date}T00:00:00Z`); t <= Date.parse(`${lr.end_date}T00:00:00Z`); t += 86_400_000) {
      dates.add(new Date(t).toISOString().slice(0, 10));
    }
  }
  return dates;
}

/**
 * Working days, expected vs. actual hours, and the shortfall for one
 * employee in one month. Days after `todayKey` don't count — an
 * in-progress month shouldn't be penalized for days that haven't happened.
 * Days covered by an approved leave request are excused entirely: they
 * don't add to expected hours, so they can never create a shortfall.
 *
 * A rest day (the employee's weekly off day) never adds to `workingDays` —
 * expected hours stay anchored to the normal roster — but if they worked it
 * anyway, those hours ARE credited to `actualHours`, as bonus hours that can
 * only reduce a shortfall, never inflate the target.
 */
export function summarizeMonth(
  attendance: Attendance[],
  monthKey: string,
  shiftStart: string,
  shiftEnd: string,
  todayKey: string,
  leaveDates: Set<string> = new Set(),
  offDays: number[] = [0, 6]
): MonthAttendanceSummary {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const shiftHours = shiftLengthHours(shiftStart, shiftEnd);
  const byDate = new Map(attendance.map((a) => [a.work_date, a]));

  let workingDays = 0;
  let leaveDays = 0;
  let actualHours = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, month - 1, d));
    const dateStr = `${monthKey}-${String(d).padStart(2, "0")}`;
    if (dateStr > todayKey) continue;

    const rec = byDate.get(dateStr);
    if (isWorkingDay(dateObj, offDays)) {
      workingDays++;
      if (leaveDates.has(dateStr)) {
        leaveDays++;
        continue;
      }
      if (rec) actualHours += hoursDecimal(rec.check_in, rec.check_out);
    } else if (rec) {
      // Worked a rest day: bonus hours, credited without counting the day
      // itself as a working day (so expected hours don't move).
      actualHours += hoursDecimal(rec.check_in, rec.check_out);
    }
  }

  const expectedHours = (workingDays - leaveDays) * shiftHours;
  const hoursShort = Math.max(0, expectedHours - actualHours);
  const hoursExtra = Math.max(0, actualHours - expectedHours);
  return { workingDays, leaveDays, expectedHours, actualHours, hoursShort, hoursExtra };
}

/**
 * Deducts in proportion to hours missed against basic salary: being short
 * by one full shift's worth of hours (e.g. 9h on a 9-to-6 shift) costs
 * exactly one day's pay. Partial shortfalls deduct proportionally.
 */
export function autoDeduction(basicSalary: number, expectedHours: number, hoursShort: number): number {
  if (expectedHours <= 0 || hoursShort <= 0) return 0;
  const hourlyRate = basicSalary / expectedHours;
  return Math.round(hoursShort * hourlyRate);
}

/**
 * Bonus in proportion to extra hours worked beyond expected — the mirror of
 * autoDeduction, using the same per-hour rate: a full extra shift's worth of
 * hours earns exactly one day's pay as a bonus.
 */
export function autoBonus(basicSalary: number, expectedHours: number, hoursExtra: number): number {
  if (expectedHours <= 0 || hoursExtra <= 0) return 0;
  const hourlyRate = basicSalary / expectedHours;
  return Math.round(hoursExtra * hourlyRate);
}
