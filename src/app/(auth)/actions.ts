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
 * The account's most recent reset code, if it matches `code`, hasn't been
 * used, and hasn't expired. Both verifyResetCode and resetPasswordWithCode
 * go through this, so the final password change never trusts that an
 * earlier verification step happened.
 */
async function findValidResetCode(admin: ReturnType<typeof createAdminClient>, email: string, code: string) {
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).limit(1).maybeSingle();
  if (!profile) return null;

  const { data: reset } = await admin
    .from("password_reset_codes")
    .select("id, code, expires_at, used_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reset || reset.used_at || reset.code !== code || new Date(reset.expires_at).getTime() < Date.now()) {
    return null;
  }
  return { userId: profile.id as string, resetId: reset.id as string };
}

/**
 * Checks the emailed code on its own, so the form can ask for the new
 * password only once the code is known to be good. Doesn't consume the
 * code — resetPasswordWithCode re-checks and consumes it.
 */
export async function verifyResetCode(email: string, code: string) {
  const trimmed = email.trim().toLowerCase();
  const trimmedCode = code.trim();
  if (!trimmed || !trimmedCode) return { error: "Enter the code from your email." };

  const found = await findValidResetCode(createAdminClient(), trimmed, trimmedCode);
  if (!found) return { error: "Invalid or expired code." };

  return { ok: true };
}

/**
 * Employee submits the emailed code plus a new password. The code is
 * re-validated here (it may have expired since verifyResetCode ran) and
 * marked used so it can't be replayed. `codeInvalid` tells the form to send
 * the employee back to the code step rather than stay on the password step.
 */
export async function resetPasswordWithCode(email: string, code: string, newPassword: string) {
  const trimmed = email.trim().toLowerCase();
  const trimmedCode = code.trim();
  if (!trimmed || !trimmedCode) return { error: "Enter the code from your email.", codeInvalid: true };
  if (newPassword.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();
  const found = await findValidResetCode(admin, trimmed, trimmedCode);
  if (!found) return { error: "Invalid or expired code.", codeInvalid: true };

  const { error: updateErr } = await admin.auth.admin.updateUserById(found.userId, { password: newPassword });
  if (updateErr) return { error: updateErr.message };

  await admin.from("password_reset_codes").update({ used_at: new Date().toISOString() }).eq("id", found.resetId);

  return { ok: true };
}
