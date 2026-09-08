import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const full_name = String(form.get("full_name") || "").trim();
    const cnic = String(form.get("cnic") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const address = String(form.get("address") || "").trim();
    const department = String(form.get("department") || "").trim();
    const position = String(form.get("position") || "").trim();
    const shift_start = String(form.get("shift_start") || "").trim();
    const shift_end = String(form.get("shift_end") || "").trim();
    const photo = form.get("photo") as File | null;

    if (
      !email ||
      !password ||
      !full_name ||
      !cnic ||
      !phone ||
      !address ||
      !department ||
      !position ||
      !shift_start ||
      !shift_end
    ) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }
    const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;
    if (!TIME_RE.test(shift_start) || !TIME_RE.test(shift_end)) {
      return NextResponse.json({ error: "Please pick a valid shift start and end time." }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Create the auth user (email pre-confirmed so they can sign in instantly).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message?.includes("registered")
        ? "An account with this email already exists."
        : createErr?.message || "Could not create account.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const userId = created.user.id;

    // 2. Upload profile photo to Storage (optional).
    let avatar_url: string | null = null;
    if (photo && photo.size > 0) {
      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/profile.${ext}`;
      const bytes = new Uint8Array(await photo.arrayBuffer());
      const { error: uploadErr } = await admin.storage
        .from("avatars")
        .upload(path, bytes, { contentType: photo.type || "image/jpeg", upsert: true });
      if (!uploadErr) {
        const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
        avatar_url = pub.publicUrl;
      }
    }

    // 3. Bootstrap admin: the configured email becomes ADMIN automatically.
    const bootstrapAdmin = (process.env.NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const role = email === bootstrapAdmin ? "ADMIN" : "EMPLOYEE";

    // 4. Insert the profile row.
    const { error: profileErr } = await admin.from("profiles").insert({
      id: userId,
      full_name,
      email,
      role,
      cnic,
      phone,
      address,
      department,
      position,
      avatar_url,
      shift_start,
      shift_end,
    });
    if (profileErr) {
      console.error("register: profile insert failed:", profileErr);
      // Roll back the orphaned auth user so the email can be reused.
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Could not save your profile. Try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, role });
  } catch (err) {
    console.error("register: unexpected error:", err);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
