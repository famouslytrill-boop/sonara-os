"use strict";
const assert = require("node:assert/strict");
const {
  MODEL_AUTHORITY, MAX_POLYNOMIAL_DEGREE, MAX_STEPS,
  rotatePoint2D, distance2D, rightTriangleTrigonometry, polygonSignedArea,
  evaluatePolynomial, derivativeCoefficients, integratePolynomial, simpsonPolynomial,
  projectileAtTime, stepBody2D
} = require("../lib/sonara-applied-game-mathematics.cjs");

describe("SONARA applied game mathematics research", () => {
  it("has explicit research-only authority", () => {
    assert.equal(MODEL_AUTHORITY, "research_only");
    assert.equal(MAX_POLYNOMIAL_DEGREE, 12);
    assert.equal(MAX_STEPS, 6000);
  });
  it("rotates 2D coordinates by pi/2", () => {
    const [x, y] = rotatePoint2D([1, 0], Math.PI / 2);
    assert.ok(Math.abs(x) < 1e-12);
    assert.ok(Math.abs(y - 1) < 1e-12);
    assert.deepEqual(rotatePoint2D([3, -2], 0), [3, -2]);
  });
  it("measures Pythagorean distance", () => {
    assert.equal(distance2D([0, 0], [3, 4]), 5);
    assert.equal(distance2D([-3, 4], [-3, 4]), 0);
  });
  it("calculates a 3-4-5 trigonometric right triangle", () => {
    const result = rightTriangleTrigonometry(3, 4);
    assert.equal(result.hypotenuse, 5);
    assert.equal(result.sine, .6);
    assert.equal(result.cosine, .8);
    assert.equal(result.tangent, .75);
    assert.ok(Math.abs(result.sine ** 2 + result.cosine ** 2 - 1) < 1e-12);
    assert.ok(Object.isFrozen(result));
  });
  it("handles the vertical tangent singularity explicitly", () => {
    assert.equal(rightTriangleTrigonometry(1, 0).tangent, null);
    assert.throws(() => rightTriangleTrigonometry(0, 0), RangeError);
    assert.throws(() => rightTriangleTrigonometry(-1, 2), RangeError);
  });
  it("uses shoelace oriented polygon area", () => {
    const poly = [[0, 0], [3, 0], [3, 2], [0, 2]];
    assert.deepEqual(polygonSignedArea(poly), {
      signedArea: 6, absoluteArea: 6, orientation: "counterclockwise"
    });
    assert.equal(polygonSignedArea([...poly].reverse()).signedArea, -6);
  });
  it("rejects invalid polygons and NaN points", () => {
    assert.throws(() => polygonSignedArea([[0, 0], [1, 1]]), RangeError);
    assert.throws(() => polygonSignedArea([[0, 0], [1, NaN], [2, 0]]), RangeError);
    assert.throws(() => rotatePoint2D([1, Infinity], 2), RangeError);
  });
  it("rejects bow-tie intersections instead of reporting misleading area", () => {
    assert.throws(() => polygonSignedArea([
      [0, 0], [4, 4], [0, 4], [4, 0]
    ]), RangeError);
  });
  it("rejects repeated vertices and touching nonadjacent boundaries", () => {
    assert.throws(() => polygonSignedArea([
      [0, 0], [4, 0], [4, 4], [0, 4], [0, 0]
    ]), RangeError);
    assert.throws(() => polygonSignedArea([
      [0, 0], [4, 0], [2, 0], [4, 4], [0, 4]
    ]), RangeError);
  });
  it("rejects collinear zero-area and zero-length edges", () => {
    assert.throws(() => polygonSignedArea([
      [0, 0], [1, 0], [2, 0]
    ]), RangeError);
    assert.throws(() => polygonSignedArea([
      [0, 0], [1, 0], [1, 0], [0, 1]
    ]), RangeError);
  });
  it("keeps concave polygon shoelace area valid in both orientations", () => {
    const shape = [[0, 0], [5, 0], [5, 5], [2, 5], [2, 2], [0, 2]];
    assert.equal(polygonSignedArea(shape).signedArea, 19);
    assert.equal(polygonSignedArea([...shape].reverse()).signedArea, -19);
  });
  it("evaluates polynomial powers in ascending coefficient order", () => {
    assert.equal(evaluatePolynomial([3, 2, 1], 2), 11);
    assert.equal(evaluatePolynomial([0], 5), 0);
    assert.equal(evaluatePolynomial([-1, 1], -1), -2);
  });
  it("derives polynomial coefficient vectors exactly", () => {
    assert.deepEqual(derivativeCoefficients([4, 3, 2]), [3, 4]);
    assert.deepEqual(derivativeCoefficients([100]), [0]);
  });
  it("integrates polynomial exactly and compares Simpson's approximation", () => {
    assert.equal(integratePolynomial([0, 0, 1], 0, 3), 9);
    assert.ok(Math.abs(simpsonPolynomial([0, 0, 1], 0, 3, 100) - 9) < 1e-9);
    assert.equal(integratePolynomial([3], -2, 2), 12);
  });
  it("bounds polynomial operations and Simpson subdivisions", () => {
    assert.throws(() => evaluatePolynomial([], 1), RangeError);
    assert.throws(() => evaluatePolynomial(Array(14).fill(1), 1), RangeError);
    assert.throws(() => evaluatePolynomial([1, 2], 11), RangeError);
    assert.throws(() => integratePolynomial([1], 4, 2), RangeError);
    assert.throws(() => simpsonPolynomial([1], 0, 2, 3), RangeError);
    assert.throws(() => simpsonPolynomial([1], 0, 2, 2002), RangeError);
  });
  it("computes projectile kinematics without hiding ground crossing", () => {
    const p = projectileAtTime({
      speed: 10, angleDegrees: 0, timeSeconds: 1
    });
    assert.equal(p.x, 10);
    assert.equal(p.y, -4.905);
    assert.equal(p.vx, 10);
    assert.equal(p.isBelowGround, true);
  });
  it("rejects negative simulation time and impossible speeds", () => {
    assert.throws(() => projectileAtTime({ speed: 1, angleDegrees: 0, timeSeconds: -1 }), RangeError);
    assert.throws(() => projectileAtTime({ speed: 1e6, angleDegrees: 0, timeSeconds: 1 }), RangeError);
  });
  it("uses repeatable fixed-step semi-implicit Euler integration", () => {
    const input = { position: [0, 0], velocity: [1, 0],
      acceleration: [0, 0], steps: 60, tickHz: 60 };
    const a = stepBody2D(input);
    assert.deepEqual(a, stepBody2D(input));
    assert.ok(Math.abs(a.position[0] - 1) < 1e-12);
    assert.equal(a.position[1], 0);
    assert.equal(a.simulatedSeconds, 1);
    assert.equal(a.integrator, "semi_implicit_euler");
  });
  it("bounds physics simulation and does not mutate caller arrays", () => {
    const position = [4, 5];
    const input = { position, velocity: [0, 0], acceleration: [1, 2], steps: 3 };
    stepBody2D(input);
    assert.deepEqual(position, [4, 5]);
    assert.throws(() => stepBody2D({ ...input, steps: MAX_STEPS + 1 }), RangeError);
    assert.throws(() => stepBody2D({ ...input, tickHz: 0 }), RangeError);
    assert.throws(() => stepBody2D({ ...input, position: [0, 0, 0] }), TypeError);
  });
});
