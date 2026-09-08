"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfile } from "./actions";
import { Modal } from "@/components/Modal";
import { Pencil, Camera, Upload, Loader2 } from "lucide-react";
import type { Profile } from "@/lib/types";

export function EditProfileButton({ profile }: { profile: Profile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onOpen() {
    setOpen(true);
    setError(null);
    setPreview(null);
  }

  function onClose() {
    setOpen(false);
    setError(null);
    setPreview(null);
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Photo must be under 4 MB.");
      e.target.value = "";
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateMyProfile(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <>
      <button
        onClick={onOpen}
        aria-label="Edit profile"
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {open && (
        <Modal title="Edit profile" onClose={onClose}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-brand-400 hover:text-brand-500"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                ) : profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </button>
              <div>
                <p className="text-sm font-medium text-slate-700">Profile photo</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                >
                  <Upload className="h-3.5 w-3.5" /> Change photo
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

            <div>
              <label className="label">Phone number</label>
              <input name="phone" required defaultValue={profile.phone ?? ""} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Department</label>
                <input name="department" required defaultValue={profile.department ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Position</label>
                <input name="position" required defaultValue={profile.position ?? ""} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <textarea
                name="address"
                required
                rows={2}
                defaultValue={profile.address ?? ""}
                className="input resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
