import test from "node:test";
import assert from "node:assert/strict";
import { linuxPolicy, macPolicy, windowsPolicy } from "../common/pathPolicy";

test("windows parent and basename", () => {
  assert.equal(windowsPolicy.parent("C:\\foo\\bar.nv12"), "C:\\foo");
  assert.equal(windowsPolicy.parent("C:\\foo"), "C:\\");
  assert.equal(windowsPolicy.parent("C:\\"), "C:\\");
  assert.equal(windowsPolicy.basename("C:\\foo\\bar.nv12"), "bar.nv12");
  assert.equal(windowsPolicy.basename("C:\\"), "C:\\");
});

test("windows root and absolute paths", () => {
  assert.equal(windowsPolicy.isRoot("C:\\"), true);
  assert.equal(windowsPolicy.isRoot("C:\\foo"), false);
  assert.equal(windowsPolicy.isAbsolute("C:\\foo"), true);
  assert.equal(windowsPolicy.isAbsolute("\\\\server\\share\\x"), true);
  assert.equal(windowsPolicy.isAbsolute("/foo"), false);
});

test("windows keys are case insensitive", () => {
  assert.equal(windowsPolicy.key("C:\\Users\\A"), windowsPolicy.key("c:\\users\\a"));
  assert.equal(windowsPolicy.caseInsensitive, true);
});

test("windows trailing separators collapse", () => {
  assert.equal(windowsPolicy.key("C:\\foo\\"), windowsPolicy.key("C:\\foo"));
  assert.equal(windowsPolicy.key("C:\\foo\\\\bar"), windowsPolicy.key("C:\\foo\\bar"));
});

test("windows forward slashes normalize", () => {
  assert.equal(windowsPolicy.key("C:/foo/bar"), windowsPolicy.key("C:\\foo\\bar"));
});

test("windows unc paths keep the double prefix", () => {
  assert.equal(windowsPolicy.isRoot("\\\\server\\share"), true);
  assert.equal(windowsPolicy.join("\\\\server\\share", "dir"), "\\\\server\\share\\dir");
});

test("windows join adds a single separator", () => {
  assert.equal(windowsPolicy.join("C:\\", "foo"), "C:\\foo");
  assert.equal(windowsPolicy.join("C:\\foo", "bar"), "C:\\foo\\bar");
});

test("mac root handling", () => {
  assert.equal(macPolicy.isRoot("/"), true);
  assert.equal(macPolicy.isRoot("/Users"), false);
  assert.equal(macPolicy.parent("/"), "/");
  assert.equal(macPolicy.parent("/Users"), "/");
  assert.equal(macPolicy.basename("/"), "/");
  assert.equal(macPolicy.basename("/Users/hcz/a.nv12"), "a.nv12");
});

test("mac segments and join", () => {
  assert.deepEqual(macPolicy.segments("/Users/hcz"), ["Users", "hcz"]);
  assert.deepEqual(macPolicy.segments("/"), []);
  assert.equal(macPolicy.join("/", "Users"), "/Users");
  assert.equal(macPolicy.join("/Users", "hcz"), "/Users/hcz");
});

test("mac keys ignore case but linux keys do not", () => {
  assert.equal(macPolicy.key("/Users/A"), macPolicy.key("/users/a"));
  assert.notEqual(linuxPolicy.key("/Users/A"), linuxPolicy.key("/users/a"));
  assert.equal(linuxPolicy.caseInsensitive, false);
});

test("posix absolute check", () => {
  assert.equal(macPolicy.isAbsolute("/tmp/x"), true);
  assert.equal(macPolicy.isAbsolute("tmp/x"), false);
  assert.equal(linuxPolicy.isAbsolute("/tmp/x"), true);
});

test("trailing slash collapse on posix", () => {
  assert.equal(macPolicy.key("/Users/hcz/"), macPolicy.key("/Users/hcz"));
  assert.equal(macPolicy.key("/Users//hcz"), macPolicy.key("/Users/hcz"));
});
