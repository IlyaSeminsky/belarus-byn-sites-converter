import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNbrbRates } from "../src/background/nbrb.js";

function payload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    Cur_ID: 431,
    Date: "2026-08-31T00:00:00",
    Cur_Abbreviation: "USD",
    Cur_Scale: 1,
    Cur_Name: "Доллар США",
    Cur_OfficialRate: 3.0396,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchNbrbRates", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches USD and EUR and computes effective rates", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/USD")) {
        return Promise.resolve(jsonResponse(payload()));
      }
      return Promise.resolve(
        jsonResponse(
          payload({ Cur_ID: 451, Cur_Abbreviation: "EUR", Cur_OfficialRate: 3.5383 }),
        ),
      );
    });

    const result = await fetchNbrbRates();
    expect(result.rates.USD).toBeCloseTo(3.0396, 6);
    expect(result.rates.EUR).toBeCloseTo(3.5383, 6);
    expect(result.nbrbDate).toBe("2026-08-31");
  });

  it("divides by Cur_Scale when it is not 1", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/USD")) {
        return Promise.resolve(
          jsonResponse(payload({ Cur_Scale: 1000, Cur_OfficialRate: 3039.6 })),
        );
      }
      return Promise.resolve(
        jsonResponse(payload({ Cur_ID: 451, Cur_Abbreviation: "EUR", Cur_OfficialRate: 3.5383 })),
      );
    });

    const result = await fetchNbrbRates();
    expect(result.rates.USD).toBeCloseTo(3.0396, 6);
  });

  it("rejects a negative official rate", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/USD")) {
        return Promise.resolve(jsonResponse(payload({ Cur_OfficialRate: -1 })));
      }
      return Promise.resolve(
        jsonResponse(payload({ Cur_ID: 451, Cur_Abbreviation: "EUR" })),
      );
    });

    await expect(fetchNbrbRates()).rejects.toThrow();
  });

  it("rejects a mismatched currency abbreviation", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/USD")) {
        return Promise.resolve(jsonResponse(payload({ Cur_Abbreviation: "EUR" })));
      }
      return Promise.resolve(
        jsonResponse(payload({ Cur_ID: 451, Cur_Abbreviation: "EUR" })),
      );
    });

    await expect(fetchNbrbRates()).rejects.toThrow();
  });

  it("rejects malformed JSON", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/USD")) {
        return Promise.resolve(
          new Response("not json", { status: 200, headers: { "content-type": "text/plain" } }),
        );
      }
      return Promise.resolve(
        jsonResponse(payload({ Cur_ID: 451, Cur_Abbreviation: "EUR" })),
      );
    });

    await expect(fetchNbrbRates()).rejects.toThrow();
  });

  it("retries on a 500 then succeeds", async () => {
    let usdCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/USD")) {
        usdCalls++;
        if (usdCalls === 1) {
          return Promise.resolve(new Response("server error", { status: 500 }));
        }
        return Promise.resolve(jsonResponse(payload()));
      }
      return Promise.resolve(
        jsonResponse(payload({ Cur_ID: 451, Cur_Abbreviation: "EUR" })),
      );
    });

    const result = await fetchNbrbRates();
    expect(usdCalls).toBe(2);
    expect(result.rates.USD).toBeCloseTo(3.0396, 6);
  }, 10000);

  it("does not retry a 404", async () => {
    let usdCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/USD")) {
        usdCalls++;
        return Promise.resolve(new Response("not found", { status: 404 }));
      }
      return Promise.resolve(
        jsonResponse(payload({ Cur_ID: 451, Cur_Abbreviation: "EUR" })),
      );
    });

    await expect(fetchNbrbRates()).rejects.toThrow();
    expect(usdCalls).toBe(1);
  });

  it("treats a fetch rejection (timeout/abort) as transient and retries", async () => {
    let usdCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/USD")) {
        usdCalls++;
        if (usdCalls === 1) {
          return Promise.reject(new DOMException("The operation timed out.", "TimeoutError"));
        }
        return Promise.resolve(jsonResponse(payload()));
      }
      return Promise.resolve(
        jsonResponse(payload({ Cur_ID: 451, Cur_Abbreviation: "EUR" })),
      );
    });

    const result = await fetchNbrbRates();
    expect(usdCalls).toBe(2);
    expect(result.rates.USD).toBeCloseTo(3.0396, 6);
  }, 10000);
});
