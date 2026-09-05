import { avbyAdapter } from "./avby.js";
import { kufarAdapter } from "./kufar.js";
import type { SiteId } from "./registry.js";
import type { SiteAdapter } from "./types.js";

/**
 * Every site this extension knows how to scan, keyed by id.
 *
 * To add a new site: add its hosts to sites.json, write an adapter module
 * (scan + a placement strategy from content/inject.ts), and add it here.
 * Nothing else — manifest hosts, popup toggles, and settings all derive
 * from sites.json + this map.
 *
 * Imported only by the content script: keeps DOM-touching adapter code out
 * of the background and popup bundles, which only need site ids/labels
 * (src/sites/registry.ts).
 */
export const ADAPTERS: Record<SiteId, SiteAdapter> = {
  kufar: kufarAdapter,
  avby: avbyAdapter,
};
