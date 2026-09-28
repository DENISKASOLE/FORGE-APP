// Shared fetch wrapper for the Forge v2 Worker API (same origin, cookie
// session). Always resolves to supabase-js's `{ data, error }` shape so the
// shim modules can hand results straight back to existing call sites.
export async function api(path, { method = "GET", body, headers, raw = false } = {}) {
  const init = { method, credentials: "same-origin", headers: { ...(headers || {}) } };
  if (body instanceof Blob || body instanceof ArrayBuffer || body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, init);
  } catch (e) {
    return { data: null, error: { message: "Network error - check your connection.", code: "network", cause: e } };
  }
  if (raw) {
    if (!res.ok) return { data: null, error: await readError(res) };
    return { data: res, error: null };
  }
  if (!res.ok) return { data: null, error: await readError(res) };
  if (res.status === 204) return { data: null, error: null };
  try {
    const json = await res.json();
    return { data: json?.data ?? null, error: json?.error ?? null };
  } catch {
    return { data: null, error: { message: "Unexpected server response", code: "bad_response" } };
  }
}

async function readError(res) {
  try {
    const json = await res.json();
    if (json?.error) return { status: res.status, ...json.error };
  } catch { /* fall through */ }
  return { status: res.status, message: res.statusText || "Request failed", code: String(res.status) };
}
