"use strict";

// What a customer reads when their generated work does not arrive.
//
// The job page printed job.error_message straight onto the screen, so somebody
// whose audio failed to save read:
//
//     What went wrong: storage_upload_failed_413
//
// That is the right value to keep in the record and the wrong thing to show a
// person. It does not say the file was too large, and it does not say what to
// do instead.
//
// 413 is worth naming precisely rather than lumping in with "something went
// wrong". Storage buckets carry a per-plan size limit -- 50 MiB on the free
// plan -- and a long piece of generated audio passes it easily, so this is a
// failure customers will actually hit. Whether it is being hit in production
// right now is a question about the project's plan that cannot be answered from
// this repository.

const assert = require("node:assert/strict");
const { generationFailureText, GENERATION_FAILURE } = require("../lib/sonara-plain-language.cjs");

describe("what a customer reads when generation fails", () => {
  it("names the actual size limit rather than saying the file was too big", () => {
    // Stricter than it looks. An earlier version said "too large" and offered
    // to "raise your storage limit" -- vague, and a promise nobody was going to
    // keep, since the limit is a plan the business decided not to buy rather
    // than a setting somebody can turn up. A number a customer can measure
    // against is the useful thing.
    for (const code of ["storage_upload_failed_413", "storage_upload_failed_402"]) {
      const text = generationFailureText(code);
      assert.match(text, /\b\d+\s?(MB|MiB)\b/, `${code} does not name a size the customer can act on`);
      assert.match(text, /shorter/i, `${code} does not say what would work instead`);
      assert.doesNotMatch(text, /ask us to raise|upgrade|contact us to increase/i, `${code} offers to raise a limit that is not going to be raised`);
    }
  });

  it("never shows the raw code", () => {
    // The whole point. A code is not a sentence.
    for (const code of Object.keys(GENERATION_FAILURE)) {
      const text = generationFailureText(code);
      assert.doesNotMatch(text, /storage_upload_failed|output_storage_failed|provider_unreachable|[a-z]+_[a-z]+_[a-z]+/, `${code} renders something that still looks like a code: ${text}`);
    }
  });

  it("says something useful for a code it does not know", () => {
    const text = generationFailureText("storage_upload_failed_502");
    assert.doesNotMatch(text, /storage_upload_failed_502/, "an unknown code is printed raw");
    assert.match(text, /did not say|tell us/i, "an unknown code produces nothing a customer can act on");
  });

  it("passes through a real message rather than replacing it", () => {
    // Some failures carry a genuine sentence from a provider. Overwriting that
    // with a generic line would lose the only specific thing the customer had.
    const provider = "The reference track could not be read.";
    assert.equal(generationFailureText("some_unmapped_code", provider), provider);
  });

  it("does not mistake a code in the message field for a sentence", () => {
    // failJobResult stores the code in both fields for several paths, so the
    // fallback has to recognise a code and refuse it.
    const text = generationFailureText("unmapped", "storage_upload_failed_413");
    assert.doesNotMatch(text, /storage_upload_failed_413/, "a code arriving as the message was printed raw");
  });

  it("writes sentences, not fragments", () => {
    // These go in front of somebody whose work just failed. A lowercase
    // fragment reads as debug output even when the words are plain.
    const wrong = [];
    for (const [code, text] of Object.entries(GENERATION_FAILURE)) {
      if (!/^[A-Z]/.test(text)) wrong.push(`${code} does not start with a capital`);
      if (!/[.!]$/.test(text)) wrong.push(`${code} does not end with a full stop`);
      if (text.length < 25) wrong.push(`${code} is too short to explain anything`);
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("avoids blaming the customer for something that is ours", () => {
    // A storage limit is our configuration, not their mistake.
    for (const [code, text] of Object.entries(GENERATION_FAILURE)) {
      assert.doesNotMatch(text, /you (?:failed|did|entered) (?:something )?wrong|your fault|invalid input/i, `${code} blames the customer`);
    }
  });
});
