export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PK", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Formats a "HH:MM" or "HH:MM:SS" 24h time-of-day string as e.g. "9:00 AM". */
export function formatTimeOfDay(value: string | null): string {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Dropdown options for picking a shift time, in 30-minute increments. */
export function shiftTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      options.push({ value, label: formatTimeOfDay(value) });
    }
  }
  return options;
}

export function hoursBetween(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

/** Decimal hours between two timestamps, or 0 if either is missing/invalid. */
export function hoursDecimal(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? ms / 3_600_000 : 0;
}

/** Length of a "HH:MM" shift in decimal hours, handling shifts that cross midnight. */
export function shiftLengthHours(shiftStart: string, shiftEnd: string): number {
  const [sh, sm] = shiftStart.split(":").map(Number);
  const [eh, em] = shiftEnd.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

/** Minutes of grace after shift start before a check-in counts as Late. */
export const LATE_GRACE_MINUTES = 30;

/** Whether a "HH:MM" check-in time is Late relative to a "HH:MM" shift start. */
export function isLateCheckIn(checkInTime: string, shiftStart: string): boolean {
  const [ch, cm] = checkInTime.split(":").map(Number);
  const [sh, sm] = shiftStart.split(":").map(Number);
  return ch * 60 + cm > sh * 60 + sm + LATE_GRACE_MINUTES;
}

/** Extracts an ISO timestamp's PKT wall-clock time as "HH:MM", for time inputs. */
export function isoToPktTimeInput(value: string | null): string {
  if (!value) return "";
  const pkt = new Date(new Date(value).getTime() + 5 * 3600 * 1000);
  return `${String(pkt.getUTCHours()).padStart(2, "0")}:${String(pkt.getUTCMinutes()).padStart(2, "0")}`;
}

/** Formats decimal hours as e.g. "7h 30m". */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Formats an amount as e.g. "Rs. 50,000" (PKR, no decimals). */
export function formatCurrency(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-PK")}`;
}

/** "Now" in Pakistan Standard Time (UTC+5, no DST), as a UTC-based Date so getUTC* reads PKT fields. */
export function pktNow(): Date {
  return new Date(Date.now() + 5 * 3600 * 1000);
}

export function isWorkingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6; // Mon–Fri
}

export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKeyOf(d);
}

/** Formats a "YYYY-MM" key as e.g. "September 2026". */
export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
