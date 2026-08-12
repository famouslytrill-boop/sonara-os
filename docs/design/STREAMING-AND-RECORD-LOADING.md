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

## What is real, measured, and not yet applied

**Level of detail.** The owner record pages select `*` and render a handful of
columns:

| | Columns |
|---|---|
| Displayed across 22 owner record pages | 112 |
| Fetched by `select=*` | 307 |
| Ratio | **2.7×** |

Every list view pulls roughly two and a half times the data it shows, on every
page load, for every row. The Growth Studio record pages already do this
correctly — each declares an explicit `select` naming exactly the fields its
columns read, which is LOD_2 for the list and LOD_0 on the detail page.

**It is deliberately not fixed here, and the reason matters.** The columns a
page displays are declared as `value: (row) => …` functions, so the fields a
row actually needs cannot be recovered by reading the declaration — a renderer
also reaches for `row.id` to build the detail link, and `rowAction` refusal
rules read fields no column displays (`status`, `customer_id`, `amount_cents`).
Inferring the select list from those arrow functions would work on most pages
and silently blank cells on the rest, and a blank cell in a business record is
worse than an oversized query.

The safe version is the one Growth Studio already uses: each page declares its
own `select`, explicitly, and a check asserts every field a column reads is in
it. That is real work across 22 pages plus the check, and it is worth doing —
recorded here with the measurement so it is picked up as a task rather than
rediscovered as an idea.

**Paging past the first 100** is the other half. The list now says a total
exists beyond the cap; it still offers no way to reach it. Saying so is
strictly better than the previous silence, and it is not the same as being
finished.
