// supabase-js-compatible `functions.invoke(name, { body })` backed by the
// Forge v2 Worker. The three v1 Edge Functions map to Worker routes:
//   forge-ai        -> POST /api/ai
//   forge-fatsecret -> POST /api/food
//   forge-paypal    -> POST /api/pay
//
// Result semantics (what the call sites in src/lib/ai.js, src/lib/fatsecret.js
// and PaymentsTab.jsx rely on):
// - 2xx: `{ data, error: null }` where `data` is the object the v1 function
//   returned (the Worker's `{ data }` envelope is unwrapped). A v1 body like
//   `{ error: "barcode not enabled" }` sent with 200 still arrives as
//   `data.error`, exactly as before.
// - non-2xx: `{ data: null, error }`. Unlike supabase-js's generic "Edge
//   Function returned a non-2xx status code", `error.message` is the real
//   reason, and `error.context.json()` resolves to `{ error: <message> }`
//   (the v1 body shape) so code that digs into the context keeps working.
//   `error.status` and `error.code` are also set.
// - network failure: `{ data: null, error: { message, code: "network" } }`.
import { api } from "./http.js";

const ROUTES = {
  "forge-ai": "/api/ai",
  "forge-fatsecret": "/api/food",
  "forge-paypal": "/api/pay",
};

function toFunctionsError(err) {
  const message = err?.message || "Request failed";
  const status = err?.status ?? 0;
  return {
    name: status ? "FunctionsHttpError" : "FunctionsFetchError",
    message,
    code: err?.code || (status ? String(status) : "network"),
    status,
    context: { status, json: async () => ({ error: message }) },
  };
}

async function invoke(name, options = {}) {
  const path = ROUTES[name];
  if (!path) return { data: null, error: toFunctionsError({ message: `Unknown function: ${name}`, code: "unknown_function" }) };
  const { data, error } = await api(path, { method: "POST", body: options.body ?? {}, headers: options.headers });
  if (error) return { data: null, error: toFunctionsError(error) };
  return { data, error: null };
}

export const functions = { invoke };
