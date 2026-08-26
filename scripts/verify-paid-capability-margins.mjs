// No capability may be sold for less than the resource it consumes.
//
// `lib/sonara-paid-capabilities.cjs` prices the six things that cost us money
// per use. Each carries a floor -- a dated, sourced external rate -- and a
// price. A price below its own floor is a loss on every unit, and it is never a
// pricing decision somebody made: it is a typo, or a floor that moved after the
// price was set.
//
// The cheap moment to find one is now. The expensive moment is a month of
// invoices later, and the thing that makes it expensive is that nothing about
// it looks wrong -- the feature works, the customer is billed, the money is
// simply less than the bill underneath it.
//
// This runs the module's own `verifyMargins()` rather than reimplementing the
// comparison, so the rule cannot drift between the two. It also asserts the
// module actually examined something: a check that ran over an empty catalogue
// would print "verified" having compared nothing, which is the defect this
// repository is organised against.

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let paid;
try {
  paid = require(path.join(root, "lib", "sonara-paid-capabilities.cjs"));
} catch (error) {
  console.error(`lib/sonara-paid-capabilities.cjs could not be loaded: ${error.message}`);
  process.exit(1);
}

if (typeof paid.verifyMargins !== "function") {
  console.error("sonara-paid-capabilities.cjs no longer exports verifyMargins, so this check has nothing to run.");
  process.exit(1);
}

const result = paid.verifyMargins();

// The module guards its own population too, but the guard is repeated here
// because this is the thing in the release chain: if the module's own floor is
// ever loosened, this line still refuses to vouch for a catalogue that shrank.
if (!Number.isFinite(result.checked) || result.checked < 6) {
  console.error(`Only ${result.checked} paid capabilities were examined; six are recorded in docs/products/. This check has gone blind.`);
  process.exit(1);
}

if (!result.ok) {
  console.error("Paid capability margin check failed:");
  for (const problem of result.problems) console.error(`- ${problem}`);
  console.error("");
  console.error("A price below its own floor is a loss on every unit sold. Either the price is");
  console.error("wrong, or the floor moved and docs/pricing/ needs re-sourcing before the price");
  console.error("is changed to match it.");
  process.exit(1);
}

// Named in the output rather than summarised, so the figure is checkable.
const lines = Object.entries(paid.CAPABILITIES)
  .map(([name, entry]) => `${name} ${entry.priceMinor}/${entry.floorMinor} per ${entry.unit}`)
  .join(", ");

console.log(`Paid capability margins verified: ${result.checked} capabilities, each priced at or above its floor -- ${lines}.`);
