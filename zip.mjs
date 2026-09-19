import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, "dist");
const releasesDir = path.join(rootDir, "releases");

/**
 * Package dist/ for the Chrome Web Store.
 *
 * The store requires manifest.json at the archive root, so the archive is
 * built with dist/ as the working directory ("." rather than "dist") — a
 * zip of the folder itself would nest everything one level too deep and be
 * rejected on upload.
 */
async function main() {
  const manifest = JSON.parse(await readFile(path.join(distDir, "manifest.json"), "utf-8"));
  const zipPath = path.join(releasesDir, `byn-price-converter-${manifest.version}.zip`);

  await mkdir(releasesDir, { recursive: true });
  // `zip` appends to an existing archive, which would keep files removed
  // since the last packaging run. Start from scratch every time.
  await rm(zipPath, { force: true });

  const result = spawnSync(
    "zip",
    [
      "--recurse-paths",
      "-X", // no extra filesystem attributes (macOS resource forks etc.)
      zipPath,
      ".",
      "--exclude",
      "*.DS_Store",
      "__MACOSX/*",
    ],
    { cwd: distDir, stdio: "inherit" },
  );

  if (result.error?.code === "ENOENT") {
    throw new Error("`zip` command not found — install Info-ZIP (or use the system archiver).");
  }
  if (result.status !== 0) {
    throw new Error(`zip exited with code ${result.status}`);
  }

  console.log(`Packaged v${manifest.version} → ${zipPath}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
