import { minskDateKey } from "../shared/clock.js";
import { STORAGE_KEY_RATE_CACHE, STORAGE_KEY_RATE_ERROR, STORAGE_KEY_SETTINGS } from "../shared/constants.js";
import { readRateCache, readRateError } from "../shared/rateStore.js";
import { isValidManualRate, loadSettings, saveSettings } from "../shared/settings.js";
import { SITES, SITE_IDS } from "../sites/registry.js";
import type { Currency, DisplayMode, RateCache, RateError, Settings } from "../shared/types.js";

function formatDisplayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  if (y === undefined || m === undefined || d === undefined) {
    return dateKey;
  }
  return `${d}.${m}.${y}`;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`missing #${id} in popup.html`);
  }
  return el as T;
}

const enabledToggle = byId<HTMLInputElement>("enabled-toggle");
const statusEl = byId<HTMLElement>("status");
const refreshButton = byId<HTMLButtonElement>("refresh-button");
const manualError = byId<HTMLElement>("manual-error");
const sitesList = byId<HTMLElement>("sites-list");

const nbrbEls: Record<Currency, HTMLElement> = {
  USD: byId("nbrb-USD"),
  EUR: byId("nbrb-EUR"),
};
const manualInputs: Record<Currency, HTMLInputElement> = {
  USD: byId("manual-USD"),
  EUR: byId("manual-EUR"),
};
const clearButtons: Record<Currency, HTMLButtonElement> = {
  USD: byId("clear-USD"),
  EUR: byId("clear-EUR"),
};
const modeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".segmented__option"),
);

let currentSettings: Settings | undefined;
let currentCache: RateCache | undefined;

/** Drives both the status text and the coloured state dot (see `.status[data-state]`). */
function renderStatus(cache: RateCache | undefined, error: RateError | undefined): void {
  if (error) {
    statusEl.dataset["state"] = "error";
    statusEl.textContent = `Не удалось обновить курс: ${error.message}`;
    return;
  }

  if (!cache) {
    statusEl.dataset["state"] = "pending";
    statusEl.textContent = "Курсов пока нет — запрашиваем…";
    return;
  }

  const isToday = cache.nbrbDate === minskDateKey();
  statusEl.dataset["state"] = isToday ? "fresh" : "stale";
  statusEl.textContent = isToday
    ? `Актуально · ${formatDisplayDate(cache.nbrbDate)}`
    : `Устарело · последний курс ${formatDisplayDate(cache.nbrbDate)}`;
}

function renderRates(cache: RateCache | undefined, settings: Settings): void {
  for (const currency of ["USD", "EUR"] as const) {
    const nbrbEl = nbrbEls[currency];
    nbrbEl.textContent = cache ? cache.rates[currency].toFixed(4) : "—";

    const manual = settings.manualRates[currency];
    const input = manualInputs[currency];
    if (document.activeElement !== input) {
      input.value = manual !== undefined ? String(manual) : "";
    }
    input.placeholder = cache ? cache.rates[currency].toFixed(4) : "вручную";
  }
}

function renderMode(settings: Settings): void {
  for (const button of modeButtons) {
    const mode = button.dataset["mode"] as DisplayMode | undefined;
    button.setAttribute("aria-checked", String(mode === settings.displayMode));
  }
}

function renderEnabled(settings: Settings): void {
  enabledToggle.checked = settings.enabled;
}

/** Build one checkbox row per registered site. New sites need no changes here. */
function renderSites(settings: Settings): void {
  sitesList.replaceChildren(
    ...SITE_IDS.map((id) => {
      const row = document.createElement("label");
      row.className = "site";

      const label = document.createElement("span");
      label.className = "site__label";
      label.textContent = SITES[id].label;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "site__checkbox";
      checkbox.checked = settings.sites[id];
      checkbox.addEventListener("change", () => {
        void updateSettings({ sites: { ...currentSettings?.sites, [id]: checkbox.checked } as Settings["sites"] });
      });

      row.append(label, checkbox);
      return row;
    }),
  );
}

async function renderAll(): Promise<void> {
  const [settings, cache, error] = await Promise.all([
    loadSettings(),
    readRateCache(),
    readRateError(),
  ]);
  currentSettings = settings;
  currentCache = cache;
  renderStatus(cache, error);
  renderRates(cache, settings);
  renderMode(settings);
  renderEnabled(settings);
  renderSites(settings);
}

async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const base = currentSettings ?? (await loadSettings());
  const next: Settings = { ...base, ...patch };
  currentSettings = next;
  await saveSettings(next);
}

enabledToggle.addEventListener("change", () => {
  void updateSettings({ enabled: enabledToggle.checked });
});

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    const mode = button.dataset["mode"] as DisplayMode | undefined;
    if (mode) {
      void updateSettings({ displayMode: mode });
    }
  });
}

function showManualError(message: string): void {
  manualError.textContent = message;
  manualError.hidden = false;
}

function hideManualError(): void {
  manualError.hidden = true;
  manualError.textContent = "";
}

for (const currency of ["USD", "EUR"] as const) {
  manualInputs[currency].addEventListener("change", () => {
    const raw = manualInputs[currency].value.trim();
    const base = currentSettings;
    if (!base) {
      return;
    }

    if (raw === "") {
      const manualRates = { ...base.manualRates };
      delete manualRates[currency];
      void updateSettings({ manualRates });
      hideManualError();
      return;
    }

    const value = Number(raw);
    if (!isValidManualRate(value)) {
      showManualError(`Введите курс от 0 до 100 для ${currency}.`);
      manualInputs[currency].value = base.manualRates[currency]?.toString() ?? "";
      return;
    }

    hideManualError();
    const manualRates = { ...base.manualRates, [currency]: value };
    void updateSettings({ manualRates });
  });

  clearButtons[currency].addEventListener("click", () => {
    const base = currentSettings;
    if (!base) {
      return;
    }
    manualInputs[currency].value = "";
    hideManualError();
    const manualRates = { ...base.manualRates };
    delete manualRates[currency];
    void updateSettings({ manualRates });
  });
}

refreshButton.addEventListener("click", () => {
  refreshButton.disabled = true;
  refreshButton.textContent = "Обновляем…";
  chrome.runtime.sendMessage({ type: "REFRESH_RATES", force: true }, () => {
    void chrome.runtime.lastError;
    refreshButton.disabled = false;
    refreshButton.textContent = "Обновить курсы";
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    (areaName === "local" &&
      (STORAGE_KEY_RATE_CACHE in changes || STORAGE_KEY_RATE_ERROR in changes)) ||
    (areaName === "sync" && STORAGE_KEY_SETTINGS in changes)
  ) {
    void renderAll();
  }
});

void renderAll();
