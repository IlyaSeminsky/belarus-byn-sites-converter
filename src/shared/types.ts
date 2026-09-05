import type { SiteId } from "../sites/registry.js";

export type Currency = "USD" | "EUR";

export type DisplayMode = "USD" | "EUR" | "USD_EUR";

/** Effective NBRB rates: BYN per 1 unit of currency (Cur_OfficialRate / Cur_Scale). */
export interface Rates {
  USD: number;
  EUR: number;
}

export interface RateCache {
  schemaVersion: 1;
  rates: Rates;
  /** Date (Europe/Minsk, YYYY-MM-DD) the rate is official for. */
  nbrbDate: string;
  /** Epoch ms when this cache entry was fetched. */
  fetchedAt: number;
}

export interface RateError {
  message: string;
  at: number;
}

export type ManualRates = Partial<Record<Currency, number>>;

export type SiteToggles = Record<SiteId, boolean>;

export interface Settings {
  enabled: boolean;
  displayMode: DisplayMode;
  manualRates: ManualRates;
  sites: SiteToggles;
}

export interface EnsureFreshMessage {
  type: "ENSURE_FRESH";
}

export interface RefreshRatesMessage {
  type: "REFRESH_RATES";
  force: true;
}

export type ExtensionMessage = EnsureFreshMessage | RefreshRatesMessage;

export interface RefreshResult {
  ok: boolean;
  error?: string;
}
