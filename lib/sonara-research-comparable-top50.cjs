// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No license is granted; see LICENSE.
"use strict";
// Pure audit of caller-supplied research numbers. Never fetches, stores, publishes,
// executes formula handlers, grants rights or gives investment/legal advice.
const { planTop50Research } = require("./sonara-research-atlas.cjs");

const MEASURES = Object.freeze({
  annual_revenue: Object.freeze({ units: ["usd", "eur", "gbp"], kind: ["company", "organization", "establishment"], type: "money" }),
  employee_count: Object.freeze({ units: ["persons"], kind: ["company", "organization", "establishment"], type: "count" }),
  annual_output_units: Object.freeze({ units: ["units"], kind: ["company", "organization", "establishment"], type: "count" }),
  delivery_on_time_rate: Object.freeze({ units: ["fraction"], kind: ["company", "establishment"], type: "rate" }),
  gross_margin_rate: Object.freeze({ units: ["fraction"], kind: ["company", "establishment"], type: "rate" }),
  annual_grants: Object.freeze({ units: ["usd"], kind: ["organization"], type: "money" }),
  publication_count: Object.freeze({ units: ["works"], kind: ["individual"], type: "count" }),
  citation_count: Object.freeze({ units: ["citations"], kind: ["individual"], type: "count" }),
  patent_count: Object.freeze({ units: ["patents"], kind: ["individual"], type: "count" }),
  audience_count: Object.freeze({ units: ["people"], kind: ["individual"], type: "count" })
});
const FIELD_SET = new Set(["entityId", "value", "metric", "unit", "period", "geography", "evidenceId", "observedAt"]);
const REQUEST_SET = new Set(["categoryId", "metric", "unit", "period", "geography", "observations", "reviewedAt", "direction"]);
function validDay(x) {
  if (typeof x !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(x)) return false;
  const d = new Date(x + "T00:00:00Z");
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10) === x;
}
function validId(x) {
  return typeof x === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(x);
}
function acceptedGeography(categoryId) {
  if (categoryId.startsWith("us_")) return "US";
  if (categoryId.startsWith("europe_")) return "EUROPE";
  return "GLOBAL";
}
function planComparableTop50(request = {}) {
  if (!request || typeof request !== "object" || Array.isArray(request) ||
    Object.keys(request).some(k=>!REQUEST_SET.has(k))) {
    throw new TypeError("Unexpected comparison request fields");
  }
  const {categoryId,metric,unit,period,geography,observations,reviewedAt,direction="descending"} = request;
  const plan = planTop50Research(categoryId);
  if (plan.reference.role === "publisher_ranking") {
    throw new RangeError("Official publisher rankings must use the separate publisher evidence gate");
  }
  const definition = Object.prototype.hasOwnProperty.call(MEASURES,metric) ? MEASURES[metric] : null;
  if (!definition || !definition.kind.includes(plan.kind)) {
    throw new RangeError("Metric is not an allowed comparison for this population kind");
  }
  if (!definition.units.includes(unit)) throw new RangeError("Incompatible measurement unit");
  if (typeof period !== "string" || !/^20\d{2}$/.test(period)) {
    throw new TypeError("Period must be a defined reporting year");
  }
  if (geography !== acceptedGeography(categoryId)) {
    throw new RangeError("Geography does not match category population");
  }
  if (direction !== "descending" && direction !== "ascending") {
    throw new RangeError("Sort direction must be ascending or descending");
  }
  if (!validDay(reviewedAt)) throw new TypeError("reviewedAt must be a real calendar day");
  const reviewYear = Number(reviewedAt.slice(0,4));
  if (Number(period) > reviewYear ||
    (metric.startsWith("annual_") && Number(period) >= reviewYear)) {
    throw new RangeError("Reporting year is future or annual period is not yet closed");
  }
  if (!Array.isArray(observations) || observations.length > 500) {
    throw new TypeError("observations must be an array of at most 500 records");
  }
  const seen = new Set();
  const accepted = [];
  for (let i=0;i<observations.length;i++) {
    const r=observations[i];
    if (!r || typeof r !== "object" || Array.isArray(r) ||
      Object.keys(r).some(k=>!FIELD_SET.has(k)) ||
      Object.keys(r).length !== FIELD_SET.size || !validId(r.entityId) ||
      !validId(r.evidenceId) || seen.has(r.entityId) ||
      r.metric !== metric || r.unit !== unit ||
      r.period !== period || r.geography !== geography ||
      typeof r.value !== "number" || !Number.isFinite(r.value) ||
      r.value < 0 || r.value > 1e15 ||
      (definition.type === "count" && !Number.isSafeInteger(r.value)) ||
      (definition.type === "rate" && r.value > 1) ||
      !validDay(r.observedAt) || r.observedAt > reviewedAt) {
      throw new TypeError("Invalid or incomparable evidence record at index " + i);
    }
    seen.add(r.entityId);
    accepted.push(Object.freeze({entityId:r.entityId,value:r.value,evidenceId:r.evidenceId}));
  }
  const sufficientPopulation = accepted.length >= 50;
  const sorted = sufficientPopulation
    ? accepted.sort((a,b) => (direction === "descending" ? b.value-a.value : a.value-b.value)
      || a.entityId.localeCompare(b.entityId))
    : [];
  const cutoffTie = sorted.length > 50 && sorted[49].value === sorted[50].value;
  let lastValue = null;
  let rank = 0;
  const candidateTop50 = Object.freeze(sorted.slice(0,50).map((row,index)=>{
    if (lastValue !== row.value) {rank=index+1;lastValue=row.value;}
    return Object.freeze({...row,rank});
  }));
  const blockers = Object.freeze([
    ...(sufficientPopulation ? [] : ["population_below_50"]),
    ...(cutoffTie ? ["rank_50_cutoff_tie_requires_review"] : []),
    ...(categoryId === "us_small_businesses" ? ["sba_industry_size_eligibility_unverified"] : []),
    ...(/investment|hedge|law/.test(categoryId) ? ["regulated_specialist_review_required"] : []),
    "population_sampling_unverified",
    "source_edition_and_provenance_unverified",
    "rights_and_licensing_unverified",
    "metric_semantics_and_unit_basis_unverified",
    "owner_review_and_release_missing"
  ]);
  return Object.freeze({
    categoryId, metric, unit, period, geography, direction,
    observedCount: accepted.length, candidateTop50,
    hasFiftyComparableRecords: sufficientPopulation,
    cutoffTieRequiresReview: cutoffTie,
    blockers, reviewDateProvenance: "caller_supplied_unverified",
    sourceVerified: false, populationVerified: false, rankingVerified: false,
    officialPublisherRanking: false, automatedIngestionAllowed: false,
    publicationAuthorized: false, productionAuthorized: false,
    customerDecisionAuthorized: false,
    nextGate: "Independent reviewer must verify all entity identities, source content, scope, units, population sampling, copyright/rights and owner approval."
  });
}
module.exports = Object.freeze({ MEASURES, planComparableTop50 });
