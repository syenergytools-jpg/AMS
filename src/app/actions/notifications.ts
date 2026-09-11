"use server";

import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";

/**
 * The signed-in user's most recent notifications. No explicit auth check
 * here on purpose — RLS ("user_id = auth.uid()") already scopes every one
 * of these queries to the caller's own rows, so re-validating the session
 * with an extra auth.getUser() call before each one would just be a second
 * Supabase Auth round-trip for no additional safety. An unauthenticated
 * request simply gets an empty/no-op result instead of an error, which is
 * fine here since this is a background poll, not a user-facing action.
 */
export async function getMyNotifications(): Promise<Notification[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) return { error: error.message };
  return { ok: true };
}
