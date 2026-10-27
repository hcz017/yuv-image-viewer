#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"

npm ci
npm run compile
npm run test
npm run app:build
npm run check:version

cd app
if [ -n "$TARGET" ]; then
  npx tauri build --target "$TARGET"
  echo "macOS bundle: app/src-tauri/target/$TARGET/release/bundle/macos"
else
  npx tauri build
  echo "macOS bundle: app/src-tauri/target/release/bundle/macos"
fi
