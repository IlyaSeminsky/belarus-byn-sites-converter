import { BADGE_ATTRIBUTE, placeAfterAnchor } from "../content/inject.js";
import { parseBynAmount } from "../shared/money.js";
import type { PriceHit, SiteAdapter } from "./types.js";

const PRICE_SELECTORS = [
  ".card__price-primary", // advert detail page
  ".listing-item__price-primary", // search results listing
  ".listing-top__price-primary", // promoted / similar / related cards
  '[class*="price-primary"]', // forward-compatible catch-all
].join(",");

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

  return hits;
}

export const avbyAdapter: SiteAdapter = {
  id: "avby",
  scan,
  place: placeAfterAnchor,
  debounceMs: 120,
};
