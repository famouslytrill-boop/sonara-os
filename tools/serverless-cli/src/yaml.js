"use strict";

// A YAML parser that refuses what it does not understand.
//
// This tool reads one file, and everything it does afterwards -- what gets
// deployed, what gets deleted, what a plan says will change -- is downstream of
// what that file was understood to mean. So the failure that matters here is not
// "the parser threw". It is **the parser quietly deciding something different
// from what the author wrote** and every later step reporting success against
// that misreading.
//
// YAML is unusually good at this. `on: yes` is a boolean in YAML 1.1 and the
// string "yes" in 1.2. `timeout: 022` is 18 in one reading and 22 in another.
// `version: 1.20` loses its trailing zero. A tab where spaces were meant is a
// parse error in the spec and silently "works" in several hand-written parsers.
// Every one of those is a wrong deployment that reported success.
//
// So this parser implements a documented subset and **refuses everything else by
// name**, with the line number and what to write instead. Refusing is safe: the
// author reads the message and fixes the file. Guessing is not: nobody reads
// anything, and the guess ships.
//
// ## What is supported
//
//   - Block mappings and block sequences, nested by indentation (spaces only).
//   - Scalars: plain, 'single quoted', "double quoted" (with \n \t \" \\ \/ \r
//     and \uXXXX escapes).
//   - Flow collections on one line: [a, b] and {a: 1, b: 2}.
//   - Explicit types: true/false, null (and ~ and empty), integers, floats.
//   - `#` comments, and `---` opening one document.
//   - Multi-line block scalars: `|` (keep newlines) and `>` (fold), with the
//     `-` chomping indicator.
//
// ## What is refused, deliberately
//
//   - Tabs used for indentation.
//   - Anchors, aliases and merge keys (`&a`, `*a`, `<<:`) -- one file that
//     silently shares structure is one file where a change lands twice.
//   - Explicit tags (`!!str`, `!Ref`). CloudFormation's shorthand `!Ref` is a
//     tag, and supporting some tags but not others is how a parser starts
//     lying. `manifest.js` has its own way to reference a resource.
//   - More than one document in a file.
//   - Duplicate keys in the same mapping. YAML says last-wins; a person who
//     wrote a key twice meant something and last-wins is not reliably it.
//   - The YAML 1.1 booleans `yes`/`no`/`on`/`off`. Refused rather than picked,
//     because either choice is wrong for somebody. Write true or false.
//   - Leading-zero integers, which read as octal in YAML 1.1 and decimal in
//     1.2.
//
// Nothing here is a general YAML library and it must not become one. It is the
// smallest thing that reads this tool's own file format without ever guessing.

// Refusals carry a line number so the message can point at the file.
class YamlError extends Error {
  constructor(message, line, hint) {
    super(message);
    this.name = "YamlError";
    this.line = line;
    this.hint = hint || "";
  }
}

const REFUSED_BOOLEANS = new Set(["yes", "no", "on", "off", "y", "n"]);

function fail(message, lineNumber, hint) {
  throw new YamlError(message, lineNumber, hint);
}

// Strip a comment, but only one that starts a token. `name: a#b` is the string
// "a#b" -- treating every `#` as a comment is a classic way to silently
// truncate a value.
function stripComment(text) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === '"' && !inSingle) inDouble = !inDouble;
    else if (char === "#" && !inSingle && !inDouble && (i === 0 || /\s/.test(text[i - 1]))) {
      return text.slice(0, i);
    }
  }
  return text;
}

function parseDoubleQuoted(raw, lineNumber) {
  let out = "";
  for (let i = 1; i < raw.length - 1; i += 1) {
    const char = raw[i];
    if (char !== "\\") { out += char; continue; }
    const next = raw[i + 1];
    i += 1;
    if (next === "n") out += "\n";
    else if (next === "t") out += "\t";
    else if (next === "r") out += "\r";
    else if (next === '"') out += '"';
    else if (next === "\\") out += "\\";
    else if (next === "/") out += "/";
    else if (next === "u") {
      const hex = raw.slice(i + 1, i + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        fail(`\\u must be followed by four hex digits, and this is "${hex}".`, lineNumber);
      }
      out += String.fromCharCode(parseInt(hex, 16));
      i += 4;
    } else {
      fail(`\\${next} is not an escape this reads.`, lineNumber,
        "Supported escapes are \\n \\t \\r \\\" \\\\ \\/ and \\uXXXX.");
    }
  }
  return out;
}

// One scalar, already comment-stripped and trimmed.
function parseScalar(raw, lineNumber) {
  const text = raw.trim();
  if (text === "") return null;

  if (text.startsWith('"')) {
    if (!text.endsWith('"') || text.length < 2) fail("This double-quoted value never closes.", lineNumber);
    return parseDoubleQuoted(text, lineNumber);
  }
  if (text.startsWith("'")) {
    if (!text.endsWith("'") || text.length < 2) fail("This single-quoted value never closes.", lineNumber);
    // In YAML a doubled '' inside single quotes is one literal quote. There are
    // no other escapes, which is the whole point of single quotes.
    return text.slice(1, -1).replace(/''/g, "'");
  }

  if (text.startsWith("&") || text.startsWith("*")) {
    fail(`Anchors and aliases are not read here, and "${text}" is one.`, lineNumber,
      "Write the value out in both places. One file that silently shares structure is one file where a change lands in two places.");
  }
  if (text.startsWith("!")) {
    fail(`Tags are not read here, and "${text.split(/\s/)[0]}" is one.`, lineNumber,
      "That includes CloudFormation shorthand like !Ref and !GetAtt. Use the plain names this file documents instead.");
  }

  if (text.startsWith("[") || text.startsWith("{")) return parseFlow(text, lineNumber);

  if (text === "null" || text === "~" || text === "Null" || text === "NULL") return null;
  if (text === "true" || text === "True" || text === "TRUE") return true;
  if (text === "false" || text === "False" || text === "FALSE") return false;

  if (REFUSED_BOOLEANS.has(text.toLowerCase())) {
    fail(`"${text}" means different things in different YAML versions.`, lineNumber,
      'Write true or false. In YAML 1.1 this is a boolean; in YAML 1.2 it is the string "' + text + '", and guessing which you meant is how the wrong thing gets deployed.');
  }

  if (/^-?0[0-9]+$/.test(text)) {
    fail(`"${text}" has a leading zero, which is octal in YAML 1.1 and decimal in YAML 1.2.`, lineNumber,
      `Write ${String(Number(text.replace(/^(-?)0+/, "$1")) || 0)} if you meant the decimal number, or quote it if you meant the text.`);
  }
  if (/^-?[0-9]+$/.test(text)) return Number(text);
  if (/^-?[0-9]*\.[0-9]+$/.test(text)) return Number(text);

  return text;
}

// [a, b] and {a: 1} on a single line. Nesting is allowed; a newline is not.
function parseFlow(text, lineNumber) {
  let index = 0;

  function skipSpace() { while (index < text.length && /\s/.test(text[index])) index += 1; }

  function readUntil(stops) {
    const start = index;
    let inSingle = false;
    let inDouble = false;
    let depth = 0;
    while (index < text.length) {
      const char = text[index];
      if (char === "'" && !inDouble) inSingle = !inSingle;
      else if (char === '"' && !inSingle) inDouble = !inDouble;
      else if (!inSingle && !inDouble) {
        if (char === "[" || char === "{") depth += 1;
        else if (char === "]" || char === "}") {
          if (depth === 0 && stops.includes(char)) break;
          depth -= 1;
        } else if (depth === 0 && stops.includes(char)) break;
      }
      index += 1;
    }
    return text.slice(start, index);
  }

  function value() {
    skipSpace();
    if (text[index] === "[") {
      index += 1;
      const list = [];
      skipSpace();
      if (text[index] === "]") { index += 1; return list; }
      for (;;) {
        list.push(value());
        skipSpace();
        if (text[index] === ",") { index += 1; continue; }
        if (text[index] === "]") { index += 1; return list; }
        fail("This flow sequence is missing a comma or a closing bracket.", lineNumber);
      }
    }
    if (text[index] === "{") {
      index += 1;
      const map = {};
      skipSpace();
      if (text[index] === "}") { index += 1; return map; }
      for (;;) {
        skipSpace();
        const key = readUntil([":"]).trim();
        if (text[index] !== ":") fail("This flow mapping has a key with no colon after it.", lineNumber);
        index += 1;
        const parsedKey = parseScalar(key, lineNumber);
        if (Object.prototype.hasOwnProperty.call(map, parsedKey)) {
          fail(`"${parsedKey}" is set twice in the same mapping.`, lineNumber,
            "YAML would keep the last one. Delete the one you did not mean rather than relying on that.");
        }
        map[parsedKey] = value();
        skipSpace();
        if (text[index] === ",") { index += 1; continue; }
        if (text[index] === "}") { index += 1; return map; }
        fail("This flow mapping is missing a comma or a closing brace.", lineNumber);
      }
    }
    const raw = readUntil([",", "]", "}"]);
    return parseScalar(raw, lineNumber);
  }

  const result = value();
  skipSpace();
  if (index < text.length) {
    fail(`There is more on this line after the value ended: "${text.slice(index)}".`, lineNumber);
  }
  return result;
}

/**
 * Parse a YAML document into plain JavaScript values.
 *
 * Throws YamlError with a line number for anything outside the documented
 * subset. It never returns a best guess.
 */
function parse(source) {
  if (typeof source !== "string") fail("There is nothing to read here.", 0);

  const rawLines = source.split(/\r\n|\r|\n/);

  // Every line, with its original number kept so a message can point at it.
  const lines = [];
  let seenDocumentStart = false;
  for (let i = 0; i < rawLines.length; i += 1) {
    const number = i + 1;
    const line = rawLines[i];

    if (/^\s*$/.test(line)) continue;
    if (/^\s*#/.test(line)) continue;

    if (line.trim() === "---") {
      // Only legal as the very first thing in the file. A `---` after content
      // has started opens a second document -- and the bug this replaced read
      // straight past it, merging the second document's keys into the first
      // mapping. Two `a:` blocks silently becoming one is precisely the class
      // of misreading this parser exists to refuse.
      if (seenDocumentStart || lines.length > 0) {
        fail("This file has more than one document in it.", number,
          "Everything after a second --- belongs to a document nothing here reads. Split it into two files.");
      }
      seenDocumentStart = true;
      continue;
    }
    if (line.trim() === "...") continue;

    const indentMatch = line.match(/^[ \t]*/)[0];
    if (indentMatch.includes("\t")) {
      fail("This line is indented with a tab.", number,
        "YAML does not allow tabs for indentation, and editors show them as any width you like -- so a file that looks aligned is not. Use spaces.");
    }

    lines.push({ number, indent: indentMatch.length, text: line.slice(indentMatch.length) });
  }

  if (!lines.length) return null;

  let cursor = 0;

  // A block scalar (`|` or `>`) swallows every following line indented past the
  // key. Chomping: `-` strips the trailing newline, the default keeps one.
  function readBlockScalar(style, chomp, parentIndent) {
    const collected = [];
    let blockIndent = null;
    while (cursor < lines.length && lines[cursor].indent > parentIndent) {
      if (blockIndent === null) blockIndent = lines[cursor].indent;
      if (lines[cursor].indent < blockIndent) break;
      collected.push(" ".repeat(lines[cursor].indent - blockIndent) + lines[cursor].text);
      cursor += 1;
    }
    if (!collected.length) return "";
    let out;
    if (style === "|") {
      out = collected.join("\n");
    } else {
      // Folded: a blank line is a paragraph break, otherwise newlines become
      // spaces. Blank lines were dropped above, so folding is a plain join.
      out = collected.join(" ");
    }
    return chomp === "-" ? out : `${out}\n`;
  }

  function parseBlock(parentIndent) {
    const first = lines[cursor];
    if (first.text.startsWith("- ") || first.text === "-") return parseSequence(first.indent);
    return parseMapping(first.indent, parentIndent);
  }

  function parseSequence(indent) {
    const list = [];
    while (cursor < lines.length && lines[cursor].indent === indent) {
      const line = lines[cursor];
      if (!line.text.startsWith("- ") && line.text !== "-") break;

      const rest = line.text === "-" ? "" : line.text.slice(2).trim();
      cursor += 1;

      if (rest === "") {
        // The item's content is on the following, more-indented lines.
        if (cursor < lines.length && lines[cursor].indent > indent) list.push(parseBlock(indent));
        else list.push(null);
        continue;
      }

      // `- name: a` starts a mapping whose first key sits on the dash line.
      const inlineKey = matchKey(rest, line.number);
      if (inlineKey) {
        const item = {};
        readKeyInto(item, inlineKey, line, indent + 2);
        while (cursor < lines.length && lines[cursor].indent > indent) {
          const next = lines[cursor];
          const key = matchKey(next.text, next.number);
          if (!key) break;
          cursor += 1;
          readKeyInto(item, key, next, next.indent);
        }
        list.push(item);
        continue;
      }

      list.push(parseScalar(stripComment(rest), line.number));
    }
    return list;
  }

  // Split "key: value" without being fooled by a colon inside a quoted key or
  // inside the value. Returns null when the line is not a key at all.
  function matchKey(text, lineNumber) {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === "'" && !inDouble) inSingle = !inSingle;
      else if (char === '"' && !inSingle) inDouble = !inDouble;
      else if (char === ":" && !inSingle && !inDouble) {
        const after = text[i + 1];
        // A colon only ends a key when a space or end-of-line follows it, so
        // "https://x" and "12:30" are values rather than keys.
        if (after !== undefined && after !== " ") continue;
        const rawKey = text.slice(0, i).trim();
        if (rawKey === "") return null;
        if (rawKey === "<<") {
          fail("Merge keys are not read here.", lineNumber,
            "`<<:` pulls another mapping's keys in invisibly. Write the keys out.");
        }
        return { key: parseScalar(rawKey, lineNumber), value: text.slice(i + 1).trim(), lineNumber };
      }
    }
    return null;
  }

  function readKeyInto(target, matched, line, indent) {
    const { key } = matched;
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      fail(`"${key}" is set twice in the same block.`, line.number,
        "YAML would silently keep the last one. Delete the one you did not mean.");
    }

    const valueText = stripComment(matched.value).trim();

    const blockScalar = valueText.match(/^([|>])([-+]?)$/);
    if (blockScalar) {
      target[key] = readBlockScalar(blockScalar[1], blockScalar[2], indent);
      return;
    }

    if (valueText === "") {
      // The value is whatever is indented under this key. Nothing indented
      // under it means an explicitly empty value, which is null and not {}.
      if (cursor < lines.length && lines[cursor].indent > indent) target[key] = parseBlock(indent);
      else target[key] = null;
      return;
    }

    target[key] = parseScalar(valueText, line.number);
  }

  function parseMapping(indent, parentIndent) {
    const map = {};
    while (cursor < lines.length && lines[cursor].indent === indent) {
      const line = lines[cursor];
      if (line.text.startsWith("- ")) break;

      const matched = matchKey(line.text, line.number);
      if (!matched) {
        fail(`This line is not a "key: value" pair and not a "- " list item.`, line.number,
          `It reads: ${line.text.trim()}`);
      }
      cursor += 1;
      readKeyInto(map, matched, line, indent);
    }

    if (cursor < lines.length && lines[cursor].indent > indent && lines[cursor].indent !== parentIndent) {
      // Deeper than the block that just closed and belonging to no key. Almost
      // always a typo'd indent, and silently dropping it loses configuration.
      fail("This line is indented further than the block it follows, and belongs to no key.", lines[cursor].number,
        "Line it up with the keys around it.");
    }

    return map;
  }

  const result = parseBlock(-1);

  if (cursor < lines.length) {
    fail("This line is indented less than the block it is in.", lines[cursor].number,
      "Check the indentation of the lines above it.");
  }

  return result;
}

module.exports = { parse, YamlError };
