import { supabase } from "../../supabaseClient.js";
import { CONTRACT_VERSION } from "./agreementText.js";

// Most recent signature of any version, so the gate can tell "never signed"
// apart from "signed an older version" if that distinction is ever needed.
export async function fetchLatestSignature(clientId) {
  const { data, error } = await supabase
    .from("agreement_signatures")
    .select("*")
    .eq("client_id", clientId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export function isCurrentSignature(signature) {
  return !!signature && signature.contract_version === CONTRACT_VERSION;
}

export async function insertSignature(record) {
  const { data, error } = await supabase.from("agreement_signatures").insert(record).select("*").single();
  if (error) throw error;
  return data;
}
