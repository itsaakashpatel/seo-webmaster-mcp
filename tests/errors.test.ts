import test from "node:test";
import assert from "node:assert/strict";
import { getErrorCode, getErrorMessage, withCode } from "../build/core/errors.js";

test("getErrorCode extracts integer codes from direct properties", () => {
  assert.equal(getErrorCode({ code: 403 }), 403);
  assert.equal(getErrorCode({ status: 404 }), 404);
  assert.equal(getErrorCode({ statusCode: 500 }), 500);
  assert.equal(getErrorCode({ code: "429" }), 429);
});

test("getErrorCode extracts codes from Axios / Gaxios error structure", () => {
  const gaxiosError: Record<string, unknown> = {
    response: {
      status: 401,
      data: {
        error: {
          code: 401,
          message: "Unauthorized",
        },
      },
    },
  };
  assert.equal(getErrorCode(gaxiosError), 401);
});

test("getErrorCode extracts code from nested cause chain", () => {
  const root = { code: 429, message: "Quota exceeded" };
  const intermediate = new Error("Failed upstream", { cause: root });
  const top = new Error("Operation failed", { cause: intermediate });
  assert.equal(getErrorCode(top), 429);
});

test("getErrorCode returns undefined for non-objects or missing codes", () => {
  assert.equal(getErrorCode(null), undefined);
  assert.equal(getErrorCode("not an error"), undefined);
  assert.equal(getErrorCode({ message: "just a message" }), undefined);
});

test("getErrorMessage safely converts any value to string", () => {
  assert.equal(getErrorMessage(new Error("custom error")), "custom error");
  assert.equal(getErrorMessage("string error"), "string error");
  assert.equal(getErrorMessage(123), "123");
  assert.equal(getErrorMessage(null), "null");
  assert.equal(getErrorMessage(undefined), "undefined");
});

test("withCode attaches code and returns augmented Error", () => {
  const err = new Error("Resource not found");
  const coded = withCode(err, 404);
  assert.equal(coded.code, 404);
  assert.equal(coded.message, "Resource not found");
  assert.equal(getErrorCode(coded), 404);
});
