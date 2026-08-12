# Streaming and record loading

Audit date: 2026-08-12. Prompted by a streaming-engine explainer (chunked map,
radial load zone, level of detail, asynchronous streaming, seamless swap) and
the question of what it means for this application.

A record list and a game map are not the same problem, and most of the analogy
does not survive contact. What follows separates the parts that describe a real
property of this codebase from the parts that only sound like they do.

## The model, and what each part actually maps to

| Engine concept | Maps to | Verdict |
|---|---|---|
| `ActiveWorld(t) ⊂ TotalWorld` — render only the frustum | A page shows a slice of the records | **Real, and the slice was lying.** Fixed below |
| `Map = ⋃ Chunkᵢ` — partition into independent blocks | Rows are already independent; there is nothing to partition | Not applicable — a table is not a contiguous world |
| `Loaded(p) = {c ∣ dist(p,c) ≤ Rₛ}` — a load zone that moves | `limit=100` ordered by `created_at.desc` | **Half-real.** There is a zone; it does not move. No paging past the first 100 |
| `LOD(d)` — far objects get 4 polygons, near ones 4,820 | List view vs record detail view | **Real and measurable.** See below |
| Async streaming, SSD → RAM → VRAM | Reads already run concurrently via `Promise.all` | Already done, and there is no second tier to stream into |
| Seamless swap, `<12ms`, zero stutter | Server-rendered pages; no swap to be seamless | Not applicable — this is not a client-side scene |

The honest summary is that two of the six describe something true about this
application. The other four are a rendering architecture for a continuous 3D
world, and adopting their vocabulary for a list of invoices would be borrowing
the appearance of rigour rather than the substance.

## What was wrong, and is fixed

**The load zone did not know the size of the map.** Every owner and creator
record page read `limit=100` and captioned the table `${rows.length} records`.
Under the cap that is correct. Over it, the page states a total it never
measured — a business with 250 customers is told it has 100, with nothing on
screen suggesting otherwise. Not a truncated list: a wrong number, presented
with the same confidence as a right one.

An engine loads the chunks near the player and is never confused about how big
the map is. This page had the first half and not the second.

Fixed by reading one row past the page, which settles "is there more" for free,
and paying for an exact count only once the first read shows it will say
something new. Accounts under the cap still cost one query. A failed count
stays `null` and the caption says "more than 100" — the floor the first read
established, rather than a number invented to fill the gap. See
`tests/record-lists-say-what-they-did-not-load.test.js`.

## Level of detail, applied

The owner record pages selected `*` and rendered a handful of columns:

| | Columns |
|---|---|
| Displayed across 22 owner record pages | 112 |
| Fetched by `select=*` | 307 |
| Fetched now | **153** |

Every list view was pulling roughly two and a half times the data it showed, on
every page load, for every row. The Growth Studio record pages already did this
correctly — each declares an explicit `select` naming the fields its columns
read, which is the list's LOD_2 against the detail page's LOD_0. The owner pages
now declare one too.

### Deriving the field list

The fields a page needs cannot be read off its declaration: columns are
`value: (row) => …` functions, the renderer reaches for `row.id` to build the
detail link, and `rowAction` refusal rules read fields no column displays. Two
methods, unioned:

1. **Run it.** Each column function is called against a `Proxy` that records
   every property read.
2. **Read it.** Every property taken off the first parameter in the function
   source.

Both were necessary. The runtime probe alone missed `customer_id` on quotes,
because the refusal rule returns early on any status that is not `accepted` and
never reaches the line that reads it. Across all 22 pages the two methods then
agreed exactly, at 153 fields.

### Why the check does not repeat that derivation

A check that rebuilds the list the same way the list was built agrees with
itself by construction — which is precisely the defect found earlier in the
tenant-tables generator, verified by re-running itself.

`tests/record-selects-cover-every-column.test.js` checks the property instead.
It hands each column function a row containing **only** what the select asked
for and reports anything it reaches for beyond that. It separately checks every
selected field against the columns the migrations actually create, because the
two failure modes are different and only one of them is visible:

| Mistake | What the customer sees |
|---|---|
| Select omits a field a column reads | A blank cell — reads as "this customer has no phone number", not as a bug |
| Select omits a field a *refusal rule* reads | The wrong answer about whether a row can act — no blank cell at all |
| Select names a column the table lacks | PostgREST rejects the whole query; the page reports "not set up yet" |

Verified by dropping `customer_id` from the quotes select and by adding a
misspelled column, both caught by name.

## The load zone moves

The caption was shipped before the pager, which meant a business told it had 250
customers and shown 100 had a number it could not act on. `?page=N` now moves
the window, with plain `Previous 100` / `Next 100` links — plain, because the
rest of these pages are plain forms and a customer with JavaScript disabled
still has a business to run.

Three things the caption had to learn along with it:

- **"the 100 most recent" is true only on page 1.** On page 2 they are not the
  most recent, they are the next hundred, and a customer who cannot tell which
  window they are looking at cannot tell whether the record they came for is
  missing or merely further along. It says `Showing 101 to 200` now.
- **Reaching the end of page 3 does not mean the rows in hand are the total.**
  Everything before the offset is still a record. Reporting `12 records` there
  would have been the original defect relocated, so a later page always counts
  the table rather than the window.
- **`?page=99` on a small account must not render as an empty table**, which is
  indistinguishable from a business that has lost its data. It says the page is
  past the end, and gives the real total.

An unparseable `?page=` is page 1 — an unreadable page number should show the
first page, not an error and not an empty table.

## Still open

**The `also` side tables** on the creator pages — a second list drawn on the
same page — read the first 100 and have no pager, because a second window on
one page needs a second parameter and there are two such lists in the product.
Their caption still states the true total and the window it is showing, so the
limit is visible rather than hidden.

Nothing else. The creator record pages share this renderer and are covered too,
including the `also` side tables — each of those is a second list drawn on the
same page by the same code, and leaving them out would have let a select go
unchecked while the file read as though it covered the renderer. 25 lists in
all.
