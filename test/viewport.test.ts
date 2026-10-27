import test from "node:test";
import assert from "node:assert/strict";
import { decodeConfig, defaultConfig, encodeConfig } from "../common/config";
import { splitStage } from "../webview/panes";
import { clampView, clipRect, fitView, panView, viewRect, zoomAt } from "../webview/viewport";
import { pushRecentDir } from "../common/recentDirs";
import { linuxPolicy, macPolicy } from "../common/pathPolicy";

test("fitView centers and scales the image", () => {
  const view = fitView(1920, 1080, 960, 540);
  assert.equal(view.scale, 0.5);
  assert.equal(view.x, 0);
  assert.equal(view.y, 0);
});

test("fitView letterboxes tall canvases", () => {
  const view = fitView(1920, 1080, 1000, 1000);
  assert.ok(Math.abs(view.scale - 1000 / 1920) < 1e-9);
  assert.ok(Math.abs(view.x) < 1e-9);
  assert.ok(view.y > 0);
});

test("fitView guards zero sizes", () => {
  assert.deepEqual(fitView(0, 0, 100, 100), { scale: 1, x: 0, y: 0 });
});

test("viewRect applies scale and offset", () => {
  assert.deepEqual(viewRect({ scale: 2, x: 5, y: 6 }, 10, 20), { x: 5, y: 6, w: 20, h: 40 });
});

test("clipRect flips the y axis", () => {
  assert.deepEqual(clipRect({ x: 0, y: 0, w: 100, h: 100 }, 100, 100), { x: -1, y: 1, w: 2, h: -2 });
});

test("zoomAt keeps the anchor stable", () => {
  const view = zoomAt({ scale: 1, x: 0, y: 0 }, 2, 50, 50, 100, 100, 100, 100);
  assert.equal(view.scale, 2);
  assert.equal(view.x, -50);
  assert.equal(view.y, -50);
});

test("zoomAt clamps the scale range", () => {
  const zoomedOut = zoomAt({ scale: 1, x: 0, y: 0 }, 0.0001, 0, 0, 10, 10, 10, 10);
  assert.ok(zoomedOut.scale >= 0.01);
  const zoomedIn = zoomAt({ scale: 1, x: 0, y: 0 }, 10000, 0, 0, 10, 10, 10, 10);
  assert.ok(zoomedIn.scale <= 64);
});

test("panView centers images smaller than the canvas", () => {
  const view = panView({ scale: 1, x: 0, y: 0 }, 20, 20, 10, 10, 100, 100);
  assert.deepEqual(view, { scale: 1, x: 45, y: 45 });
});

test("clampView keeps large images inside the canvas", () => {
  const view = clampView({ scale: 2, x: 1000, y: 1000 }, 100, 100, 50, 50);
  assert.equal(view.x, 0);
  assert.equal(view.y, 0);
});

test("splitStage keeps A + gutter + B equal to the width", () => {
  const layout = splitStage(1000, 600, 8);
  assert.equal(layout.a.x, 0);
  assert.equal(layout.a.width, 496);
  assert.equal(layout.b.x, 504);
  assert.equal(layout.b.width, 496);
  assert.equal(layout.a.width + layout.gutter + layout.b.width, 1000);
});

test("splitStage handles odd widths", () => {
  const layout = splitStage(1001, 600, 8);
  assert.equal(layout.a.width + layout.gutter + layout.b.width, 1001);
});

test("decodeConfig falls back to defaults", () => {
  assert.deepEqual(decodeConfig(null), defaultConfig);
  const decoded = decodeConfig({ sort_key: "bogus", color_standard: "srgb", last_dir: 3 as unknown as string });
  assert.equal(decoded.sortKey, "name");
  assert.equal(decoded.colorStandard, "bt601");
  assert.equal(decoded.lastDir, null);
});

test("encodeConfig round-trips", () => {
  const config = {
    ...defaultConfig,
    lastDir: "/tmp",
    recentDirs: ["/tmp"],
    colorStandard: "bt709",
    sortKey: "size",
    sortDesc: true,
  };
  const decoded = decodeConfig(encodeConfig(config));
  assert.deepEqual(decoded, config);
});

test("recent directories dedupe case-insensitively on mac", () => {
  const recent = pushRecentDir(["/Users/A"], "/users/a", macPolicy);
  assert.deepEqual(recent, ["/users/a"]);
});

test("recent directories keep distinct paths on linux", () => {
  const recent = pushRecentDir(["/Users/A"], "/users/a", linuxPolicy);
  assert.deepEqual(recent, ["/users/a", "/Users/A"]);
});

test("recent directories are capped", () => {
  let recent: string[] = [];
  for (let index = 0; index < 15; index++) {
    recent = pushRecentDir(recent, `/tmp/${index}`, macPolicy, 10);
  }
  assert.equal(recent.length, 10);
  assert.equal(recent[0], "/tmp/14");
});
