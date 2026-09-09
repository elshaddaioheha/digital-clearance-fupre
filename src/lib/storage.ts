import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PLACEHOLDER_URL = "https://your-project-ref.supabase.co";
const PLACEHOLDER_KEY = "your-supabase-service-role-key";

const BUCKET_NAME = "clearance-documents";

/**
 * Raised when a document could not be persisted. Callers should surface this to
 * the client rather than reporting success, because nothing was stored.
 */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Returns a human-readable reason why cloud storage cannot be used at all, or
 * null when there is something worth trying. Only missing or placeholder values
 * disable storage — anything else is handed to Supabase, which is the real
 * authority on whether a credential works.
 */
function describeMisconfiguration(): string | null {
  if (!supabaseUrl || supabaseUrl === PLACEHOLDER_URL) {
    return "SUPABASE_URL is missing or still set to the example placeholder.";
  }

  if (!supabaseServiceKey || supabaseServiceKey === PLACEHOLDER_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is missing or still set to the example placeholder.";
  }

  return null;
}

/**
 * Supabase issues secrets in two shapes: the legacy service_role JWT, and the
 * newer `sb_secret_...` API key. Both are valid, so this never blocks an
 * upload — it only supplies a hint when a failure is likely to be caused by the
 * wrong value being pasted (a publishable/anon key, or something truncated).
 */
function describeKeyFormatHint(): string | null {
  if (!supabaseServiceKey) return null;

  const looksLikeJwt = supabaseServiceKey.split(".").length === 3;
  const looksLikeSecretKey = supabaseServiceKey.startsWith("sb_secret_");
  const looksLikePublishableKey = supabaseServiceKey.startsWith("sb_publishable_");

  if (looksLikePublishableKey) {
    return (
      " The configured value looks like a publishable key, which cannot write to " +
      "storage. Use the secret (service_role) key from Supabase - Project Settings - API Keys."
    );
  }

  if (!looksLikeJwt && !looksLikeSecretKey) {
    return (
      " The configured key matches neither a service_role JWT nor an " +
      "`sb_secret_...` key, so it may be truncated or mis-pasted."
    );
  }

  return null;
}

/**
 * Turns a storage API error into actionable advice where the cause is known.
 *
 * Supabase Storage validates the credential as a JWT. Handing it one of the
 * newer `sb_secret_...` API keys makes it fail with "Invalid Compact JWS" on
 * every call, including a plain bucket listing — the key is well-formed, it is
 * simply not the shape this service accepts.
 */
function describeUploadHint(message: string): string {
  const looksLikeJwt = supabaseServiceKey.split(".").length === 3;

  if (/JWS|JWT/i.test(message) && !looksLikeJwt) {
    return (
      " Supabase Storage expects a JWT credential, and the configured key is not one." +
      " Use the legacy service_role JWT (Supabase - Project Settings - API Keys -" +
      " legacy/JWT keys), which begins with `eyJ`, rather than an `sb_secret_...` key."
    );
  }

  return describeKeyFormatHint() ?? "";
}

const configError = describeMisconfiguration();

const supabase = configError ? null : createClient(supabaseUrl, supabaseServiceKey);

if (configError) {
  console.warn(`[storage] Cloud storage disabled. ${configError}`);
}

/**
 * Persists a document and returns its retrievable URL.
 *
 * In production this throws StorageError rather than degrading: the old code
 * caught every storage failure, wrote to `public/uploads` and returned an HTTP
 * 200, so a submission looked successful while the document sat on an ephemeral
 * container filesystem and vanished on the next deploy.
 *
 * In development it still falls back to local disk — with a warning — so the
 * app remains usable without Supabase credentials.
 */
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueName = `${Date.now()}-${sanitizedName}`;
  const isProduction = process.env.NODE_ENV === "production";

  if (supabase) {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(uniqueName, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        throw new StorageError(
          `Upload to Supabase Storage bucket "${BUCKET_NAME}" failed: ${error.message}.` +
            ` Check that the bucket exists and that the service key may write to it.` +
            `${describeUploadHint(error.message)}`
        );
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(uniqueName);

      return urlData.publicUrl;
    } catch (err) {
      if (isProduction) throw err;

      console.warn(
        `[storage] Supabase upload failed, falling back to local disk (development only): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return writeToLocalDisk(uniqueName, fileBuffer);
    }
  }

  // No usable cloud credentials. Local disk is a development convenience only —
  // on a serverless host it is ephemeral and often read-only, so a document
  // written there is lost on the next deploy.
  if (isProduction) {
    throw new StorageError(
      `Cloud storage is not configured, so uploads cannot be stored. ${configError}`
    );
  }

  console.warn(`[storage] ${configError} Writing to local disk (development only).`);
  return writeToLocalDisk(uniqueName, fileBuffer);
}

/**
 * Best-effort removal of previously stored files.
 *
 * Resubmitting replaces a request's Document rows, which used to leave the
 * underlying files behind forever. Failures here are logged and swallowed: the
 * database is already consistent by this point, and losing a cleanup is far
 * less harmful than failing a submission that actually succeeded.
 */
export async function deleteFiles(fileUrls: string[]): Promise<void> {
  if (fileUrls.length === 0) return;

  const localNames: string[] = [];
  const remoteNames: string[] = [];

  for (const url of fileUrls) {
    if (url.startsWith("/uploads/")) {
      localNames.push(url.slice("/uploads/".length));
    } else if (url.includes(`/${BUCKET_NAME}/`)) {
      // Public URLs look like .../object/public/<bucket>/<name>
      const name = url.split(`/${BUCKET_NAME}/`).pop();
      if (name) remoteNames.push(decodeURIComponent(name.split("?")[0]));
    }
  }

  if (supabase && remoteNames.length > 0) {
    try {
      const { error } = await supabase.storage.from(BUCKET_NAME).remove(remoteNames);
      if (error) throw new Error(error.message);
    } catch (err) {
      console.warn(
        `[storage] Could not remove ${remoteNames.length} replaced file(s) from Supabase: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  for (const name of localNames) {
    try {
      // Guard against a stored value that tries to escape the upload directory.
      if (name.includes("/") || name.includes("\\") || name.includes("..")) continue;

      const filePath = path.join(process.cwd(), "public", "uploads", name);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.warn(
        `[storage] Could not remove replaced local file ${name}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}

function writeToLocalDisk(uniqueName: string, fileBuffer: Buffer): string {
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    fs.writeFileSync(path.join(uploadDir, uniqueName), fileBuffer);
  } catch (err) {
    throw new StorageError(
      `Local development upload failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return `/uploads/${uniqueName}`;
}
