// supabase-js-compatible query builder backed by POST /api/db/query and
// POST /api/db/rpc/:name (worker/routes/db.ts). Covers exactly what the app
// uses: select/insert/update/upsert/delete, eq/neq/in/is, order, limit,
// single/maybeSingle and `.select()` after a write. Builders are immutable
// (every method returns a new one) and thenable; awaiting one resolves to
// `{ data, error }` and never throws - network failures come back as
// `{ error }` too, which src/lib/cache.js relies on to queue offline writes.
import { api } from "./http.js";

const QUERY_PATH = "/api/db/query";

/** @typedef {{ data: any, error: null | { message: string, code?: string, status?: number } }} Result */

class QueryBuilder {
  /** @param {object} state */
  constructor(state) {
    this.state = Object.freeze(state);
  }

  /** @returns {QueryBuilder} */
  next(patch) {
    return new QueryBuilder({ ...this.state, ...patch });
  }

  /** On a read: the columns to fetch. After a write: return the written rows. */
  select(columns = "*") {
    if (this.state.op === "select" || !this.state.op) return this.next({ op: "select", columns });
    return this.next({ columns, returning: true });
  }

  insert(values) { return this.next({ op: "insert", values }); }
  update(values) { return this.next({ op: "update", values }); }
  upsert(values, { onConflict } = {}) { return this.next({ op: "upsert", values, onConflict }); }
  delete() { return this.next({ op: "delete" }); }

  filter(col, op, value) { return this.next({ filters: [...this.state.filters, { col, op, value }] }); }
  eq(col, value) { return this.filter(col, "eq", value); }
  neq(col, value) { return this.filter(col, "neq", value); }
  in(col, values) { return this.filter(col, "in", Array.from(values || [])); }
  is(col, value) { return this.filter(col, "is", value); }

  order(col, { ascending = true } = {}) { return this.next({ order: [...this.state.order, { col, ascending }] }); }
  limit(count) { return this.next({ limit: count }); }
  single() { return this.next({ single: "single" }); }
  maybeSingle() { return this.next({ single: "maybe" }); }

  toBody() {
    const s = this.state;
    const body = { table: s.table, op: s.op || "select", filters: s.filters };
    if (s.columns !== undefined) body.columns = s.columns;
    if (s.values !== undefined) body.values = s.values;
    if (s.onConflict) body.onConflict = s.onConflict;
    if (s.order.length) body.order = s.order;
    if (s.limit !== undefined) body.limit = s.limit;
    if (s.returning) body.returning = true;
    if (s.single) body.single = s.single;
    return body;
  }

  /** @returns {Promise<Result>} */
  async execute() {
    try {
      const { data, error } = await api(QUERY_PATH, { method: "POST", body: this.toBody() });
      return error ? { data: null, error } : { data: data ?? null, error: null };
    } catch (e) {
      return { data: null, error: { message: e?.message || "Request failed", code: "client_error" } };
    }
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) { return this.execute().catch(onRejected); }
  finally(onFinally) { return this.execute().finally(onFinally); }
}

/** supabase.from(table) */
export function from(table) {
  return new QueryBuilder({ table, op: null, filters: [], order: [] });
}

/**
 * supabase.rpc(name, args)
 * @returns {Promise<Result>}
 */
export async function rpc(name, args = {}) {
  try {
    const { data, error } = await api(`/api/db/rpc/${encodeURIComponent(name)}`, { method: "POST", body: args || {} });
    return error ? { data: null, error } : { data: data ?? null, error: null };
  } catch (e) {
    return { data: null, error: { message: e?.message || "Request failed", code: "client_error" } };
  }
}
