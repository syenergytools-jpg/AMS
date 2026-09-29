import { isWorkingDay } from "@/lib/format";
import { type DayStatus } from "@/lib/hours";
import type { ProductivitySession, SiteCategoryValue } from "@/lib/types";

/** Productive share of tracked time, rounded to a whole percent; null when nothing was tracked (avoids a divide-by-zero 0%/NaN reading as "all unproductive"). */
export function productivityPercent(productiveSeconds: number, unproductiveSeconds: number): number | null {
  const total = productiveSeconds + unproductiveSeconds;
  if (total === 0) return null;
  return Math.round((productiveSeconds / total) * 100);
}

/** Productive hours an employee is expected to track on a working day, given their shift length. */
export function requiredProductiveHours(shiftHours: number): number {
  return Math.max(0, shiftHours - 1.5);
}

export interface ProductivityDayHours {
  date: string;
  label: string;
  hours: number;
  status: DayStatus;
  isRestDay: boolean;
}

/**
 * Builds one ProductivityDayHours entry per day in the given month, comparing
 * tracked productive hours against the daily target — the productivity
 * analog of hours.ts's buildMonthDayHours, sharing its DayStatus vocabulary
 * so both render with the same badges/colors.
 */
export function buildMonthProductivityDays(
  sessions: ProductivitySession[],
  monthKey: string,
  targetHours: number,
  todayKey: string,
  leaveDates: Set<string>,
  offDays: number[] = [0, 6]
): ProductivityDayHours[] {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const byDate = new Map(sessions.map((s) => [s.work_date, s]));

  const days: ProductivityDayHours[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, month - 1, d));
    const dateStr = `${monthKey}-${String(d).padStart(2, "0")}`;
    const isRestDay = !isWorkingDay(dateObj, offDays);
    const isOnLeave = leaveDates.has(dateStr);
    const session = isOnLeave ? undefined : byDate.get(dateStr);
    const hours = session ? session.total_productive_seconds / 3600 : 0;

    let status: DayStatus;
    if (dateStr > todayKey) status = "UPCOMING";
    else if (isOnLeave) status = "ON_LEAVE";
    else if (isRestDay && hours === 0) status = "REST_DAY";
    else if (hours === 0) status = "ABSENT";
    else if (hours >= targetHours) status = "MET";
    else status = "PARTIAL";

    days.push({
      date: dateStr,
      label: dateObj.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", timeZone: "UTC" }),
      hours: Math.round(hours * 100) / 100,
      status,
      isRestDay,
    });
  }
  return days;
}

export function categoryLabel(category: SiteCategoryValue): string {
  return category === "UNCATEGORIZED" ? "Uncategorized" : category;
}

export function categoryBadgeClass(category: SiteCategoryValue): string {
  switch (category) {
    case "PRODUCTIVE":
      return "bg-emerald-50 text-emerald-700";
    case "DISTRACTING":
      return "bg-red-50 text-red-700";
    case "NEUTRAL":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

/** Formats a raw executable basename (e.g. "chrome.exe", "EXCEL.EXE") as e.g. "Chrome", "Excel". */
export function formatAppName(appName: string): string {
  const base = appName.replace(/\.exe$/i, "");
  return base
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
