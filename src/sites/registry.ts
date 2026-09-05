import sitesJson from "./sites.json";

/** One entry per supported site: display label + MV3 match patterns for its hosts. */
export interface SiteConfig {
  label: string;
  hosts: string[];
}

export type SiteId = keyof typeof sitesJson;

export const SITES: Record<SiteId, SiteConfig> = sitesJson;

export const SITE_IDS = Object.keys(SITES) as SiteId[];

/** Every host pattern across every site, flattened — used to build the manifest. */
export function allHostPatterns(): string[] {
  return SITE_IDS.flatMap((id) => SITES[id].hosts);
}

/** Extract the host part (with its wildcard, if any) out of an MV3 match pattern. */
function hostPatternOf(matchPattern: string): string {
  const withoutScheme = matchPattern.replace(/^[a-z*]+:\/\//, "");
  return withoutScheme.split("/")[0] ?? "";
}

function hostPatternMatches(hostPattern: string, hostname: string): boolean {
  if (hostPattern.startsWith("*.")) {
    const bareDomain = hostPattern.slice(2);
    return hostname === bareDomain || hostname.endsWith(`.${bareDomain}`);
  }
  return hostname === hostPattern;
}

/** Resolve which configured site (if any) a given hostname belongs to. */
export function siteIdForHostname(hostname: string): SiteId | undefined {
  return SITE_IDS.find((id) => SITES[id].hosts.some((host) => hostPatternMatches(hostPatternOf(host), hostname)));
}
