import test from "node:test";
import assert from "node:assert/strict";
import { applySelection, type Selection } from "../common/selectionModel";
import { macPolicy } from "../common/pathPolicy";
import type { FileRow } from "../common/types";

const row = (name: string): FileRow => ({
  name,
  path: `/tmp/${name}`,
  size: 1,
  modifiedMs: 0,
  width: null,
  height: null,
  stride: null,
  scanline: null,
  format: "nv12",
});

const rows = [row("a.nv12"), row("b.nv12"), row("c.nv12"), row("d.nv12")];
const empty: Selection = { order: [], anchor: null };

test("single selection replaces the whole selection", () => {
  const next = applySelection(rows, { order: ["/tmp/a.nv12"], anchor: "/tmp/a.nv12" }, "/tmp/c.nv12", "single", macPolicy);
  assert.deepEqual(next, { order: ["/tmp/c.nv12"], anchor: "/tmp/c.nv12" });
});

test("toggle adds and removes", () => {
  const added = applySelection(rows, empty, "/tmp/a.nv12", "toggle", macPolicy);
  assert.deepEqual(added.order, ["/tmp/a.nv12"]);
  const addedMore = applySelection(rows, added, "/tmp/c.nv12", "toggle", macPolicy);
  assert.deepEqual(addedMore.order, ["/tmp/a.nv12", "/tmp/c.nv12"]);
  const removed = applySelection(rows, addedMore, "/tmp/a.nv12", "toggle", macPolicy);
  assert.deepEqual(removed.order, ["/tmp/c.nv12"]);
});

test("range selection uses the anchor", () => {
  const anchor: Selection = { order: ["/tmp/b.nv12"], anchor: "/tmp/b.nv12" };
  const next = applySelection(rows, anchor, "/tmp/d.nv12", "range", macPolicy);
  assert.deepEqual(next.order, ["/tmp/b.nv12", "/tmp/c.nv12", "/tmp/d.nv12"]);
});

test("range selection works in reverse order", () => {
  const anchor: Selection = { order: ["/tmp/d.nv12"], anchor: "/tmp/d.nv12" };
  const next = applySelection(rows, anchor, "/tmp/b.nv12", "range", macPolicy);
  assert.deepEqual(next.order, ["/tmp/b.nv12", "/tmp/c.nv12", "/tmp/d.nv12"]);
});

test("range without anchor selects just the clicked row", () => {
  const next = applySelection(rows, empty, "/tmp/c.nv12", "range", macPolicy);
  assert.deepEqual(next.order, ["/tmp/c.nv12"]);
});

test("unknown paths keep the current selection", () => {
  const current: Selection = { order: ["/tmp/a.nv12"], anchor: "/tmp/a.nv12" };
  const next = applySelection(rows, current, "/tmp/missing.nv12", "single", macPolicy);
  assert.equal(next, current);
});
