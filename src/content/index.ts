import { ADAPTERS } from "../sites/adapters.js";
import { siteIdForHostname } from "../sites/registry.js";
import { minskDateKey } from "../shared/clock.js";
import { STORAGE_KEY_RATE_CACHE, STORAGE_KEY_SETTINGS } from "../shared/constants.js";
import { formatBadge } from "../shared/money.js";
import { readRateCache } from "../shared/rateStore.js";
import { sanitizeSettings } from "../shared/settings.js";
import type { Currency, DisplayMode, ManualRates, RateCache, Settings } from "../shared/types.js";
import { removeAllBadges } from "./inject.js";
import type { SiteAdapter } from "../sites/types.js";

const siteId = siteIdForHostname(location.hostname);
const adapter: SiteAdapter | undefined = siteId ? ADAPTERS[siteId] : undefined;

async function readSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY_SETTINGS);
  return sanitizeSettings(stored[STORAGE_KEY_SETTINGS]);
}

function isCacheStale(cache: RateCache): boolean {
  return cache.nbrbDate !== minskDateKey();
}

function formatDisplayDate(dateKey: string): string {
  const parts = dateKey.split("-");
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) {
    return dateKey;
  }
  return `${d}.${m}.${y}`;
}

function sourceLabel(currency: Currency, cache: RateCache, manualRates: ManualRates): string {
  const manual = manualRates[currency];
  if (manual !== undefined) {
    return `Ручной курс ${manual.toFixed(4)}`;
  }
  return `НБРБ ${cache.rates[currency].toFixed(4)} · ${formatDisplayDate(cache.nbrbDate)}`;
}

function buildTooltip(mode: DisplayMode, cache: RateCache, manualRates: ManualRates): string {
  if (mode === "USD") {
    return sourceLabel("USD", cache, manualRates);
  }
  if (mode === "EUR") {
    return sourceLabel("EUR", cache, manualRates);
  }
  return `${sourceLabel("USD", cache, manualRates)} · ${sourceLabel("EUR", cache, manualRates)}`;
}

function effectiveRates(cache: RateCache, manualRates: ManualRates): { USD: number; EUR: number } {
  return {
    USD: manualRates.USD ?? cache.rates.USD,
    EUR: manualRates.EUR ?? cache.rates.EUR,
  };
}

function requestBackgroundRefresh(): void {
  chrome.runtime.sendMessage({ type: "ENSURE_FRESH" }, () => {
    // Swallow "no receiving end" / other errors — best-effort only. Reading
    // chrome.runtime.lastError prevents an unchecked-error console warning.
    void chrome.runtime.lastError;
  });
}

let observer: MutationObserver | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function runInjectionPass(site: SiteAdapter, settings: Settings, cache: RateCache): void {
  const rates = effectiveRates(cache, settings.manualRates);
  const tooltip = buildTooltip(settings.displayMode, cache, settings.manualRates);

  observer?.disconnect();
  try {
    const hits = site.scan(document);
    for (const hit of hits) {
      const text = formatBadge(hit.byn, rates, settings.displayMode);
      site.place(hit.anchor, text, tooltip);
    }
  } finally {
    observer?.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }
}

async function renderAll(site: SiteAdapter): Promise<void> {
  const settings = await readSettings();

  if (!settings.enabled || !settings.sites[site.id]) {
    observer?.disconnect();
    observer = undefined;
    removeAllBadges(document);
    return;
  }

  const cache = await readRateCache();
  if (!cache) {
    requestBackgroundRefresh();
    ensureObserving(site);
    return;
  }

  if (isCacheStale(cache)) {
    requestBackgroundRefresh();
  }

  ensureObserving(site);
  runInjectionPass(site, settings, cache);
}

function scheduleRender(site: SiteAdapter): void {
  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    requestAnimationFrame(() => {
      void renderAll(site);
    });
  }, site.debounceMs);
}

function ensureObserving(site: SiteAdapter): void {
  if (observer) {
    return;
  }
  observer = new MutationObserver((mutations) => {
    const relevant = site.isRelevantMutation
      ? mutations.some((mutation) => site.isRelevantMutation!(mutation))
      : true;
    if (relevant) {
      scheduleRender(site);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });
}

function main(): void {
  if (!adapter) {
    // Loaded on a host we don't recognise (shouldn't happen given manifest
    // matches, but keeps this script inert rather than throwing).
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && STORAGE_KEY_RATE_CACHE in changes) {
      void renderAll(adapter);
      return;
    }
    if (areaName === "sync" && STORAGE_KEY_SETTINGS in changes) {
      void renderAll(adapter);
    }
  });

  void renderAll(adapter);
}

main();
