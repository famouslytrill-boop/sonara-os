// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

/**
 * Pure bounded research mathematics. Not a collision engine, CAD authority,
 * portfolio valuation, calibration, finance ledger, or production simulator.
 * Uses JS double precision and deterministic arithmetic for finite inputs.
 */
const MODEL_AUTHORITY = "research_only";
const MAX_POLYNOMIAL_DEGREE = 12;
const MAX_STEPS = 6000;

function finite(value, name, min = -1e6, max = 1e6) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(name + " must be a finite number in [" + min + ", " + max + "]");
  }
  return value;
}
function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + " must be a safe integer in [" + min + ", " + max + "]");
  }
  return value;
}
function result(value, name) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e15) {
    throw new RangeError(name + " exceeded the numerical safety limit");
  }
  return value;
}
function validateVector(point, name) {
  if (!Array.isArray(point) || point.length !== 2) throw new TypeError(name + " must be [x,y]");
  return [finite(point[0], name + ".x"), finite(point[1], name + ".y")];
}
function validatePolynomial(coefficients) {
  if (!Array.isArray(coefficients) || coefficients.length < 1 ||
      coefficients.length > MAX_POLYNOMIAL_DEGREE + 1) {
    throw new RangeError("polynomial requires 1..13 coefficients ascending in power");
  }
  return coefficients.map((x, i) => finite(x, "coefficient[" + i + "]", -1e5, 1e5));
}

/** Coordinate geometry. Padded/clamped values are not silently accepted. */
function rotatePoint2D(point, angleRadians) {
  const [x, y] = validateVector(point, "point");
  const angle = finite(angleRadians, "angleRadians", -1e4, 1e4);
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  return Object.freeze([result(x * cosine - y * sine, "rotated x"),
    result(x * sine + y * cosine, "rotated y")]);
}
function distance2D(a, b) {
  const [ax, ay] = validateVector(a, "a");
  const [bx, by] = validateVector(b, "b");
  return Math.hypot(ax - bx, ay - by);
}
function rightTriangleTrigonometry(opposite, adjacent) {
  finite(opposite, "opposite", 0, 1e6);
  finite(adjacent, "adjacent", 0, 1e6);
  if (opposite === 0 && adjacent === 0) throw new RangeError("triangle sides cannot both be zero");
  const hypotenuse = Math.hypot(opposite, adjacent);
  const angleRadians = Math.atan2(opposite, adjacent);
  return Object.freeze({
    hypotenuse, angleRadians, angleDegrees: angleRadians * 180 / Math.PI,
    sine: opposite / hypotenuse, cosine: adjacent / hypotenuse,
    tangent: adjacent === 0 ? null : opposite / adjacent
  });
}

/** Shoelace polygon area; points must form a simple polygon for physical area. */
function polygonSignedArea(points) {
  if (!Array.isArray(points) || points.length < 3 || points.length > 128) {
    throw new RangeError("polygon needs 3..128 ordered vertices");
  }
  const vertices = points.map((point, i) => validateVector(point, "point[" + i + "]"));
  let twiceArea = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[(i + 1) % vertices.length];
    twiceArea = result(twiceArea + (x1 * y2 - y1 * x2), "polygon area");
  }
  return Object.freeze({ signedArea: twiceArea / 2, absoluteArea: Math.abs(twiceArea / 2),
    orientation: twiceArea > 0 ? "counterclockwise" : twiceArea < 0 ? "clockwise" : "degenerate" });
}

/** Horner polynomial evaluation, coefficient[0] is the constant. */
function evaluatePolynomial(coefficients, x) {
  const c = validatePolynomial(coefficients);
  finite(x, "x", -10, 10);
  let value = 0;
  for (let i = c.length - 1; i >= 0; i--) {
    value = result(value * x + c[i], "polynomial");
  }
  return value;
}
function derivativeCoefficients(coefficients) {
  const c = validatePolynomial(coefficients);
  if (c.length === 1) return Object.freeze([0]);
  return Object.freeze(c.slice(1).map((value, index) => value * (index + 1)));
}
function integratePolynomial(coefficients, lower, upper) {
  const c = validatePolynomial(coefficients);
  finite(lower, "lower", -10, 10);
  finite(upper, "upper", -10, 10);
  if (upper < lower) throw new RangeError("upper must not precede lower");
  // Integrate analytically term by term; no expression eval or user callbacks.
  let value = 0;
  for (let i = 0; i < c.length; i++) {
    value = result(value + c[i] * (upper ** (i + 1) - lower ** (i + 1)) / (i + 1),
      "definite integral");
  }
  return value;
}
function simpsonPolynomial(coefficients, lower, upper, subdivisions = 100) {
  validatePolynomial(coefficients);
  finite(lower, "lower", -10, 10);
  finite(upper, "upper", -10, 10);
  if (upper < lower) throw new RangeError("upper must not precede lower");
  integer(subdivisions, "subdivisions", 2, 2000);
  if (subdivisions % 2) throw new RangeError("Simpson subdivisions must be even");
  const h = (upper - lower) / subdivisions;
  let weightedSum = evaluatePolynomial(coefficients, lower) + evaluatePolynomial(coefficients, upper);
  for (let i = 1; i < subdivisions; i++) {
    weightedSum = result(weightedSum + (i % 2 ? 4 : 2) * evaluatePolynomial(coefficients, lower + i * h),
      "Simpson weighted sum");
  }
  return result(weightedSum * h / 3, "Simpson integral");
}

/** Analytic ballistic trajectory; ignores air drag, impact and collision. */
function projectileAtTime({ speed, angleDegrees, gravity = 9.81, height = 0, timeSeconds }) {
  finite(speed, "speed", 0, 1e4);
  finite(angleDegrees, "angleDegrees", -360, 360);
  finite(gravity, "gravity", 0, 100);
  finite(height, "height", 0, 1e6);
  finite(timeSeconds, "timeSeconds", 0, 1000);
  const angle = angleDegrees * Math.PI / 180;
  const vx = speed * Math.cos(angle);
  const vy = speed * Math.sin(angle) - gravity * timeSeconds;
  return Object.freeze({
    x: result(vx * timeSeconds, "projectile x"),
    y: result(height + speed * Math.sin(angle) * timeSeconds -
      0.5 * gravity * timeSeconds ** 2, "projectile y"),
    vx, vy, isBelowGround: height + speed * Math.sin(angle) * timeSeconds -
      0.5 * gravity * timeSeconds ** 2 < 0
  });
}

/** Fixed-step semi-implicit Euler educational motion; not collision/rigidbody physics. */
function stepBody2D({ position, velocity, acceleration, tickHz = 60, steps = 1 }) {
  let [x, y] = validateVector(position, "position");
  let [vx, vy] = validateVector(velocity, "velocity");
  const [ax, ay] = validateVector(acceleration, "acceleration");
  integer(tickHz, "tickHz", 1, 240);
  integer(steps, "steps", 1, MAX_STEPS);
  const dt = 1 / tickHz;
  for (let i = 0; i < steps; i++) {
    vx = result(vx + ax * dt, "velocity x");
    vy = result(vy + ay * dt, "velocity y");
    x = result(x + vx * dt, "position x");
    y = result(y + vy * dt, "position y");
  }
  return Object.freeze({
    position: Object.freeze([x, y]), velocity: Object.freeze([vx, vy]),
    simulatedSeconds: steps / tickHz, integrator: "semi_implicit_euler"
  });
}
module.exports = {
  MODEL_AUTHORITY, MAX_POLYNOMIAL_DEGREE, MAX_STEPS,
  rotatePoint2D, distance2D, rightTriangleTrigonometry, polygonSignedArea,
  evaluatePolynomial, derivativeCoefficients, integratePolynomial, simpsonPolynomial,
  projectileAtTime, stepBody2D
};
