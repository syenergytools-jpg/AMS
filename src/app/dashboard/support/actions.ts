"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notify";

const CATEGORIES = ["ATTENDANCE", "SALARY", "LEAVE", "OTHER"];

/** Employee raises a complaint/support ticket. Starts out OPEN. */
export async function submitComplaint(
  category: string,
  subject: string,
  description: string,
  relatedDate: string
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const subjectTrimmed = subject.trim();
  const descriptionTrimmed = description.trim();
  if (!subjectTrimmed || !descriptionTrimmed) {
    return { error: "Please fill in a subject and description." };
  }

  const cat = CATEGORIES.includes(category) ? category : "OTHER";

  const { error } = await supabase.from("complaints").insert({
    user_id: user.id,
    category: cat,
    subject: subjectTrimmed,
    description: descriptionTrimmed,
    related_date: relatedDate || null,
  });

  if (error) return { error: error.message };

  const employeeName = (user.user_metadata as { full_name?: string } | null)?.full_name || user.email || "An employee";
  await notifyAdmins("COMPLAINT_SUBMITTED", `${employeeName} raised a complaint: "${subjectTrimmed}"`, "/admin/support");

  revalidatePath("/dashboard/support");
  return { ok: true };
}
