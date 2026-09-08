"use client";

import { useState, useTransition } from "react";
import { changeMyPassword } from "./actions";
import { Modal } from "@/components/Modal";
import { KeyRound, Loader2 } from "lucide-react";

export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onOpen() {
    setOpen(true);
    setError(null);
    setSaved(false);
  }

  function onClose() {
    setOpen(false);
    setError(null);
    setSaved(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const oldPassword = String(form.get("old_password") || "");
    const newPassword = String(form.get("new_password") || "");
    const confirmPassword = String(form.get("confirm_password") || "");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    startTransition(async () => {
      const res = await changeMyPassword(oldPassword, newPassword);
      if (res?.error) {
        setError(res.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <>
      <button
        onClick={onOpen}
        aria-label="Change password"
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
      >
        <KeyRound className="h-3.5 w-3.5" />
      </button>

      {open && (
        <Modal title="Change password" onClose={onClose}>
          {saved ? (
            <div className="space-y-4">
              <p className="text-sm text-emerald-600">Your password has been changed.</p>
              <div className="flex justify-end">
                <button type="button" onClick={onClose} className="btn-primary">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">Current password</label>
                <input name="old_password" type="password" required autoComplete="current-password" className="input" />
              </div>
              <div>
                <label className="label">New password</label>
                <input
                  name="new_password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="input"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  name="confirm_password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="input"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="btn-primary">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
