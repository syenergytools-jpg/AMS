import { formatAppName } from "@/lib/productivity";
import { formatHours } from "@/lib/format";
import type { AppActivity } from "@/lib/types";

/**
 * Employee-facing "today's apps" view, distinct from the shared
 * AppBreakdownList used in admin drill-down modals — this one adds a
 * proportional share bar (of today's total tracked time) per app, split
 * into its own productive/unproductive portions.
 */
export function TodayApps({ apps }: { apps: AppActivity[] }) {
  if (apps.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No app activity recorded today.</p>;
  }

  const totalSeconds = apps.reduce((sum, a) => sum + a.productive_seconds + a.unproductive_seconds, 0);
  const sorted = [...apps].sort(
    (a, b) => b.productive_seconds + b.unproductive_seconds - (a.productive_seconds + a.unproductive_seconds)
  );

  return (
    <div className="space-y-4">
      {sorted.map((a) => {
        const appTotal = a.productive_seconds + a.unproductive_seconds;
        const sharePct = totalSeconds > 0 ? (appTotal / totalSeconds) * 100 : 0;
        const productiveSharePct = appTotal > 0 ? (a.productive_seconds / appTotal) * 100 : 0;
        return (
          <div key={a.id}>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-navy">{formatAppName(a.app_name)}</span>
              <span className="shrink-0 text-sm font-medium text-slate-500">{formatHours(appTotal / 3600)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="flex h-full" style={{ width: `${Math.max(sharePct, 2)}%` }}>
                <div style={{ width: `${productiveSharePct}%`, background: "#059669" }} />
                <div style={{ width: `${100 - productiveSharePct}%`, background: "#f59e0b" }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
