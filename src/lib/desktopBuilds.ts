import "server-only";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { DesktopBuild } from "@/lib/types";

// Backblaze B2 (S3-compatible), not Cloudinary: Cloudinary's free plan hard-caps
// "raw" files at 10MB account-wide (confirmed via its own usage API — a
// resource_type:"video" workaround was rejected outright: "Unsupported video
// format or file"). B2's free tier (10GB) needs no credit card and has no
// per-file cap, so it comfortably handles a 110MB installer.
const FOLDER = "tracker-builds";
const NAME_SEPARATOR = "__";
const DOWNLOAD_URL_TTL_SECONDS = 3600;
const UPLOAD_URL_TTL_SECONDS = 3600;

// B2's S3-compatible endpoint hostname embeds its region, e.g.
// "s3.us-west-004.backblazeb2.com" — read off the bucket's details page.
function regionFromEndpoint(endpoint: string): string {
  const match = endpoint.match(/s3\.([\w-]+)\.backblazeb2\.com/);
  if (!match) throw new Error(`B2_ENDPOINT doesn't look like a B2 S3 endpoint: ${endpoint}`);
  return match[1];
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (client) return client;
  const endpoint = process.env.B2_ENDPOINT!;
  client = new S3Client({
    region: regionFromEndpoint(endpoint),
    endpoint: endpoint.startsWith("http") ? endpoint : `https://${endpoint}`,
    credentials: {
      accessKeyId: process.env.B2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

function bucket(): string {
  return process.env.B2_BUCKET_NAME!;
}

// B2 object keys can safely hold most characters, but keep this tight and
// predictable since the true original filename is decoded back out of it
// (see fallbackFilename) rather than stored separately.
function sanitize(filename: string): string {
  return filename.replace(/[^\w.\- ]/g, "_");
}

function filenameFromKey(key: string): string {
  const base = key.startsWith(`${FOLDER}/`) ? key.slice(FOLDER.length + 1) : key;
  const idx = base.indexOf(NAME_SEPARATOR);
  return idx >= 0 ? base.slice(idx + NAME_SEPARATOR.length) : base;
}

/** Lists every uploaded desktop-app build, newest first. */
export async function listDesktopBuilds(): Promise<DesktopBuild[]> {
  const s3 = getClient();
  const result = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket(), Prefix: `${FOLDER}/` })
  );

  const objects = (result.Contents ?? []).filter((o) => o.Key && o.Size);
  const builds = await Promise.all(
    objects.map(async (o) => {
      const key = o.Key!;
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket(), Key: key }), {
        expiresIn: DOWNLOAD_URL_TTL_SECONDS,
      });
      return {
        path: key,
        filename: filenameFromKey(key),
        size: o.Size!,
        uploadedAt: (o.LastModified ?? new Date()).toISOString(),
        url,
      };
    })
  );

  return builds.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
}

/**
 * Returns a presigned URL the browser can PUT the file to directly. Vercel's
 * serverless functions hard-cap request bodies at 4.5MB (infrastructure-level,
 * not something next.config's bodySizeLimit can override), so a ~110MB build
 * can never be relayed through a Server Action in production — it has to go
 * browser-to-B2 directly, bypassing Vercel entirely for the file bytes.
 */
export async function createUploadUrl(
  filename: string,
  contentType: string
): Promise<{ key: string; url: string } | { error: string }> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const key = `${FOLDER}/${unique}${NAME_SEPARATOR}${sanitize(filename)}`;

  try {
    const url = await getSignedUrl(
      getClient(),
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        ContentType: contentType || "application/octet-stream",
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS }
    );
    return { key, url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not prepare upload." };
  }
}

/** Removes a previously uploaded build from B2. */
export async function deleteDesktopBuild(key: string): Promise<{ error?: string }> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Delete failed." };
  }
}
