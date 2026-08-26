"use strict";

// How this talks.
//
// Two rules, and they are most of the file.
//
// **Colour is decoration, never the message.** Anything said in red is also
// said in words, because output gets piped, redirected into a log, and read by
// people who do not see colour. NO_COLOR is honoured, and so is a pipe: a
// terminal that is not a terminal gets plain text.
//
// **An error says what to do next.** A message that only says what went wrong
// leaves somebody to work the rest out, and this tool nearly always knows.
// Every failure carries a hint, and where it does not, that is a gap rather
// than a house style.

const ESC = String.fromCharCode(27);

const useColour = () =>
  process.stdout.isTTY === true
  && !process.env.NO_COLOR
  && process.env.TERM !== "dumb";

const paint = (code) => (text) => (useColour() ? `${ESC}[${code}m${text}${ESC}[0m` : String(text));

const colour = {
  bold: paint("1"),
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  blue: paint("36")
};

const out = (text = "") => process.stdout.write(`${text}\n`);
const err = (text = "") => process.stderr.write(`${text}\n`);

let printedAnything = false;

function heading(text) {
  if (printedAnything) out("");
  out(colour.bold(text));
  printedAnything = true;
}

function line(text = "") {
  out(text);
  printedAnything = true;
}

function success(text) {
  line(`${colour.green("+")} ${text}`);
}

function note(text) {
  line(colour.dim(text));
}

function warn(text) {
  line(`${colour.yellow("!")} ${text}`);
}

/**
 * Report a failure the way this tool always reports failures.
 *
 * The shape is fixed on purpose: what happened, where, and what to do about it.
 * A caller with nothing to put in `hint` should look again, because the tool
 * usually does know.
 */
function failure({ message, where, hint, detail }) {
  err("");
  err(`${colour.red("x")} ${colour.bold(message)}`);
  if (where) err(`  in ${where}`);
  if (detail) {
    err("");
    for (const detailLine of String(detail).split("\n")) err(`  ${detailLine}`);
  }
  if (hint) {
    err("");
    for (const hintLine of String(hint).split("\n")) err(`  ${hintLine}`);
  }
  err("");
}

// A table whose columns line up, for plans and route lists.
function table(rows, { indent = "  " } = {}) {
  if (!rows.length) return;
  const widths = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] || 0, String(cell).length);
    });
  }
  for (const row of rows) {
    const rendered = row
      .map((cell, index) => (index === row.length - 1 ? String(cell) : String(cell).padEnd(widths[index])))
      .join("  ");
    line(`${indent}${rendered.trimEnd()}`);
  }
}

// A spinner that degrades to one printed line when nothing is watching. A
// progress animation written into a CI log is thousands of lines of noise.
function progress(text) {
  if (!useColour()) {
    line(colour.dim(`... ${text}`));
    return { done: (final) => { if (final) success(final); }, fail: (final) => { if (final) warn(final); } };
  }
  const frames = ["|", "/", "-", "\\"];
  let index = 0;
  process.stdout.write(`${frames[0]} ${text}`);
  const timer = setInterval(() => {
    index = (index + 1) % frames.length;
    process.stdout.write(`\r${frames[index]} ${text}`);
  }, 120);
  timer.unref?.();

  const clear = () => {
    clearInterval(timer);
    process.stdout.write(`\r${" ".repeat(text.length + 4)}\r`);
  };
  return {
    done: (final) => { clear(); if (final) success(final); },
    fail: (final) => { clear(); if (final) warn(final); }
  };
}

module.exports = { colour, out, err, line, heading, success, note, warn, failure, table, progress, useColour };
