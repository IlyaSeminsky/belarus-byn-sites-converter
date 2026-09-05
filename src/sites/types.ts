import type { SiteId } from "./registry.js";

export interface PriceHit {
  /** Element the badge should be attached relative to. */
  anchor: Element;
  /** Parsed BYN amount. */
  byn: number;
  /**
   * Set for a delta amount (e.g. av.by's price-change log: "+ 3 044 руб."),
   * so the badge shows a signed change rather than a plain "≈" price.
   * Omit for a plain price.
   */
  sign?: 1 | -1;
}

/** Renders (or updates) the badge for one price hit, however that site needs it placed. */
export type PlacementStrategy = (anchor: Element, text: string, tooltip: string) => void;

/**
 * A site adapter owns exactly two things a site does differently: how to
 * find BYN prices in its markup, and how to attach a badge near one.
 * Everything else — settings, rate cache, staleness, debounce, observer
 * lifecycle, badge text — is shared runner code (src/content/index.ts).
 */
export interface SiteAdapter {
  id: SiteId;
  /** Find eligible BYN price elements under `root` and resolve each one's badge anchor. */
  scan(root: ParentNode): PriceHit[];
  /** Attach/update the badge for one hit. One of the strategies in content/inject.ts. */
  place: PlacementStrategy;
  /**
   * Should this single DOM mutation trigger a rescan? Omit to always rescan
   * on any observed mutation (simplest, correct default for a small page).
   */
  isRelevantMutation?(mutation: MutationRecord): boolean;
  /** Debounce (ms) between an observed mutation and the next rescan. */
  debounceMs: number;
}
