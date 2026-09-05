import {
  NBRB_ENDPOINT,
  NBRB_FETCH_TIMEOUT_MS,
  NBRB_RETRY_DELAYS_MS,
} from "../shared/constants.js";
import { minskDateKey } from "../shared/clock.js";
import type { Currency, Rates } from "../shared/types.js";

interface NbrbPayload {
  Cur_ID: number;
  Date: string;
  Cur_Abbreviation: string;
  Cur_Scale: number;
  Cur_Name: string;
  Cur_OfficialRate: number;
}

export interface NbrbFetchResult {
  rates: Rates;
  nbrbDate: string;
}

/** Thrown for a 4xx response — never retried. */
export class NbrbClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "NbrbClientError";
  }
}

/** Thrown for network errors, timeouts, and 5xx — retried by the caller. */
export class NbrbTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NbrbTransientError";
  }
}

/** Thrown when a 2xx payload fails shape/value validation — never retried. */
export class NbrbValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NbrbValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validatePayload(value: unknown, expected: Currency): NbrbPayload {
  if (!isRecord(value)) {
    throw new NbrbValidationError("NBRB payload is not an object");
  }

  const abbreviation = value["Cur_Abbreviation"];
  if (typeof abbreviation !== "string" || abbreviation !== expected) {
    throw new NbrbValidationError(
      `expected Cur_Abbreviation "${expected}", got ${JSON.stringify(abbreviation)}`,
    );
  }

  const officialRate = value["Cur_OfficialRate"];
  if (typeof officialRate !== "number" || !Number.isFinite(officialRate) || officialRate <= 0) {
    throw new NbrbValidationError(`invalid Cur_OfficialRate: ${JSON.stringify(officialRate)}`);
  }

  const scale = value["Cur_Scale"];
  if (typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0) {
    throw new NbrbValidationError(`invalid Cur_Scale: ${JSON.stringify(scale)}`);
  }

  const date = value["Date"];
  if (typeof date !== "string" || Number.isNaN(Date.parse(date))) {
    throw new NbrbValidationError(`invalid Date: ${JSON.stringify(date)}`);
  }

  return {
    Cur_ID: 0,
    Date: date,
    Cur_Abbreviation: abbreviation,
    Cur_Scale: scale,
    Cur_Name: "",
    Cur_OfficialRate: officialRate,
  };
}

async function fetchOnce(currency: Currency): Promise<NbrbPayload> {
  const url = `${NBRB_ENDPOINT}/${currency}?parammode=2`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(NBRB_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    // Network failure or timeout (AbortSignal.timeout aborts -> DOMException "TimeoutError"
    // or "AbortError" depending on runtime) — both are transient, always retryable.
    const message = error instanceof Error ? error.message : String(error);
    throw new NbrbTransientError(`fetch failed for ${currency}: ${message}`);
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new NbrbClientError(response.status, `NBRB returned ${response.status} for ${currency}`);
    }
    throw new NbrbTransientError(`NBRB returned ${response.status} for ${currency}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NbrbValidationError(`malformed JSON for ${currency}: ${message}`);
  }

  return validatePayload(json, currency);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(currency: Currency): Promise<NbrbPayload> {
  let lastError: unknown;
  const attempts = NBRB_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchOnce(currency);
    } catch (error) {
      lastError = error;
      // Client (4xx) and validation errors are not retried.
      if (error instanceof NbrbClientError || error instanceof NbrbValidationError) {
        throw error;
      }
      const waitMs = NBRB_RETRY_DELAYS_MS[attempt];
      if (waitMs !== undefined) {
        await delay(waitMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new NbrbTransientError(String(lastError));
}

/**
 * Fetch USD and EUR official rates from NBRB in parallel, with retry on
 * transient failures. Rejects the whole refresh (never writes a half-valid
 * cache) if either currency ultimately fails.
 */
export async function fetchNbrbRates(now: Date = new Date()): Promise<NbrbFetchResult> {
  const [usd, eur] = await Promise.all([fetchWithRetry("USD"), fetchWithRetry("EUR")]);

  const rates: Rates = {
    USD: usd.Cur_OfficialRate / usd.Cur_Scale,
    EUR: eur.Cur_OfficialRate / eur.Cur_Scale,
  };

  // Both payloads should carry the same official date; prefer USD's, falling
  // back to the caller's clock (Minsk) if parsing ever surprises us.
  const nbrbDate = Number.isNaN(Date.parse(usd.Date)) ? minskDateKey(now) : usd.Date.slice(0, 10);

  return { rates, nbrbDate };
}
