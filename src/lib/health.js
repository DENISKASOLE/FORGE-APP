import { supabase } from "../supabaseClient.js";

// Wearable connections (Fitbit / Oura). Everything sensitive lives in the
// forge-health edge function - the browser never handles an OAuth token,
// only connection status and a redirect URL.

export const PROVIDER_META = {
  fitbit: { label: "Fitbit", blurb: "Steps and sleep from any Fitbit tracker or Versa/Sense watch." },
  oura: { label: "Oura Ring", blurb: "Sleep, steps and readiness from an Oura ring." },
  garmin: { label: "Garmin", blurb: "Steps and sleep from a Garmin watch." },
  whoop: { label: "Whoop", blurb: "Sleep and strain from a Whoop band." },
};

async function callForgeHealth(action, body) {
  const { data, error } = await supabase.functions.invoke("forge-health", { body: { action, ...body } });
  if (error) {
    let message = error.message || "Health request failed";
    if (typeof error.context?.json === "function") {
      try {
        const errBody = await error.context.json();
        if (errBody?.error) message = errBody.error;
      } catch {}
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// `available` is whichever providers actually have credentials configured,
// so the UI never offers a device that would fail the moment it's tapped.
export async function getHealthStatus(clientId) {
  return await callForgeHealth("status", { clientId });
}

// Returns the provider's own consent page; the caller sends the browser
// there. The provider redirects back to the edge function, which finishes
// the exchange and bounces to `returnTo`.
export async function startHealthConnect(clientId, provider, returnTo) {
  const data = await callForgeHealth("connect", { clientId, provider, returnTo });
  if (!data?.url) throw new Error("Couldn't start that connection.");
  return data.url;
}

export async function syncHealth(clientId, days = 7) {
  return await callForgeHealth("sync", { clientId, days });
}

export async function disconnectHealth(clientId, provider) {
  return await callForgeHealth("disconnect", { clientId, provider });
}
