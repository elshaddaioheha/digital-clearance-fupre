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
 * Returns a human-readable reason why cloud storage is unusable, or null when
 * the credentials look well-formed. This only validates shape — an authentic
 * but revoked key still fails at upload time.
 */
function describeMisconfiguration(): string | null {
  if (!supabaseUrl || supabaseUrl === PLACEHOLDER_URL) {
    return "SUPABASE_URL is missing or still set to the example placeholder.";
  }

  if (!supabaseServiceKey || supabaseServiceKey === PLACEHOLDER_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is missing or still set to the example placeholder.";
  }

  // A Supabase service_role key is a JWT: three dot-separated segments. A value
  // of any other shape produces an opaque "Invalid Compact JWS" at upload time,
  // so it is worth catching here with a message that says what to do.
  if (supabaseServiceKey.split(".").length !== 3) {
    return (
      "SUPABASE_SERVICE_ROLE_KEY is not a valid JWT (expected three dot-separated " +
      "segments). Copy the service_role key from Supabase - Project Settings - API Keys."
    );
  }

  return null;
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
          `Upload to Supabase Storage bucket "${BUCKET_NAME}" failed: ${error.message}`
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
