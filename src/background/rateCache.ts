import { minskDateKey } from "../shared/clock.js";
import { SCHEMA_VERSION, STORAGE_KEY_RATE_CACHE, STORAGE_KEY_RATE_ERROR } from "../shared/constants.js";
import { readRateCache, readRateError } from "../shared/rateStore.js";
import type { RateCache, RateError } from "../shared/types.js";
import { fetchNbrbRates } from "./nbrb.js";

export const readCache = readRateCache;
export const readLastError = readRateError;

async function writeCache(cache: RateCache): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_RATE_CACHE]: cache });
}

async function writeError(error: RateError): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_RATE_ERROR]: error });
}

async function clearError(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY_RATE_ERROR);
}

/** A cache is stale if it's missing, has a schema mismatch, or isn't for today's Minsk date. */
export function isStale(cache: RateCache | undefined, now: Date = new Date()): boolean {
  return !cache || cache.nbrbDate !== minskDateKey(now);
}

// Module-level single-flight promise: concurrent callers (e.g. several tabs
// loading at once) collapse into one in-flight fetch. The promise always
// resolves (never rejects) so every collapsed caller gets a consistent
// result: the fresh cache on success, or the pre-refresh cache on failure.
let inFlight: Promise<RateCache | undefined> | undefined;

export interface EnsureFreshOptions {
  force?: boolean;
  now?: Date;
}

/**
 * Ensure the rate cache is fresh (or forcibly refetch). On failure, the
 * existing cache is preserved (stale rates beat no rates) and the error is
 * recorded separately so the popup can surface it without invalidating rates.
 */
export async function ensureFresh(options: EnsureFreshOptions = {}): Promise<RateCache | undefined> {
  const now = options.now ?? new Date();
  const existing = await readCache();

  if (!options.force && !isStale(existing, now)) {
    return existing;
  }

  if (inFlight) {
    return inFlight;
  }

  const task = (async (): Promise<RateCache | undefined> => {
    try {
      const { rates, nbrbDate } = await fetchNbrbRates(now);
      const cache: RateCache = {
        schemaVersion: SCHEMA_VERSION,
        rates,
        nbrbDate,
        fetchedAt: Date.now(),
      };
      await writeCache(cache);
      await clearError();
      return cache;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await writeError({ message, at: Date.now() });
      // Keep whatever was cached before; the caller can inspect the error
      // separately via readLastError().
      return existing;
    }
  })();

  inFlight = task;
  try {
    return await task;
  } finally {
    inFlight = undefined;
  }
}
