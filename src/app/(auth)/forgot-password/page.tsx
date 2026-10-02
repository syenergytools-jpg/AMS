"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPasswordReset, resetPasswordWithCode } from "../actions";
import { Loader2, Mail, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await requestPasswordReset(email);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setInfo(`If ${email.trim()} is registered, we've sent a 6-digit code to it.`);
    setStep("code");
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);

    const res = await resetPasswordWithCode(email, code, password);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.push("/login");
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy">
        {step === "email" ? "Forgot your password?" : "Enter the code"}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {step === "email"
          ? "Enter your work email and we'll send you a reset code."
          : "Check your inbox for a 6-digit code, then set a new password."}
      </p>

      {step === "email" ? (
        <form onSubmit={handleRequestCode} className="mt-8 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}
          <div>
            <label className="label">Work email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="you@evolutecomsolutions.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send reset code
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="mt-8 space-y-5">
          {info && !error && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
              {info}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}
          <div>
            <label className="label">Reset code</label>
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={6}
              className="input"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Reset password
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setError(null);
              setInfo(null);
            }}
            className="w-full text-center text-sm font-medium text-slate-500 hover:underline"
          >
            Use a different email
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
