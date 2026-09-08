import { createAdminClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/types";

/**
 * Cross-user notification inserts, kept out of any "use server" action file
 * on purpose — these use the service-role key so they can write a
 * notification for someone other than whoever is signed in (an employee
 * notifying admins, or an admin notifying that employee). Only ever call
 * these from other server actions, never expose this file's exports
 * directly to a client component.
 *
 * Best-effort: a notification failing to send should never fail the leave
 * request/review action it's attached to, so errors are swallowed.
 */
export async function notifyUser(userId: string, type: NotificationType, message: string, link?: string) {
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({ user_id: userId, type, message, link: link ?? null });
  } catch (err) {
    console.error("notify: notifyUser failed:", err);
  }
}

export async function notifyAdmins(type: NotificationType, message: string, link?: string) {
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "ADMIN");
    if (!admins || admins.length === 0) return;
    await admin.from("notifications").insert(
      admins.map((a: { id: string }) => ({ user_id: a.id, type, message, link: link ?? null }))
    );
  } catch (err) {
    console.error("notify: notifyAdmins failed:", err);
  }
}
