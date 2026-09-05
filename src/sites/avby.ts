import { BADGE_ATTRIBUTE, placeAfterAnchor, placeInsideAnchor } from "../content/inject.js";
import { parseBynAmount } from "../shared/money.js";
import type { PriceHit, SiteAdapter } from "./types.js";

// price-history chart bar: needs its own placement (see `place` below) —
// nested inside the anchor rather than appended as its sibling.
const GRAPH_ITEM_PRICE_SELECTOR = ".graph-item__price";

const PRICE_SELECTORS = [
  ".card__price-primary", // advert detail page
  ".listing-item__price-primary", // search results listing
  ".listing-top__price-primary", // promoted / similar / related cards
  ".listing-index__price", // index/summary cards (listing-index__summary)
  GRAPH_ITEM_PRICE_SELECTOR, // price-history chart: price at one point
  ".graph-log__sum", // price-history change log: running total after a change
  ".drawer-price", // mobile bottom drawer: sticky price header
  '[class*="price-primary"]', // forward-compatible catch-all
].join(",");

// price-history change log: the delta itself, e.g. "+ 3 044 руб." / "− 618 руб.".
// The log's first entry reads "Начальная цена" (no sign, no digits) and is
// skipped — its value is already covered by its own .graph-log__sum.
const DIFF_SELECTOR = ".graph-log__diff";
const DIFF_SIGN = /^\s*([+−-])/;

/** Maximum number of parentElement hops to look for a wrapping <button>. */
const MAX_ANCHOR_HOPS = 3;

/**
 * Resolve the insertion anchor for a price element: walk up at most
 * MAX_ANCHOR_HOPS parentElement hops looking for a wrapping <button> (the
 * detail page wraps its price in `.card__price-button`); if one is found
 * within that bound, use it, otherwise fall back to the price element
 * itself. This deliberately never does a bare `closest('button')` walk,
 * which could latch onto an unrelated ancestor button far up the tree.
 */
function resolveAnchor(priceEl: Element): Element {
  let node: Element | null = priceEl;
  for (let hop = 0; hop < MAX_ANCHOR_HOPS && node !== null; hop++) {
    if (node.tagName === "BUTTON") {
      return node;
    }
    node = node.parentElement;
  }
  return priceEl;
}

/**
 * Scan the document (or a subtree root) for eligible BYN price elements.
 * Skips elements already inside one of our own badges, elements that don't
 * parse as a plain BYN amount (already-converted badges, ranges, other
 * currencies), and returns each hit's resolved insertion anchor.
 */
function scan(root: ParentNode): PriceHit[] {
  const elements = root.querySelectorAll(PRICE_SELECTORS);
  const seenAnchors = new Set<Element>();
  const hits: PriceHit[] = [];

  for (const el of elements) {
    if (el.closest(`[${BADGE_ATTRIBUTE}]`)) {
      continue;
    }

    const byn = parseBynAmount(el.textContent ?? "");
    if (byn === null) {
      continue;
    }

    const anchor = resolveAnchor(el);
    if (seenAnchors.has(anchor)) {
      continue;
    }
    seenAnchors.add(anchor);

    hits.push({ anchor, byn });
  }

  for (const el of root.querySelectorAll(DIFF_SELECTOR)) {
    if (el.closest(`[${BADGE_ATTRIBUTE}]`)) {
      continue;
    }

    const text = el.textContent ?? "";
    const signMatch = DIFF_SIGN.exec(text);
    if (!signMatch) {
      continue; // "Начальная цена" — no numeric delta to convert
    }

    const byn = parseBynAmount(text);
    if (byn === null) {
      continue;
    }

    const anchor = resolveAnchor(el);
    if (seenAnchors.has(anchor)) {
      continue;
    }
    seenAnchors.add(anchor);

    const sign: 1 | -1 = signMatch[1] === "+" ? 1 : -1;
    hits.push({ anchor, byn, sign });
  }

  return hits;
}

/**
 * Most av.by badges go after their anchor as a sibling — including the
 * button-wrapped detail-page price (`.card__price-primary` resolves its
 * anchor to the wrapping `.card__price-button`; the badge lands right
 * after that button). Two chart/log cases nest the badge inside the
 * anchor instead, because the anchor's siblings there carry unrelated
 * layout (a flex column with a chart bar, a log row's other flex cells)
 * that a plain sibling badge gets squeezed into or mis-positioned against:
 *  - the chart-bar price (.graph-item__price): sits in a fixed-height flex
 *    column alongside a bar whose bottom is flush against an unrelated date
 *    row beneath it.
 *  - the change-log diff/sum (.graph-log__diff, .graph-log__sum): sibling
 *    of the log row's other flex cells.
 * Nesting keeps each case's own layout untouched and lands the badge right
 * under its value.
 */
function place(anchor: Element, text: string, tooltip: string): void {
  if (anchor.matches(`${GRAPH_ITEM_PRICE_SELECTOR}, ${DIFF_SELECTOR}, .graph-log__sum`)) {
    placeInsideAnchor(anchor, text, tooltip);
    return;
  }
  placeAfterAnchor(anchor, text, tooltip);
}

export const avbyAdapter: SiteAdapter = {
  id: "avby",
  scan,
  place,
  debounceMs: 120,
};
