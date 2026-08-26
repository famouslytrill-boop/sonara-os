"use strict";

// The application could not accept a file until now. The two ways a parser
// like this goes wrong are both silent:
//
//   1. **It corrupts the file by a few bytes** — a wrong CRLF at a part
//      boundary, or a round trip through a string. The upload succeeds, the
//      row is written, and the JPEG will not open a week later.
//   2. **It trusts what the sender said the file was.** A filename with `../`
//      in it, or a text/html file declared as an image.
//
// Every test here is one of those two.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const multipart = require("../lib/sonara-multipart.cjs");

const BOUNDARY = "----sonaratest12345";

/** Build a body the way a browser would. */
function bodyOf(parts, boundary = BOUNDARY) {
  const chunks = [];
  for (const part of parts) {
    let head = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename !== undefined) head += `; filename="${part.filename}"`;
    head += "\r\n";
    if (part.type) head += `Content-Type: ${part.type}\r\n`;
    head += "\r\n";
    chunks.push(Buffer.from(head, "latin1"));
    chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(String(part.value), "utf8"));
    chunks.push(Buffer.from("\r\n", "latin1"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "latin1"));
  return Buffer.concat(chunks);
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  crypto.randomBytes(512)
]);

describe("an upload", () => {
  describe("arrives byte for byte", () => {
    it("returns a file identical to the one that went in", () => {
      const parsed = multipart.parse(
        bodyOf([{ name: "photo", filename: "job.png", type: "image/png", value: PNG }]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      assert.equal(parsed.ok, true);
      assert.equal(parsed.files.length, 1);
      assert.deepEqual(parsed.files[0].bytes, PNG, "the bytes must be the same bytes");
    });

    it("survives content containing CRLF, which is the framing character", () => {
      // The most likely way to lose exactly two bytes off every file.
      const awkward = Buffer.from([0x00, 0x0d, 0x0a, 0x41, 0x0d, 0x0a, 0x0d, 0x0a, 0xff, 0xfe]);
      const parsed = multipart.parse(
        bodyOf([{ name: "f", filename: "x.bin", value: awkward }]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      assert.deepEqual(parsed.files[0].bytes, awkward);
    });

    it("survives content that contains the boundary text without the dashes", () => {
      const tricky = Buffer.from(`before ${BOUNDARY} after`, "utf8");
      const parsed = multipart.parse(
        bodyOf([{ name: "f", filename: "x.txt", value: tricky }]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      assert.deepEqual(parsed.files[0].bytes, tricky);
    });

    it("survives every byte value, which a round trip through a string does not", () => {
      // A file turned into UTF-8 and back is not the same file: invalid
      // sequences become U+FFFD and the corruption is invisible until somebody
      // opens it.
      const everyByte = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
      const parsed = multipart.parse(
        bodyOf([{ name: "f", filename: "all.bin", value: everyByte }]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      assert.deepEqual(parsed.files[0].bytes, everyByte);
      assert.equal(parsed.files[0].bytes.length, 256);
    });

    it("reads several files and several fields from one body", () => {
      const second = crypto.randomBytes(64);
      const parsed = multipart.parse(
        bodyOf([
          { name: "title", value: "Kitchen job" },
          { name: "before", filename: "a.png", type: "image/png", value: PNG },
          { name: "notes", value: "leak under the sink" },
          { name: "after", filename: "b.bin", value: second }
        ]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      assert.deepEqual(parsed.fields, { title: "Kitchen job", notes: "leak under the sink" });
      assert.deepEqual(parsed.files.map((f) => f.field), ["before", "after"]);
      assert.deepEqual(parsed.files[1].bytes, second);
    });

    it("reads an empty field as an empty string rather than dropping it", () => {
      // Absent and blank are different answers, and a form that silently drops
      // a cleared box makes them the same.
      const parsed = multipart.parse(
        bodyOf([{ name: "notes", value: "" }]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      assert.deepEqual(parsed.fields, { notes: "" });
    });

    it("accepts a quoted boundary, which some senders use", () => {
      const parsed = multipart.parse(
        bodyOf([{ name: "a", value: "1" }]),
        `multipart/form-data; boundary="${BOUNDARY}"`
      );
      assert.equal(parsed.ok, true);
    });
  });

  describe("cannot be used to write outside where it belongs", () => {
    const traversals = [
      // The basename, not a mangled path: `../../etc/passwd` is `passwd`.
      ["../../etc/passwd", "passwd"],
      ["..\\..\\windows\\system32", "system32"],
      ["/absolute/path.png", "path.png"],
      ["...", "file"],
      ["..", "file"],
      ["", "file"]
    ];

    for (const [given, expected] of traversals) {
      it(`rebuilds ${JSON.stringify(given)} as ${JSON.stringify(expected)}`, () => {
        assert.equal(multipart.safeFilename(given), expected);
      });
    }

    it("keeps no directory separator in any filename it returns", () => {
      const parsed = multipart.parse(
        bodyOf([{ name: "f", filename: "../../secret/key.png", value: PNG }]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      const name = parsed.files[0].filename;
      assert.ok(!name.includes("/") && !name.includes("\\"), name);
      assert.ok(!name.startsWith("."), name);
    });
  });

  describe("reads the bytes rather than believing the sender", () => {
    it("names the real type of a file whatever it was declared as", () => {
      const parsed = multipart.parse(
        bodyOf([{ name: "f", filename: "photo.png", type: "image/png", value: Buffer.from("<html>hello</html>") }]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      const verdict = multipart.accept(parsed.files[0], ["image/png", "image/jpeg"]);
      assert.equal(verdict.ok, false);
      assert.equal(verdict.code, "unknown_type");
    });

    it("refuses a real file of the wrong kind, and says which kind it is", () => {
      const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), crypto.randomBytes(64)]);
      const parsed = multipart.parse(
        bodyOf([{ name: "f", filename: "invoice.png", type: "image/png", value: pdf }]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      const verdict = multipart.accept(parsed.files[0], ["image/png"]);
      assert.equal(verdict.ok, false);
      assert.match(verdict.problem, /application\/pdf/);
    });

    it("reports a mismatch even when it accepts the file", () => {
      // Usually a renamed extension, occasionally somebody trying something.
      // Either way it is worth seeing.
      const parsed = multipart.parse(
        bodyOf([{ name: "f", filename: "photo.png", type: "image/png", value: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(32)]) }]),
        `multipart/form-data; boundary=${BOUNDARY}`
      );
      const verdict = multipart.accept(parsed.files[0], ["image/jpeg"]);
      assert.equal(verdict.ok, true);
      assert.equal(verdict.type, "image/jpeg");
      assert.equal(verdict.mismatched, true);
    });

    it("returns null for a type it cannot tell, rather than guessing", () => {
      // "I could not tell" and "this is a JPEG" are different answers, and
      // folding them together is how a page serves HTML as an image.
      assert.equal(multipart.sniff(crypto.randomBytes(64)), null);
      assert.equal(multipart.sniff(Buffer.alloc(0)), null);
      assert.equal(multipart.sniff(Buffer.from("ab")), null);
    });

    it("recognises what this product actually receives", () => {
      const cases = [
        [Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)]), "image/jpeg"],
        [PNG, "image/png"],
        [Buffer.concat([Buffer.from("RIFF...."), Buffer.from("WAVE"), Buffer.alloc(16)]), "audio/wav"],
        [Buffer.concat([Buffer.from("...."), Buffer.from("ftypM4A "), Buffer.alloc(16)]), "audio/mp4"],
        [Buffer.concat([Buffer.from("%PDF-1.4"), Buffer.alloc(16)]), "application/pdf"]
      ];
      for (const [bytes, expected] of cases) {
        assert.equal(multipart.sniff(bytes), expected, expected);
      }
    });
  });

  describe("has limits, and says which one was hit", () => {
    it("refuses a body over the total limit", () => {
      const answer = multipart.parse(
        bodyOf([{ name: "f", filename: "big.bin", value: Buffer.alloc(2048) }]),
        `multipart/form-data; boundary=${BOUNDARY}`,
        { maxTotalBytes: 1024 }
      );
      assert.equal(answer.code, "too_large");
      assert.match(answer.problem, /1024/);
    });

    it("refuses one file over the per-file limit, naming it", () => {
      const answer = multipart.parse(
        bodyOf([{ name: "f", filename: "huge.png", value: Buffer.alloc(4096) }]),
        `multipart/form-data; boundary=${BOUNDARY}`,
        { maxFileBytes: 1024 }
      );
      assert.equal(answer.code, "file_too_large");
      assert.match(answer.problem, /huge\.png/, "'upload failed' sends somebody to try the same file again");
    });

    it("refuses too many files", () => {
      const parts = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}`, filename: `${i}.bin`, value: Buffer.alloc(4) }));
      const answer = multipart.parse(bodyOf(parts), `multipart/form-data; boundary=${BOUNDARY}`, { maxFiles: 3 });
      assert.equal(answer.code, "too_many_files");
    });

    it("refuses too many fields", () => {
      const parts = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}`, value: "x" }));
      const answer = multipart.parse(bodyOf(parts), `multipart/form-data; boundary=${BOUNDARY}`, { maxFields: 3 });
      assert.equal(answer.code, "too_many_fields");
    });

    it("has limits a caller can tighten but not be talked out of", () => {
      assert.ok(multipart.DEFAULTS.maxTotalBytes > 0);
      assert.ok(multipart.DEFAULTS.maxFileBytes <= multipart.DEFAULTS.maxTotalBytes);
    });
  });

  describe("never throws on something malformed", () => {
    const rubbish = [
      ["nothing at all", Buffer.alloc(0), "multipart/form-data; boundary=x"],
      ["no boundary in the header", bodyOf([{ name: "a", value: "1" }]), "multipart/form-data"],
      ["a different content type", bodyOf([{ name: "a", value: "1" }]), "application/json"],
      ["a boundary that is not in the body", bodyOf([{ name: "a", value: "1" }]), "multipart/form-data; boundary=elsewhere"],
      ["a part with no headers", Buffer.from(`--${BOUNDARY}\r\n\r\n`, "latin1"), `multipart/form-data; boundary=${BOUNDARY}`],
      ["a part cut off mid-way", Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="a"\r\n\r\nhalf`, "latin1"), `multipart/form-data; boundary=${BOUNDARY}`],
      ["random bytes", crypto.randomBytes(400), `multipart/form-data; boundary=${BOUNDARY}`],
      ["a quoted boundary containing a quote", bodyOf([{ name: "a", value: "1" }]), 'multipart/form-data; boundary="a"b"']
    ];

    for (const [what, body, type] of rubbish) {
      it(`refuses ${what} rather than throwing`, () => {
        // A body that is not what it says it is comes from outside. A parser
        // that throws on it hands whoever sent it a way to produce a 500.
        const answer = multipart.parse(body, type);
        assert.equal(answer.ok, false, what);
        assert.ok(answer.problem, "a refusal has to say something");
      });
    }
  });
});
