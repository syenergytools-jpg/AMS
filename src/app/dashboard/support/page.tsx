import { getCurrentProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { SupportForm } from "./SupportForm";
import type { Complaint } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data } = await supabase
    .from("complaints")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const complaints = (data ?? []) as Complaint[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Support</h1>
        <p className="mt-1 text-sm text-slate-500">
          Raise an issue — e.g. a check-in/check-out that didn't record correctly — and track its
          status here.
        </p>
      </div>
      <SupportForm complaints={complaints} />
    </div>
  );
}
