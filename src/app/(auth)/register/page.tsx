"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shiftTimeOptions } from "@/lib/format";
import { Loader2, UserPlus, Upload, Camera } from "lucide-react";

const SHIFT_OPTIONS = shiftTimeOptions();

export default function RegisterPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Photo must be under 4 MB.");
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const email = String(form.get("email") || "").trim();

    const res = await fetch("/api/register", { method: "POST", body: form });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Registration failed. Please try again.");
      setLoading(false);
      return;
    }

    // Account created server-side — now sign the employee in.
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError("Account created. Please sign in.");
      setLoading(false);
      router.push("/login");
      return;
    }
    router.replace(json.role === "ADMIN" ? "/admin" : "/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy">Create your account</h2>
      <p className="mt-1 text-sm text-slate-500">
        Register as an Evolut employee. All fields help verify your identity.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Photo */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-brand-400 hover:text-brand-500"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
          </button>
          <div>
            <p className="text-sm font-medium text-slate-700">Profile photo</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
            >
              <Upload className="h-3.5 w-3.5" /> Upload a clear photo
            </button>
            <input
              ref={fileRef}
              type="file"
              name="photo"
              accept="image/*"
              className="hidden"
              onChange={onPhotoChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Full name</label>
            <input name="full_name" required className="input" placeholder="Ahmed Khan" />
          </div>
          <div>
            <label className="label">Work email</label>
            <input
              name="email"
              type="email"
              required
              className="input"
              placeholder="ahmed@evolutecomsolutions.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="input"
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="label">CNIC</label>
            <input
              name="cnic"
              required
              className="input"
              placeholder="35202-1234567-1"
              pattern="[0-9]{5}-?[0-9]{7}-?[0-9]{1}"
              title="Format: 35202-1234567-1"
            />
          </div>
          <div>
            <label className="label">Phone number</label>
            <input
              name="phone"
              required
              className="input"
              placeholder="+92 3XX XXXXXXX"
            />
          </div>
          <div>
            <label className="label">Department</label>
            <input name="department" required className="input" placeholder="Operations" />
          </div>
          <div>
            <label className="label">Position</label>
            <input name="position" required className="input" placeholder="Account Manager" />
          </div>
          <div>
            <label className="label">Shift start</label>
            <select name="shift_start" required defaultValue="09:00" className="input">
              {SHIFT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Shift end</label>
            <select name="shift_end" required defaultValue="17:00" className="input">
              {SHIFT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <textarea
              name="address"
              required
              rows={2}
              className="input resize-none"
              placeholder="House #, Street, City"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
