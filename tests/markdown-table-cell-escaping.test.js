"use strict";

const assert = require("node:assert/strict");

describe("Markdown table cell escaping", () => {
  let markdownTableCell;

  before(async () => {
    ({ markdownTableCell } = await import("../scripts/markdown-table-cell.mjs"));
  });

  it("escapes backslashes before delimiters and flattens line breaks", () => {
    assert.equal(markdownTableCell("C:\\temp|route\r\nnext"), "C:\\\\temp\\|route next");
  });

  it("normalizes nullish values without creating a table delimiter", () => {
    assert.equal(markdownTableCell(null), "");
    assert.equal(markdownTableCell(undefined), "");
  });
});
