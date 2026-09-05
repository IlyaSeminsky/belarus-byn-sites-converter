---
name: byn-price-converter
description: Context for the BYN Price Converter browser extension (Chrome MV3) that shows an informational USD/EUR equivalent under BYN prices on kufar.by and av.by. Use when working on this repo — manifest, site adapters, background service worker, popup, NBRB rate handling, or questions about what the extension does and why it is lawful.
---

# BYN Price Converter

Chrome MV3 extension. Adds a read-only USD/EUR estimate under the BYN prices
shown on `kufar.by` / `re.kufar.by` and `av.by`, in the user's own browser.

## Why it exists

In Belarus prices must be quoted and settled in BYN, so both sites show only
BYN. Sellers and buyers still think in USD/EUR, so buyers mentally
re-convert every listing. The extension does that arithmetic for them.

## Legality — non-negotiable design constraints

The extension is a personal viewing aid, not a pricing tool. Keep it that way:

- **BYN stays primary.** Never replace, hide, or overwrite the BYN price. USD/EUR is added as a separate, visually secondary line.
- **Informational only.** Label the converted figure as an approximation; it is never a price, an offer, or a settlement amount.
- **Official rate only.** Use the National Bank of the Republic of Belarus rate (`api.nbrb.by/exrates/rates/...`). No commercial, market, or user-invented rates — a user-entered "manual rate" override in the popup is an explicit, visible substitution the user makes themselves, not a hidden default.
- **Client-side only.** All rendering happens locally. No user data, browsing history, or listing data leaves the browser. No analytics, no third-party servers.
- **No interference with the sites.** No scraping pipelines, no bulk requests, no bypassing auth, paywalls, or rate limits, no altering listings or outbound requests. Only DOM read + local DOM annotation on pages the user already opened.

Reject changes that break any of the above.

## Architecture

One thing is shared for every site (the rate fetcher and the settings
store); one thing is different per site (how prices are found and how a
badge is attached). Adding a third site should never require touching the
shared parts.

| File | Role |
|---|---|
| `src/sites/sites.json` | Single source of truth for site ids, labels, and MV3 host match patterns. Read by `build.mjs` (generates the manifest's `host_permissions` / `content_scripts.matches`) and by `src/sites/registry.ts` (runtime + popup). |
| `src/sites/registry.ts` | Pure data: `SiteId`, `SITES`, `SITE_IDS`, hostname → site resolution. Safe to import from background/popup/content. |
| `src/sites/adapters.ts` | `Record<SiteId, SiteAdapter>` — the only place a new site is wired in besides `sites.json`. Imported only by the content script (keeps DOM-touching code out of the background/popup bundles). |
| `src/sites/<site>.ts` | One adapter per site: `scan(root)` finds eligible BYN price elements and resolves each one's badge anchor; `place` is one of the two strategies in `content/inject.ts`; optional `isRelevantMutation` + `debounceMs` tune the mutation observer. |
| `src/content/inject.ts` | Badge creation + the two placement strategies (`placeAfterAnchor`, `placeAmongSiblings`) + `removeAllBadges`. |
| `src/content/index.ts` | Site-agnostic runner: resolves the adapter for the current hostname, reads settings/cache, debounces on `MutationObserver`, calls `adapter.scan` + `adapter.place`. |
| `src/background/nbrb.ts` + `rateCache.ts` | The only code that talks to `api.nbrb.by`. Retried on transient failures, validated, single-flighted, cached in `chrome.storage.local` (fresh for the current Minsk day). |
| `src/shared/rateStore.ts` | Read-only cache/error parsing shared by the content script, popup, and background — so there is exactly one implementation of "is this stored value a valid rate cache". |
| `src/shared/settings.ts` + `constants.ts` | The only settings store: `enabled`, `displayMode` (USD/EUR/both), `manualRates` overrides, `sites` (per-site on/off), in `chrome.storage.sync`. `DEFAULT_SETTINGS.sites` and `sanitizeSites` derive from the registry, so a new site defaults to enabled without any settings-schema edit. |
| `src/shared/money.ts` | `parseBynAmount` (untrusted DOM text → BYN number), `convert`, `formatBadge`. Shared by every adapter. |
| `src/popup/` | Popup UI (Russian): enable toggle, rate overrides, display mode, per-site checkboxes (rendered from `SITE_IDS`/`SITES`, so a new site needs no popup edit), refresh button. |
| `PRIVACY.md` | Privacy policy — must stay true to "no data collection". |

### Adding a site

1. Add its id/label/host patterns to `src/sites/sites.json`.
2. Write `src/sites/<site>.ts` exporting a `SiteAdapter` (`scan` + `place`,
   reusing `placeAfterAnchor` or `placeAmongSiblings` from
   `content/inject.ts`, or a new strategy there if neither fits).
3. Add it to the map in `src/sites/adapters.ts`.
4. Nothing else. `npm run build` regenerates the manifest's host
   permissions and content-script matches from `sites.json`; the popup's
   site toggles and `Settings.sites` pick it up automatically.

## Behaviour notes

- Rate cache (`rateCache` key, `chrome.storage.local`) is fresh for the
  current Minsk calendar day; refreshed by an hourly `chrome.alarms` tick
  and on-demand from the popup/content script. No hardcoded fallback rate —
  if NBRB is unreachable and there is no prior cache, no badge is shown
  (silence over a wrong number, for a tool whose whole premise is the
  official rate).
- Settings (`settings` key, `chrome.storage.sync`): `enabled`, `displayMode`
  (`USD` | `EUR` | `USD_EUR`), `manualRates` (per-currency override, takes
  priority over the NBRB rate when set), `sites` (per-site on/off).
- `parseBynAmount` accepts "руб", "byn", and kufar's abbreviated "р."
  markers; rejects already-converted badges (`$`/`€`) and price ranges.
- UI strings (popup) are Russian; keep new user-facing text in Russian.
