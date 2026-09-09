import { requireAdmin } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { ComplaintReviewTable } from "./ComplaintReviewTable";
import type { Complaint, Profile } from "@/lib/types";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  await requireAdmin();
  const supabase = createClient();

  const [{ data: complaintsData }, { data: profilesData }] = await Promise.all([
    supabase.from("complaints").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("role", "EMPLOYEE"),
  ]);

  const complaints = (complaintsData ?? []) as Complaint[];
  const employees = (profilesData ?? []) as Profile[];

  const openCount = complaints.filter((c) => c.status === "OPEN").length;
  const resolvedCount = complaints.filter((c) => c.status === "RESOLVED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Support</h1>
        <p className="mt-1 text-sm text-slate-500">Complaints raised by your team, per employee.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<AlertCircle className="h-5 w-5" />} label="Open" value={openCount} accent="text-amber-600" />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Resolved"
          value={resolvedCount}
          accent="text-emerald-600"
        />
      </div>

      <ComplaintReviewTable complaints={complaints} employees={employees} />
    </div>
  );
}
