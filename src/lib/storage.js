import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

const BUCKET = "client-photos";

export function isStoragePath(value) {
  return typeof value === "string" && !!value && !value.startsWith("data:") && !value.startsWith("http:") && !value.startsWith("https:");
}

function uniqueName(extension) {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
}

export async function uploadClientPhoto(clientId, folder, blob, extension = "jpg") {
  const path = `clients/${clientId}/${folder}/${uniqueName(extension)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function uploadTrainerPhoto(trainerId, folder, blob, extension = "jpg") {
  const path = `trainers/${trainerId}/${folder}/${uniqueName(extension)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function deleteClientPhoto(path) {
  if (!isStoragePath(path)) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

const signedUrlCache = new Map();

export async function getSignedPhotoUrl(path, expiresIn = 3600) {
  if (!path) return "";
  if (!isStoragePath(path)) return path; // legacy base64 data URL or already-resolved http(s) URL
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return "";
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + (expiresIn - 60) * 1000 });
  return data.signedUrl;
}

export function usePhotoUrl(path) {
  const [resolved, setResolved] = useState("");
  useEffect(() => {
    if (!isStoragePath(path)) return;
    let cancelled = false;
    getSignedPhotoUrl(path).then((url) => { if (!cancelled) setResolved(url); });
    return () => { cancelled = true; };
  }, [path]);
  return isStoragePath(path) ? resolved : (path || "");
}
