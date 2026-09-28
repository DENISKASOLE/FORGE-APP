import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { storage } from "./storage.js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("forge storage shim (supabase.storage shape)", () => {
  it("upload PUTs the raw blob with content type and upsert header", async () => {
    fetchMock.mockResolvedValue(json(200, { data: { path: "clients/c1/p/a b.jpg", fullPath: "client-photos/clients/c1/p/a b.jpg" } }));
    const blob = new Blob([new Uint8Array(3)], { type: "image/png" });
    const res = await storage.from("client-photos").upload("clients/c1/p/a b.jpg", blob, { contentType: "image/jpeg", upsert: true });
    expect(res).toEqual({ data: { path: "clients/c1/p/a b.jpg", fullPath: "client-photos/clients/c1/p/a b.jpg", id: null }, error: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/files/object/client-photos/clients/c1/p/a%20b.jpg");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(blob);
    expect(init.headers).toMatchObject({ "Content-Type": "image/jpeg", "x-upsert": "true" });
  });

  it("upload falls back to the blob type and returns API errors", async () => {
    fetchMock.mockResolvedValue(json(409, { error: { message: "The resource already exists", code: "Duplicate" } }));
    const res = await storage.from("screening-documents").upload("c1/s/sig.png", new Blob(["x"], { type: "image/png" }));
    expect(res.data).toBeNull();
    expect(res.error).toMatchObject({ status: 409, code: "Duplicate" });
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ "Content-Type": "image/png", "x-upsert": "false" });
  });

  it("upload wraps typed arrays in a Blob and validates input", async () => {
    fetchMock.mockResolvedValue(json(200, { data: { path: "p/a/b.pdf" } }));
    await storage.from("client-photos").upload("p/a/b.pdf", new Uint8Array([1, 2]), { contentType: "application/pdf" });
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(Blob);
    expect((await storage.from("client-photos").upload("", new Blob([]))).error.code).toBe("invalid_argument");
    expect((await storage.from("client-photos").upload("a/b/c", { nope: 1 })).error.code).toBe("invalid_argument");
  });

  it("remove deletes each path and returns the removed objects", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(200, { data: { path: "x" } })));
    const res = await storage.from("client-photos").remove(["clients/c1/p/1.jpg", "clients/c1/p/2.jpg"]);
    expect(res).toEqual({ data: [{ name: "clients/c1/p/1.jpg", bucket_id: "client-photos" }, { name: "clients/c1/p/2.jpg", bucket_id: "client-photos" }], error: null });
    expect(fetchMock.mock.calls.map((c) => c[1].method)).toEqual(["DELETE", "DELETE"]);
  });

  it("remove surfaces the first error", async () => {
    fetchMock.mockResolvedValue(json(403, { error: { message: "You don't have access to this file.", code: "forbidden" } }));
    const res = await storage.from("screening-documents").remove(["c1/s/x.pdf"]);
    expect(res.data).toBeNull();
    expect(res.error.code).toBe("forbidden");
  });

  it("createSignedUrl posts {bucket, path, expiresIn} and returns {signedUrl}", async () => {
    fetchMock.mockResolvedValue(json(200, { data: { signedUrl: "/api/files/raw/client-photos/a/b/c.jpg?exp=1&sig=ab" } }));
    const res = await storage.from("client-photos").createSignedUrl("a/b/c.jpg", 3600);
    expect(res).toEqual({ data: { signedUrl: "/api/files/raw/client-photos/a/b/c.jpg?exp=1&sig=ab" }, error: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/files/sign");
    expect(JSON.parse(init.body)).toEqual({ bucket: "client-photos", path: "a/b/c.jpg", expiresIn: 3600 });
  });

  it("createSignedUrl returns an error when forbidden", async () => {
    fetchMock.mockResolvedValue(json(403, { error: { message: "no", code: "forbidden" } }));
    const res = await storage.from("client-photos").createSignedUrl("a/b/c.jpg", 60);
    expect(res.data).toBeNull();
    expect(res.error.code).toBe("forbidden");
  });

  it("download signs then fetches the blob", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { data: { signedUrl: "/api/files/raw/client-photos/a/b/c.jpg?exp=1&sig=ab" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/jpeg" } }));
    const { data, error } = await storage.from("client-photos").download("a/b/c.jpg");
    expect(error).toBeNull();
    expect(data).toBeInstanceOf(Blob);
    expect(data.size).toBe(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/files/raw/client-photos/a/b/c.jpg?exp=1&sig=ab");
  });

  it("download returns the error when the object is missing", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { data: { signedUrl: "/api/files/raw/x/y/z?exp=1&sig=ab" } }))
      .mockResolvedValueOnce(json(404, { error: { message: "File not found", code: "not_found" } }));
    const res = await storage.from("client-photos").download("y/z/w");
    expect(res.data).toBeNull();
    expect(res.error.code).toBe("not_found");
  });
});
