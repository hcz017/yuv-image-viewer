import test from "node:test";
import assert from "node:assert/strict";
import {
  SPEC_CACHE_VERSION,
  decodeSpecCache,
  encodeSpecCache,
  entryMatches,
  type SpecCacheEntry,
} from "../common/specCache";
import { makeSpec } from "../common/spec";

function entry(): SpecCacheEntry {
  return {
    path: "C:\\frames\\odd.yuv",
    size: 460800,
    modifiedMs: 1_700_000_000_000,
    spec: makeSpec(640, 480, 640, 480, "nv12"),
    updatedMs: 1_700_000_100_000,
  };
}

test("cache entries round-trip through the wire format", () => {
  const original = entry();
  const wire = encodeSpecCache([original]);
  assert.equal(wire.version, SPEC_CACHE_VERSION);
  const decoded = decodeSpecCache(wire);
  assert.equal(decoded.length, 1);
  assert.deepEqual(decoded[0], original);
});

test("unknown cache versions are ignored", () => {
  const wire = { ...encodeSpecCache([entry()]), version: 99 };
  assert.deepEqual(decodeSpecCache(wire), []);
});

test("malformed cache entries are dropped", () => {
  const wire = encodeSpecCache([entry()]);
  const broken = {
    ...wire,
    entries: [
      { ...wire.entries[0], format: "rgb24" },
      { ...wire.entries[0], width: -1 },
      { ...wire.entries[0], path: "" },
      { ...wire.entries[0], modified_ms: "yesterday" },
      wire.entries[0],
    ],
  };
  const decoded = decodeSpecCache(broken);
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].path, "C:\\frames\\odd.yuv");
});

test("missing or invalid payloads decode to an empty cache", () => {
  assert.deepEqual(decodeSpecCache(null), []);
  assert.deepEqual(decodeSpecCache({}), []);
  assert.deepEqual(decodeSpecCache({ version: SPEC_CACHE_VERSION, entries: "nope" }), []);
});

test("validity requires both file size and modification time to match", () => {
  const cached = entry();
  assert.ok(entryMatches(cached, 460800, 1_700_000_000_000));
  assert.ok(!entryMatches(cached, 460801, 1_700_000_000_000));
  assert.ok(!entryMatches(cached, 460800, 1_700_000_000_001));
});
