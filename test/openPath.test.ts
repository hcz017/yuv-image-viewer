import test from "node:test";
import assert from "node:assert/strict";
import { resolveOpenRequest, type StatInfo } from "../common/openPath";
import { macPolicy, windowsPolicy } from "../common/pathPolicy";

const statOf = (map: Record<string, StatInfo>) => (path: string) =>
  map[path] ?? { exists: false, isDir: false, supported: false };

test("empty path lists error out", () => {
  const decision = resolveOpenRequest([], statOf({}), macPolicy);
  assert.equal(decision.kind, "error");
});

test("a directory opens as a directory", () => {
  const decision = resolveOpenRequest(
    ["/tmp/shots"],
    statOf({ "/tmp/shots": { exists: true, isDir: true, supported: true } }),
    macPolicy
  );
  assert.deepEqual(decision, { kind: "dir", dir: "/tmp/shots" });
});

test("a supported file opens with its parent directory", () => {
  const decision = resolveOpenRequest(
    ["/tmp/a.nv12"],
    statOf({ "/tmp/a.nv12": { exists: true, isDir: false, supported: true } }),
    macPolicy
  );
  assert.deepEqual(decision, { kind: "file", dir: "/tmp", file: "/tmp/a.nv12" });
});

test("missing paths report an error", () => {
  const decision = resolveOpenRequest(["/tmp/none.nv12"], statOf({}), macPolicy);
  assert.equal(decision.kind, "error");
  if (decision.kind === "error") {
    assert.match(decision.message, /不存在/);
  }
});

test("unsupported files report an error", () => {
  const decision = resolveOpenRequest(
    ["/tmp/a.png"],
    statOf({ "/tmp/a.png": { exists: true, isDir: false, supported: false } }),
    macPolicy
  );
  assert.equal(decision.kind, "error");
  if (decision.kind === "error") {
    assert.match(decision.message, /不支持/);
  }
});

test("two files in the same directory compare", () => {
  const decision = resolveOpenRequest(
    ["/tmp/a.nv12", "/tmp/b.nv12"],
    statOf({
      "/tmp/a.nv12": { exists: true, isDir: false, supported: true },
      "/tmp/b.nv12": { exists: true, isDir: false, supported: true },
    }),
    macPolicy
  );
  assert.deepEqual(decision, { kind: "compare", dir: "/tmp", a: "/tmp/a.nv12", b: "/tmp/b.nv12" });
});

test("two files in different directories are rejected", () => {
  const decision = resolveOpenRequest(
    ["/tmp/a.nv12", "/var/b.nv12"],
    statOf({
      "/tmp/a.nv12": { exists: true, isDir: false, supported: true },
      "/var/b.nv12": { exists: true, isDir: false, supported: true },
    }),
    macPolicy
  );
  assert.equal(decision.kind, "error");
});

test("directory plus file is rejected", () => {
  const decision = resolveOpenRequest(
    ["/tmp", "/tmp/a.nv12"],
    statOf({
      "/tmp": { exists: true, isDir: true, supported: true },
      "/tmp/a.nv12": { exists: true, isDir: false, supported: true },
    }),
    macPolicy
  );
  assert.equal(decision.kind, "error");
});

test("more than two paths are rejected", () => {
  const decision = resolveOpenRequest(
    ["/tmp/a.nv12", "/tmp/b.nv12", "/tmp/c.nv12"],
    statOf({
      "/tmp/a.nv12": { exists: true, isDir: false, supported: true },
      "/tmp/b.nv12": { exists: true, isDir: false, supported: true },
      "/tmp/c.nv12": { exists: true, isDir: false, supported: true },
    }),
    macPolicy
  );
  assert.equal(decision.kind, "error");
});

test("relative paths are rejected before any stat", () => {
  const decision = resolveOpenRequest(["frame.nv12"], statOf({}), macPolicy);
  assert.equal(decision.kind, "error");
  if (decision.kind === "error") {
    assert.match(decision.message, /绝对路径/);
  }
});

test("mac keys differ only by case but still resolve to one directory", () => {
  const decision = resolveOpenRequest(
    ["/tmp/A.nv12", "/tmp/b.nv12"],
    statOf({
      "/tmp/A.nv12": { exists: true, isDir: false, supported: true },
      "/tmp/b.nv12": { exists: true, isDir: false, supported: true },
    }),
    macPolicy
  );
  assert.equal(decision.kind, "compare");
});

test("windows comparison treats case differences as the same directory", () => {
  const decision = resolveOpenRequest(
    ["C:\\Shots\\a.nv12", "c:\\shots\\b.nv12"],
    statOf({
      "C:\\Shots\\a.nv12": { exists: true, isDir: false, supported: true },
      "c:\\shots\\b.nv12": { exists: true, isDir: false, supported: true },
    }),
    windowsPolicy
  );
  assert.equal(decision.kind, "compare");
});
