import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Rates } from "../src/shared/types.js";

const fetchNbrbRatesMock = vi.fn<(now?: Date) => Promise<{ rates: Rates; nbrbDate: string }>>();

vi.mock("../src/background/nbrb.js", () => ({
  fetchNbrbRates: (now?: Date) => fetchNbrbRatesMock(now),
}));

interface FakeStorageArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

function createFakeStorageArea(): FakeStorageArea {
  const data = new Map<string, unknown>();
  return {
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of list) {
        if (data.has(key)) {
          result[key] = data.get(key);
        }
      }
      return result;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) {
        data.delete(key);
      }
    },
  };
}

function installFakeChrome(): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: createFakeStorageArea(),
    },
  });
}

describe("rateCache", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchNbrbRatesMock.mockReset();
    installFakeChrome();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isStale is true with no cache and false for today's Minsk date", async () => {
    const { isStale } = await import("../src/background/rateCache.js");
    const now = new Date("2026-08-31T10:00:00Z");
    expect(isStale(undefined, now)).toBe(true);
    expect(
      isStale({ schemaVersion: 1, rates: { USD: 3, EUR: 3.5 }, nbrbDate: "2026-08-31", fetchedAt: 0 }, now),
    ).toBe(false);
  });

  it("isStale flips across the Minsk midnight boundary", async () => {
    const { isStale } = await import("../src/background/rateCache.js");
    const cache = { schemaVersion: 1 as const, rates: { USD: 3, EUR: 3.5 }, nbrbDate: "2026-08-31", fetchedAt: 0 };

    // 23:59 Minsk (UTC+3) on Aug 31 -> still Aug 31 in Minsk.
    expect(isStale(cache, new Date("2026-08-31T20:59:00Z"))).toBe(false);
    // 00:01 Minsk on Sep 1 -> now Sep 1 in Minsk, cache is stale.
    expect(isStale(cache, new Date("2026-08-31T21:01:00Z"))).toBe(true);
  });

  it("ensureFresh fetches and caches when stale", async () => {
    fetchNbrbRatesMock.mockResolvedValue({
      rates: { USD: 3.0396, EUR: 3.5383 },
      nbrbDate: "2026-08-31",
    });
    const { ensureFresh, readCache } = await import("../src/background/rateCache.js");

    const now = new Date("2026-08-31T10:00:00Z");
    const result = await ensureFresh({ now });

    expect(result?.rates.USD).toBeCloseTo(3.0396, 6);
    expect(fetchNbrbRatesMock).toHaveBeenCalledTimes(1);

    const stored = await readCache();
    expect(stored?.nbrbDate).toBe("2026-08-31");
  });

  it("a failed refresh preserves the existing cache and records the error", async () => {
    const { ensureFresh, readCache, readLastError } = await import("../src/background/rateCache.js");

    fetchNbrbRatesMock.mockResolvedValueOnce({
      rates: { USD: 3.0396, EUR: 3.5383 },
      nbrbDate: "2026-08-31",
    });
    const now = new Date("2026-08-31T10:00:00Z");
    await ensureFresh({ now });

    fetchNbrbRatesMock.mockRejectedValueOnce(new Error("network down"));
    const tomorrow = new Date("2026-09-01T10:00:00Z");
    const result = await ensureFresh({ now: tomorrow });

    // Existing (now stale) cache is preserved rather than wiped out.
    expect(result?.nbrbDate).toBe("2026-08-31");
    const stored = await readCache();
    expect(stored?.nbrbDate).toBe("2026-08-31");

    const error = await readLastError();
    expect(error?.message).toContain("network down");
  });

  it("discards the cache on a schema-version mismatch and refetches", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: (() => {
          const area = createFakeStorageArea();
          void area.set({
            rateCache: {
              schemaVersion: 0,
              rates: { USD: 1, EUR: 1 },
              nbrbDate: "2026-08-31",
              fetchedAt: 0,
            },
          });
          return area;
        })(),
      },
    });

    fetchNbrbRatesMock.mockResolvedValue({
      rates: { USD: 3.0396, EUR: 3.5383 },
      nbrbDate: "2026-08-31",
    });

    const { ensureFresh } = await import("../src/background/rateCache.js");
    const now = new Date("2026-08-31T10:00:00Z");
    const result = await ensureFresh({ now });

    expect(fetchNbrbRatesMock).toHaveBeenCalledTimes(1);
    expect(result?.rates.USD).toBeCloseTo(3.0396, 6);
  });

  it("single-flight collapses concurrent ensureFresh calls into one fetch", async () => {
    let resolveFetch: ((value: { rates: Rates; nbrbDate: string }) => void) | undefined;
    fetchNbrbRatesMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { ensureFresh } = await import("../src/background/rateCache.js");
    const now = new Date("2026-08-31T10:00:00Z");

    const call1 = ensureFresh({ now });
    const call2 = ensureFresh({ now });

    // Let both calls advance past their initial `readCache()` await so the
    // single-flight `inFlight` promise is installed before we resolve it.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    resolveFetch?.({ rates: { USD: 3.0396, EUR: 3.5383 }, nbrbDate: "2026-08-31" });

    const [result1, result2] = await Promise.all([call1, call2]);
    expect(result1?.rates.USD).toBeCloseTo(3.0396, 6);
    expect(result2?.rates.USD).toBeCloseTo(3.0396, 6);
    expect(fetchNbrbRatesMock).toHaveBeenCalledTimes(1);
  });
});
