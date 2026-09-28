import { describe, expect, it } from "vitest";
import {
  DEFAULT_PBKDF2_ITERATIONS,
  base64UrlToBytes,
  bytesToBase64Url,
  dummyVerify,
  hashPassword,
  isWellFormedToken,
  randomToken,
  resolveIterations,
  sha256Hex,
  timingSafeEqual,
  verifyPassword,
} from "./crypto";

const FAST = 10_000; // keep the suite quick; the algorithm is identical at any count

describe("password hashing", () => {
  it("round-trips a correct password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery", FAST);
    expect(stored.iterations).toBe(FAST);
    expect(base64UrlToBytes(stored.salt)).toHaveLength(16);
    expect(base64UrlToBytes(stored.hash)).toHaveLength(32);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterY", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("uses a fresh random salt per hash", async () => {
    const a = await hashPassword("same-password", FAST);
    const b = await hashPassword("same-password", FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("verifies with the per-user stored iteration count", async () => {
    const stored = await hashPassword("pw-12345678", 12_345);
    expect(await verifyPassword("pw-12345678", stored)).toBe(true);
    expect(await verifyPassword("pw-12345678", { ...stored, iterations: 12_346 })).toBe(false);
  });

  it("dummyVerify always fails", async () => {
    expect(await dummyVerify("anything", FAST)).toBe(false);
  });

  it("clamps PBKDF2_ITERATIONS to the Workers range and defaults to 100000", () => {
    expect(resolveIterations(undefined)).toBe(DEFAULT_PBKDF2_ITERATIONS);
    expect(resolveIterations("nonsense")).toBe(DEFAULT_PBKDF2_ITERATIONS);
    expect(resolveIterations("600000")).toBe(100_000);
    expect(resolveIterations("50000")).toBe(50_000);
    expect(resolveIterations("10")).toBe(10_000);
  });
});

describe("timingSafeEqual", () => {
  const bytes = (...v: number[]) => new Uint8Array(v);
  it("matches equal arrays", () => {
    expect(timingSafeEqual(bytes(1, 2, 3), bytes(1, 2, 3))).toBe(true);
    expect(timingSafeEqual(bytes(), bytes())).toBe(true);
  });
  it("rejects differences at any position and length mismatches", () => {
    expect(timingSafeEqual(bytes(1, 2, 3), bytes(0, 2, 3))).toBe(false);
    expect(timingSafeEqual(bytes(1, 2, 3), bytes(1, 2, 4))).toBe(false);
    expect(timingSafeEqual(bytes(1, 2, 3), bytes(1, 2))).toBe(false);
    expect(timingSafeEqual(bytes(1, 2), bytes(1, 2, 0))).toBe(false);
    expect(timingSafeEqual(bytes(0), bytes())).toBe(false);
  });
});

describe("tokens", () => {
  it("are 32 random bytes in base64url", () => {
    const t = randomToken();
    expect(isWellFormedToken(t)).toBe(true);
    expect(base64UrlToBytes(t)).toHaveLength(32);
    expect(randomToken()).not.toBe(t);
  });
  it("rejects malformed tokens", () => {
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(isWellFormedToken(123)).toBe(false);
  });
  it("base64url round-trips all byte values", () => {
    const all = new Uint8Array(256).map((_, i) => i);
    expect(Array.from(base64UrlToBytes(bytesToBase64Url(all)))).toEqual(Array.from(all));
  });
  it("sha256Hex matches a known vector", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
