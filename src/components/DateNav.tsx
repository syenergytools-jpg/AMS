"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function DateNav({
  basePath,
  dateKey,
  prevDate,
  nextDate,
  nextDisabled,
  todayKey,
}: {
  /** Route to navigate within, e.g. "/admin/productivity" — the date is appended as ?date=. */
  basePath: string;
  dateKey: string;
  prevDate: string;
  nextDate: string;
  nextDisabled: boolean;
  todayKey: string;
}) {
  const router = useRouter();

  function goTo(date: string) {
    router.push(`${basePath}?date=${date}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
      <button
        onClick={() => goTo(prevDate)}
        aria-label="Previous day"
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-navy"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="date"
        value={dateKey}
        max={todayKey}
        onChange={(e) => e.target.value && goTo(e.target.value)}
        className="h-8 rounded-md border-0 text-center text-sm font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {nextDisabled ? (
        <span className="flex h-8 w-8 items-center justify-center text-slate-200">
          <ChevronRight className="h-4 w-4" />
        </span>
      ) : (
        <button
          onClick={() => goTo(nextDate)}
          aria-label="Next day"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-navy"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
