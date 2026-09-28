// CONTRACT (owned by the files agent): export `storage` with `from(bucket)`.
export const storage = { from() { throw new Error("forge storage shim not implemented"); } };
