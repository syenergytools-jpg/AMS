"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/data";
import { createUploadUrl, deleteDesktopBuild as deleteDesktopBuildAsset } from "@/lib/desktopBuilds";

/**
 * Returns a presigned URL for the browser to PUT the file to directly — see
 * the comment on createUploadUrl for why this can't go through a normal
 * Server Action body on Vercel.
 */
export async function requestUploadUrl(filename: string, contentType: string) {
  await requireAdmin();
  return createUploadUrl(filename, contentType);
}

/** Admin confirms a direct browser→B2 upload finished, so both pages refresh. */
export async function finalizeUpload() {
  await requireAdmin();
  revalidatePath("/admin/downloads");
  revalidatePath("/dashboard/downloads");
}

/** Admin removes a previously uploaded build. */
export async function deleteDesktopBuild(path: string) {
  await requireAdmin();

  const { error } = await deleteDesktopBuildAsset(path);
  if (error) return { error };

  revalidatePath("/admin/downloads");
  revalidatePath("/dashboard/downloads");
  return { ok: true };
}
