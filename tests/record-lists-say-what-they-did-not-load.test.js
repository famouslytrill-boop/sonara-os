"use strict";

// A list that loads 100 rows and calls it "100 records".
//
// Every owner and creator record page read `limit=100` and captioned the table
// with `${rows.length} records`. For an account under the cap that is correct
// and nothing looks wrong. For an account over it, the page states a total it
// never measured: a business with 250 customers is told it has 100, with
// nothing on screen suggesting otherwise. Not a truncated list -- a wrong
// number, presented with the same confidence as a right one.
//
// This is the defect this repository keeps finding: a signal that reports
// success without being true. The row count was never the record count; it was
// the number of rows one query happened to return, and the caption collapsed
// the difference.
//
// The fix asks for one row more than it shows, which settles "is there more"
// for free, and pays for an exact count only when the answer is yes. What is
// checked here is the sentence, because the sentence is what lied.

const assert = require("node:assert/strict");
const { recordCountCaption, PAGE_SIZE, pageNumber } = require("../routes/sonara-last9-routes.cjs");

const rows = (count) => Array.from({ length: count }, (_, index) => ({ id: String(index) }));

describe("a record list says what it did not load", () => {
  it("exports the caption and the page size", () => {
    assert.equal(typeof recordCountCaption, "function", "the caption is not exported; this check cannot look at it");
    assert.ok(Number.isInteger(PAGE_SIZE) && PAGE_SIZE > 0, "PAGE_SIZE is not a usable number");
  });

  it("counts plainly when the read reached the end", () => {
    assert.equal(recordCountCaption(rows(0), { loadedAll: true, total: 0 }), "0 records");
    assert.equal(recordCountCaption(rows(1), { loadedAll: true, total: 1 }), "1 record");
    assert.equal(recordCountCaption(rows(7), { loadedAll: true, total: 7 }), "7 records");
  });

  it("never presents a capped list as the whole of it", () => {
    // The defect, stated as an assertion. A caption for a truncated read must
    // not be a bare count -- that is precisely the sentence that was wrong.
    const caption = recordCountCaption(rows(PAGE_SIZE), { loadedAll: false, total: 250 });
    assert.notEqual(caption, `${PAGE_SIZE} records`, "a truncated list is still captioned as if it were complete");
    assert.match(caption, /250 records/, "the real total is known and not being said");
    assert.match(caption, new RegExp(`${PAGE_SIZE}`), "the caption does not say how many are actually shown");
  });

  it("says only what it knows when the total could not be counted", () => {
    // A failed count is not a total of zero and not a total of 100. "More than
    // 100" is the floor the first read actually established, and claiming any
    // exact number here would be inventing one.
    const caption = recordCountCaption(rows(PAGE_SIZE), { loadedAll: false, total: null });
    assert.match(caption, /More than 100 records/);
    assert.doesNotMatch(caption, /^100 records$/);
  });

  it("describes what is on screen when it was told nothing about paging", () => {
    // An older call site passes no paging information. Describing the rows in
    // hand is the only honest claim available, and it must not throw.
    assert.equal(recordCountCaption(rows(4), null), "4 records");
    assert.equal(recordCountCaption(rows(1), undefined), "1 record");
  });

  it("prefers the counted total over the rows in hand", () => {
    // loadedAll with a total means the read reached the end and the total was
    // measured; they should agree, and if they ever do not, the measured one is
    // the answer -- the rows in hand are what this defect was about trusting.
    assert.equal(recordCountCaption(rows(3), { loadedAll: true, total: 3 }), "3 records");
  });
});

describe("a record list says which records these are", () => {
  it("does not call the second page the most recent", () => {
    // The first caption said "Showing the 100 most recent", which is true on
    // page 1 and false everywhere after it. A customer who cannot tell which
    // window they are looking at cannot tell whether the record they came for
    // is missing or simply further along.
    const caption = recordCountCaption(rows(PAGE_SIZE), { loadedAll: false, total: 250, offset: PAGE_SIZE, page: 2 });
    assert.doesNotMatch(caption, /most recent/, "a later page is still described as the most recent records");
    assert.match(caption, /Showing 101 to 200/);
    assert.match(caption, /250 records/);
  });

  it("counts the whole table on a later page, not the rows in hand", () => {
    // Reaching the end on page 3 does not mean the rows in hand are the total:
    // everything before the offset is still a record. Reporting 12 here would
    // be the original defect, relocated.
    const caption = recordCountCaption(rows(12), { loadedAll: false, total: 212, offset: 200, page: 3 });
    assert.match(caption, /212 records/);
    assert.match(caption, /Showing 201 to 212/);
    assert.doesNotMatch(caption, /^12 records/);
  });

  it("says so rather than looking empty when the page is past the end", () => {
    // ?page=99 on a small account must not render as an account with no
    // records -- that is indistinguishable from a business that has lost its
    // data.
    const caption = recordCountCaption(rows(0), { loadedAll: false, total: 40, offset: 9800, page: 99 });
    assert.match(caption, /past the end/);
    assert.match(caption, /40 records/);
  });

  it("treats an unusable page number as the first page", () => {
    for (const value of ["0", "-3", "abc", "", null, undefined, "1.9e400", {}]) {
      assert.equal(pageNumber(value), 1, `${JSON.stringify(value)} should fall back to page 1`);
    }
    assert.equal(pageNumber("2"), 2);
    assert.equal(pageNumber(7), 7);
  });
});
