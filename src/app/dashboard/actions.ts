"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, createVerifyClient } from "@/lib/supabase/server";
import { isLateCheckIn } from "@/lib/format";

/** Current date & time in Pakistan Standard Time (UTC+5, no DST). */
function nowPKT() {
  const now = new Date();
  const pkt = new Date(now.getTime() + 5 * 3600 * 1000);
  return {
    iso: now.toISOString(),
    date: pkt.toISOString().slice(0, 10),
    hour: pkt.getUTCHours(),
    minute: pkt.getUTCMinutes(),
  };
}

export async function checkIn() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("shift_start")
    .eq("id", user.id)
    .single();

  const { iso, date, hour, minute } = nowPKT();
  const checkInTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const isLate = isLateCheckIn(checkInTime, profile?.shift_start ?? "09:00");

  const { error } = await supabase.from("attendance").upsert(
    {
      user_id: user.id,
      work_date: date,
      check_in: iso,
      status: isLate ? "LATE" : "PRESENT",
    },
    { onConflict: "user_id,work_date" }
  );

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Employee edits the subset of their own profile that isn't identity/HR
 * data — everything else (name, email, CNIC, shift time, role) is
 * admin-only. Photo is optional here even though it's required at
 * registration; re-upload only replaces it if a new file is provided.
 */
export async function updateMyProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const phone = String(formData.get("phone") || "").trim();
  const department = String(formData.get("department") || "").trim();
  const position = String(formData.get("position") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const photo = formData.get("photo") as File | null;

  if (!phone || !department || !position || !address) {
    return { error: "Please fill in all fields." };
  }

  const updates: Record<string, string> = { phone, department, position, address };

  if (photo && photo.size > 0) {
    const admin = createAdminClient();
    const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/profile.${ext}`;
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const { error: uploadErr } = await admin.storage
      .from("avatars")
      .upload(path, bytes, { contentType: photo.type || "image/jpeg", upsert: true });
    if (!uploadErr) {
      const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
      updates.avatar_url = pub.publicUrl;
    }
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Employee changes their own password, re-verifying the current one first
 * so a session left open on an unattended device can't be used to silently
 * take it over. Verification runs on a cookie-less client so it can't
 * disturb the active session, then the real update goes through the
 * request's own authenticated client.
 */
export async function changeMyPassword(oldPassword: string, newPassword: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not signed in." };

  if (!oldPassword || !newPassword) return { error: "Please fill in all fields." };
  if (newPassword.length < 6) return { error: "New password must be at least 6 characters." };
  if (newPassword === oldPassword) return { error: "New password must be different from the current one." };

  const verifyClient = createVerifyClient();
  const { error: verifyErr } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: oldPassword,
  });
  if (verifyErr) return { error: "Current password is incorrect." };

  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updateErr) return { error: updateErr.message };

  return { ok: true };
}

export async function checkOut() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Find the open shift (checked in, not yet checked out) rather than
  // assuming it's dated today — an evening/night shift that starts before
  // midnight is still stored under yesterday's work_date, so a checkout
  // after midnight would never match "today" and would silently update
  // nothing.
  const { data: openRecord, error: findErr } = await supabase
    .from("attendance")
    .select("id")
    .eq("user_id", user.id)
    .not("check_in", "is", null)
    .is("check_out", null)
    .order("work_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) return { error: findErr.message };
  if (!openRecord) return { error: "You haven't checked in yet." };

  const { iso } = nowPKT();
  const { error } = await supabase
    .from("attendance")
    .update({ check_out: iso })
    .eq("id", openRecord.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
