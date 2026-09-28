import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { functions } from "../../src/lib/forge/functions.js";

const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("functions.invoke shim", () => {
  it.each([
    ["forge-ai", "/api/ai"],
    ["forge-fatsecret", "/api/food"],
    ["forge-paypal", "/api/pay"],
  ])("maps %s to POST %s with a JSON body", async (name, path) => {
    fetchMock.mockResolvedValueOnce(reply({ data: {} }));
    await functions.invoke(name, { body: { action: "x", n: 1 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(path);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(init.body)).toEqual({ action: "x", n: 1 });
  });

  it("unwraps the envelope so data is what the v1 function returned", async () => {
    fetchMock.mockResolvedValueOnce(reply({ data: { draft: { verdict: "ok" } } }));
    expect(await functions.invoke("forge-ai", { body: {} })).toEqual({ data: { draft: { verdict: "ok" } }, error: null });
  });

  it("passes a v1 200 `{ error }` body through as data.error", async () => {
    fetchMock.mockResolvedValueOnce(reply({ data: { error: "barcode not enabled" } }));
    const { data, error } = await functions.invoke("forge-fatsecret", { body: { action: "barcode" } });
    expect(error).toBeNull();
    expect(data.error).toBe("barcode not enabled");
  });

  it("turns a non-2xx into an error with the real message, status, code and a v1-shaped context", async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: { message: "Gemini rate limit reached (model m). quota", code: "ai_error" } }, 500));
    const { data, error } = await functions.invoke("forge-ai", { body: {} });
    expect(data).toBeNull();
    expect(error).toMatchObject({ name: "FunctionsHttpError", message: "Gemini rate limit reached (model m). quota", status: 500, code: "ai_error" });
    expect(await error.context.json()).toEqual({ error: "Gemini rate limit reached (model m). quota" });
  });

  it("falls back to the status text when the error body isn't JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 502, statusText: "Bad Gateway" }));
    const { error } = await functions.invoke("forge-paypal", { body: {} });
    expect(error).toMatchObject({ message: "Bad Gateway", status: 502 });
  });

  it("reports network failures as an error, never a throw", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { data, error } = await functions.invoke("forge-ai", { body: {} });
    expect(data).toBeNull();
    expect(error).toMatchObject({ name: "FunctionsFetchError", code: "network" });
  });

  it("rejects unknown function names without a request", async () => {
    const { data, error } = await functions.invoke("forge-other", { body: {} });
    expect(data).toBeNull();
    expect(error.message).toMatch(/Unknown function/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an empty object when no body is given", async () => {
    fetchMock.mockResolvedValueOnce(reply({ data: { foods: [] } }));
    await functions.invoke("forge-fatsecret");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
  });
});
