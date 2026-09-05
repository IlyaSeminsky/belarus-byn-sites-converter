import type { Currency, DisplayMode, Rates } from "./types.js";

/**
 * All whitespace variants av.by / kufar.by (and we) may use as thousand
 * separators: regular \s, NBSP (U+00A0), narrow NBSP (U+202F), thin space
 * (U+2009).
 */
const SPACE_CHARS = /[\s   ]/g;

const CURRENCY_SIGN = /[$€]/;
// "руб" (av.by), "byn", and kufar's abbreviated "р." marker.
const BYN_MARKER = /руб|byn|р\./i;
const RANGE_MARKER = /\d[—–-]\d/;
const AMOUNT_PATTERN = /(\d+(?:[.,]\d{1,2})?)/;

const MAX_AMOUNT = 1e8;

/**
 * Parse a BYN amount out of a price element's text content.
 * Returns null for anything that is not a single, well-formed BYN price:
 * already-converted badges (contain $ / €), non-BYN text, price ranges,
 * and out-of-range or non-finite numbers.
 */
export function parseBynAmount(text: string): number | null {
  const stripped = text.replace(SPACE_CHARS, "");

  if (CURRENCY_SIGN.test(stripped)) {
    return null;
  }

  if (!BYN_MARKER.test(stripped)) {
    return null;
  }

  if (RANGE_MARKER.test(stripped)) {
    return null;
  }

  const match = AMOUNT_PATTERN.exec(stripped);
  if (!match || match[1] === undefined) {
    return null;
  }

  const normalized = match[1].replace(",", ".");
  const value = Number(normalized);

  if (!Number.isFinite(value) || value <= 0 || value >= MAX_AMOUNT) {
    return null;
  }

  return value;
}

/**
 * Convert a BYN amount into the given currency using an effective NBRB
 * (or manual override) rate expressed as BYN per 1 unit of currency.
 */
export function convert(byn: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`rate must be a finite positive number, got ${rate}`);
  }
  return byn / rate;
}

const badgeFormatter = new Intl.NumberFormat("ru-BY", {
  maximumFractionDigits: 0,
});

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
};

function formatAmount(byn: number, rate: number, currency: Currency): string {
  const converted = convert(byn, rate);
  return `${badgeFormatter.format(converted)} ${CURRENCY_SYMBOL[currency]}`;
}

/**
 * Render the badge text shown under a BYN price, for the given display mode.
 */
export function formatBadge(byn: number, rates: Rates, mode: DisplayMode): string {
  switch (mode) {
    case "USD":
      return `≈ ${formatAmount(byn, rates.USD, "USD")}`;
    case "EUR":
      return `≈ ${formatAmount(byn, rates.EUR, "EUR")}`;
    case "USD_EUR":
      return `≈ ${formatAmount(byn, rates.USD, "USD")} · ${formatAmount(
        byn,
        rates.EUR,
        "EUR",
      )}`;
  }
}
