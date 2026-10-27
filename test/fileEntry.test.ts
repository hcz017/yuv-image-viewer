import test from "node:test";
import assert from "node:assert/strict";
import { naturalCompare, neighborPath, rowsFromEntries, sortRows } from "../common/fileEntry";
import type { EntryInfo, FileRow } from "../common/types";

const entry = (name: string, size = 100, isDir = false): EntryInfo => ({
  name,
  path: `/tmp/${name}`,
  isDir,
  size,
  modifiedMs: 0,
});

const row = (name: string, size = 100, modifiedMs = 0): FileRow => ({
  name,
  path: `/tmp/${name}`,
  size,
  modifiedMs,
  width: null,
  height: null,
  stride: null,
  scanline: null,
  format: "yuv",
});

test("natural compare orders numeric segments", () => {
  assert.ok(naturalCompare("frame2.nv12", "frame10.nv12") < 0);
  assert.ok(naturalCompare("frame10.nv12", "frame2.nv12") > 0);
  assert.equal(naturalCompare("a.nv12", "a.nv12"), 0);
});

test("sortRows sorts by name ascending and descending", () => {
  const rows = [row("b.nv12"), row("a.nv12")];
  assert.deepEqual(sortRows(rows, "name", false).map((item) => item.name), ["a.nv12", "b.nv12"]);
  assert.deepEqual(sortRows(rows, "name", true).map((item) => item.name), ["b.nv12", "a.nv12"]);
});

test("sortRows sorts by size and modified time", () => {
  const rows = [row("a.nv12", 30, 2), row("b.nv12", 10, 1), row("c.nv12", 20, 3)];
  assert.deepEqual(sortRows(rows, "size", false).map((item) => item.name), ["b.nv12", "c.nv12", "a.nv12"]);
  assert.deepEqual(sortRows(rows, "modified", false).map((item) => item.name), ["b.nv12", "a.nv12", "c.nv12"]);
});

test("neighborPath respects boundaries without wrapping", () => {
  const rows = [row("a.nv12"), row("b.nv12"), row("c.nv12")];
  assert.equal(neighborPath(rows, "/tmp/a.nv12", 1), "/tmp/b.nv12");
  assert.equal(neighborPath(rows, "/tmp/b.nv12", -1), "/tmp/a.nv12");
  assert.equal(neighborPath(rows, "/tmp/a.nv12", -1), null);
  assert.equal(neighborPath(rows, "/tmp/c.nv12", 1), null);
  assert.equal(neighborPath(rows, "/tmp/missing.nv12", 1), null);
});

test("rowsFromEntries filters directories", () => {
  const rows = rowsFromEntries([entry("a.nv12"), entry("sub", 0, true)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "a.nv12");
});

test("rowsFromEntries derives size and format from the name", () => {
  const [first] = rowsFromEntries([entry("clip_640x480.nv12")]);
  assert.equal(first.format, "nv12");
  assert.equal(first.width, 640);
  assert.equal(first.height, 480);
  assert.equal(first.path, "/tmp/clip_640x480.nv12");
});

test("rowsFromEntries falls back to yuv for unknown extensions", () => {
  const [first] = rowsFromEntries([entry("clip.bin")]);
  assert.equal(first.format, "yuv");
  assert.equal(first.width, null);
});
