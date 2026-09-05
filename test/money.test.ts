import { describe, expect, it } from "vitest";
import { convert, formatBadge, parseBynAmount } from "../src/shared/money.js";
import type { Rates } from "../src/shared/types.js";

describe("parseBynAmount", () => {
  it("parses a plain amount with regular spaces", () => {
    expect(parseBynAmount("21 885 руб.")).toBe(21885);
  });

  it("parses an amount using NBSP thousand separators", () => {
    expect(parseBynAmount("21 885 руб.")).toBe(21885);
  });

  it("parses an amount using narrow-NBSP thousand separators", () => {
    expect(parseBynAmount("18 500 руб.")).toBe(18500);
  });

  it("parses a decimal amount with a comma", () => {
    expect(parseBynAmount("1 234,56 руб.")).toBe(1234.56);
  });

  it("parses a decimal amount with a dot", () => {
    expect(parseBynAmount("1234.56 руб.")).toBe(1234.56);
  });

  it("accepts the 'byn' marker case-insensitively", () => {
    expect(parseBynAmount("9999 BYN")).toBe(9999);
  });

  it("accepts kufar's abbreviated 'р.' marker", () => {
    expect(parseBynAmount("138 705 р.")).toBe(138705);
  });

  it("accepts a per-square-meter price using the 'р.' marker", () => {
    expect(parseBynAmount("3 278 р. за м²")).toBe(3278);
  });

  it("rejects already-converted USD badges", () => {
    expect(parseBynAmount("≈ 5 660 $")).toBeNull();
  });

  it("rejects already-converted EUR badges", () => {
    expect(parseBynAmount("≈ 6 185 €")).toBeNull();
  });

  it("rejects price ranges", () => {
    expect(parseBynAmount("12 800 — 79 999 руб.")).toBeNull();
  });

  it("rejects price ranges with an en dash", () => {
    expect(parseBynAmount("12800–79999 руб.")).toBeNull();
  });

  it("rejects price ranges with a hyphen", () => {
    expect(parseBynAmount("12800-79999 руб.")).toBeNull();
  });

  it("rejects text with no BYN/руб marker", () => {
    expect(parseBynAmount("21 885")).toBeNull();
  });

  it("rejects empty text", () => {
    expect(parseBynAmount("")).toBeNull();
  });

  it("rejects a zero amount", () => {
    expect(parseBynAmount("0 руб.")).toBeNull();
  });

  it("rejects absurdly large amounts", () => {
    expect(parseBynAmount("999999999 руб.")).toBeNull();
  });
});

describe("convert", () => {
  it("divides BYN by the rate", () => {
    expect(convert(21885, 3.0396)).toBeCloseTo(21885 / 3.0396, 6);
  });

  it("throws for a zero rate", () => {
    expect(() => convert(100, 0)).toThrow(RangeError);
  });

  it("throws for a negative rate", () => {
    expect(() => convert(100, -1)).toThrow(RangeError);
  });

  it("throws for a non-finite rate", () => {
    expect(() => convert(100, Number.NaN)).toThrow(RangeError);
  });
});

describe("formatBadge", () => {
  const rates: Rates = { USD: 3.0396, EUR: 3.5383 };

  it("formats USD mode", () => {
    const text = formatBadge(21885, rates, "USD");
    expect(text.startsWith("≈ ")).toBe(true);
    expect(text.endsWith("$")).toBe(true);
    expect(text).not.toContain("€");
  });

  it("formats EUR mode", () => {
    const text = formatBadge(21885, rates, "EUR");
    expect(text.startsWith("≈ ")).toBe(true);
    expect(text.endsWith("€")).toBe(true);
    expect(text).not.toContain("$");
  });

  it("formats USD_EUR mode with both currencies", () => {
    const text = formatBadge(21885, rates, "USD_EUR");
    expect(text).toContain("$");
    expect(text).toContain("€");
    expect(text).toContain("·");
  });

  it("rounds to whole units with Russian-style thousand separators", () => {
    const text = formatBadge(7200 * 3.0396, rates, "USD");
    // Result should be close to 7200, formatted with a NBSP/space thousand separator.
    expect(text).toMatch(/7[\s  ]200/);
  });
});
