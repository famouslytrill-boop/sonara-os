"use strict";
const assert = require("node:assert/strict");
const {
  ENGINE_STATUS, HAND_ORDER, choose, cardDrawProbability,
  evaluateFiveCardHand, solveTwoByTwoZeroSum, solveTicTacToe
} = require("../lib/sonara-card-game-strategy.cjs");

describe("SONARA card probability and finite game theory sandbox", () => {
  it("is explicitly non-redeemable, non-trading and not certified", () => {
    for (const key of ["moneyOrPrizes", "rngCertification", "liveDealer",
      "liveTrading", "playerAuthentication"]) assert.equal(ENGINE_STATUS[key], false);
    assert.ok(Object.isFrozen(ENGINE_STATUS));
  });
  it("calculates exact combinations using BigInt", () => {
    assert.equal(choose(52, 5), 2598960n);
    assert.equal(choose(52, 26), 495918532948104n);
    assert.equal(choose(52, 0), 1n);
  });
  it("rejects oversized or fractional binomial dimensions", () => {
    assert.throws(() => choose(53, 4), RangeError);
    assert.throws(() => choose(52, 1.2), RangeError);
    assert.throws(() => choose(52, -1), RangeError);
  });
  it("computes a 5-card exactly-one-ace probability", () => {
    const p = cardDrawProbability({ successCards: 4, drawCount: 5, exactSuccesses: 1 });
    assert.equal(p.favorableOutcomes, "778320");
    assert.equal(p.totalOutcomes, "2598960");
    assert.ok(Math.abs(p.probability - 778320 / 2598960) < 1e-14);
  });
  it("counts impossible and certain events correctly", () => {
    assert.equal(cardDrawProbability({ deckSize: 10, successCards: 1, drawCount: 5, exactSuccesses: 3 }).probability, 0);
    assert.equal(cardDrawProbability({ deckSize: 10, successCards: 10, drawCount: 3, exactSuccesses: 3 }).probability, 1);
  });
  it("rejects inconsistent deck sizes", () => {
    assert.throws(() => cardDrawProbability({
      deckSize: 52, successCards: 60, drawCount: 1, exactSuccesses: 0
    }), RangeError);
  });
  it("classifies ace high and low five-card straight flush", () => {
    const high = evaluateFiveCardHand(["AS", "KS", "QS", "JS", "TS"]);
    const low = evaluateFiveCardHand(["AS", "2S", "3S", "4S", "5S"]);
    assert.equal(high.kind, "straight_flush");
    assert.deepEqual(high.tiebreak, [14]);
    assert.deepEqual(low.tiebreak, [5]);
    assert.equal(high.rankClass, HAND_ORDER.length - 1);
  });
  it("classifies four-kind and full house", () => {
    assert.equal(evaluateFiveCardHand(["AS", "AH", "AD", "AC", "2S"]).kind, "four_kind");
    assert.equal(evaluateFiveCardHand(["AS", "AH", "AD", "KS", "KH"]).kind, "full_house");
  });
  it("classifies flush and ordinary straight", () => {
    assert.equal(evaluateFiveCardHand(["2C", "4C", "6C", "8C", "JC"]).kind, "flush");
    assert.equal(evaluateFiveCardHand(["2C", "3H", "4S", "5C", "6D"]).kind, "straight");
  });
  it("classifies all remaining hand classes", () => {
    assert.equal(evaluateFiveCardHand(["AS", "AH", "AD", "KC", "2H"]).kind, "three_kind");
    assert.equal(evaluateFiveCardHand(["AS", "AH", "KS", "KH", "2S"]).kind, "two_pair");
    assert.equal(evaluateFiveCardHand(["AS", "AH", "KS", "QC", "2S"]).kind, "one_pair");
    assert.equal(evaluateFiveCardHand(["AS", "KH", "QS", "8C", "2S"]).kind, "high_card");
  });
  it("blocks duplicates and malformed card inputs", () => {
    assert.throws(() => evaluateFiveCardHand(["AS", "AS", "3S", "4S", "5S"]), RangeError);
    assert.throws(() => evaluateFiveCardHand(["AS", "2S"]), RangeError);
    assert.throws(() => evaluateFiveCardHand(["AS", "2S", "3S", "4S", "10S"]), TypeError);
  });
  it("solves matching pennies as 50/50 interior mixed Nash", () => {
    const v = solveTwoByTwoZeroSum([[1, -1], [-1, 1]]);
    assert.equal(v.equilibriumType, "mixed");
    assert.deepEqual(v.rowProbabilities, [.5, .5]);
    assert.deepEqual(v.columnProbabilities, [.5, .5]);
    assert.equal(v.gameValue, 0);
  });
  it("returns pure saddle-point equilibrium when present", () => {
    const v = solveTwoByTwoZeroSum([[4, 2], [3, 1]]);
    assert.equal(v.equilibriumType, "pure");
    assert.equal(v.gameValue, 2);
    assert.deepEqual(v.pureEquilibria, [{ row: 0, column: 1 }]);
  });
  it("rejects malformed or nonfinite payoff matrices", () => {
    assert.throws(() => solveTwoByTwoZeroSum([[1, 2]]), RangeError);
    assert.throws(() => solveTwoByTwoZeroSum([[1, NaN], [0, 0]]), RangeError);
  });
  it("solves opening tic-tac-toe to a draw", () => {
    const v = solveTicTacToe();
    assert.equal(v.status, "ongoing");
    assert.equal(v.scoreForX, 0);
    assert.equal(v.turn, "X");
    assert.equal(v.optimalMoves.length, 9);
    assert.deepEqual(v, solveTicTacToe());
  });
  it("finds the sole win, and marks finished games terminal", () => {
    const v = solveTicTacToe("XX.OO....");
    assert.deepEqual(v.optimalMoves, [2]);
    assert.equal(v.scoreForX, 1);
    const done = solveTicTacToe("XXXOO....");
    assert.equal(done.winner, "X");
    assert.equal(done.status, "terminal");
    assert.deepEqual(done.optimalMoves, []);
  });
  it("denies invalid counts, simultaneous winners and malformed cells", () => {
    assert.throws(() => solveTicTacToe("OO......."), RangeError);
    assert.throws(() => solveTicTacToe("XXXOOO..."), RangeError);
    assert.throws(() => solveTicTacToe("XX......"), TypeError);
    assert.throws(() => solveTicTacToe("XXXXXXXXX"), RangeError);
    assert.throws(() => solveTicTacToe("XOX!....."), TypeError);
  });
});
