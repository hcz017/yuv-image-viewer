import test from "node:test";
import assert from "node:assert/strict";
import { initialState, reduce, type AppState } from "../common/appState";
import type { FileRow } from "../common/types";

const row = (name: string): FileRow => ({
  name,
  path: `/tmp/${name}`,
  size: 10,
  modifiedMs: 0,
  width: null,
  height: null,
  stride: null,
  scanline: null,
  format: "nv12",
});

const rows = [row("a.nv12"), row("b.nv12")];

test("initial state is a list", () => {
  const state = initialState("/tmp");
  assert.equal(state.mode.kind, "list");
  assert.equal(state.dir, "/tmp");
  assert.equal(state.generation, 0);
});

test("requestStarted advances the generation", () => {
  const state = reduce(initialState("/tmp"), { type: "requestStarted", token: 5 });
  assert.equal(state.generation, 5);
});

test("stale tokens are ignored", () => {
  const started = reduce(initialState("/tmp"), { type: "requestStarted", token: 5 });
  const stale = reduce(started, { type: "openDir", token: 4, dir: "/other", rows });
  assert.equal(stale, started);
});

test("openFile records a pending mode", () => {
  const state = reduce(
    reduce(initialState("/tmp"), { type: "requestStarted", token: 1 }),
    { type: "openFile", token: 1, dir: "/tmp", file: "/tmp/a.nv12", rows }
  );
  assert.equal(state.mode.kind, "list");
  assert.deepEqual(state.pendingMode, { kind: "single", dir: "/tmp", file: "/tmp/a.nv12" });
  assert.equal(state.pendingRows, rows);
});

test("loadCommit switches to single mode", () => {
  const state = reduce(
    reduce(initialState("/tmp"), { type: "requestStarted", token: 1 }),
    {
      type: "loadCommit",
      token: 1,
      mode: { kind: "single", dir: "/tmp", file: "/tmp/a.nv12" },
      rows,
      displayedFile: "/tmp/a.nv12",
    }
  );
  assert.equal(state.mode.kind, "single");
  assert.equal(state.displayedFile, "/tmp/a.nv12");
  assert.equal(state.pendingMode, null);
});

test("loadAbort reports an error and clears pending", () => {
  const state = reduce(
    reduce(initialState("/tmp"), { type: "requestStarted", token: 1 }),
    { type: "loadAbort", token: 1, error: "读取失败" }
  );
  assert.equal(state.error, "读取失败");
  assert.equal(state.pendingMode, null);
});

test("modal blocks navigation but allows selection", () => {
  const modal = reduce(initialState("/tmp"), { type: "setModal", open: true });
  const blocked = reduce(modal, {
    type: "openFile",
    token: 0,
    dir: "/tmp",
    file: "/tmp/a.nv12",
    rows,
  });
  assert.equal(blocked, modal);

  const selected = reduce(blocked, { type: "select", order: ["/tmp/a.nv12"], anchor: "/tmp/a.nv12" });
  assert.deepEqual(selected.selectionOrder, ["/tmp/a.nv12"]);
});

test("backToList restores list mode", () => {
  const single = reduce(
    reduce(initialState("/tmp"), { type: "requestStarted", token: 1 }),
    {
      type: "loadCommit",
      token: 1,
      mode: { kind: "single", dir: "/tmp", file: "/tmp/a.nv12" },
      rows,
      displayedFile: "/tmp/a.nv12",
    }
  );
  const state = reduce(single, { type: "backToList" });
  assert.equal(state.mode.kind, "list");
  assert.equal(state.displayedFile, null);
});

test("swapCompare exchanges a and b", () => {
  const compare = reduce(
    reduce(initialState("/tmp"), { type: "requestStarted", token: 1 }),
    {
      type: "loadCommit",
      token: 1,
      mode: { kind: "compare", dir: "/tmp", a: "/tmp/a.nv12", b: "/tmp/b.nv12" },
      rows,
      displayedFile: null,
    }
  );
  const swapped = reduce(compare, { type: "swapCompare" });
  assert.equal(swapped.mode.kind, "compare");
  if (swapped.mode.kind === "compare") {
    assert.equal(swapped.mode.a, "/tmp/b.nv12");
    assert.equal(swapped.mode.b, "/tmp/a.nv12");
  }
});

test("setSort toggles direction when the key is unchanged", () => {
  const once = reduce(initialState("/tmp"), { type: "setSort", key: "size" });
  assert.equal(once.sortKey, "size");
  assert.equal(once.sortDesc, false);
  const twice = reduce(once, { type: "setSort", key: "size" });
  assert.equal(twice.sortDesc, true);
  const other = reduce(twice, { type: "setSort", key: "name" });
  assert.equal(other.sortDesc, false);
});

test("openDir keeps selection inside the same directory", () => {
  let state: AppState = reduce(initialState("/tmp"), { type: "requestStarted", token: 1 });
  state = reduce(state, { type: "openDir", token: 1, dir: "/tmp", rows });
  state = reduce(state, { type: "select", order: ["/tmp/a.nv12"], anchor: "/tmp/a.nv12" });
  const same = reduce(state, { type: "openDir", token: 1, dir: "/tmp", rows });
  assert.deepEqual(same.selectionOrder, ["/tmp/a.nv12"]);

  state = reduce(state, { type: "requestStarted", token: 2 });
  const other = reduce(state, { type: "openDir", token: 2, dir: "/var", rows: [] });
  assert.deepEqual(other.selectionOrder, []);
  assert.equal(other.dir, "/var");
});
