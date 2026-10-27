import test from "node:test";
import assert from "node:assert/strict";
import { detectP010Alignment } from "../common/bitdepth";

function words(values: number[]): Uint8Array {
  const data = new Uint8Array(values.length * 2);
  values.forEach((value, index) => {
    data[index * 2] = value & 0xff;
    data[index * 2 + 1] = (value >> 8) & 0xff;
  });
  return data;
}

test("high-aligned p010 data is detected", () => {
  const values = Array.from({ length: 1024 }, (_, index) => (index % 256) << 8);
  assert.equal(detectP010Alignment(words(values)), "high");
});

test("low-aligned p010 data is detected", () => {
  const values = Array.from({ length: 1024 }, (_, index) => index % 1024);
  assert.equal(detectP010Alignment(words(values)), "low");
});

test("mixed data stays unknown", () => {
  const values = Array.from({ length: 1024 }, () => 0x1555);
  assert.equal(detectP010Alignment(words(values)), "unknown");
});

test("tiny buffers are unknown", () => {
  assert.equal(detectP010Alignment(new Uint8Array(8)), "unknown");
});
