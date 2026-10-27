import test from "node:test";
import assert from "node:assert/strict";
import { expectedBytes, formatDimensions, makeSpec, validateSpec } from "../common/spec";
import { resolveSpec } from "../common/resolveSpec";
import { guessSpecsBySize } from "../common/sizeGuesser";

test("nv12 byte count for 640x480", () => {
  const spec = makeSpec(640, 480, 640, 480, "nv12");
  assert.equal(spec.bytesPerSample, 1);
  assert.equal(expectedBytes(spec), 460800);
});

test("p010 byte count doubles", () => {
  const spec = makeSpec(640, 480, 640, 480, "p010");
  assert.equal(spec.bytesPerSample, 2);
  assert.equal(expectedBytes(spec), 921600);
});

test("stride padding is part of the byte count", () => {
  const spec = makeSpec(1920, 1080, 2048, 1088, "nv12");
  assert.equal(expectedBytes(spec), (2048 * 1088 * 3) / 2);
});

test("exact size validates as ok", () => {
  const spec = makeSpec(640, 480, 640, 480, "nv12");
  assert.equal(validateSpec(spec, 460800).kind, "ok");
});

test("larger files are reported as trailing", () => {
  const spec = makeSpec(640, 480, 640, 480, "nv12");
  const check = validateSpec(spec, 460800 + 16);
  assert.equal(check.kind, "trailing");
  assert.equal(check.expected, 460800);
});

test("short files are invalid", () => {
  const spec = makeSpec(640, 480, 640, 480, "nv12");
  assert.equal(validateSpec(spec, 460799).kind, "invalid");
});

test("odd dimensions are invalid", () => {
  assert.equal(validateSpec(makeSpec(641, 480, 641, 480, "nv12"), 1e9).kind, "invalid");
  assert.equal(validateSpec(makeSpec(640, 481, 640, 481, "nv12"), 1e9).kind, "invalid");
});

test("stride smaller than width is invalid", () => {
  assert.equal(validateSpec(makeSpec(640, 480, 512, 480, "nv12"), 1e9).kind, "invalid");
});

test("stride beyond gpu limit is invalid", () => {
  const spec = makeSpec(640, 480, 640, 480, "nv12");
  assert.equal(validateSpec(spec, 1e9, 256).kind, "invalid");
});

test("formatDimensions renders WxH", () => {
  assert.equal(formatDimensions(makeSpec(640, 480, 640, 480, "nv12")), "640x480");
});

test("size guessing finds the 640x480 nv12 spec", () => {
  const guesses = guessSpecsBySize(460800, "nv12");
  assert.equal(guesses.length, 1);
  assert.equal(guesses[0].width, 640);
  assert.equal(guesses[0].height, 480);
});

test("resolveSpec uses the filename when it carries a size", () => {
  const result = resolveSpec({ name: "clip_1280x720.nv12", fileSize: 1382400, format: null });
  assert.equal(result.kind, "resolved");
  if (result.kind === "resolved") {
    assert.equal(result.spec.width, 1280);
    assert.equal(result.spec.height, 720);
  }
});

test("resolveSpec guesses from the byte size when the name is generic", () => {
  const result = resolveSpec({ name: "frame.nv12", fileSize: 460800, format: null });
  assert.equal(result.kind, "resolved");
  if (result.kind === "resolved") {
    assert.equal(result.spec.width, 640);
  }
});

test("resolveSpec asks for a format when the extension is yuv", () => {
  assert.equal(resolveSpec({ name: "frame.yuv", fileSize: 460800, format: null }).kind, "chooseFormat");
});

test("resolveSpec falls back to manual when nothing matches", () => {
  assert.equal(resolveSpec({ name: "frame.nv12", fileSize: 123457, format: null }).kind, "manual");
});

test("resolveSpec rejects tiny files", () => {
  assert.equal(resolveSpec({ name: "a.nv12", fileSize: 4, format: "nv12" }).kind, "invalid");
});
