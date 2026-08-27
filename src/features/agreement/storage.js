import { supabase } from "../../supabaseClient.js";

const BUCKET = "agreement-documents";

export async function uploadAgreementFile(clientId, signatureId, filename, blob) {
  const path = `${clientId}/${signatureId}/${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return path;
}

export async function getSignedAgreementUrl(path, expiresIn = 3600) {
  if (!path) return "";
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}
