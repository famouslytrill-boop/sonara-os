// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A small operational training page, not an order, payroll or payment UI.
// It only renders one fictional, deterministic turn. There is no browser-side
// JavaScript, database read, external SDK, personal data or real business action.
const { PACKS, simulateTrainingScenario } = require("./sonara-training-simulation.cjs");
const PAGE = "/business-builder/owner/operations";

const TRAINING_CHOICES = Object.freeze([
  ["restaurant_shift", "Restaurant shift"],
  ["trades_dispatch", "Trade dispatch"],
  ["retail_fulfillment", "Retail fulfillment"],
  ["creator_render", "Creator production"]
]);
const ACTIONS = Object.freeze([
  ["fulfill", "Complete one or more fictional jobs"],
  ["replenish", "Add fictional resources"]
]);

function decimal(value, maximum) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,6})$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= maximum ? number : null;
}

function sections(query = {}, escape) {
  if (typeof escape !== "function") throw new TypeError("HTML escaping is required");
  const q = query && typeof query === "object" && !Array.isArray(query) ? query : {};
  const selected = TRAINING_CHOICES.some(([key]) => key === q.scenario)
    ? q.scenario : "restaurant_shift";
  const chooser = (name, title, values, choice) => {
    return '<label for="training-' + name + '">' + escape(title) + '</label>'
      + '<select id="training-' + name + '" name="' + name + '">'
      + values.map(([id, titleText]) => '<option value="' + escape(id) + '"'
        + (id === choice ? " selected" : "") + '>' + escape(titleText) + '</option>').join("")
      + '</select>';
  };
  // Inputs are accepted only as exact bounded decimal strings. Arrays,
  // exponent notation, negative values, missing values and huge numbers fail
  // rather than being coerced to an apparently meaningful resource quantity.
  const renderNumber = (key, label, defaultValue, max) =>
    '<label for="training-' + key + '">' + escape(label) + '</label>'
    + '<input id="training-' + key + '" name="' + key + '" type="number" min="0" max="' + max
    + '" step="1" required value="' + escape(decimal(q[key], max) ?? defaultValue) + '">';
  const choiceAction = ACTIONS.some(([key]) => key === q.action) ? q.action : "fulfill";
  const form = '<form class="auth-form" action="' + PAGE + '" method="get" autocomplete="off">'
    + '<input name="view" type="hidden" value="training">'
    + '<input name="run" type="hidden" value="1">'
    + chooser("scenario", "Fictional business type", TRAINING_CHOICES, selected)
    + chooser("action", "Decision to rehearse", ACTIONS, choiceAction)
    + renderNumber("points", "Starting training points", 100, 1000000)
    + renderNumber("stock", "Starting fictional resources", 10, 1000)
    + renderNumber("units", "Units for this one turn", 1, 30)
    + '<button type="submit" class="button">Preview this turn</button></form>';
  const intro = '<article class="card"><h2>Practice without changing your business</h2>'
    + '<p>Every number here is fictional. Choose a single turn, then see exactly how resources and training points change. '
    + 'This does not book a guest, charge a customer, dispatch staff, send a message or affect your records.</p>'
    + '<p>Scores are fictional learning points, not money, credit ratings or forecasts. No bets, cashable prizes or live provider connections.</p>'
    + form + '</article>';
  if (q.run === undefined) return [intro];

  const points = decimal(q.points, 1000000);
  const stock = decimal(q.stock, 1000);
  const units = decimal(q.units, 30);
  const valid = q.run === "1" && q.scenario === selected
    && q.action === choiceAction && points !== null && stock !== null && units !== null;
  const preview = valid
    ? simulateTrainingScenario({
      mode: "fictional_training", scenario: selected, startingPoints: points, startingStock: stock,
      turns: [{ action: choiceAction, units }]
    })
    : { ok: false, code: "invalid_training_inputs" };
  if (!preview.ok) {
    return [intro, '<article class="card" role="alert"><h2>Could not calculate this turn</h2>'
      + '<p>Check your industry, action and whole-number limits. Nothing was recorded.</p>'
      + '<p>Reason: ' + escape(preview.code) + '</p></article>'];
  }
  const line = (title, value) => '<dt>' + escape(title) + '</dt><dd>' + escape(String(value)) + '</dd>';
  const result = '<article class="card" role="status"><h2>Your fictional turn</h2>'
    + '<dl>' + line("Scenario", PACKS[selected].label)
    + line("Action", choiceAction)
    + line("Units", units)
    + line("Points remaining", preview.remainingPoints)
    + line("Resources remaining", preview.remainingStock)
    + line("Completed units", preview.completedUnits)
    + line("Training score", preview.trainingScore)
    + '</dl><p>This was a one-turn preview, not a saved game or actual business result.</p>'
    + '</article>';
  return [intro, result];
}

module.exports = { PAGE, sections };
