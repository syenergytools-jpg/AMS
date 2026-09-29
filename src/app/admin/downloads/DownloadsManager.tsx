"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDesktopBuild, finalizeUpload, requestUploadUrl } from "./actions";
import { Modal } from "@/components/Modal";
import { formatDate, formatFileSize } from "@/lib/format";
import type { DesktopBuild } from "@/lib/types";
import { Download, Loader2, Trash2, Upload } from "lucide-react";

export function DownloadsManager({ builds }: { builds: DesktopBuild[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DesktopBuild | null>(null);
  const [deleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Uploads straight from the browser to B2 with a presigned URL, bypassing
  // Vercel's serverless functions (which hard-cap request bodies at 4.5MB)
  // entirely for the actual file bytes — a Server Action only ever hands back
  // the small presigned URL, never the file itself.
  function putWithProgress(url: string, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status}).`));
      };
      xhr.onerror = () => reject(new Error("Upload failed — network error."));
      xhr.send(file);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setError(null);
    setProgress(0);
    setUploading(true);

    (async () => {
      try {
        const res = await requestUploadUrl(file.name, file.type);
        if ("error" in res) throw new Error(res.error);
        await putWithProgress(res.url, file);
        await finalizeUpload();
        setFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    })();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteDesktopBuild(deleteTarget.path);
      if (res?.error) {
        setDeleteError(res.error);
      } else {
        router.refresh();
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-semibold text-navy">Upload a new build</h2>
        <p className="mt-1 text-sm text-slate-500">
          Employees always see the most recently uploaded build on their Tracker page.
        </p>
        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept=".zip"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="input"
          />
          <button type="submit" disabled={uploading || !fileName} className="btn-primary shrink-0">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </button>
        </form>
        {uploading && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-navy">Uploaded builds</h2>
        </div>
        {builds.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No builds uploaded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">File</th>
                <th className="px-6 py-3 font-medium">Size</th>
                <th className="px-6 py-3 font-medium">Uploaded</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {builds.map((b, i) => (
                <tr key={b.path} className="text-slate-600">
                  <td className="px-6 py-3 font-medium text-navy">
                    {b.filename}
                    {i === 0 && <span className="badge ml-2 bg-emerald-50 text-emerald-700">Current</span>}
                  </td>
                  <td className="px-6 py-3">{formatFileSize(b.size)}</td>
                  <td className="px-6 py-3">{formatDate(b.uploadedAt)}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={b.url}
                        download={b.filename}
                        aria-label={`Download ${b.filename}`}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => {
                          setDeleteTarget(b);
                          setDeleteError(null);
                        }}
                        aria-label={`Delete ${b.filename}`}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <Modal title="Delete build" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-slate-600">
            Delete <strong className="text-navy">{deleteTarget.filename}</strong>? Employees won&apos;t be able to
            download it anymore. This can&apos;t be undone.
          </p>
          {deleteError && <p className="mt-2 text-xs text-red-600">{deleteError}</p>}
          <div className="flex justify-end gap-2 pt-5">
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
