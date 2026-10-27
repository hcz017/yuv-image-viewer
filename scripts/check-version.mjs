import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const cargo = readFileSync(resolve(root, "app/src-tauri/Cargo.toml"), "utf8")
  .match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const tauri = JSON.parse(readFileSync(resolve(root, "app/src-tauri/tauri.conf.json"), "utf8")).version;

const versions = { "package.json": pkg, "Cargo.toml": cargo, "tauri.conf.json": tauri };
const unique = new Set(Object.values(versions));
console.log(versions);
if (unique.size !== 1) {
  console.error("版本号不一致，请同步三处版本");
  process.exit(1);
}
