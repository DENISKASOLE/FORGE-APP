// Bucket/path validation and R2 key helpers. The R2 key is "<bucket>/<path>".
import { HttpError } from "../http";
import { ALLOWED_BUCKETS, type Bucket } from "./config";

const SEGMENT_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const MAX_PATH_LENGTH = 512;
const MAX_SEGMENTS = 8;

export function isBucket(value: unknown): value is Bucket {
  return typeof value === "string" && (ALLOWED_BUCKETS as readonly string[]).includes(value);
}

// Returns the path split into segments, or throws a 400. Rejects traversal
// ("." / ".."), leading or trailing slashes, backslashes, empty segments and
// anything outside a conservative filename alphabet.
export function validatePath(path: unknown): string[] {
  if (typeof path !== "string" || !path || path.length > MAX_PATH_LENGTH) {
    throw new HttpError(400, "Invalid file path", "invalid_path");
  }
  const segments = path.split("/");
  if (segments.length > MAX_SEGMENTS) throw new HttpError(400, "Invalid file path", "invalid_path");
  for (const seg of segments) {
    if (!SEGMENT_RE.test(seg) || seg === "." || seg === "..") {
      throw new HttpError(400, "Invalid file path", "invalid_path");
    }
  }
  return segments;
}

export function validateTarget(bucket: unknown, path: unknown): { bucket: Bucket; path: string; segments: string[] } {
  if (!isBucket(bucket)) throw new HttpError(400, "Unknown storage bucket", "invalid_bucket");
  const segments = validatePath(path);
  return { bucket, path: path as string, segments };
}

export function objectKey(bucket: Bucket, path: string): string {
  return `${bucket}/${path}`;
}

export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

// Extracts {bucket, path} from a request pathname like
// "/api/files/object/client-photos/clients/1/x.jpg" given kind "object".
export function targetFromPathname(pathname: string, kind: "object" | "raw") {
  const marker = `/api/files/${kind}/`;
  const at = pathname.indexOf(marker);
  if (at !== 0) throw new HttpError(400, "Invalid file path", "invalid_path");
  const rest = pathname.slice(marker.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) throw new HttpError(400, "Invalid file path", "invalid_path");
  let bucket: string;
  let segments: string[];
  try {
    bucket = decodeURIComponent(rest.slice(0, slash));
    segments = rest.slice(slash + 1).split("/").map((s) => decodeURIComponent(s));
  } catch {
    throw new HttpError(400, "Invalid file path", "invalid_path");
  }
  return validateTarget(bucket, segments.join("/"));
}
