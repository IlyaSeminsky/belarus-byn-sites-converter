import { build, context } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, "dist");

const args = process.argv.slice(2);
const isProd = args.includes("--prod");
const isWatch = args.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const sharedOptions = {
  bundle: true,
  target: "chrome110",
  sourcemap: isProd ? false : "inline",
  minify: isProd,
  logLevel: "info",
};

const esmEntries = {
  entryPoints: [
    { in: path.join(rootDir, "src/background/index.ts"), out: "background" },
    { in: path.join(rootDir, "src/popup/popup.ts"), out: "popup" },
  ],
  format: "esm",
  outdir: distDir,
  ...sharedOptions,
};

const iifeEntry = {
  entryPoints: [{ in: path.join(rootDir, "src/content/index.ts"), out: "content" }],
  format: "iife",
  outdir: distDir,
  ...sharedOptions,
};

/**
 * Fill host_permissions and the content script's `matches` from
 * src/sites/sites.json, so adding a site there never requires touching the
 * manifest by hand.
 */
async function generateManifest() {
  const sitesPath = path.join(rootDir, "src/sites/sites.json");
  const sites = JSON.parse(await readFile(sitesPath, "utf-8"));
  const siteHosts = Object.values(sites).flatMap((site) => site.hosts);

  const manifestPath = path.join(rootDir, "public/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

  manifest.host_permissions = [...siteHosts, "https://api.nbrb.by/*"];
  manifest.content_scripts[0].matches = [...siteHosts];

  await writeFile(path.join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

async function copyStaticAssets() {
  await mkdir(distDir, { recursive: true });
  await cp(path.join(rootDir, "public/popup.html"), path.join(distDir, "popup.html"));
  await cp(path.join(rootDir, "icons"), path.join(distDir, "icons"), { recursive: true });
  await cp(path.join(rootDir, "src/content/content.css"), path.join(distDir, "content.css"));
  await cp(path.join(rootDir, "src/popup/popup.css"), path.join(distDir, "popup.css"));
  await generateManifest();
}

async function main() {
  await mkdir(distDir, { recursive: true });

  if (isWatch) {
    const [backgroundCtx, contentCtx] = await Promise.all([
      context(esmEntries),
      context(iifeEntry),
    ]);
    await copyStaticAssets();
    await Promise.all([backgroundCtx.watch(), contentCtx.watch()]);
    console.log("Watching for changes...");
    return;
  }

  await Promise.all([build(esmEntries), build(iifeEntry)]);
  await copyStaticAssets();
  console.log(`Build complete (${isProd ? "production" : "development"}) → ${distDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
