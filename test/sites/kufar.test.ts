import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { kufarAdapter } from "../../src/sites/kufar.js";
import { removeAllBadges } from "../../src/content/inject.js";
import { formatBadge } from "../../src/shared/money.js";
import type { Rates } from "../../src/shared/types.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/kufar");

function loadFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

const rates: Rates = { USD: 3.0396, EUR: 3.5383 };

function runPass(): void {
  const hits = kufarAdapter.scan(document);
  for (const hit of hits) {
    const text = formatBadge(hit.byn, rates, "USD");
    kufarAdapter.place(hit.anchor, text, "НБРБ 3.0396 · 31.08.2026");
  }
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("kufar adapter on a plain price leaf", () => {
  it("places a badge after the price element and leaves the BYN text untouched", () => {
    document.body.innerHTML = loadFixture("plain.html");
    runPass();

    const priceEl = document.querySelector(".listing-item__price-container span");
    expect(priceEl?.textContent).toBe("138 705 р.");

    // Anchor resolves to the nearest ancestor with a "price" class
    // (`.listing-item__price-container`), not the leaf span itself.
    const priceContainer = document.querySelector(".listing-item__price-container");
    const badge = document.querySelector("[data-byn-badge]");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("$");
    expect(priceContainer?.nextElementSibling).toBe(badge);
  });
});

describe("kufar adapter on a per-square-meter row", () => {
  it("anchors the badge to the row containing both the price and 'за м²'", () => {
    document.body.innerHTML = loadFixture("per-square-meter.html");
    runPass();

    const wrapper = document.querySelector(".listing-item__price-wrapper");
    const badge = document.querySelector("[data-byn-badge]");
    expect(badge).not.toBeNull();
    expect(wrapper?.nextElementSibling).toBe(badge);
    // The badge must not have landed inside the wrapper, squeezed next to
    // the price or the "за м²" label.
    expect(badge?.parentElement).toBe(wrapper?.parentElement);
  });
});

describe("kufar adapter escapes a horizontal flex row", () => {
  it("places the badge after the whole flex row, not inside it", () => {
    document.body.innerHTML = loadFixture("flex-row.html");
    runPass();

    const row = document.querySelector(".row");
    const outer = document.querySelector(".outer");
    const badge = document.querySelector("[data-byn-badge]");

    expect(badge).not.toBeNull();
    expect(badge?.parentElement).toBe(outer);
    expect(row?.nextElementSibling).toBe(badge);
  });
});

describe("kufar adapter re-anchoring", () => {
  it("moves an existing badge back next to its anchor instead of duplicating it", () => {
    document.body.innerHTML = loadFixture("plain.html");
    runPass();

    const priceEl = document.querySelector(".listing-item__price-container");
    const badge = document.querySelector("[data-byn-badge]");
    expect(priceEl?.nextElementSibling).toBe(badge);

    // Simulate the page (React / a map balloon re-render) inserting a new
    // node between the price and our badge.
    const intruder = document.createElement("div");
    intruder.className = "intruder";
    priceEl?.after(intruder);
    expect(priceEl?.nextElementSibling).toBe(intruder);

    kufarAdapter.place(priceEl as Element, "≈ 45 645 $", "tooltip");

    expect(document.querySelectorAll("[data-byn-badge]").length).toBe(1);
    expect(priceEl?.nextElementSibling).toBe(badge);
  });
});

describe("idempotency", () => {
  it("running the pass twice produces no duplicate badges", () => {
    document.body.innerHTML = loadFixture("plain.html");
    runPass();
    runPass();

    expect(document.querySelectorAll("[data-byn-badge]").length).toBe(1);
  });
});

describe("removeAllBadges", () => {
  it("removes every injected badge", () => {
    document.body.innerHTML = loadFixture("plain.html");
    runPass();
    expect(document.querySelectorAll("[data-byn-badge]").length).toBe(1);

    removeAllBadges(document);
    expect(document.querySelectorAll("[data-byn-badge]").length).toBe(0);
  });
});
