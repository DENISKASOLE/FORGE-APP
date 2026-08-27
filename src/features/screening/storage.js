import { supabase } from "../../supabaseClient.js";

const BUCKET = "screening-documents";

export async function uploadScreeningFile(clientId, screeningId, filename, blob) {
  const path = `${clientId}/${screeningId}/${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return path;
}

export async function getSignedScreeningUrl(path, expiresIn = 3600) {
  if (!path) return "";
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}
