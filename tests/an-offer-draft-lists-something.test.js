"use strict";

// "Deliverables is required" meant the box was not blank.
//
// /business-builder/offers/free and /creator-studio/offers/free both mark
// deliverables required. requireFields tested the submitted string for
// non-blankness, and the builders then split it on commas and dropped the empty
// pieces -- so ", , ," passed, produced `deliverables: []`, and saved a draft
// the page reported as recorded. The offer listed nothing.
//
// A required field satisfied by measuring nothing. The refusal now happens
// before the save, and says which field and what to do about it.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const {
  splitList,
  listFieldsWithNothingIn,
  emptyListMessage,
  buildBusinessOffer,
  buildCreatorOffer,
  OFFER_LIST_FIELDS
} = require("../lib/sonara-offer-drafts.cjs");
const { FIELD_LABELS } = require("../lib/sonara-plain-language.cjs");

// The two routes and the field each one declares. Named here rather than read
// from the handlers, so this file is a second statement of the promise instead
// of an echo of the code under test.
const OFFER_ENDPOINTS = [
  {
    api: "/api/business-builder/offers",
    page: "/business-builder/offers/free",
    complete: { serviceType: "Kitchen fitting", audience: "Landlords", priceIdea: "2000", deliverables: "survey, fitting" }
  },
  {
    api: "/api/creator-studio/offers",
    page: "/creator-studio/offers/free",
    complete: { offerType: "Preset pack", audience: "Photographers", deliverables: "20 presets, install guide", priceIdea: "35" }
  }
];

// Strings that are not blank and contain no item.
const SEPARATORS_ONLY = [",", ", ,", " , , ", ",,,", "\t,\t"];

describe("an offer draft lists something", () => {
  it("has endpoints to check", () => {
    assert.equal(OFFER_ENDPOINTS.length, 2, "both offer forms must be covered or this file proves half a thing");
    assert.ok(SEPARATORS_ONLY.length >= 4, "too few separator-only inputs to be convincing");
  });

  describe("splitting a list", () => {
    it("keeps what somebody typed", () => {
      assert.deepEqual(splitList("survey, fitting , sign-off"), ["survey", "fitting", "sign-off"]);
    });

    it("returns nothing for separators alone, which is the whole bug", () => {
      for (const input of SEPARATORS_ONLY) {
        assert.deepEqual(splitList(input), [], `${JSON.stringify(input)} produced items`);
      }
    });

    it("treats a missing value as an empty list rather than the word undefined", () => {
      // String(undefined) is "undefined", which splits to ["undefined"] -- one
      // item, named after the absence. The builders call this on optional
      // fields, so an offer would have listed a proof point called "undefined".
      assert.deepEqual(splitList(undefined), []);
      assert.deepEqual(splitList(null), []);
    });
  });

  describe("naming the fields that came in empty", () => {
    it("names one when one is empty", () => {
      assert.deepEqual(listFieldsWithNothingIn({ deliverables: ", ," }, ["deliverables"]), ["deliverables"]);
    });

    it("names none when the list has something in it", () => {
      assert.deepEqual(listFieldsWithNothingIn({ deliverables: "a, b" }, ["deliverables"]), []);
    });

    it("names every empty one rather than stopping at the first", () => {
      const found = listFieldsWithNothingIn({ deliverables: ",", proofPoints: " , " }, ["deliverables", "proofPoints"]);
      assert.deepEqual(found, ["deliverables", "proofPoints"]);
    });

    it("says the field in words a customer recognises", () => {
      const message = emptyListMessage(["deliverables"]);
      assert.match(message, new RegExp(FIELD_LABELS.deliverables), "the sentence does not use the plain label");
      assert.doesNotMatch(message, /\bproductKey\b|\bpriceIdea\b/, "a raw field key reached the customer sentence");
      assert.ok(message.includes("comma"), "the sentence does not say what to do instead");
    });

    it("says nothing when there is nothing to say", () => {
      assert.equal(emptyListMessage([]), "");
    });
  });

  describe("what the builders produce", () => {
    it("carries the items through", () => {
      assert.deepEqual(buildCreatorOffer({ offerType: "p", audience: "a", deliverables: "one, two", priceIdea: "9" }).deliverables, ["one", "two"]);
      assert.deepEqual(buildBusinessOffer({ serviceType: "s", audience: "a", priceIdea: "9", deliverables: "one" }).deliverables, ["one"]);
    });

    it("does not invent a proof point out of an absent field", () => {
      assert.deepEqual(buildBusinessOffer({ serviceType: "s", audience: "a", priceIdea: "9", deliverables: "one" }).proofPoints, []);
    });
  });

  describe("over HTTP, which is where a customer meets it", () => {
    for (const endpoint of OFFER_ENDPOINTS) {
      it(`${endpoint.api} refuses a list with only separators in it`, async () => {
        for (const separators of SEPARATORS_ONLY) {
          const response = await request(app)
            .post(endpoint.api)
            .send({ ...endpoint.complete, deliverables: separators })
            .set("Accept", "application/json");
          assert.equal(response.status, 400, `${JSON.stringify(separators)} was accepted`);
          assert.equal(response.body.code, "empty_list", `${JSON.stringify(separators)} was refused for the wrong reason`);
          assert.deepEqual(response.body.fields, ["deliverables"], "the refusal did not name the field");
        }
      });

      it(`${endpoint.api} still refuses a genuinely missing field for its own reason`, async () => {
        const body = { ...endpoint.complete };
        delete body.audience;
        const response = await request(app).post(endpoint.api).send(body).set("Accept", "application/json");
        assert.equal(response.status, 400);
        assert.equal(response.body.code, "validation_failed", "an absent field is now reported as an empty list");
        assert.ok(response.body.missing.includes("audience"), "the missing field was not named");
      });

      it(`${endpoint.api} lets a complete draft past the check`, async () => {
        // Past the check, not saved: there is no database here, so it stops at
        // the workspace guard. Without this the four assertions above would
        // pass just as well against a handler that refused everything.
        const response = await request(app).post(endpoint.api).send(endpoint.complete).set("Accept", "application/json");
        assert.notEqual(response.status, 400, "a complete offer was refused, so the refusals above prove nothing");
        assert.notEqual(response.body.code, "empty_list");
      });

      it(`${endpoint.page} sends an anonymous visitor to sign in`, async () => {
        const response = await request(app).get(endpoint.page).set("Accept", "text/html");
        assert.equal(response.status, 303, `${endpoint.page} does not exist or does not guard`);
        assert.match(response.headers.location, /login/);
      });

      it(`${endpoint.api} names the field in words on the HTML path`, async () => {
        const response = await request(app)
          .post(endpoint.api)
          .send({ ...endpoint.complete, deliverables: ", ," })
          .set("Accept", "text/html");
        assert.equal(response.status, 400);
        assert.match(response.text, new RegExp(FIELD_LABELS.deliverables), "the page does not name the field");
      });
    }
  });

  it("declares the list fields it guards, for both studios", () => {
    assert.deepEqual(Object.keys(OFFER_LIST_FIELDS).sort(), ["business_builder", "creator_studio"]);
    for (const [studio, fields] of Object.entries(OFFER_LIST_FIELDS)) {
      assert.ok(fields.length > 0, `${studio} declares no list field, so the guard covers nothing`);
    }
  });
});
