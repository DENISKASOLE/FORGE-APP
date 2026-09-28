// supabase.storage-compatible shim backed by the Worker's /api/files routes
// (R2). Call sites keep using supabase.storage.from(bucket).upload/remove/
// createSignedUrl/download unchanged. The app stores the bare path; the R2
// key is "<bucket>/<path>".
import { api } from "./http.js";

const DOWNLOAD_LINK_SECONDS = 60;

function encodePath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function objectUrl(bucket, path) {
  return `/api/files/object/${encodeURIComponent(bucket)}/${encodePath(path)}`;
}

function toBlob(body, contentType) {
  if (body instanceof Blob) return body;
  if (body instanceof ArrayBuffer) return new Blob([body], { type: contentType });
  if (ArrayBuffer.isView(body)) return new Blob([body], { type: contentType });
  if (typeof body === "string") return new Blob([body], { type: contentType });
  return null;
}

function invalid(message) {
  return { data: null, error: { message, code: "invalid_argument" } };
}

function createBucketApi(bucket) {
  const bucketApi = {
    async upload(path, body, options = {}) {
      if (!path) return invalid("A file path is required.");
      const contentType = options.contentType || (body instanceof Blob && body.type) || "application/octet-stream";
      const blob = toBlob(body, contentType);
      if (!blob) return invalid("Unsupported upload body.");
      const { data, error } = await api(objectUrl(bucket, path), {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType, "x-upsert": options.upsert ? "true" : "false" },
      });
      if (error) return { data: null, error };
      return { data: { path: data?.path ?? path, fullPath: data?.fullPath ?? `${bucket}/${path}`, id: null }, error: null };
    },

    async remove(paths) {
      const list = Array.isArray(paths) ? paths : [paths];
      const results = await Promise.all(list.map((p) => api(objectUrl(bucket, p), { method: "DELETE" })));
      const failed = results.find((r) => r.error);
      const removed = list.filter((_, i) => !results[i].error).map((name) => ({ name, bucket_id: bucket }));
      return { data: failed ? null : removed, error: failed ? failed.error : null };
    },

    async createSignedUrl(path, expiresIn) {
      if (!path) return invalid("A file path is required.");
      const { data, error } = await api("/api/files/sign", { method: "POST", body: { bucket, path, expiresIn } });
      if (error || !data?.signedUrl) return { data: null, error: error || { message: "Couldn't create a file link.", code: "bad_response" } };
      return { data: { signedUrl: data.signedUrl }, error: null };
    },

    async download(path) {
      const signed = await bucketApi.createSignedUrl(path, DOWNLOAD_LINK_SECONDS);
      if (signed.error) return { data: null, error: signed.error };
      const { data: res, error } = await api(signed.data.signedUrl, { raw: true });
      if (error) return { data: null, error };
      try {
        return { data: await res.blob(), error: null };
      } catch (e) {
        return { data: null, error: { message: "Couldn't read the downloaded file.", code: "bad_response", cause: e } };
      }
    },
  };
  return bucketApi;
}

export const storage = {
  from(bucket) {
    return createBucketApi(bucket);
  },
};
