"use strict";

// Two high-severity CodeQL alerts on lib/sonara-multipart.cjs, and one more, all
// reached once the profile picture upload made the parser part of a new request
// path. Each is measured here rather than taken on the scanner's word.
//
// **A field name was a property name.** parse wrote every form field onto a plain
// object under the name the sender chose. A field called `constructor` replaced
// `fields.constructor` with a string; a field called `__proto__` stored nothing,
// counted nothing, and vanished. parseDisposition did the same with every
// parameter on the Content-Disposition line. Both write sites were flagged as
// remote property injection.
//
// **The header was read with a regular expression that backtracks.**
// /^multipart\/form-data\s*;\s*(.*)$/i has two quantifiers that can each take a
// space. On a header that fails at the end, the time grows with the square of the
// length: measured at 5ms for 2,000 characters and 278ms for 16,000. The failing
// input needs a line feed inside the header, which Node's HTTP parser rejects, so
// this was the scanner being right about the shape and probably not about
// reachability. It is fixed regardless; a regex's safety should not depend on the
// parser in front of it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const multipart = require("../lib/sonara-multipart.cjs");

const BOUNDARY = "XyZbound";
const TYPE = `multipart/form-data; boundary=${BOUNDARY}`;
const part = (disposition, body) => `--${BOUNDARY}\r\nContent-Disposition: form-data; ${disposition}\r\n\r\n${body}\r\n`;
const form = (...parts) => Buffer.from(parts.join("") + `--${BOUNDARY}--\r\n`);

describe("a form field cannot name a property", () => {
  describe("field names a plain object already has", () => {
    for (const name of ["constructor", "__proto__", "prototype"]) {
      it(`refuses a field called ${name}`, () => {
        const parsed = multipart.parse(form(part(`name="${name}"`, "x")), TYPE);
        assert.equal(parsed.ok, false, `a field called ${name} was accepted`);
        assert.equal(parsed.code, "reserved_field_name");
      });
    }

    it("still accepts ordinary fields and returns them as a plain object", () => {
      const parsed = multipart.parse(form(part('name="title"', "Kitchen job"), part('name="notes"', "leak")), TYPE);
      assert.equal(parsed.ok, true);
      assert.deepEqual(parsed.fields, { title: "Kitchen job", notes: "leak" });
      // Built-ins untouched: the property the first version let a sender replace.
      assert.equal(typeof parsed.fields.constructor, "function");
    });

    it("counts every field against the limit", () => {
      // The old Object.keys count missed a field that wrote nothing. Now every
      // field is counted, so the limit is the limit.
      const parsed = multipart.parse(form(part('name="a"', "1"), part('name="b"', "2"), part('name="c"', "3")), TYPE, { maxFields: 2 });
      assert.equal(parsed.ok, false);
      assert.equal(parsed.code, "too_many_fields");
    });
  });

  describe("disposition parameters a sender chose", () => {
    it("reads name and filename and nothing else", () => {
      const parsed = multipart.parse(form(part('name="title"; constructor="y"; toString="z"', "ok")), TYPE);
      assert.equal(parsed.ok, true);
      assert.deepEqual(parsed.fields, { title: "ok" });
    });

    it("still tells an empty file input from a field", () => {
      // An empty filename is how a browser sends a file input left empty; it must
      // stay a file, not become a field. parse checks for the filename's presence.
      const parsed = multipart.parse(form(part('name="picture"; filename=""', "")), TYPE);
      assert.equal(parsed.ok, true);
      assert.deepEqual(parsed.fields, {});
    });

    it("writes no sender-chosen key onto the disposition object", () => {
      const source = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-multipart.cjs"), "utf8");
      // The two write shapes the scanner flagged, by the variable names they used.
      assert.doesNotMatch(source, /\bout\[key\]\s*=/, "parseDisposition writes a sender's key onto an object again");
      assert.doesNotMatch(source, /\bfields\[disposition\.name\]\s*=/, "parse writes a sender's field name onto an object again");
    });
  });

  describe("reading the boundary", () => {
    it("still finds it, quoted or not, whatever the case and spacing", () => {
      assert.equal(multipart.boundaryOf('multipart/form-data; boundary="abc"'), "abc");
      assert.equal(multipart.boundaryOf("Multipart/Form-Data ; charset=utf-8; boundary=xyz"), "xyz");
      assert.equal(multipart.boundaryOf("  multipart/form-data;boundary=q  "), "q");
    });

    it("refuses what the old pattern refused", () => {
      assert.equal(multipart.boundaryOf("text/plain; boundary=x"), null);
      assert.equal(multipart.boundaryOf("multipart/form-data"), null);
      assert.equal(multipart.boundaryOf("multipart/form-data; boundary=\"a\"b\""), null);
      // A line terminator: the old `(.*)` did not cross one, so neither does this.
      assert.equal(multipart.boundaryOf("multipart/form-data; boundary=a\nb"), null);
    });

    it("takes time in proportion to the header, not its square", () => {
      // The old pattern took about 2.7 seconds at this length (278ms at 16,000,
      // quadrupling per doubling). A linear read takes well under a millisecond;
      // the bound is set two orders of magnitude above that so a slow machine does
      // not make this flaky, and still three below the quadratic case.
      const hostile = "multipart/form-data;" + " ".repeat(50000) + "a\nb";
      const started = process.hrtime.bigint();
      multipart.boundaryOf(hostile);
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      assert.ok(elapsedMs < 200, `reading a 50,000-character header took ${elapsedMs.toFixed(1)}ms`);
    });
  });
});
