import { SCHEMA_VERSION, STORAGE_KEY_RATE_CACHE, STORAGE_KEY_RATE_ERROR } from "./constants.js";
import type { RateCache, RateError } from "./types.js";

/**
 * Read-only access to the rate cache/error written by background/rateCache.ts
 * (the only place that fetches from NBRB and writes these keys). Shared here
 * so content scripts and the popup don't each carry their own copy of the
 * parse/validate logic for untrusted `chrome.storage.local` values.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRateCache(value: unknown): RateCache | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (value["schemaVersion"] !== SCHEMA_VERSION) {
    return undefined;
  }
  const rates = value["rates"];
  if (!isRecord(rates)) {
    return undefined;
  }
  const usd = rates["USD"];
  const eur = rates["EUR"];
  const nbrbDate = value["nbrbDate"];
  const fetchedAt = value["fetchedAt"];
  if (
    typeof usd !== "number" ||
    typeof eur !== "number" ||
    typeof nbrbDate !== "string" ||
    typeof fetchedAt !== "number"
  ) {
    return undefined;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    rates: { USD: usd, EUR: eur },
    nbrbDate,
    fetchedAt,
  };
}

export function parseRateError(value: unknown): RateError | undefined {
  if (!isRecord(value) || typeof value["message"] !== "string" || typeof value["at"] !== "number") {
    return undefined;
  }
  return { message: value["message"], at: value["at"] };
}

export async function readRateCache(): Promise<RateCache | undefined> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_RATE_CACHE);
  return parseRateCache(stored[STORAGE_KEY_RATE_CACHE]);
}

export async function readRateError(): Promise<RateError | undefined> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_RATE_ERROR);
  return parseRateError(stored[STORAGE_KEY_RATE_ERROR]);
}
