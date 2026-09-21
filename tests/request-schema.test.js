"use strict";

const assert = require("node:assert/strict");
const { validateRequestBody } = require("../lib/sonara-request-schema.cjs");

describe("runtime request schema validation", () => {
  const schema = Object.freeze({
    name: { type: "string", required: true, minLength: 1, maxLength: 8 },
    mode: { type: "string", enum: ["safe", "strict"] },
    count: { type: "integer", min: 0, max: 10 }
  });

  it("returns only declared normalized fields", () => {
    const result = validateRequestBody({ name: "  Ada  ", mode: "safe", count: 3 }, schema);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { name: "Ada", mode: "safe", count: 3 });
  });

  it("rejects unknown fields instead of permitting parameter smuggling", () => {
    const result = validateRequestBody({ name: "Ada", organization_id: "other-tenant" }, schema);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [{ field: "organization_id", code: "unknown_field" }]);
  });

  it("rejects arrays and nested objects instead of coercing them", () => {
    for (const name of [["Ada"], { value: "Ada" }]) {
      const result = validateRequestBody({ name }, schema);
      assert.equal(result.ok, false);
      assert.deepEqual(result.errors, [{ field: "name", code: "invalid_type" }]);
    }
  });

  it("distinguishes missing, too-long and invalid-enum inputs", () => {
    assert.equal(validateRequestBody({}, schema).errors[0].code, "required");
    assert.equal(validateRequestBody({ name: "123456789" }, schema).errors[0].code, "too_long");
    assert.equal(validateRequestBody({ name: "Ada", mode: "anything" }, schema).errors[0].code, "not_allowed");
  });

  it("rejects non-object bodies and excessive field counts", () => {
    assert.equal(validateRequestBody([], schema).errors[0].code, "invalid_type");
    const many = Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`k${index}`, "x"]));
    assert.equal(validateRequestBody(many, {}, { allowUnknown: true }).errors[0].code, "too_many_fields");
  });

  it("does not coerce JSON strings into numeric or boolean fields", () => {
    const numeric = validateRequestBody({ name: "Ada", count: "3" }, schema);
    assert.equal(numeric.ok, false);
    assert.equal(numeric.errors[0].code, "invalid_type");

    const bool = validateRequestBody({ name: "Ada", enabled: "true" }, {
      name: schema.name,
      enabled: { type: "boolean", required: true }
    });
    assert.equal(bool.ok, false);
    assert.equal(bool.errors[0].code, "invalid_type");
  });
});
