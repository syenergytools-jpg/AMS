"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

export async function checkOut() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { iso, date } = nowPKT();
  const { error } = await supabase
    .from("attendance")
    .update({ check_out: iso })
    .eq("user_id", user.id)
    .eq("work_date", date);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
