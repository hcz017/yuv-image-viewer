#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! pkg-config --exists webkit2gtk-4.1; then
  echo "缺少 webkit2gtk-4.1 开发包。请先安装：" >&2
  echo "  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libxdo-dev \\" >&2
  echo "    libayatana-appindicator3-dev librsvg2-dev libssl-dev build-essential" >&2
  exit 1
fi

npm ci
npm run compile
npm run test
npm run app:build
npm run check:version

cd app
npx tauri build

echo "Linux bundles: app/src-tauri/target/release/bundle/{appimage,deb}"
