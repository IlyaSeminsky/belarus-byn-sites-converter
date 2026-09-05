import { SITE_IDS } from "../sites/registry.js";
import { DEFAULT_SETTINGS, STORAGE_KEY_SETTINGS } from "./constants.js";
import type { Currency, DisplayMode, ManualRates, Settings, SiteToggles } from "./types.js";

const DISPLAY_MODES: readonly DisplayMode[] = ["USD", "EUR", "USD_EUR"];
const CURRENCIES: readonly Currency[] = ["USD", "EUR"];

const MAX_MANUAL_RATE = 100;

/** Is `value` a finite, positive number that is safe to use as a manual rate? */
export function isValidManualRate(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_MANUAL_RATE;
}

function sanitizeManualRates(value: unknown): ManualRates {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const result: ManualRates = {};
  for (const currency of CURRENCIES) {
    const raw = (value as Record<string, unknown>)[currency];
    if (typeof raw === "number" && isValidManualRate(raw)) {
      result[currency] = raw;
    }
  }
  return result;
}

function sanitizeDisplayMode(value: unknown): DisplayMode {
  return typeof value === "string" && (DISPLAY_MODES as readonly string[]).includes(value)
    ? (value as DisplayMode)
    : DEFAULT_SETTINGS.displayMode;
}

/**
 * Merge a possibly-partial/untrusted stored value with the site registry:
 * a known site id keeps its stored boolean, a missing or unrecognised one
 * (new site added since this value was saved, or corrupted storage)
 * defaults to enabled.
 */
function sanitizeSites(value: unknown): SiteToggles {
  const stored = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const result = {} as SiteToggles;
  for (const id of SITE_IDS) {
    const raw = stored[id];
    result[id] = typeof raw === "boolean" ? raw : true;
  }
  return result;
}

/** Merge a possibly-partial/untrusted stored value with defaults, dropping invalid fields. */
export function sanitizeSettings(value: unknown): Settings {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_SETTINGS, manualRates: {}, sites: sanitizeSites(undefined) };
  }
  const partial = value as Record<string, unknown>;
  return {
    enabled: typeof partial["enabled"] === "boolean" ? partial["enabled"] : DEFAULT_SETTINGS.enabled,
    displayMode: sanitizeDisplayMode(partial["displayMode"]),
    manualRates: sanitizeManualRates(partial["manualRates"]),
    sites: sanitizeSites(partial["sites"]),
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY_SETTINGS);
  return sanitizeSettings(stored[STORAGE_KEY_SETTINGS]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY_SETTINGS]: settings });
}
