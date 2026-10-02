import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;
function getClient(apiKey: string): Resend {
  if (!client) client = new Resend(apiKey);
  return client;
}

// Values typed into Vercel's dashboard often pick up stray whitespace, or
// literal quotes (Vercel keeps pasted quotes, unlike a .env file).
function envValue(name: string): string | undefined {
  const cleaned = process.env[name]?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return cleaned || undefined;
}

// The reason is shown on the form (a public page) so a failure on the live
// site can be diagnosed without reading server logs. It only ever names a
// failure category or Resend's own message — never a key or account detail.
function failure(reason: string): { error: string } {
  return { error: `Could not send the reset email (${reason}). Please try again or contact an admin.` };
}

/** Emails a password-reset code via Resend. The full failure is also logged server-side. */
export async function sendPasswordResetEmail(to: string, code: string): Promise<{ error?: string }> {
  const apiKey = envValue("RESEND_API_KEY");
  const from = envValue("RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    const missing = !apiKey ? "RESEND_API_KEY" : "RESEND_FROM_EMAIL";
    console.error(`resend: ${missing} is not set.`);
    return failure(`${missing} is not set on the server`);
  }

  try {
    const { error } = await getClient(apiKey).emails.send({
      from,
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
      return failure(`Resend ${error.statusCode ?? error.name}: ${String(error.message ?? "").slice(0, 160)}`);
    }
    return {};
  } catch (e) {
    // The exception text isn't shown: some runtime errors quote the offending
    // header value, which here would be the API key.
    console.error("resend: unexpected error sending password reset email:", e);
    return failure("unexpected error — check RESEND_API_KEY and RESEND_FROM_EMAIL for stray spaces or quotes");
  }
}
