# Privacy Policy — BYN Price Converter

_Last updated: 2026-09-05_

BYN Price Converter is a free, open-source browser extension. This page
describes what data it accesses and what it does with it.

## What the extension does

The extension reads the Belarusian ruble (BYN) prices shown on kufar.by and
av.by listing, search, and detail pages, and displays an additional
estimated price in US dollars and/or euros next to them, using the official
exchange rates published by the National Bank of the Republic of Belarus.

## Data the extension accesses

- **Page content on kufar.by and av.by**: the extension reads price text
  already visible on the page (e.g. `138 705 р.`) in order to compute and
  display the USD/EUR equivalent. It does not read, collect, or transmit any
  other page content — no personal data, messages, contact details, or
  account information.
- **Exchange rate data**: the extension fetches the current USD/BYN and
  EUR/BYN rates from the National Bank of the Republic of Belarus public API
  (`api.nbrb.by/exrates/rates/...`). This is a public, unauthenticated
  endpoint; no identifying information is sent with the request.

## Data the extension stores

The extension stores the following in the browser's extension storage,
which stays on your device (or is synced only through your own browser
account, for settings) and is never sent anywhere by the extension itself:

- the last fetched USD/BYN and EUR/BYN exchange rates and the date they were
  fetched for (`chrome.storage.local`),
- your preferences — whether the extension is enabled, which currencies to
  show, any manual rate overrides, and which sites are enabled
  (`chrome.storage.sync`).

The rate cache is refreshed automatically once a day (Minsk time), or
immediately if you use the "Refresh rates" button in the extension's popup.

## Data the extension does NOT do

- It does not collect, transmit, or sell any personal data.
- It does not use analytics, tracking pixels, or third-party scripts.
- It does not require or use any account, login, or authentication.
- It does not communicate with any server other than kufar.by / av.by (to
  read page content) and api.nbrb.by (to fetch exchange rates).

## Permissions explained

| Permission | Why it's needed |
|---|---|
| `storage` | Cache exchange rates and preferences locally. |
| `alarms` | Schedule the periodic background rate refresh. |
| Host access to `kufar.by` / `av.by` | Read visible BYN prices on the page to display a USD/EUR equivalent next to them. |
| Host access to `api.nbrb.by` | Fetch the official exchange rates. |

## Changes to this policy

If this policy changes, the update will be reflected on this page with a
new "Last updated" date.

## Contact

For questions about this extension, open an issue on the project's GitHub
repository: https://github.com/IlyaSeminsky/kufar-usd-converter
