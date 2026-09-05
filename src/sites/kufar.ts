import { isOwnNode, placeAmongSiblings } from "../content/inject.js";
import { parseBynAmount } from "../shared/money.js";
import type { PriceHit, SiteAdapter } from "./types.js";

// Strict: the whole (trimmed) text content must be just a BYN price —
// "138 705 р." — so we only ever treat true leaf price nodes as hits.
const BYN_PRICE_PATTERN = /^\d[\d\s]*\s?р\.$/;
// Loose: used only to decide whether a DOM mutation is worth a rescan —
// the price may arrive inside a bigger container.
const BYN_PRICE_HINT_PATTERN = /\d[\d\s]*\s?р\./;

const PRICE_CONTAINER_SELECTOR = '[class*="price"]';
const PRICE_CANDIDATE_SELECTOR = "span, p";

// "3 278 р. за м2" / "3 278 р. за м²" — matched by text, not by class: kufar
// names this class differently (often a hash) on different page types.
const PER_SQUARE_METER_TEXT_PATTERN = /за\s?м[²2]/i;
const PER_SQUARE_METER_SEARCH_DEPTH = 3;

/** Marks a source price leaf we've already produced a hit for, so repeated
 * rescans of a big page (map balloons, long listings) don't re-walk its
 * ancestors on every debounce tick. Cleared implicitly whenever the page
 * re-renders the node (a fresh element has no attributes). */
const SCANNED_ATTRIBUTE = "data-byn-scanned";

function isEligiblePriceLeaf(element: Element): boolean {
  if (element.children.length > 0) {
    return false;
  }
  if (element.hasAttribute(SCANNED_ATTRIBUTE)) {
    return false;
  }
  return BYN_PRICE_PATTERN.test(element.textContent?.trim() ?? "");
}

/**
 * Find the smallest ancestor (within PER_SQUARE_METER_SEARCH_DEPTH hops)
 * whose text contains both the price and a "за м²" marker — that's the
 * "BYN + per-square-meter" row as a whole.
 */
function findRowContainingPerSquareMeterPrice(priceElement: Element): Element {
  const priceContainer = priceElement.closest(PRICE_CONTAINER_SELECTOR) ?? priceElement;

  let candidate: Element = priceContainer;
  for (let depth = 0; depth < PER_SQUARE_METER_SEARCH_DEPTH; depth++) {
    if (PER_SQUARE_METER_TEXT_PATTERN.test(candidate.textContent ?? "")) {
      return candidate;
    }
    if (!candidate.parentElement) {
      break;
    }
    candidate = candidate.parentElement;
  }

  return priceContainer;
}

function isHorizontalFlexRow(element: Element): boolean {
  const style = getComputedStyle(element);
  if (style.display !== "flex" && style.display !== "inline-flex") {
    return false;
  }
  return style.flexDirection === "row" || style.flexDirection === "row-reverse";
}

/**
 * The USD/EUR badge must land on its own line under the whole "BYN + per-m²"
 * row, not squeezed into it next to a calculator icon or favorite button —
 * so walk out of any horizontal flex row the price row itself sits inside.
 */
function escapeHorizontalRow(element: Element): Element {
  let current = element;
  while (current.parentElement && isHorizontalFlexRow(current.parentElement)) {
    current = current.parentElement;
  }
  return current;
}

function resolveAnchor(priceElement: Element): Element {
  return escapeHorizontalRow(findRowContainingPerSquareMeterPrice(priceElement));
}

function scan(root: ParentNode): PriceHit[] {
  const hits: PriceHit[] = [];

  for (const el of root.querySelectorAll(PRICE_CANDIDATE_SELECTOR)) {
    if (!isEligiblePriceLeaf(el)) {
      continue;
    }

    const byn = parseBynAmount(el.textContent ?? "");
    if (byn === null) {
      continue;
    }

    el.setAttribute(SCANNED_ATTRIBUTE, "");
    hits.push({ anchor: resolveAnchor(el), byn });
  }

  return hits;
}

// className on SVG elements is an SVGAnimatedString, not a string.
function readClassName(element: Element): string {
  if (typeof element.className === "string") {
    return element.className;
  }
  return element.getAttribute("class") ?? "";
}

function looksLikePriceElement(element: Element): boolean {
  const className = readClassName(element);
  return className.includes("price") || className.includes("rate-line");
}

function isRelevantMutation(mutation: MutationRecord): boolean {
  if (isOwnNode(mutation.target)) {
    return false;
  }

  for (const addedNode of mutation.addedNodes) {
    if (addedNode.nodeType !== Node.ELEMENT_NODE || isOwnNode(addedNode)) {
      continue;
    }
    const addedElement = addedNode as Element;
    if (BYN_PRICE_HINT_PATTERN.test(addedElement.textContent ?? "")) {
      return true;
    }
    if (looksLikePriceElement(addedElement)) {
      return true;
    }
  }

  return mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE
    && looksLikePriceElement(mutation.target as Element);
}

export const kufarAdapter: SiteAdapter = {
  id: "kufar",
  scan,
  place: placeAmongSiblings,
  isRelevantMutation,
  debounceMs: 150,
};
