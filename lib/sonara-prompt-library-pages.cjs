// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What a workspace saves in its prompt library, and the forms that save it.
//
// The studio prompt pages said "use these starter instructions straight away,
// or save your own", listed "Your saved instructions", and offered nothing that
// saved one. tests/form-reachability.test.js excused the save endpoints:
// "Saving a customer's own template needs a column separating it from the
// curated reference set first." There was nothing to separate. The curated set
// is BUILTIN_PROMPT_TEMPLATES in lib/sonara-prompt-library.cjs and never touches
// the table; a saved instruction is a sonara_prompt_templates row carrying its
// organization, its author, its source_type and its provenance, and the page
// already showed those rows in a card of their own. The page's promise was the
// true part and the excuse was the stale one.
//
// Every option offered here is one validatePromptRecord accepts, read from the
// same exported lists. Public visibility is not offered: publishing an
// instruction beyond the workspace goes through review, and a form that let a
// customer pick "public" would describe a step this page does not take.

const {
  MAX_TEMPLATE_LENGTH,
  MAX_VALUE_LENGTH,
  PROMPT_TYPES,
  extractVariables
} = require("./sonara-prompt-library.cjs");

const PAGE_VISIBILITIES = Object.freeze(["private", "organization"]);

const PROBLEMS = Object.freeze({
  name_required: "A collection needs a name.",
  invalid_id: "Choose an instruction and a collection that belong to this workspace.",
  template_required: "Choose one of your saved instructions.",
  protected_data_detected: "Those values look like a password, a key or a card number, so nothing was saved. Use the instruction without them.",
  missing_variables: "Fill in every value the instruction asks for.",
  setup_required: "Your workspace is not connected yet, so nothing was saved.",
  database_unavailable: "That could not be saved just now. Nothing was recorded.",
  database_rpc_unavailable: "That version could not be saved just now. The instruction is unchanged.",
  not_found: "That is not in this workspace.",
  forbidden: "That belongs to somebody else's private library.",
  workspace_mismatch: "That belongs to a different studio's library.",
  validation_failed: "That was not saved. Check the fields and try again."
});

const DONE = Object.freeze({
  template: "Instruction saved.",
  version: "New version saved.",
  collection: "Collection made.",
  collection_item: "Added to the collection.",
  connection: "Connected."
});

const words = (value) => String(value || "").replaceAll("_", " ");

function notice(query = {}, escape) {
  const problem = PROBLEMS[String(query.problem || "")];
  const done = DONE[String(query.done || "")];
  if (problem) return `<article class="card" role="alert"><h2>Not saved</h2><p>${escape(problem)}</p></article>`;
  if (query.problem) return `<article class="card" role="alert"><h2>Not saved</h2><p>That could not be saved. Nothing was recorded.</p></article>`;
  if (done) return `<article class="card" role="status"><h2>Saved</h2><p>${escape(done)}</p></article>`;
  return "";
}

function options(values, selected = "") {
  return values.map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${words(value)}</option>`).join("");
}

const hidden = (name, value, escape) => `<input type="hidden" name="${name}" value="${escape(value)}">`;

// Three states: could not read, nothing yet, and the list.
function listOrSay(result, empty, render) {
  if (!result || result.ok === false) return "<p>We could not read these just now. This is not the same as having none.</p>";
  if (!result.rows.length) return `<p>${empty}</p>`;
  return render(result.rows);
}

function savedInstructionsCard(result, { productArea, back, base, escape }) {
  const list = listOrSay(result, "Nothing saved yet.", (rows) => `<table><thead><tr><th>Instruction</th><th>Type</th><th>Who can see it</th><th>Version</th></tr></thead><tbody>${rows.map((row) => `<tr><td><a href="${escape(`${base}/${row.id}`)}">${escape(row.title || "Untitled")}</a></td><td>${escape(words(row.prompt_type))}</td><td>${escape(row.visibility === "organization" ? "Your workspace" : "Only you")}</td><td>${escape(String(row.current_version ?? 1))}</td></tr>`).join("")}</tbody></table>`);
  return `<article class="card"><h2>Your saved instructions</h2>${list}<form method="post" action="/api/prompt-library/templates">${hidden("product_area", productArea, escape)}${hidden("back", back, escape)}<label>Title<input name="title" required maxlength="160"></label><label>What it is for<textarea name="description" maxlength="1000"></textarea></label><label>The instruction<textarea name="content" required maxlength="${MAX_TEMPLATE_LENGTH}" rows="8"></textarea></label><p class="fine">Write {{name}} wherever a value should be filled in each time, for example {{customer_name}}.</p><label>Type<select name="prompt_type">${options(PROMPT_TYPES, "text")}</select></label><label>Who can see it<select name="visibility">${PAGE_VISIBILITIES.map((value) => `<option value="${value}">${value === "organization" ? "Everyone in your workspace" : "Only you"}</option>`).join("")}</select></label><label>Tags, separated by commas<input name="tags" maxlength="400"></label><button class="action" type="submit">Save instruction</button></form></article>`;
}

function collectionsCard(result, { productArea, back, escape }) {
  const list = listOrSay(result, "No collections yet.", (rows) => `<table><thead><tr><th>Collection</th><th>About</th><th>Who can see it</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escape(row.name || "Untitled collection")}</td><td>${escape(row.description || "")}</td><td>${escape(row.visibility === "organization" ? "Your workspace" : "Only you")}</td></tr>`).join("")}</tbody></table>`);
  return `<article class="card"><h2>Your collections</h2>${list}<form method="post" action="/api/prompt-library/collections">${hidden("product_area", productArea, escape)}${hidden("back", back, escape)}<label>Name<input name="name" required maxlength="160"></label><label>About<textarea name="description" maxlength="1000"></textarea></label><label>Who can see it<select name="visibility">${PAGE_VISIBILITIES.map((value) => `<option value="${value}">${value === "organization" ? "Everyone in your workspace" : "Only you"}</option>`).join("")}</select></label><button type="submit">Make collection</button></form></article>`;
}

function instructionCard(row, escape) {
  return `<article class="card"><h2>${escape(row.title || "Untitled")}</h2><p>${escape(row.description || "")}</p><p class="fine">${escape(words(row.prompt_type))} · version ${escape(String(row.current_version ?? 1))} · ${escape(row.visibility === "organization" ? "everyone in your workspace can see it" : "only you can see it")}</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(row.content || "")}</pre></article>`;
}

// One field per {{variable}}, named value_<variable>. Variable names are
// letters, digits and underscores (extractVariables), so the field name is
// always a safe attribute value.
function runForm(row, { productArea, back, escape }) {
  const variables = extractVariables(row.content);
  const fields = variables.map((name) => `<label>${escape(words(name))}<textarea name="value_${name}" maxlength="${MAX_VALUE_LENGTH}" rows="2"></textarea></label>`).join("");
  return `<article class="card"><h2>Fill it in</h2><p class="fine">Prepares the instruction with your values and keeps a record that it was used. No AI provider is called.</p><form method="post" action="/api/prompt-library/runs">${hidden("product_area", productArea, escape)}${hidden("template_id", row.id, escape)}${hidden("back", back, escape)}${fields || "<p>This instruction has no values to fill in.</p>"}<button class="action" type="submit">Prepare</button></form></article>`;
}

function versionForm(row, { productArea, back, escape }) {
  return `<article class="card"><h2>Save a new version</h2><form method="post" action="/api/prompt-library/templates/${escape(row.id)}/versions">${hidden("product_area", productArea, escape)}${hidden("back", back, escape)}<label>Title<input name="title" required maxlength="160" value="${escape(row.title || "")}"></label><label>The instruction<textarea name="content" required maxlength="${MAX_TEMPLATE_LENGTH}" rows="8">${escape(row.content || "")}</textarea></label><label>What changed<input name="change_note" maxlength="500"></label><button type="submit">Save version</button></form></article>`;
}

function addToCollectionForm(row, collections, { back, base, escape }) {
  if (!collections || collections.ok === false) return `<article class="card"><h2>Add to a collection</h2><p>We could not read your collections just now.</p></article>`;
  if (!collections.rows.length) return `<article class="card"><h2>Add to a collection</h2><p>You have no collections yet. Make one on the <a href="${escape(base)}">prompt library page</a>.</p></article>`;
  return `<article class="card"><h2>Add to a collection</h2><form method="post" action="${escape(`${base}/${row.id}/collections`)}">${hidden("back", back, escape)}<label>Collection<select name="collection_id" required>${collections.rows.map((collection) => `<option value="${escape(collection.id)}">${escape(collection.name || "Untitled collection")}</option>`).join("")}</select></label><button type="submit">Add</button></form></article>`;
}

function connectForm(row, others, { productArea, back, escape }) {
  const choices = others && others.ok !== false ? others.rows.filter((other) => other.id !== row.id) : [];
  if (!choices.length) return "";
  return `<article class="card"><h2>What comes next</h2><p class="fine">Connect this instruction to the one you use after it, so the order is recorded.</p><form method="post" action="/api/prompt-library/connections">${hidden("product_area", productArea, escape)}${hidden("source_id", row.id, escape)}${hidden("back", back, escape)}<label>Then use<select name="target_id" required>${choices.map((other) => `<option value="${escape(other.id)}">${escape(other.title || "Untitled")}</option>`).join("")}</select></label><label>Why that order<input name="label" maxlength="120"></label><button type="submit">Connect</button></form></article>`;
}

function runsCard(result, escape) {
  const list = listOrSay(result, "Not used yet.", (rows) => `<table><thead><tr><th>When</th><th>Version</th><th>Fingerprint</th></tr></thead><tbody>${rows.map((run) => `<tr><td>${escape(String(run.created_at || "").slice(0, 16).replace("T", " "))}</td><td>${escape(String(run.template_version ?? ""))}</td><td>${escape(String(run.prompt_fingerprint || "").slice(0, 12))}</td></tr>`).join("")}</tbody></table>`);
  return `<article class="card"><h2>Recent uses</h2>${list}</article>`;
}

// The prepared instruction, after a run was recorded. Shown as text: the
// values were typed by a person and are not trusted as markup.
function preparedCard(run, escape) {
  return `<article class="card"><h2>Ready to use</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(run.rendered_prompt || "")}</pre><p class="fine">Recorded as a prepared use, fingerprint ${escape(String(run.prompt_fingerprint || "").slice(0, 12))}. No AI provider was called.</p></article>`;
}

// The reasons a save was refused, from validatePromptRecord and the safety
// review. Rendered directly rather than carried in an address, so they are this
// server's sentences and not whatever a link supplies.
function refusalCard(errors, escape) {
  const list = (Array.isArray(errors) ? errors : []).slice(0, 12).map((error) => `<li>${escape(String(error))}</li>`).join("");
  return `<article class="card" role="alert"><h2>Not saved</h2>${list ? `<ul>${list}</ul>` : "<p>That was not saved. Check the fields and try again.</p>"}</article>`;
}

module.exports = {
  PAGE_VISIBILITIES,
  PROBLEMS,
  DONE,
  notice,
  savedInstructionsCard,
  collectionsCard,
  instructionCard,
  runForm,
  versionForm,
  addToCollectionForm,
  connectForm,
  runsCard,
  preparedCard,
  refusalCard
};
