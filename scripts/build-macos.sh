#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"

if ! command -v npm >/dev/null 2>&1; then
  for dir in "$HOME/.local/node/bin" "/opt/homebrew/bin" "/usr/local/bin" "$HOME"/.nvm/versions/node/*/bin; do
    if [ -x "$dir/npm" ]; then
      PATH="$dir:$PATH"
      break
    fi
  done
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm，请先安装 Node.js，或将其 bin 目录加入 PATH" >&2
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  for dir in "$HOME/.cargo/bin" "/opt/homebrew/bin" "/usr/local/bin"; do
    if [ -x "$dir/cargo" ]; then
      PATH="$dir:$PATH"
      break
    fi
  done
fi
if ! command -v cargo >/dev/null 2>&1; then
  echo "未找到 cargo，请先安装 Rust 工具链（https://rustup.rs），或将其 bin 目录加入 PATH" >&2
  exit 1
fi

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
