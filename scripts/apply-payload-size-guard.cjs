"use strict";

const fs = require("node:fs");
const path = require("node:path");

require("./apply-readiness-display-contract.cjs");

const serverPath = path.join(process.cwd(), "server.js");
const STRUCTURED_BODY_LIMIT = "1mb";
const STRUCTURED_BODY_MAX_BYTES = 1024 * 1024;

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from the repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

function replaceRequired(label, oldValue, newValue) {
  if (source.includes(newValue)) return;
  if (!source.includes(oldValue)) {
    console.error(`Payload-size guard patch failed: ${label} source was not found.`);
    process.exit(1);
  }
  source = source.replace(oldValue, newValue);
}

replaceRequired(
  "structured request parser limits",
  `app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "64kb" }));`,
  `app.use(express.urlencoded({ extended: false, limit: "${STRUCTURED_BODY_LIMIT}" }));
app.use(express.json({ limit: "${STRUCTURED_BODY_LIMIT}" }));`
);

const payloadErrorHandler = `app.use((error, req, res, next) => {
  const isPayloadTooLarge = error?.type === "entity.too.large" || error?.status === 413 || error?.statusCode === 413;
  if (!isPayloadTooLarge) return next(error);

  return res.status(413).json({
    ok: false,
    code: "payload_too_large",
    message: "Structured request bodies must be 1 MB or smaller. Upload file bytes directly to approved private storage with a signed upload URL instead of embedding them in JSON.",
    maxBytes: ${STRUCTURED_BODY_MAX_BYTES}
  });
});

`;

replaceRequired(
  "payload-too-large error handler",
  "module.exports = app;",
  `${payloadErrorHandler}module.exports = app;`
);

fs.writeFileSync(serverPath, source);
console.log("SONARA payload-size guard applied.");
