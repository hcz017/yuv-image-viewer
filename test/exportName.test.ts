import test from "node:test";
import assert from "node:assert/strict";
import { exportFileName, replaceExtension, stripExtension } from "../common/exportName";

test("strips every supported extension", () => {
  assert.equal(stripExtension("clip.nv12"), "clip");
  assert.equal(stripExtension("clip.JPEG"), "clip");
  assert.equal(stripExtension("clip.png"), "clip");
  assert.equal(stripExtension("clip.v2.nv12"), "clip.v2");
});

test("keeps unknown extensions intact", () => {
  assert.equal(stripExtension("clip.bmp"), "clip.bmp");
});

test("export name switches the extension", () => {
  assert.equal(exportFileName("clip_640x480.nv12", "jpg"), "clip_640x480.jpg");
  assert.equal(exportFileName("clip.JPG", "png"), "clip.png");
});

test("batch output stays next to the source file", () => {
  assert.equal(replaceExtension("D:/frames/clip.nv12", "png"), "D:/frames/clip.png");
  assert.equal(replaceExtension("D:\\frames\\clip.yuv", "jpg"), "D:\\frames\\clip.jpg");
});
