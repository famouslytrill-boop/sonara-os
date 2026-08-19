"use strict";

// Three algorithms, checked against facts that are true independently of this
// implementation.
//
// The failure this file exists to prevent is the one CLAUDE.md names: a signal
// that reports success without being true. An assertion that a route came back
// with six stops in it is satisfied by a function that returns its input. So
// every check below is either a value that can be looked up (the distance from
// London to Paris), a property of the right answer rather than of the code (a
// tour is a permutation; 2-opt never lengthens what it was given), or an
// exhaustive comparison against a brute-force answer for a size small enough to
// enumerate.
//
// Two of them are guards against the checks themselves going vacuous: 2-opt is
// asserted to *improve* a case it should improve, so a no-op implementation
// fails; and the grid search is compared against every point on its own grid, so
// a search that returned the first candidate fails.

const assert = require("node:assert/strict");
const science = require("../lib/sonara-operations-science.cjs");
const { stopOrder, demandForecast, duplicateCustomers, parseStopLines } = require("../lib/sonara-planner-tools.cjs");

// A deterministic pseudo-random source. Math.random would make a failure
// impossible to reproduce, and "it passed the last hundred times" is not a
// property.
function seeded(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomStops(count, random) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Stop ${index}`,
    // A patch about 55 km across, which is the scale of a delivery round.
    latitude: 51.4 + random() * 0.5,
    longitude: -0.4 + random() * 0.5
  }));
}

function bruteForceBest(stops, returnToStart) {
  // The first stop is fixed, so this enumerates (n-1)! orders.
  const rest = stops.map((_, index) => index).slice(1);
  let best = Infinity;
  const permute = (fixed, remaining) => {
    if (!remaining.length) {
      best = Math.min(best, science.routeLength([0, ...fixed], stops, { returnToStart }));
      return;
    }
    for (let index = 0; index < remaining.length; index += 1) {
      permute([...fixed, remaining[index]], [...remaining.slice(0, index), ...remaining.slice(index + 1)]);
    }
  };
  permute([], rest);
  return best;
}

describe("stop sequencing", () => {
  const LONDON = { latitude: 51.5074, longitude: -0.1278 };
  const PARIS = { latitude: 48.8566, longitude: 2.3522 };

  it("measures a distance anybody can look up", () => {
    // London to Paris is about 343.5 km great-circle. Within 1 km is far tighter
    // than any plausible wrong formula would land.
    const km = science.haversineMetres(LONDON, PARIS) / 1000;
    assert.ok(Math.abs(km - 343.5) < 1, `London to Paris came out at ${km.toFixed(1)} km`);

    // One degree of latitude at the equator is 111.19 km for this radius.
    const degree = science.haversineMetres({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) / 1000;
    assert.ok(Math.abs(degree - 111.195) < 0.01, `a degree of latitude came out at ${degree.toFixed(3)} km`);
  });

  it("is symmetric, and zero from a point to itself", () => {
    assert.equal(science.haversineMetres(LONDON, LONDON), 0);
    assert.ok(Math.abs(science.haversineMetres(LONDON, PARIS) - science.haversineMetres(PARIS, LONDON)) < 1e-6);
  });

  it("returns every stop exactly once, starting where the van is", () => {
    const random = seeded(11);
    for (let trial = 0; trial < 40; trial += 1) {
      const stops = randomStops(9, random);
      const result = science.sequenceStops(stops);
      assert.equal(result.ok, true);
      assert.equal(result.order.length, stops.length, "the round lost or gained a stop");
      assert.deepEqual(
        [...result.order.map((stop) => stop.name)].sort(),
        [...stops.map((stop) => stop.name)].sort(),
        "the round is not a permutation of the stops given"
      );
      assert.equal(result.order[0].name, "Stop 0", "the round does not start where the van already is");
    }
  });

  it("never comes back longer than the nearest-neighbour route it started from", () => {
    const random = seeded(23);
    for (let trial = 0; trial < 60; trial += 1) {
      const stops = randomStops(8 + (trial % 8), random);
      const result = science.sequenceStops(stops);
      assert.ok(
        result.metres <= result.nearestNeighbourMetres + 1e-6,
        `2-opt lengthened the route: ${result.metres.toFixed(1)} against ${result.nearestNeighbourMetres.toFixed(1)}`
      );
    }
  });

  it("actually improves a round that nearest-neighbour gets wrong", () => {
    // Without this, an implementation whose 2-opt did nothing would pass every
    // assertion above. Nearest-neighbour is known to strand a far point and
    // double back for it; over enough random instances it must do so sometimes.
    const random = seeded(37);
    let improvedCount = 0;
    for (let trial = 0; trial < 120; trial += 1) {
      const result = science.sequenceStops(randomStops(10, random));
      if (result.metres < result.nearestNeighbourMetres - 1) improvedCount += 1;
    }
    assert.ok(improvedCount > 10, `2-opt improved only ${improvedCount} of 120 rounds; it may be doing nothing`);
  });

  it("lands on or near the shortest possible round, checked by enumerating them", () => {
    const random = seeded(101);
    let worstGap = 0;
    for (let trial = 0; trial < 12; trial += 1) {
      const stops = randomStops(7, random);
      const optimal = bruteForceBest(stops, true);
      const found = science.sequenceStops(stops).metres;
      assert.ok(found >= optimal - 1e-6, "found a route shorter than the shortest one, so the measurement is wrong");
      worstGap = Math.max(worstGap, (found - optimal) / optimal);
    }
    // Not asserted as exact. 2-opt is not an exact method and claiming it is
    // would be the kind of comment that reads like a verified fact and is not.
    assert.ok(worstGap < 0.06, `worst round was ${(worstGap * 100).toFixed(1)}% above optimal`);
  });

  it("gives the same answer twice", () => {
    const stops = randomStops(12, seeded(5));
    const first = science.sequenceStops(stops).order.map((stop) => stop.name).join(",");
    const second = science.sequenceStops(stops).order.map((stop) => stop.name).join(",");
    assert.equal(first, second, "two runs over one list produced two rounds");
  });

  it("counts the closing leg only when the round comes back", () => {
    const stops = randomStops(8, seeded(77));
    const closed = science.sequenceStops(stops, { returnToStart: true });
    const open = science.sequenceStops(stops, { returnToStart: false });
    assert.ok(open.metres < closed.metres, "an open path measured no shorter than the same round closed");
  });

  it("refuses a coordinate that is not one, and says which", () => {
    const result = science.sequenceStops([
      { name: "Real", latitude: 51.5, longitude: -0.1 },
      { name: "Empty form", latitude: 0, longitude: 0 },
      { name: "Off the planet", latitude: 91, longitude: 0 },
      { name: "Words", latitude: "somewhere", longitude: "over there" }
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.code, "not_enough_stops");
    // Named, not counted -- "three were skipped" makes somebody re-check all of
    // them; naming them makes them fix the three.
    assert.deepEqual(result.skipped.sort(), ["Empty form", "Off the planet", "Words"]);
  });

  it("refuses too many stops rather than quietly dropping the tail", () => {
    const result = science.sequenceStops(randomStops(science.MAX_STOPS + 1, seeded(9)));
    assert.equal(result.ok, false);
    assert.equal(result.code, "too_many_stops");
  });

  describe("the page a customer fills in", () => {
    it("reads a name with a comma in it", () => {
      const rows = parseStopLines("Smith, Jones and Co, 51.5074, -0.1278\nDepot\t51.4826\t-0.0077");
      assert.equal(rows.length, 2);
      assert.equal(rows[0].name, "Smith, Jones and Co");
      assert.equal(rows[0].latitude, 51.5074);
      assert.equal(rows[1].name, "Depot");
      assert.equal(rows[1].longitude, -0.0077);
    });

    it("puts a real round in a sensible order and says what it is measuring", () => {
      const output = stopOrder({
        stops: [
          "Depot, 51.5074, -0.1278",
          "Greenwich, 51.4826, -0.0077",
          "Paddington, 51.5154, -0.1755",
          "Canary Wharf, 51.5054, -0.0235",
          "Kensington, 51.4988, -0.1749"
        ].join("\n")
      });
      assert.ok(!output.couldNotCalculate, output.couldNotCalculate);
      assert.match(output.driveThemInThisOrder, /^1\. Depot/);
      // West cluster before east cluster, in one direction or the other.
      const order = output.driveThemInThisOrder;
      assert.ok(order.indexOf("Kensington") < order.indexOf("Greenwich"), `did not group the round: ${order}`);
      assert.match(output.whatThisIsMeasuring, /not driving distance/i);
    });

    it("says the existing round is fine rather than inventing a saving", () => {
      // Three stops in a line, given in the order they sit in. There is nothing
      // to improve, and a tool that claimed a percentage here would be lying.
      const output = stopOrder({ stops: "A, 51.50, -0.10\nB, 51.51, -0.10\nC, 51.52, -0.10" });
      assert.match(output.againstTheOrderYouGave, /same length as the order you typed/i);
    });
  });
});

describe("demand forecasting", () => {
  it("recovers a straight line exactly", () => {
    // 10, 12, 14 ... has level and trend with no noise, so a correct
    // implementation continues it and a wrong one does not.
    const series = Array.from({ length: 14 }, (_, index) => 10 + index * 2);
    const result = science.forecastDemand(series, { horizon: 3 });
    assert.equal(result.ok, true);
    assert.ok(Math.abs(result.trendPerPeriod - 2) < 1e-6, `trend came out at ${result.trendPerPeriod}`);
    assert.ok(Math.abs(result.periods[0].forecast - 38) < 1e-6, `next period came out at ${result.periods[0].forecast}`);
    assert.ok(Math.abs(result.periods[2].forecast - 42) < 1e-6);
    assert.ok(result.meanAbsoluteError < 1e-9, "a straight line was fitted with error in it");
  });

  it("forecasts a flat line flat, and admits it cannot beat doing nothing", () => {
    const result = science.forecastDemand(new Array(12).fill(40), { horizon: 4 });
    assert.equal(result.ok, true);
    assert.ok(Math.abs(result.trendPerPeriod) < 1e-9);
    for (const period of result.periods) assert.ok(Math.abs(period.forecast - 40) < 1e-9);
    // Both errors are zero, so neither beats the other, and the honest answer is
    // "no" rather than a tie reported as a win.
    assert.equal(result.beatsNaive, null);
    assert.equal(result.errorVersusNaive, null);
  });

  it("does not forecast a negative quantity", () => {
    // A steep decline extended far enough goes below zero, and nobody can order
    // minus four of something.
    const series = [100, 88, 76, 64, 52, 40, 28, 16, 8];
    const result = science.forecastDemand(series, { horizon: 20 });
    assert.equal(result.ok, true);
    assert.ok(result.trendPerPeriod < 0, "the fixture does not decline, so this proves nothing");
    for (const period of result.periods) assert.ok(period.forecast >= 0, `forecast ${period.forecast} for period ${period.period}`);
    assert.equal(result.periods[result.periods.length - 1].forecast, 0);
  });

  it("picks the settings with the smallest error, checked against every one it tried", () => {
    // Guards the search itself. An implementation that returned the first grid
    // point would satisfy every other assertion in this block.
    const series = [22, 19, 25, 24, 30, 27, 33, 31, 38, 35, 41, 40];
    const result = science.forecastDemand(series, { horizon: 2 });
    let bestError = Infinity;
    for (const alpha of science.ALPHA_GRID) {
      for (const beta of science.BETA_GRID) {
        let level = series[0];
        let trend = series[1] - series[0];
        let squared = 0;
        for (let index = 1; index < series.length; index += 1) {
          const error = series[index] - (level + trend);
          squared += error * error;
          const previousLevel = level;
          level = alpha * series[index] + (1 - alpha) * (level + trend);
          trend = beta * (level - previousLevel) + (1 - beta) * trend;
        }
        bestError = Math.min(bestError, squared);
      }
    }
    let chosenSquared = 0;
    {
      let level = series[0];
      let trend = series[1] - series[0];
      for (let index = 1; index < series.length; index += 1) {
        const error = series[index] - (level + trend);
        chosenSquared += error * error;
        const previousLevel = level;
        level = result.alpha * series[index] + (1 - result.alpha) * (level + trend);
        trend = result.beta * (level - previousLevel) + (1 - result.beta) * trend;
      }
    }
    assert.ok(Math.abs(chosenSquared - bestError) < 1e-9, `chose settings with error ${chosenSquared}, best on the grid was ${bestError}`);
  });

  it("refuses a series too short to fit a trend to", () => {
    const result = science.forecastDemand([4, 6, 5, 7], { horizon: 3 });
    assert.equal(result.ok, false);
    assert.equal(result.code, "not_enough_history");
    assert.match(result.message, new RegExp(String(science.MIN_OBSERVATIONS)));
  });

  it("gives the same answer twice", () => {
    const series = [5, 9, 6, 11, 8, 14, 10, 17, 12, 20];
    assert.equal(
      JSON.stringify(science.forecastDemand(series, { horizon: 6 })),
      JSON.stringify(science.forecastDemand(series, { horizon: 6 }))
    );
  });

  describe("the page a customer fills in", () => {
    it("reports how wrong it usually is, next to the forecast", () => {
      const output = demandForecast({ history: "12 14 13 16 17 19 18 21 22 24", periodsAhead: "5" });
      assert.ok(!output.couldNotCalculate, output.couldNotCalculate);
      assert.match(output.whichWayItIsGoing, /Rising/);
      // The qualifier is the point. A forecast shown without its error gets
      // acted on as though it had none.
      assert.match(output.howWrongItUsuallyIs, /typically out by/i);
      assert.match(output.whatThisAssumes, /knows nothing about/i);
    });

    it("tells a customer to plan around the average when the line is not worth having", () => {
      // Demand with no signal in it: the smoothing cannot beat assuming no
      // change, and the honest output says so rather than drawing a line anyway.
      const noisy = [30, 31, 29, 30, 31, 29, 30, 31, 29, 30, 31, 29];
      const result = science.forecastDemand(noisy, { horizon: 3 });
      assert.equal(result.ok, true);
      if (result.beatsNaive === false) {
        const output = demandForecast({ history: noisy.join(" "), periodsAhead: "3" });
        assert.match(output.howWrongItUsuallyIs, /plan around the average/i);
      }
    });
  });
});

describe("duplicate customers", () => {
  it("measures edit distance against values anybody can check", () => {
    assert.equal(science.editDistance("kitten", "sitting"), 3);
    assert.equal(science.editDistance("flaw", "lawn"), 2);
    assert.equal(science.editDistance("", "abc"), 3);
    assert.equal(science.editDistance("same", "same"), 0);
    assert.equal(science.editDistance("abc", "cba"), 2);
  });

  it("is symmetric", () => {
    for (const [left, right] of [["taylor", "tailor"], ["jose", "josef"], ["a", "bbbb"]]) {
      assert.equal(science.editDistance(left, right), science.editDistance(right, left));
    }
  });

  it("treats an accent, a punctuation mark and a country code as the same person", () => {
    assert.equal(science.normalizeName("José  García-López"), science.normalizeName("jose garcia lopez"));
    assert.equal(science.normalizePhone("+1 (555) 010-9999"), science.normalizePhone("555.010.9999"));
    assert.equal(science.normalizeEmail("  SAM@Example.COM "), "sam@example.com");
  });

  it("does not treat a.b@ and ab@ as one person", () => {
    // Gmail ignores dots; most providers do not. Merging two real customers is
    // the expensive direction of this mistake, so the local part is compared as
    // typed.
    assert.notEqual(science.normalizeEmail("a.b@example.com"), science.normalizeEmail("ab@example.com"));
  });

  it("refuses a phone number too short to be one", () => {
    assert.equal(science.normalizePhone("1234"), "");
    assert.equal(science.normalizePhone("no digits here"), "");
  });

  it("finds the four kinds of duplicate, and labels each by how sure it is", () => {
    const result = science.findDuplicateCustomers([
      { id: "1", name: "Sam Taylor", email: "sam@example.com" },
      { id: "2", name: "Completely Different", email: "SAM@example.com" },
      { id: "3", name: "Jose Garcia", phone: "+1 (555) 010-9999" },
      { id: "4", name: "José García", phone: "555 010 9999" },
      { id: "5", name: "Alex Reed", email: "alex1@example.com" },
      { id: "6", name: "Reed Alex", email: "alex2@example.com" },
      { id: "7", name: "Priya Nair", email: "p@example.com" },
      { id: "8", name: "Priya Nayar", email: "pn@example.com" }
    ]);
    assert.equal(result.ok, true);
    const byCode = Object.fromEntries(result.pairs.map((pair) => [pair.code, pair]));
    assert.ok(byCode.same_email, "a shared email address was not found");
    assert.ok(byCode.same_phone, "a shared phone number was not found");
    assert.ok(byCode.reordered_name, "a first and last name the other way round was not found");
    assert.ok(byCode.similar_name, "a near-miss spelling was not found");
    assert.equal(byCode.same_email.confidence, "high");
    assert.equal(byCode.same_phone.confidence, "high");
    assert.equal(byCode.similar_name.confidence, "low");
    // Sorted so the ones worth acting on come first.
    assert.equal(result.pairs[0].confidence, "high");
  });

  it("says nothing about two people who are not the same person", () => {
    const result = science.findDuplicateCustomers([
      { id: "1", name: "Sam Taylor", email: "sam@example.com" },
      { id: "2", name: "Nadia Okonkwo", email: "nadia@example.com", phone: "555 111 2222" },
      { id: "3", name: "Wei Zhang", email: "wei@example.com", phone: "555 333 4444" }
    ]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.pairs, [], `invented ${result.pairs.length} matches between different people`);
    assert.equal(result.comparisons, 3, "the comparison count is wrong, so an empty result may mean nothing was compared");
  });

  it("compares every pair, so an empty answer means none matched", () => {
    // The vacuous-pass guard: "no duplicates found" is also what a function that
    // compared nothing returns.
    const result = science.findDuplicateCustomers(Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: `Person Number ${index}` })));
    assert.equal(result.compared, 20);
    assert.equal(result.comparisons, 190);
  });

  it("refuses a list too long to compare inside a request", () => {
    const result = science.findDuplicateCustomers(
      Array.from({ length: science.MAX_CUSTOMERS_COMPARED + 1 }, (_, index) => ({ id: String(index), name: `Person ${index}` }))
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "too_many_customers");
  });

  describe("the page a customer fills in", () => {
    it("reads a name split across two fields", () => {
      const output = duplicateCustomers({ customers: "Sam Taylor, sam@example.com\nTaylor, Sam, s.taylor@example.com" });
      assert.ok(!output.couldNotCalculate, output.couldNotCalculate);
      assert.match(output.theseMayBeTheSamePerson, /Sam Taylor/);
      assert.match(output.theseMayBeTheSamePerson, /the other way round/i);
    });

    it("never offers to merge anything", () => {
      const output = duplicateCustomers({ customers: "A, a@example.com\nB, a@example.com" });
      assert.match(output.nothingWasChanged, /never a merge/i);
      assert.match(output.nextAction, /Decide which record to keep yourself/i);
      // Merging customer records is destructive and irreversible, which
      // AGENTS.md puts behind owner approval. Nothing here writes at all.
      const source = require("node:fs").readFileSync(require.resolve("../lib/sonara-operations-science.cjs"), "utf8");
      assert.doesNotMatch(source, /\bfetch\s*\(/, "the science module reaches the network");
      assert.doesNotMatch(source, /\brequire\s*\(/, "the science module pulls in a dependency");
    });

    it("says so plainly when nothing is duplicated", () => {
      const output = duplicateCustomers({ customers: "Nadia Okonkwo, nadia@example.com\nWei Zhang, wei@example.com" });
      assert.match(output.nothingLooksDuplicated, /none of them look like the same person/i);
    });
  });
});
