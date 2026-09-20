import test from "node:test";
import assert from "node:assert/strict";
import { isRecord, asRecord, asFiniteNumber, asString } from "../build/core/guards.js";

test("isRecord correctly identifies non-null non-array objects", () => {
  assert.equal(isRecord({ a: 1 }), true);
  assert.equal(isRecord({}), true);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord("string"), false);
  assert.equal(isRecord(123), false);
  assert.equal(isRecord(undefined), false);
});

test("asRecord returns record or throws descriptive error", () => {
  const obj: Record<string, unknown> = { foo: "bar" };
  assert.equal(asRecord(obj, "test"), obj);
  assert.throws(() => asRecord("bad", "item"), {
    message: /Invalid item: expected an object/,
  });
});

test("asFiniteNumber returns value if finite number, fallback otherwise", () => {
  assert.equal(asFiniteNumber(42, 0), 42);
  assert.equal(asFiniteNumber(0, 10), 0);
  assert.equal(asFiniteNumber(-3.14, 0), -3.14);
  assert.equal(asFiniteNumber(Number.NaN, 5), 5);
  assert.equal(asFiniteNumber(Number.POSITIVE_INFINITY, 5), 5);
  assert.equal(asFiniteNumber("42", 5), 5);
  assert.equal(asFiniteNumber(undefined, 5), 5);
});

test("asString returns value if string, fallback otherwise", () => {
  assert.equal(asString("hello", "fallback"), "hello");
  assert.equal(asString("", "fallback"), "");
  assert.equal(asString(123, "fallback"), "fallback");
  assert.equal(asString(null, "fallback"), "fallback");
  assert.equal(asString(undefined, "fallback"), "fallback");
});
