import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;
function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/**
 * Emails a password-reset code via Resend. The real failure reason is
 * logged server-side only — callers show the generic message to the user,
 * since a raw provider error ("invalid API key", etc.) isn't useful to them.
 */
export async function sendPasswordResetEmail(to: string, code: string): Promise<{ error?: string }> {
  const GENERIC_ERROR = "Could not send the reset email. Please try again or contact an admin.";

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.error("resend: RESEND_API_KEY or RESEND_FROM_EMAIL is not set.");
    return { error: GENERIC_ERROR };
  }

  try {
    const { error } = await getClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject: "Your Evolut Attendance password reset code",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #0B1B2E;">Reset your password</h2>
          <p style="color: #334155;">Use this code to reset your Evolut Attendance password. It expires in 10 minutes.</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563EB;">${code}</p>
          <p style="color: #64748b; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("resend: failed to send password reset email:", error);
      return { error: GENERIC_ERROR };
    }
    return {};
  } catch (e) {
    console.error("resend: unexpected error sending password reset email:", e);
    return { error: GENERIC_ERROR };
  }
}
