import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, clearSessionCookie, parseCookies, readSessionToken, sessionCookie } from "./cookies";
import { randomToken } from "./crypto";

describe("parseCookies", () => {
  it("parses multiple cookies, trims, decodes and unquotes", () => {
    expect(parseCookies('a=1; b = two ; c="q%20v"; d=')).toEqual({ a: "1", b: "two", c: "q v", d: "" });
  });
  it("keeps the first occurrence and tolerates junk", () => {
    expect(parseCookies("x=1; x=2; novalue; =bad; y=%E0%A4%A")).toEqual({ x: "1", y: "%E0%A4%A" });
  });
  it("handles a missing header", () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies("")).toEqual({});
  });
});

describe("readSessionToken", () => {
  const token = randomToken();
  it("reads the forge_session cookie", () => {
    const headers = new Headers({ Cookie: `other=1; ${SESSION_COOKIE}=${token}` });
    expect(readSessionToken(headers)).toBe(token);
  });
  it("falls back to Authorization: Bearer", () => {
    expect(readSessionToken(new Headers({ Authorization: `Bearer ${token}` }))).toBe(token);
    expect(readSessionToken(new Headers({ Authorization: `bearer ${token}` }))).toBe(token);
  });
  it("prefers a valid cookie over a bearer token", () => {
    const other = randomToken();
    const headers = new Headers({ Cookie: `${SESSION_COOKIE}=${token}`, Authorization: `Bearer ${other}` });
    expect(readSessionToken(headers)).toBe(token);
  });
  it("ignores malformed values", () => {
    expect(readSessionToken(new Headers({ Cookie: `${SESSION_COOKIE}=nope` }))).toBeNull();
    expect(readSessionToken(new Headers({ Authorization: "Basic abc" }))).toBeNull();
    expect(readSessionToken(new Headers())).toBeNull();
  });
});

describe("cookie attributes", () => {
  it("sets a 30-day HttpOnly Secure SameSite=Lax cookie on /", () => {
    const c = sessionCookie("tok");
    expect(c).toContain(`${SESSION_COOKIE}=tok`);
    expect(c).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) expect(c).toContain(attr);
  });
  it("clears with Max-Age=0", () => {
    expect(clearSessionCookie()).toMatch(/^forge_session=; Max-Age=0;/);
  });
});
