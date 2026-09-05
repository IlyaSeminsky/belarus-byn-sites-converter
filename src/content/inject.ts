export const BADGE_ATTRIBUTE = "data-byn-badge";
const BADGE_CLASS = "byn-price-badge";

function isBadgeElement(node: Element | null): node is HTMLElement {
  return node !== null && node.hasAttribute(BADGE_ATTRIBUTE);
}

export function isOwnNode(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && isBadgeElement(node as Element);
}

function createBadge(text: string, tooltip: string): HTMLElement {
  // <span>, not <div>: on kufar the price line lives inside a <p>, where a
  // block-level <div> child is invalid markup.
  const badge = document.createElement("span");
  badge.className = BADGE_CLASS;
  badge.setAttribute(BADGE_ATTRIBUTE, "");
  badge.textContent = text;
  badge.title = tooltip;
  return badge;
}

/**
 * av.by placement: the badge is always the anchor's very next sibling.
 * If one is already there, update it in place; otherwise insert a new one.
 */
export function placeAfterAnchor(anchor: Element, text: string, tooltip: string): void {
  const existing = anchor.nextElementSibling;
  if (isBadgeElement(existing)) {
    if (existing.textContent !== text) {
      existing.textContent = text;
    }
    if (existing.title !== tooltip) {
      existing.title = tooltip;
    }
    return;
  }

  anchor.after(createBadge(text, tooltip));
}

/**
 * kufar placement: search *all* of the anchor's siblings (not just the next
 * one) for an existing badge — React and the Yandex Maps balloons can
 * reorder or insert nodes between the price and our badge across
 * re-renders. Any duplicate badges found are dropped; the surviving one is
 * updated in place and re-anchored if it drifted away from `anchor`.
 */
export function placeAmongSiblings(anchor: Element, text: string, tooltip: string): void {
  const siblingBadges = anchor.parentElement
    ? Array.from(anchor.parentElement.children).filter(isOwnNode)
    : [];
  const [existing, ...duplicates] = siblingBadges;

  duplicates.forEach((badge) => badge.remove());

  if (!existing) {
    anchor.after(createBadge(text, tooltip));
    return;
  }

  if (existing.textContent !== text) {
    existing.textContent = text;
  }
  if ((existing as HTMLElement).title !== tooltip) {
    (existing as HTMLElement).title = tooltip;
  }
  if (existing.previousElementSibling !== anchor) {
    anchor.after(existing);
  }
}

/** Remove every badge node this extension has injected into the document. */
export function removeAllBadges(root: ParentNode = document): void {
  for (const badge of root.querySelectorAll(`[${BADGE_ATTRIBUTE}]`)) {
    badge.remove();
  }
}
