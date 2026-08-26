"use strict";

// Three questions the database already holds the answer to, and nobody had
// written the arithmetic for.
//
// `lib/sonara-inventory-science.cjs` did this for safety stock. Same terms here:
// no model call, no provider, no network, no cost per use, and the same inputs
// always give the same output. That is not thrift for its own sake -- a route
// plan that costs a fifth of a cent per press is one a business stops pressing,
// and a number that changes between two presses is one nobody acts on.
//
//   1. Stop sequencing. `location_zones` already stores the latitude and
//      longitude a customer typed in (`numeric(10,7)`, both nullable). What
//      order to visit them in is a travelling salesman problem, and for the
//      sizes a small business has -- a van with eight to twenty stops --
//      nearest-neighbour followed by 2-opt lands within a few per cent of
//      optimal in microseconds. No mapping service, no API key, no per-call fee.
//   2. Demand forecasting. `pos_menu_mix_items.quantity_sold` is per item, and
//      it joins to `pos_sales_summaries.business_date`. So a series of daily
//      quantities exists. Holt's linear exponential smoothing is exact
//      arithmetic over it.
//   3. Duplicate customers. `customer_records` has name, email and phone.
//      Whether two rows are the same person is deterministic string comparison.
//
// ## What these do not claim
//
// Straight-line distance is not driving distance, a forecast is not a promise,
// and two rows that look alike are not proven to be one person. Each function
// returns the qualifier next to the number and the pages print it, because a
// figure shown without its limit gets acted on as though it had none.

// ---------------------------------------------------------------------------
// 1. Stop sequencing
// ---------------------------------------------------------------------------

// The IUGG arithmetic-mean Earth radius. Distance on a sphere is exact for the
// model, and the model is an approximation of a slightly pear-shaped planet: at
// the scale of a delivery round the spherical error is under half a per cent,
// which is far smaller than the error from ignoring roads. So it is not the part
// worth improving.
const EARTH_RADIUS_METRES = 6371008.8;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineMetres(from, to) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(to.longitude - from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  // atan2 rather than asin(sqrt(a)): asin loses precision as `a` approaches 1,
  // which is the nearly-antipodal case. Two stops in one town never go near it,
  // but the formula costs the same either way.
  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

// A coordinate this can actually use. Latitude outside ±90 is not a latitude,
// and 0,0 is open water in the Gulf of Guinea -- which is exactly where an empty
// form field lands when it is read as a number, so it is refused rather than
// routed to.
function usableStop(stop) {
  const latitude = Number(stop?.latitude);
  const longitude = Number(stop?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { name: String(stop?.name || "").trim() || "Unnamed stop", latitude, longitude };
}

function routeLength(order, stops, { returnToStart }) {
  let total = 0;
  for (let index = 1; index < order.length; index += 1) {
    total += haversineMetres(stops[order[index - 1]], stops[order[index]]);
  }
  if (returnToStart && order.length > 1) {
    total += haversineMetres(stops[order[order.length - 1]], stops[order[0]]);
  }
  return total;
}

// Nearest neighbour from the first stop. Ties break on the lower index, so the
// same list always produces the same route -- a plan that reshuffles between two
// presses is a plan a driver stops trusting.
function nearestNeighbourOrder(stops) {
  const unvisited = new Set(stops.map((_, index) => index));
  const order = [0];
  unvisited.delete(0);
  while (unvisited.size) {
    const from = stops[order[order.length - 1]];
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of unvisited) {
      const distance = haversineMetres(from, stops[candidate]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    order.push(best);
    unvisited.delete(best);
  }
  return order;
}

// 2-opt: reverse a segment whenever doing so shortens the route, until nothing
// does.
//
// The first stop stays first on purpose -- it is where the van already is, and a
// plan that opens by driving somewhere else is not a plan. When the round
// returns to base the closing leg is part of what is being minimised, so the
// last stop may move; when it does not, the last leg is not counted and the
// result is an open path.
//
// The pass cap is stated rather than assumed: 2-opt from a nearest-neighbour
// start converges in well under a dozen passes at these sizes, and a cap means
// no input can hang a request.
const MAX_TWO_OPT_PASSES = 200;

function twoOptOrder(initial, stops, { returnToStart }) {
  const order = [...initial];
  const last = returnToStart ? order.length : order.length - 1;
  let improved = true;
  let passes = 0;
  let length = routeLength(order, stops, { returnToStart });
  while (improved && passes < MAX_TWO_OPT_PASSES) {
    improved = false;
    passes += 1;
    for (let i = 1; i < last - 1; i += 1) {
      for (let k = i + 1; k < last; k += 1) {
        const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        const candidateLength = routeLength(candidate, stops, { returnToStart });
        // The epsilon is not decoration. Floating-point noise can make a
        // reversal look like a gain of 1e-13 forever, and the loop would then
        // run to the cap on every request without improving anything.
        if (candidateLength < length - 1e-9) {
          order.splice(0, order.length, ...candidate);
          length = candidateLength;
          improved = true;
        }
      }
    }
  }
  return { order, passes, length };
}

const MIN_STOPS = 2;
const MAX_STOPS = 60;

/**
 * Order a list of stops so the driving is short.
 * @param {Array<{name?: string, latitude: number|string, longitude: number|string}>} rawStops
 * @param {{returnToStart?: boolean}} options
 */
function sequenceStops(rawStops, options = {}) {
  const returnToStart = options.returnToStart !== false;
  const stops = [];
  const skipped = [];
  for (const raw of Array.isArray(rawStops) ? rawStops : []) {
    const usable = usableStop(raw);
    if (usable) stops.push(usable);
    // Named rather than counted. "Three stops were skipped" makes somebody
    // re-check all of them; naming the three makes them fix the three.
    else skipped.push(String(raw?.name || "").trim() || "a stop with no name");
  }

  if (stops.length < MIN_STOPS) {
    return {
      ok: false,
      code: "not_enough_stops",
      skipped,
      message: `Two stops with a location each are the fewest this can order. ${stops.length} of the ones given had usable coordinates.`
    };
  }
  if (stops.length > MAX_STOPS) {
    // Refused rather than truncated. 2-opt is quadratic per pass and this runs
    // inside a request; silently dropping the tail would answer a different
    // question from the one asked, which is worse than saying no.
    return {
      ok: false,
      code: "too_many_stops",
      skipped,
      message: `${stops.length} stops is more than this orders in one go. ${MAX_STOPS} is the limit -- split the round in two.`
    };
  }

  const start = nearestNeighbourOrder(stops);
  const nearestNeighbourMetres = routeLength(start, stops, { returnToStart });
  const { order, passes, length: metres } = twoOptOrder(start, stops, { returnToStart });
  const asGivenMetres = routeLength(stops.map((_, index) => index), stops, { returnToStart });

  return {
    ok: true,
    returnToStart,
    stopCount: stops.length,
    skipped,
    order: order.map((index, position) => ({ position: position + 1, ...stops[index] })),
    metres,
    kilometres: metres / 1000,
    miles: metres / 1609.344,
    // What the ordering was worth, against the order the customer typed in. Zero
    // is a real and useful answer: it means the round they already drive is
    // good, and the honest thing is to tell them to keep driving it.
    savedMetres: Math.max(0, asGivenMetres - metres),
    savedPercent: asGivenMetres > 0 ? Math.max(0, ((asGivenMetres - metres) / asGivenMetres) * 100) : 0,
    asGivenMetres,
    nearestNeighbourMetres,
    twoOptPasses: passes,
    basis: "straight-line distance between the coordinates given, not driving distance on roads. In a town, real driving is usually a fifth to a third longer."
  };
}

// ---------------------------------------------------------------------------
// 2. Demand forecasting
// ---------------------------------------------------------------------------

// Holt's linear method: one smoothed level, one smoothed trend.
//
// Simple exponential smoothing alone forecasts a flat line, which for anything
// growing or shrinking is wrong in a direction that compounds across the
// horizon. A trend term is the smallest honest upgrade.
//
// alpha smooths the level, beta the trend, and both are chosen by grid search
// minimising the sum of squared one-step errors. That makes the fit a property
// of the data rather than of somebody's default -- and it is reproducible, which
// a gradient method from a random start would not be.
const ALPHA_GRID = Object.freeze([0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
const BETA_GRID = Object.freeze([0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4]);
const MIN_OBSERVATIONS = 8;

function holtFit(series, alpha, beta) {
  // Level starts at the first observation, trend at the first difference. The
  // alternative -- a regression over the opening points -- fits the noise in a
  // short series harder than it fits the signal.
  let level = series[0];
  let trend = series[1] - series[0];
  let squaredError = 0;
  let absoluteError = 0;
  for (let index = 1; index < series.length; index += 1) {
    const forecast = level + trend;
    const error = series[index] - forecast;
    squaredError += error * error;
    absoluteError += Math.abs(error);
    const previousLevel = level;
    level = alpha * series[index] + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
  }
  return { level, trend, squaredError, absoluteError, steps: series.length - 1 };
}

/**
 * Forecast the next few periods from a series of observations, oldest first.
 * @param {Array<number|string>} rawSeries
 * @param {{horizon?: number}} options
 */
function forecastDemand(rawSeries, options = {}) {
  const series = (Array.isArray(rawSeries) ? rawSeries : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const horizon = Math.min(Math.max(Math.round(Number(options.horizon) || 7), 1), 90);

  if (series.length < MIN_OBSERVATIONS) {
    // Same rule as the safety-stock module: a number on a page gets acted on
    // whatever sits beside it, so a trend fitted to five points is refused
    // rather than computed and captioned "unreliable".
    return {
      ok: false,
      code: "not_enough_history",
      message: `${MIN_OBSERVATIONS} periods are the fewest a trend can be fitted to. ${series.length} usable ${series.length === 1 ? "figure was" : "figures were"} given.`
    };
  }

  let best = null;
  for (const alpha of ALPHA_GRID) {
    for (const beta of BETA_GRID) {
      const fit = holtFit(series, alpha, beta);
      if (!best || fit.squaredError < best.fit.squaredError - 1e-12) best = { alpha, beta, fit };
    }
  }

  const { alpha, beta, fit } = best;
  const meanAbsoluteError = fit.absoluteError / fit.steps;

  // The naive forecast -- "the next one is the same as the last one". Reported
  // because a method that cannot beat it is a method not worth using, and this
  // says so on the page rather than hiding behind a confident decimal.
  let naiveAbsolute = 0;
  for (let index = 1; index < series.length; index += 1) naiveAbsolute += Math.abs(series[index] - series[index - 1]);
  const naiveMeanAbsoluteError = naiveAbsolute / (series.length - 1);

  const periods = [];
  for (let step = 1; step <= horizon; step += 1) {
    // Clamped at zero: a downward trend extended far enough forecasts negative
    // demand, and nobody can order a negative quantity.
    periods.push({ period: step, forecast: Math.max(0, fit.level + step * fit.trend) });
  }

  return {
    ok: true,
    alpha,
    beta,
    level: fit.level,
    trendPerPeriod: fit.trend,
    horizon,
    periods,
    total: periods.reduce((sum, entry) => sum + entry.forecast, 0),
    observations: series.length,
    observedMean: series.reduce((sum, value) => sum + value, 0) / series.length,
    meanAbsoluteError,
    naiveMeanAbsoluteError,
    // Above 1 means the smoothing is worse than assuming no change. Named rather
    // than suppressed: a customer whose demand is pure noise is better served by
    // being told so than by a confident-looking line through it.
    errorVersusNaive: naiveMeanAbsoluteError > 0 ? meanAbsoluteError / naiveMeanAbsoluteError : null,
    beatsNaive: naiveMeanAbsoluteError > 0 ? meanAbsoluteError < naiveMeanAbsoluteError : null,
    basis: "past demand only. It knows nothing about a holiday, a price change, a supply problem, or a competitor opening down the road."
  };
}

// ---------------------------------------------------------------------------
// 3. Duplicate customer detection
// ---------------------------------------------------------------------------

function normalizeName(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .normalize("NFKD")
    // Combining marks, so "José" and "Jose" compare as one person rather than as
    // two people who happen to share an address.
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmail(value) {
  const match = String(value == null ? "" : value).trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/);
  if (!match) return "";
  // The local part is compared as typed. Gmail ignores dots and everything after
  // a plus, but most providers do not, and treating `a.b@` and `ab@` as one
  // person on a domain that considers them two merges two real customers --
  // which is the expensive direction of this mistake.
  return `${match[1]}@${match[2]}`;
}

// Digits only, last ten kept. `+1 (555) 010-9999` and `5550109999` are the same
// phone, and a country code present on one row and absent on the other is the
// commonest reason a real match is missed.
function normalizePhone(value) {
  const digits = String(value == null ? "" : value).replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : "";
}

// Levenshtein over two rolling rows: O(n·m) time, O(min(n,m)) space. Names are
// short so this is cheap either way; the row reuse is what keeps a 500-customer
// comparison from allocating a quarter of a million arrays.
function editDistance(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitution = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, substitution);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[right.length];
}

function stringSimilarity(left, right) {
  const longest = Math.max(left.length, right.length);
  if (!longest) return 0;
  return 1 - editDistance(left, right) / longest;
}

// "Sam Taylor" and "Taylor Sam" are one person with the fields swapped, which is
// a data-entry mistake common enough to be worth catching. Sorting the tokens
// makes those identical; the unsorted comparison is kept too and the better of
// the two wins, so "Sam Taylor" against "Samuel Taylor" is not penalised for
// having its words in the right order.
function nameSimilarity(left, right) {
  if (!left || !right) return 0;
  const direct = stringSimilarity(left, right);
  const sorted = stringSimilarity(left.split(" ").sort().join(" "), right.split(" ").sort().join(" "));
  return Math.max(direct, sorted);
}

// Where "alike" starts, measured rather than picked.
//
// Normalised edit distance over ten representative pairs, half of them the same
// person misspelled and half of them different people who happen to look alike:
//
//   0.923  catherine lee / katherine lee   same person
//   0.900  jon smith / john smith          same person
//   0.889  ana lopez / ana lopes           same person
//   0.889  wei zhang / wei chang           same person
//   0.818  priya nair / priya nayar        same person
//   ----   the line
//   0.800  dave brown / dan brown          DIFFERENT people
//   0.778  mike ross / mia ross            DIFFERENT people
//   0.769  sam taylor / samuel taylor      same person, and missed
//   0.700  john smith / jane smith         DIFFERENT people
//   0.154  sam taylor / nadia okonkwo      DIFFERENT people
//
// 0.81 is the only value that admits every misspelling above while excluding
// every different person. It still misses "Sam" against "Samuel", because a
// shortened first name scores below two unrelated people -- edit distance cannot
// see that one is a nickname for the other. That miss is the conservative
// direction: this list is read by somebody deciding what to merge, and a wrong
// suggestion costs more than an absent one.
const NAME_MATCH_THRESHOLD = 0.81;

// Why two rows might be the same customer, ordered by how sure it is. Reported
// as a reason and not only a score, because "these share an email address" is
// something a person can act on and "0.87" is not.
function duplicateReason(left, right) {
  if (left.email && left.email === right.email) {
    return { code: "same_email", confidence: "high", reason: "Both have the same email address." };
  }
  if (left.phone && left.phone === right.phone) {
    return { code: "same_phone", confidence: "high", reason: "Both have the same phone number." };
  }
  if (left.name && left.name === right.name) {
    return { code: "same_name", confidence: "medium", reason: "The names match exactly. They may still be two different people with the same name." };
  }
  // The same words in a different order is a different fact from "the letters
  // are mostly the same", and saying "100% alike, a suggestion to look at"
  // about two identical word sets reads as a tool that cannot tell.
  if (left.name && right.name && left.name.split(" ").sort().join(" ") === right.name.split(" ").sort().join(" ")) {
    return { code: "reordered_name", confidence: "medium", similarity: 1, reason: "The same name with the parts the other way round -- usually a first and last name entered in different orders." };
  }
  const similarity = nameSimilarity(left.name, right.name);
  if (similarity >= NAME_MATCH_THRESHOLD) {
    return {
      code: "similar_name",
      confidence: "low",
      similarity,
      reason: `The names are ${Math.round(similarity * 100)}% alike. This is a suggestion to look at, not a match.`
    };
  }
  return null;
}

const MAX_CUSTOMERS_COMPARED = 800;

/**
 * Which rows in a customer list might be the same person.
 * @param {Array<{id?: string, name?: string, email?: string, phone?: string}>} rawCustomers
 */
function findDuplicateCustomers(rawCustomers) {
  const customers = (Array.isArray(rawCustomers) ? rawCustomers : [])
    .map((row, index) => ({
      id: row?.id == null ? String(index) : String(row.id),
      label: String(row?.name || row?.email || row?.phone || "Unnamed record").trim(),
      name: normalizeName(row?.name),
      email: normalizeEmail(row?.email),
      phone: normalizePhone(row?.phone)
    }))
    .filter((row) => row.name || row.email || row.phone);

  if (customers.length < 2) {
    return { ok: false, code: "not_enough_customers", message: "Two records with something in them are the fewest this can compare." };
  }
  if (customers.length > MAX_CUSTOMERS_COMPARED) {
    // n(n-1)/2 comparisons. At 800 that is about 320,000 short-string
    // comparisons, which is milliseconds; ten times that is not, and this runs
    // inside a request.
    return {
      ok: false,
      code: "too_many_customers",
      message: `${customers.length} records is more than this compares in one go. ${MAX_CUSTOMERS_COMPARED} is the limit.`
    };
  }

  const pairs = [];
  for (let i = 0; i < customers.length; i += 1) {
    for (let j = i + 1; j < customers.length; j += 1) {
      const reason = duplicateReason(customers[i], customers[j]);
      if (reason) {
        pairs.push({
          left: customers[i].label,
          right: customers[j].label,
          leftId: customers[i].id,
          rightId: customers[j].id,
          ...reason
        });
      }
    }
  }

  const RANK = { high: 0, medium: 1, low: 2 };
  pairs.sort((a, b) => RANK[a.confidence] - RANK[b.confidence] || a.left.localeCompare(b.left) || a.right.localeCompare(b.right));

  return {
    ok: true,
    compared: customers.length,
    comparisons: (customers.length * (customers.length - 1)) / 2,
    pairs,
    high: pairs.filter((pair) => pair.confidence === "high").length,
    medium: pairs.filter((pair) => pair.confidence === "medium").length,
    low: pairs.filter((pair) => pair.confidence === "low").length,
    // Nothing here merges anything. Merging customer records is destructive and
    // irreversible, which AGENTS.md puts behind owner approval; this finds and
    // reports, and a person decides.
    basis: "a list to check, never a merge. Two people can share a name, and one person can have two email addresses."
  };
}

module.exports = {
  ALPHA_GRID,
  BETA_GRID,
  EARTH_RADIUS_METRES,
  MAX_CUSTOMERS_COMPARED,
  MAX_STOPS,
  MAX_TWO_OPT_PASSES,
  MIN_OBSERVATIONS,
  MIN_STOPS,
  NAME_MATCH_THRESHOLD,
  duplicateReason,
  editDistance,
  findDuplicateCustomers,
  forecastDemand,
  haversineMetres,
  nameSimilarity,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  routeLength,
  sequenceStops,
  stringSimilarity
};
