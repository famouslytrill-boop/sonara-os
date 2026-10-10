// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/**
 * Educational card-combinatorics and finite strategy solvers.
 * No casino outcome generator, wagers, trading execution or multiplayer authority.
 */
const ENGINE_STATUS = Object.freeze({
  purpose: "sandbox_strategy_and_card_mathematics",
  moneyOrPrizes: false, rngCertification: false,
  liveDealer: false, liveTrading: false, playerAuthentication: false
});
function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + " must be an integer in [" + min + ", " + max + "]");
  }
  return value;
}
function finite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e6) {
    throw new RangeError(name + " must be a bounded finite value");
  }
  return value;
}
function choose(n, k) {
  integer(n, "n", 0, 52);
  integer(k, "k", 0, 52);
  if (k > n) return 0n;
  const times = Math.min(k, n - k);
  let value = 1n;
  for (let i = 1; i <= times; i++) {
    value = value * BigInt(n - times + i) / BigInt(i);
  }
  return value;
}

/** Hypergeometric distribution: exact k successes without replacement. */
function cardDrawProbability({ deckSize = 52, successCards, drawCount, exactSuccesses }) {
  integer(deckSize, "deckSize", 1, 52);
  integer(successCards, "successCards", 0, deckSize);
  integer(drawCount, "drawCount", 0, deckSize);
  integer(exactSuccesses, "exactSuccesses", 0, drawCount);
  const numerator = choose(successCards, exactSuccesses) *
    choose(deckSize - successCards, drawCount - exactSuccesses);
  const denominator = choose(deckSize, drawCount);
  return Object.freeze({
    model: "uniform_draw_without_replacement",
    deckSize, successCards, drawCount, exactSuccesses,
    favorableOutcomes: numerator.toString(),
    totalOutcomes: denominator.toString(),
    probability: Number(numerator) / Number(denominator)
  });
}
const RANKS = "23456789TJQKA";
const HAND_ORDER = Object.freeze(["high_card", "one_pair", "two_pair", "three_kind",
  "straight", "flush", "full_house", "four_kind", "straight_flush"]);
/** 5-card high-poker evaluation. A represents Ace; T represents ten. */
function evaluateFiveCardHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) throw new RangeError("exactly five cards required");
  const seen = new Set();
  const ranks = [], suits = [];
  for (const card of cards) {
    if (typeof card !== "string" || !/^[2-9TJQKA][CDHS]$/.test(card)) {
      throw new TypeError("invalid card, expected ranks 2..9,T,J,Q,K,A and suits C,D,H,S");
    }
    if (seen.has(card)) throw new RangeError("duplicate physical card");
    seen.add(card);
    ranks.push(RANKS.indexOf(card[0]) + 2);
    suits.push(card[1]);
  }
  const freq = new Map();
  for (const r of ranks) freq.set(r, (freq.get(r) || 0) + 1);
  const unique = [...freq.keys()].sort((a, b) => a - b);
  const wheel = unique.length === 5 && unique.join(",") === "2,3,4,5,14";
  const straight = unique.length === 5 && (wheel || unique[4] - unique[0] === 4);
  const flush = suits.every(s => s === suits[0]);
  const counts = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const countPattern = counts.map(entry => entry[1]).join(",");
  let kind, tiebreak;
  if (straight && flush) {
    kind = "straight_flush"; tiebreak = [wheel ? 5 : unique[4]];
  } else if (countPattern === "4,1") {
    kind = "four_kind"; tiebreak = counts.map(entry => entry[0]);
  } else if (countPattern === "3,2") {
    kind = "full_house"; tiebreak = counts.map(entry => entry[0]);
  } else if (flush) {
    kind = "flush"; tiebreak = ranks.slice().sort((a, b) => b - a);
  } else if (straight) {
    kind = "straight"; tiebreak = [wheel ? 5 : unique[4]];
  } else if (countPattern === "3,1,1") {
    kind = "three_kind"; tiebreak = counts.map(entry => entry[0]);
  } else if (countPattern === "2,2,1") {
    kind = "two_pair"; tiebreak = counts.map(entry => entry[0]);
  } else if (countPattern === "2,1,1,1") {
    kind = "one_pair"; tiebreak = counts.map(entry => entry[0]);
  } else {
    kind = "high_card"; tiebreak = ranks.slice().sort((a, b) => b - a);
  }
  return Object.freeze({
    kind, rankClass: HAND_ORDER.indexOf(kind),
    tiebreak: Object.freeze(tiebreak),
    cards: Object.freeze([...cards]),
    authority: "educational_poker_classification_only"
  });
}

/** Row maximizes and column minimizes; interior two-by-two mixed Nash. */
function solveTwoByTwoZeroSum(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 2 ||
      matrix.some(row => !Array.isArray(row) || row.length !== 2)) {
    throw new RangeError("exact 2x2 payoff matrix required");
  }
  const [[a, b], [c, d]] = matrix.map((row, i) =>
    row.map((v, j) => finite(v, "payoff " + i + "," + j)));
  const rowMinima = [Math.min(a, b), Math.min(c, d)];
  const columnMaxima = [Math.max(a, c), Math.max(b, d)];
  const maximin = Math.max(...rowMinima);
  const minimax = Math.min(...columnMaxima);
  if (Math.abs(maximin - minimax) <= 1e-9) {
    const pureEquilibria = [];
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 2; col++) {
        const payoff = matrix[r][col];
        if (Math.abs(payoff - maximin) <= 1e-9 &&
          Math.abs(rowMinima[r] - maximin) <= 1e-9 &&
          Math.abs(columnMaxima[col] - minimax) <= 1e-9) {
          pureEquilibria.push(Object.freeze({ row: r, column: col }));
        }
      }
    }
    return Object.freeze({
      equilibriumType: "pure", gameValue: maximin,
      pureEquilibria: Object.freeze(pureEquilibria),
      rowProbabilities: null, columnProbabilities: null
    });
  }
  const determinant = a - b - c + d;
  if (Math.abs(determinant) < 1e-12) {
    throw new RangeError("unstable or degenerate game");
  }
  const p = (d - c) / determinant;
  const q = (d - b) / determinant;
  const value = (a * d - b * c) / determinant;
  if (!Number.isFinite(value) || p <= 0 || p >= 1 || q <= 0 || q >= 1) {
    throw new RangeError("no stable interior equilibrium");
  }
  return Object.freeze({
    equilibriumType: "mixed", gameValue: value,
    pureEquilibria: Object.freeze([]),
    rowProbabilities: Object.freeze([p, 1 - p]),
    columnProbabilities: Object.freeze([q, 1 - q])
  });
}
const WIN_LINES = Object.freeze([
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
]);
function winners(board) {
  const found = new Set();
  for (const [i, j, k] of WIN_LINES) {
    if (board[i] !== "." && board[i] === board[j] && board[j] === board[k]) {
      found.add(board[i]);
    }
  }
  return found;
}

/** Exhaustive memoized minimax, only for legal 3x3 tic-tac-toe positions. */
function solveTicTacToe(board = ".........") {
  if (typeof board !== "string" || !/^[XO.]{9}$/.test(board)) {
    throw new TypeError("board must be a nine-character X/O/. string");
  }
  const countX = [...board].filter(x => x === "X").length;
  const countO = [...board].filter(x => x === "O").length;
  if (countO > countX || countX - countO > 1) throw new RangeError("illegal move count");
  const found = winners(board);
  if (found.size > 1 || (found.has("X") && countX !== countO + 1) ||
      (found.has("O") && countX !== countO)) {
    throw new RangeError("contradictory game result");
  }
  const memo = new Map();
  function minimax(position) {
    if (memo.has(position)) return memo.get(position);
    const won = winners(position);
    if (won.has("X")) return 1;
    if (won.has("O")) return -1;
    if (!position.includes(".")) return 0;
    const x = [...position].filter(v => v === "X").length;
    const o = [...position].filter(v => v === "O").length;
    const current = x === o ? "X" : "O";
    let best = current === "X" ? -1 : 1;
    for (let i = 0; i < 9; i++) {
      if (position[i] !== ".") continue;
      const score = minimax(position.slice(0, i) + current + position.slice(i + 1));
      best = current === "X" ? Math.max(best, score) : Math.min(best, score);
    }
    memo.set(position, best);
    return best;
  }
  const scoreForX = minimax(board);
  const winner = found.has("X") ? "X" : found.has("O") ? "O" : null;
  const terminal = winner !== null || !board.includes(".");
  const turn = terminal ? null : countX === countO ? "X" : "O";
  const optimalMoves = [];
  if (!terminal) {
    for (let i = 0; i < 9; i++) {
      if (board[i] !== ".") continue;
      const score = minimax(board.slice(0, i) + turn + board.slice(i + 1));
      if (score === scoreForX) optimalMoves.push(i);
    }
  }
  return Object.freeze({
    status: terminal ? "terminal" : "ongoing", turn, winner, scoreForX,
    optimalMoves: Object.freeze(optimalMoves), algorithm: "memoized_minimax"
  });
}
module.exports = {
  ENGINE_STATUS, HAND_ORDER, choose,
  cardDrawProbability, evaluateFiveCardHand,
  solveTwoByTwoZeroSum, solveTicTacToe
};
