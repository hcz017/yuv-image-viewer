import test from "node:test";
import assert from "node:assert/strict";
import { formatFromName, parseSizeCandidates } from "../common/filenameParser";

test("format comes from the extension", () => {
  assert.equal(formatFromName("frame.nv12"), "nv12");
  assert.equal(formatFromName("FRAME.P010"), "p010");
  assert.equal(formatFromName("frame.yuv"), "yuv");
  assert.equal(formatFromName("frame.png"), null);
  assert.equal(formatFromName("frame"), null);
});

test("parses size and align pair", () => {
  const [candidate] = parseSizeCandidates("clip_size_640x480_align768x512_.nv12");
  assert.deepEqual(
    { w: candidate.width, h: candidate.height, stride: candidate.stride, scanline: candidate.scanline },
    { w: 640, h: 480, stride: 768, scanline: 512 }
  );
  assert.equal(candidate.source, "size+align");
});

test("parses size and stride", () => {
  const [candidate] = parseSizeCandidates("clip_size_640x480_stride_768_.nv12");
  assert.equal(candidate.width, 640);
  assert.equal(candidate.stride, 768);
  assert.equal(candidate.scanline, 480);
  assert.equal(candidate.source, "size+stride");
});

test("parses WxH_align without underscores", () => {
  const [candidate] = parseSizeCandidates("clip_640x480_align768x512.nv12");
  assert.equal(candidate.width, 640);
  assert.equal(candidate.stride, 768);
  assert.equal(candidate.source, "WxH_align");
});

test("generic candidates are collected from the end first", () => {
  const candidates = parseSizeCandidates("1280x720_640x480.nv12");
  assert.equal(candidates[0].width, 640);
  assert.equal(candidates[1].width, 1280);
});

test("duplicate candidates are removed", () => {
  const candidates = parseSizeCandidates("640x480_640x480.nv12");
  assert.equal(candidates.length, 1);
});

test("names without sizes yield no candidates", () => {
  assert.deepEqual(parseSizeCandidates("plain.nv12"), []);
});

test("tiny numbers below the pattern are ignored", () => {
  assert.deepEqual(parseSizeCandidates("a1x2.nv12"), []);
});
