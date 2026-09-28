// CONTRACT (owned by the db agent): export `from(table)` returning a
// supabase-js-compatible query builder and `rpc(name, args)`.
export function from(_table) { throw new Error("forge db shim not implemented"); }
export async function rpc(_name, _args) { return { data: null, error: { message: "not implemented" } }; }
