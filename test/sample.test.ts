import test from "node:test";
import assert from "node:assert/strict";
import { makeSpec } from "../common/spec";
import { readPixel } from "../common/sample";

function nv12Gray(): Uint8Array {
  const spec = makeSpec(2, 2, 2, 2, "nv12");
  const data = new Uint8Array((spec.stride * spec.scanline * 3) / 2);
  data.fill(100, 0, 4);
  data[4] = 128;
  data[5] = 128;
  return data;
}

test("nv12 neutral chroma yields gray", () => {
  const spec = makeSpec(2, 2, 2, 2, "nv12");
  const pixel = readPixel(nv12Gray(), spec, 1, 1, "bt601");
  assert.ok(pixel);
  assert.equal(pixel?.y, 100);
  assert.equal(pixel?.u, 128);
  assert.equal(pixel?.v, 128);
  assert.equal(pixel?.r, 100);
  assert.equal(pixel?.g, 100);
  assert.equal(pixel?.b, 100);
});

test("out of range coordinates yield null", () => {
  const spec = makeSpec(2, 2, 2, 2, "nv12");
  assert.equal(readPixel(nv12Gray(), spec, -1, 0, "bt601"), null);
  assert.equal(readPixel(nv12Gray(), spec, 2, 0, "bt601"), null);
});

test("nv21 swaps the chroma order", () => {
  const spec = makeSpec(2, 2, 2, 2, "nv21");
  const data = new Uint8Array(6);
  data.fill(90, 0, 4);
  data[4] = 200;
  data[5] = 100;
  const pixel = readPixel(data, spec, 0, 0, "bt601");
  assert.ok(pixel);
  assert.equal(pixel?.v, 200);
  assert.equal(pixel?.u, 100);
  assert.ok((pixel?.r ?? 0) > 90);
});
