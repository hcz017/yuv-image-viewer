import test from "node:test";
import assert from "node:assert/strict";
import { validateFileName } from "../common/rename";

test("accepts ordinary file names", () => {
  assert.equal(validateFileName("frame_1920x1080.yuv"), null);
  assert.equal(validateFileName("  padded.nv12  "), null);
});

test("rejects empty names", () => {
  assert.equal(validateFileName(""), "文件名不能为空");
  assert.equal(validateFileName("   "), "文件名不能为空");
});

test("rejects names with path separators or dot entries", () => {
  assert.notEqual(validateFileName("a/b.yuv"), null);
  assert.notEqual(validateFileName("a\\b.yuv"), null);
  assert.notEqual(validateFileName("."), null);
  assert.notEqual(validateFileName(".."), null);
});

test("rejects characters invalid on Windows", () => {
  for (const name of ['a:b.yuv', 'a*b.yuv', 'a?b.yuv', 'a"b.yuv', 'a<b.yuv', 'a>b.yuv', 'a|b.yuv']) {
    assert.notEqual(validateFileName(name), null, name);
  }
});
