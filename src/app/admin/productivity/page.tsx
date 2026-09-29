import { requireAdmin } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { DateNav } from "./DateNav";
import { ProductivityOverviewTable } from "./ProductivityOverviewTable";
import { NeedsCategorization } from "./NeedsCategorization";
import { FlaggedSessionsPanel } from "./FlaggedSessionsPanel";
import { pktNow } from "@/lib/format";
import type { AppActivity, Profile, ProductivitySession, SiteCategory } from "@/lib/types";
import { Users, TrendingUp, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

// How far back the "needs categorization" and "flagged sessions" panels
// look — both are recent-review queues, not full history.
const REVIEW_WINDOW_DAYS = 14;

export default async function AdminProductivityPage({ searchParams }: { searchParams: { date?: string } }) {
  await requireAdmin();
  const supabase = createClient();

  const todayKey = pktNow().toISOString().slice(0, 10);
  const requested = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayKey;
  const dateKey = requested > todayKey ? todayKey : requested; // no browsing into the future

  const prevDate = new Date(Date.parse(`${dateKey}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const nextDate = new Date(Date.parse(`${dateKey}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const nextDisabled = nextDate > todayKey;
  const windowStart = new Date(Date.now() - REVIEW_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

  const [
    { data: profilesData },
    { data: sessionsData },
    { data: appsData },
    { data: uncategorizedData },
    { data: categoriesData },
    { data: flaggedData },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "EMPLOYEE").order("full_name"),
    supabase.from("productivity_sessions").select("*").eq("work_date", dateKey),
    // Desktop-agent per-app data — both the "Top App" column and the
    // drill-down modal's source.
    supabase.from("app_activity").select("*").eq("work_date", dateKey),
    // Legacy browser-extension data — site_categories/NeedsCategorization
    // still manage it, but it won't have current data from the desktop agent.
    supabase
      .from("site_activity")
      .select("hostname")
      .eq("category", "UNCATEGORIZED")
      .gte("work_date", windowStart),
    supabase.from("site_categories").select("hostname"),
    supabase
      .from("productivity_sessions")
      .select("*")
      .eq("flagged_suspicious", true)
      .gte("work_date", windowStart)
      .order("work_date", { ascending: false }),
  ]);

  const employees = (profilesData ?? []) as Profile[];
  const sessions = (sessionsData ?? []) as ProductivitySession[];
  const apps = (appsData ?? []) as AppActivity[];
  const categorized = new Set(((categoriesData ?? []) as SiteCategory[]).map((c) => c.hostname));
  const needsCategorization = Array.from(
    new Set(
      (uncategorizedData ?? [])
        .map((r: { hostname: string }) => r.hostname)
        .filter((hostname: string) => !categorized.has(hostname))
    )
  ).sort();

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const flaggedItems = ((flaggedData ?? []) as ProductivitySession[])
    .map((session) => {
      const employee = employeeById.get(session.user_id);
      return employee ? { session, employee } : null;
    })
    .filter((item): item is { session: ProductivitySession; employee: Profile } => item !== null);

  const trackedCount = sessions.length;
  const flaggedTodayCount = sessions.filter((s) => s.flagged_suspicious).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Productivity</h1>
          <p className="mt-1 text-sm text-slate-500">App activity tracked while your team is working.</p>
        </div>
        <DateNav dateKey={dateKey} prevDate={prevDate} nextDate={nextDate} nextDisabled={nextDisabled} todayKey={todayKey} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Employees" value={employees.length} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Tracked" value={trackedCount} accent="text-brand-600" />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Flagged"
          value={flaggedTodayCount}
          accent={flaggedTodayCount > 0 ? "text-red-600" : "text-navy"}
        />
      </div>

      <ProductivityOverviewTable employees={employees} sessions={sessions} apps={apps} />

      <div className="grid gap-6 lg:grid-cols-2">
        <NeedsCategorization hostnames={needsCategorization} />
        <FlaggedSessionsPanel items={flaggedItems} />
      </div>
    </div>
  );
}
