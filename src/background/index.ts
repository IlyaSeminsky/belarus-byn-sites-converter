import { ALARM_NAME, ALARM_PERIOD_MINUTES } from "../shared/constants.js";
import type { ExtensionMessage, RefreshResult } from "../shared/types.js";
import { ensureFresh } from "./rateCache.js";

/** Storage keys used by the old single-site (kufar-only) extension, no longer read. */
const LEGACY_STORAGE_KEYS = ["usdRate", "lastUpdate"];

function startup(): void {
  void chrome.storage.local.remove(LEGACY_STORAGE_KEYS);
  void ensureFresh();
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
}

chrome.runtime.onInstalled.addListener(startup);
chrome.runtime.onStartup.addListener(startup);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    // No-ops internally when the cache is already fresh for today.
    void ensureFresh();
  }
});

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return type === "ENSURE_FRESH" || type === "REFRESH_RATES";
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isExtensionMessage(message)) {
    return false;
  }

  const respond = (result: RefreshResult): void => sendResponse(result);

  if (message.type === "ENSURE_FRESH") {
    ensureFresh()
      .then(() => respond({ ok: true }))
      .catch((error: unknown) => respond({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "REFRESH_RATES") {
    ensureFresh({ force: true })
      .then(() => respond({ ok: true }))
      .catch((error: unknown) => respond({ ok: false, error: String(error) }));
    return true;
  }

  return false;
});
