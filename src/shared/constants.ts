import { SITE_IDS } from "../sites/registry.js";
import type { Settings, SiteToggles } from "./types.js";

export const STORAGE_KEY_RATE_CACHE = "rateCache";
export const STORAGE_KEY_RATE_ERROR = "rateError";
export const STORAGE_KEY_SETTINGS = "settings";

export const NBRB_ENDPOINT = "https://api.nbrb.by/exrates/rates";

export const ALARM_NAME = "rate-refresh";
export const ALARM_PERIOD_MINUTES = 60;

export const NBRB_FETCH_TIMEOUT_MS = 8000;
export const NBRB_RETRY_DELAYS_MS = [500, 1500];

const ALL_SITES_ENABLED: SiteToggles = Object.fromEntries(
  SITE_IDS.map((id) => [id, true]),
) as SiteToggles;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  displayMode: "USD",
  manualRates: {},
  sites: ALL_SITES_ENABLED,
};

export const SCHEMA_VERSION = 1;
