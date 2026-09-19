import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { avbyAdapter } from "../../src/sites/avby.js";
import { removeAllBadges } from "../../src/content/inject.js";
import { formatBadge } from "../../src/shared/money.js";
import type { Rates } from "../../src/shared/types.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/avby");

function loadFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

const rates: Rates = { USD: 3.0396, EUR: 3.5383 };

function runPass(): void {
  const hits = avbyAdapter.scan(document);
  for (const hit of hits) {
    const text = formatBadge(hit.byn, rates, "USD");
    avbyAdapter.place(hit.anchor, text, "NBRB 3.0396 · 31.08.2026");
  }
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("avby adapter on detail page markup", () => {
  it("places the badge immediately after .card__price-button", () => {
    document.body.innerHTML = loadFixture("detail.html");
    runPass();

    const button = document.querySelector(".card__price-button");
    expect(button).not.toBeNull();
    const badge = button?.nextElementSibling;
    expect(badge).not.toBeNull();
    expect(badge?.hasAttribute("data-byn-badge")).toBe(true);
    expect(badge?.textContent).toContain("$");
  });
});

describe("avby adapter on listing markup", () => {
  it("places a badge after each listing price element", () => {
    document.body.innerHTML = loadFixture("listing.html");
    runPass();

    const priceEls = document.querySelectorAll(
      ".listing-top__price-primary, .listing-item__price-primary",
    );
    expect(priceEls.length).toBe(3);
    for (const el of priceEls) {
      const badge = el.nextElementSibling;
      expect(badge).not.toBeNull();
      expect(badge?.hasAttribute("data-byn-badge")).toBe(true);
    }
  });
});

describe("avby adapter skips already-converted markup", () => {
  it("does not touch .featured__price-value or a converted price-primary element", () => {
    document.body.innerHTML = loadFixture("already-converted.html");
    runPass();

    const badges = document.querySelectorAll("[data-byn-badge]");
    expect(badges.length).toBe(0);
  });
});

describe("idempotency", () => {
  it("running the pass twice produces no duplicate badges", () => {
    document.body.innerHTML = loadFixture("listing.html");
    runPass();
    runPass();

    const badges = document.querySelectorAll("[data-byn-badge]");
    expect(badges.length).toBe(3);
  });

  it("re-creates a badge after it is deleted and the page is rescanned", () => {
    document.body.innerHTML = loadFixture("detail.html");
    runPass();

    const firstBadge = document.querySelector("[data-byn-badge]");
    expect(firstBadge).not.toBeNull();
    firstBadge?.remove();
    expect(document.querySelectorAll("[data-byn-badge]").length).toBe(0);

    runPass();
    expect(document.querySelectorAll("[data-byn-badge]").length).toBe(1);
  });
});

describe("removeAllBadges", () => {
  it("removes every injected badge", () => {
    document.body.innerHTML = loadFixture("listing.html");
    runPass();
    expect(document.querySelectorAll("[data-byn-badge]").length).toBe(3);

    removeAllBadges(document);
    expect(document.querySelectorAll("[data-byn-badge]").length).toBe(0);
  });
});

describe("avby adapter on dealer-salon top card markup", () => {
  it("nests the badge inside .salon-listing-top__prices", () => {
    document.body.innerHTML = loadFixture("salon-top.html");
    runPass();

    const prices = document.querySelector(".salon-listing-top__prices");
    expect(prices).not.toBeNull();
    const badge = prices?.lastElementChild;
    expect(badge?.hasAttribute("data-byn-badge")).toBe(true);
    // 74 184 BYN / 3.0396 ≈ 24 406 $ (Intl groups with a non-breaking space)
    expect(badge?.textContent?.replace(/\s/g, "")).toBe("≈24406$");
    expect(prices?.nextElementSibling).toBeNull();
  });

  it("keeps the nested badge up to date across passes", () => {
    document.body.innerHTML = loadFixture("salon-top.html");
    runPass();

    const hits = avbyAdapter.scan(document);
    expect(hits.length).toBe(1);
    for (const hit of hits) {
      avbyAdapter.place(hit.anchor, formatBadge(hit.byn, rates, "EUR"), "tooltip");
    }

    const badges = document.querySelectorAll("[data-byn-badge]");
    expect(badges.length).toBe(1);
    expect(badges[0]?.textContent).toContain("€");
  });
});
