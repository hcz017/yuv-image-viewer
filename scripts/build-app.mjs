import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "app", "dist");

await mkdir(dist, { recursive: true });

await build({
  entryPoints: [resolve(root, "app", "web", "boot.ts")],
  outfile: resolve(dist, "boot.js"),
  bundle: true,
  format: "iife",
  target: "es2020",
  platform: "browser",
  sourcemap: false,
  logLevel: "info",
});

for (const name of ["index.html", "app.css"]) {
  await copyFile(resolve(root, "app", "web", name), resolve(dist, name));
}

console.log("app/dist ready");
