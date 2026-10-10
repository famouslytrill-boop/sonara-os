// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
// Fifty research POPULATIONS, not fifty verified entities or licensed rankings.
// Read-only, no network, no scraping, no regulated advice or customer mutation.
const { SOURCES, inspectRanking } = require("./sonara-research-benchmark-gates.cjs");
const REFERENCES = Object.freeze(Object.fromEntries([["fortune_us","Fortune 500 2026","https://fortune.com/ranking/fortune500/","publisher_ranking","us_revenue_2026"],["fortune_europe","Fortune 500 Europe 2026","https://fortune.com/europe/ranking/fortune500-europe/","publisher_ranking","europe_revenue_2026"],["fortune_global","Fortune Global 500 2026","https://fortune.com/ranking/global500/","publisher_ranking","global_revenue_2026"],["forbes_realtime","Forbes Real-Time Billionaires","https://www.forbes.com/real-time-billionaires/","publisher_ranking","billionaires_realtime"],["sba_size","SBA Small Business Size Standards","https://data.sba.gov/dataset/small-business-size-standards","context_only","-"],["census_cbp","Census County Business Patterns","https://www.census.gov/programs-surveys/cbp/data.html","context_only","-"],["restaurant_report","2026 Restaurant Industry Report","https://restaurant.org/research-and-media/research/research-reports/state-of-the-industry","context_only","-"],["sec_edgar","SEC EDGAR","https://www.sec.gov/edgar/search/","context_only","-"],["sec_iapd","SEC Investment Adviser Public Disclosure","https://adviserinfo.sec.gov/","context_only","-"],["openalex","OpenAlex scholarly metadata","https://help.openalex.org/api/","context_only","-"],["uspto","USPTO patent information","https://www.uspto.gov/patents","context_only","-"],["copyright_mma","U.S. Copyright Office Music Modernization","https://www.copyright.gov/music-modernization/","context_only","-"],["copyright_basics","U.S. Copyright Office - What is Copyright?","https://www.copyright.gov/what-is-copyright/","context_only","-"],["irs_990","IRS Tax Exempt Organization Search","https://www.irs.gov/charities-non-profits/search-for-tax-exempt-organizations","context_only","-"],["aba_directory","American Bar Association State Bar Directories","https://www.americanbar.org/groups/legal_services/flh-home/flh-bar-directories-and-lawyer-finders/","context_only","-"]].map(
  ([id,title,url,role,rankingId])=>[id,Object.freeze({
    id,title,url,role,rankingId:rankingId==="- " || rankingId==="-" ? null : rankingId,
    ingestionAllowed:false,republicationRightsCleared:false,
    verifiedForThisCohort:false
  })]
)));
const ATLAS = Object.freeze([["us_revenue_companies","U.S. companies by revenue","company","business_builder","annual_revenue","fortune_us"],["europe_revenue_companies","European companies by revenue","company","business_builder","annual_revenue","fortune_europe"],["global_revenue_companies","World companies by revenue","company","business_builder","annual_revenue","fortune_global"],["realtime_billionaires","World's wealthiest people","individual","sonara_one","estimated_net_worth","forbes_realtime"],["us_small_businesses","U.S. small businesses","company","business_builder","industry_specific","sba_size"],["us_restaurants","U.S. restaurants","establishment","business_builder","operator_performance","restaurant_report"],["world_restaurants","International restaurants","establishment","business_builder","operator_performance","restaurant_report"],["us_security_companies","Security services companies","company","business_builder","audited_sector_metric","census_cbp"],["us_manufacturers","Manufacturers","company","business_builder","audited_sector_metric","census_cbp"],["us_production_distributors","Production and distribution companies","company","business_builder","audited_sector_metric","census_cbp"],["us_wholesale_distributors","Wholesale distributors","company","business_builder","audited_sector_metric","census_cbp"],["us_rental_companies","Rental companies","company","business_builder","audited_sector_metric","census_cbp"],["us_hospitality_companies","Hospitality companies","company","business_builder","audited_sector_metric","census_cbp"],["us_application_companies","Application companies","company","growth_studio","audited_sector_metric","sec_edgar"],["us_design_companies","Design companies","company","creator_studio","audited_sector_metric","census_cbp"],["us_automobile_companies","Automobile companies","company","business_builder","audited_sector_metric","sec_edgar"],["us_analytics_companies","Analytics companies","company","growth_studio","audited_sector_metric","sec_edgar"],["us_transportation_companies","Transportation companies","company","business_builder","audited_sector_metric","census_cbp"],["us_logistics_companies","Logistics companies","company","business_builder","audited_sector_metric","census_cbp"],["us_media_companies","Media companies","company","creator_studio","audited_sector_metric","sec_edgar"],["us_communications_companies","Communication companies","company","growth_studio","audited_sector_metric","sec_edgar"],["us_music_companies","Music companies","company","creator_studio","licensed_distribution","copyright_mma"],["us_music_publishers","Music publishing companies","company","creator_studio","licensed_distribution","copyright_mma"],["us_book_publishers","Book publishing companies","company","creator_studio","audited_sector_metric","census_cbp"],["us_digital_distributors","Digital distribution companies","company","creator_studio","licensed_distribution","copyright_mma"],["us_monetization_companies","Monetization companies","company","growth_studio","audited_sector_metric","sec_edgar"],["us_streaming_companies","Streaming companies","company","creator_studio","audited_sector_metric","sec_edgar"],["us_recording_companies","Recording companies","company","creator_studio","licensed_distribution","copyright_mma"],["us_music_production_companies","Music production companies","company","creator_studio","licensed_distribution","copyright_mma"],["us_audio_production_companies","Audio production companies","company","creator_studio","licensed_distribution","copyright_mma"],["us_video_production_companies","Video production companies","company","creator_studio","audited_sector_metric","census_cbp"],["us_software_companies","Software companies","company","growth_studio","audited_sector_metric","sec_edgar"],["us_game_companies","Video game companies","company","creator_studio","audited_sector_metric","sec_edgar"],["us_movie_companies","Movie companies","company","creator_studio","audited_sector_metric","sec_edgar"],["us_investment_firms","Investment firms","company","business_builder","registered_firm_disclosure","sec_iapd"],["us_hedge_funds","Hedge fund managers","company","business_builder","registered_firm_disclosure","sec_iapd"],["us_law_firms","Law firms","company","business_builder","licensed_practice_directory","aba_directory"],["us_philanthropies","Philanthropic organizations","organization","business_builder","documented_grantmaking","irs_990"],["global_physicists","Physicists","individual","sonara_one","research_impact_contextual","openalex"],["global_mathematicians","Mathematicians","individual","sonara_one","research_impact_contextual","openalex"],["global_scientists","Scientists","individual","sonara_one","research_impact_contextual","openalex"],["global_inventors","Inventors","individual","sonara_one","patent_contextual","uspto"],["global_entrepreneurs","Entrepreneurs","individual","business_builder","documented_founder_activity","sec_edgar"],["global_ceos","Chief executives","individual","business_builder","documented_leadership_activity","sec_edgar"],["global_cfos","Chief financial officers","individual","business_builder","documented_finance_activity","sec_edgar"],["us_painters","U.S. painters","individual","creator_studio","curatorial_contextual","copyright_basics"],["us_visual_artists","U.S. visual artists","individual","creator_studio","curatorial_contextual","copyright_basics"],["us_musicians","U.S. musicians","individual","creator_studio","measured_audience_and_rights","copyright_mma"],["us_authors","U.S. authors","individual","creator_studio","documented_publication","copyright_basics"],["us_restaurant_tech_vendors","U.S. restaurant technology vendors","company","business_builder","operator_performance","restaurant_report"]].map(
  ([id,title,kind,product,comparisonMetric,referenceId])=>Object.freeze({
    id,title,kind,product,comparisonMetric,referenceId,
    targetSize:50,populationVerified:false,rankingVerified:false,
    status:REFERENCES[referenceId].role==="publisher_ranking"
      ? "independent_publisher_edition_audit_required"
      : "cohort_and_metric_definition_required"
  })
));
const BY_ID = new Map(ATLAS.map(item=>[item.id,item]));
const VALID_PRODUCTS = new Set(["sonara_one","business_builder","creator_studio","growth_studio"]);
const VALID_KINDS = new Set(["company","individual","organization","establishment"]);
function listResearchAtlas(filter={}) {
  if (!filter || typeof filter!=="object" || Array.isArray(filter)
    || Object.keys(filter).some(key=>!["kind","product"].includes(key)))
    throw new TypeError("Only kind/product filters supported");
  if (filter.kind!=null && !VALID_KINDS.has(filter.kind)) throw new RangeError("Unknown kind");
  if (filter.product!=null && !VALID_PRODUCTS.has(filter.product)) throw new RangeError("Unknown product");
  return Object.freeze(ATLAS.filter(x=>(filter.kind==null||x.kind===filter.kind)
    &&(filter.product==null||x.product===filter.product)));
}
function planTop50Research(categoryId) {
  if (typeof categoryId!=="string" || !BY_ID.has(categoryId)) throw new RangeError("Unknown research population");
  const category=BY_ID.get(categoryId),reference=REFERENCES[category.referenceId];
  return Object.freeze({
    categoryId,title:category.title,product:category.product,
    kind:category.kind,comparisonMetric:category.comparisonMetric,
    reference,targetSize:50,
    researchMethod:reference.role==="publisher_ranking"
      ? "independently_transcribe_and_review_publisher_edition"
      : "define_population_metric_period_geography_and_evidence_first",
    entries:Object.freeze([]),populatedCount:0,
    rightsCleared:false,independentlyVerified:false,
    rankingValid:false,automatedIngestionAllowed:false,
    customerDecisionAuthorized:false,productionAuthorized:false,
    requiredReview:Object.freeze(["metric_and_population","period_and_geography",
      "source_conflict_and_provenance","publisher_rights_and_licenses",
      "human_editorial_review","tenant_and_release_security"])
  });
}
function inspectPublishedTop50({categoryId,records,observedAt,checkedAt}={}) {
  const plan=planTop50Research(categoryId);
  if (plan.reference.role!=="publisher_ranking")
    throw new RangeError("This population has no registered authoritative Top 50 ranking");
  const sourceId=plan.reference.rankingId;
  if (!Object.prototype.hasOwnProperty.call(SOURCES,sourceId))
    throw new RangeError("Publisher source is not registered in canonical validation");
  const r=inspectRanking({sourceId,records,observedAt,checkedAt,targetSize:50});
  return Object.freeze({
    categoryId,sourceId,sourceStatus:r.status,issueCodes:r.issueCodes,
    entries:r.entries,missingRanks:r.missingRanks,rejected:r.rejected,
    transcribedCount:r.count,completeTranscription:r.missingRanks.length===0&&r.rejected.length===0,
    independentlyVerified:false,rightsCleared:false,
    automatedIngestionAllowed:false,productionAuthorized:false,
    nextGate:"Independently verify each rank, edition and publisher rights; no customer or production authorization."
  });
}
// Deterministic exploratory group statistics, not an official or independently
// verified sector ranking. No names, customer records, PII, side effects or exports.
function summarizeCohortDistribution({categoryId, values, unit, period}={}) {
  planTop50Research(categoryId);
  if (!Array.isArray(values) || values.length < 5 || values.length > 50 ||
    !values.every(value => typeof value === "number" && Number.isFinite(value)
      && value >= 0 && value <= 1e15)) {
    throw new RangeError("values must be 5 to 50 finite nonnegative samples");
  }
  if (typeof unit !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(unit)) {
    throw new TypeError("unit must be a bounded lowercase measurement unit");
  }
  if (typeof period !== "string" || !/^20[0-9]{2}$/.test(period)) {
    throw new TypeError("period must be one explicit 2000-2099 reference year");
  }
  const sorted = [...values].sort((a,b)=>a-b);
  const percentile = (p) => {
    const location=(sorted.length-1)*p;
    const lower=Math.floor(location),upper=Math.ceil(location);
    return sorted[lower] + (sorted[upper]-sorted[lower])*(location-lower);
  };
  return Object.freeze({
    categoryId,unit,period,sampleSize:sorted.length,
    minimum:sorted[0],q1:percentile(0.25),median:percentile(0.5),
    q3:percentile(0.75),maximum:sorted.at(-1),
    aggregationMethod:"sorted_sample_linear_interpolation",
    unitConsistencyVerified:false,metricComparabilityVerified:false,
    samplingBiasReviewed:false,sourceVerified:false,
    independentRanking:false,productionAuthorized:false,
    caveat:"Caller-supplied exploratory data only. Unit, population, sampling bias and rights require review."
  });
}
function getAtlasCoverage(){const established=ATLAS.filter(x=>REFERENCES[x.referenceId].role==="publisher_ranking").length;
  return Object.freeze({categories:ATLAS.length,targetPerCategory:50,
    publisherRankingCategories:established,customBenchmarkCategories:ATLAS.length-established,
    verifiedLists:0,verifiedEntityRows:0,activeCustomerIntegrations:0,
    automatedIngestionAllowed:false,productionAuthorized:false});}
module.exports=Object.freeze({REFERENCES,ATLAS,listResearchAtlas,planTop50Research,inspectPublishedTop50,summarizeCohortDistribution,getAtlasCoverage});
