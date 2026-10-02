"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { sendPasswordResetEmail } from "@/lib/resend";

const CODE_TTL_MINUTES = 10;

function generateCode(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

/**
 * Employee requests a password-reset code by email. Always returns success
 * — even when the email doesn't match an account — so this can't be used to
 * discover which emails are registered.
 */
export async function requestPasswordReset(email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Enter your email." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", trimmed)
    .limit(1)
    .maybeSingle();

  if (profile) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

    // Invalidate any earlier unused code for this account before issuing a new one.
    await admin.from("password_reset_codes").delete().eq("user_id", profile.id).is("used_at", null);

    const { error: insertErr } = await admin
      .from("password_reset_codes")
      .insert({ user_id: profile.id, code, expires_at: expiresAt });

    if (insertErr) {
      // Logged only — the caller still gets a generic success below, so this
      // failure can't be used to distinguish "no such account" from "server
      // error" (e.g. the table migration hasn't been run yet).
      console.error("requestPasswordReset: failed to store reset code:", insertErr);
    } else {
      const { error: emailErr } = await sendPasswordResetEmail(profile.email, code);
      if (emailErr) return { error: emailErr };
    }
  }

  return { ok: true };
}

/**
 * Employee submits the emailed code plus a new password. The code must
 * match the most recent one issued for that account, be unused, and not be
 * expired — using it marks it used so it can't be replayed.
 */
export async function resetPasswordWithCode(email: string, code: string, newPassword: string) {
  const trimmed = email.trim().toLowerCase();
  const trimmedCode = code.trim();
  if (!trimmed || !trimmedCode) return { error: "Enter the code from your email." };
  if (newPassword.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("email", trimmed).limit(1).maybeSingle();
  if (!profile) return { error: "Invalid or expired code." };

  const { data: reset } = await admin
    .from("password_reset_codes")
    .select("id, code, expires_at, used_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reset || reset.used_at || reset.code !== trimmedCode || new Date(reset.expires_at).getTime() < Date.now()) {
    return { error: "Invalid or expired code." };
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword });
  if (updateErr) return { error: updateErr.message };

  await admin.from("password_reset_codes").update({ used_at: new Date().toISOString() }).eq("id", reset.id);

  return { ok: true };
}
