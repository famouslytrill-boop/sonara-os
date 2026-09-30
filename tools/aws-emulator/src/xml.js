"use strict";

// The little XML the query-protocol services need.
//
// Not a serialiser. Three services here answer XML and each has its own shape,
// so a general "object to XML" function would need a schema per service to know
// what to call a list element -- which is the schema, written twice. These are
// the two pieces that are genuinely common: escaping, and the error envelope
// every AWS XML service shares.

// The five XML predefined entities. `&` first, or the escapes get escaped.
function xml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// S3's error shape: a bare <Error> document.
function errorXml(code, message, extra = {}) {
  const fields = Object.entries(extra)
    .map(([name, value]) => `<${name}>${xml(value)}</${name}>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${xml(code)}</Code><Message>${xml(message)}</Message>${fields}<RequestId>emulator</RequestId></Error>`;
}

// The Query protocol's error shape, which is a different document: CloudFormation,
// STS, IAM and EC2 all wrap it in <ErrorResponse>. An SDK parsing for one will
// not find the other, and reports "unknown error" -- which is how an emulator
// with perfectly good error messages becomes useless.
// The namespace defaults to SQS's because that is what this function hardcoded,
// and services/index.js and services/sqs.js both rely on it. What changed is that
// a caller with a different namespace can now say so.
//
// services/identity.js has always passed one -- ten call sites hand `fail()` either
// STS_NAMESPACE or IAM_NAMESPACE -- and `fail()` dropped it, so every IAM and STS
// error this emulator returned carried the SQS namespace while every success
// carried the right one. Its sibling `xmlAnswer()` passes the namespace through to
// queryResponse below, which is what made the asymmetry invisible: the two
// functions look alike and only one of them was honouring its third argument.
function queryErrorXml(code, message, { type = "Sender", namespace = "http://queue.amazonaws.com/doc/2012-11-05/" } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?><ErrorResponse xmlns="${namespace}"><Error><Type>${xml(type)}</Type><Code>${xml(code)}</Code><Message>${xml(message)}</Message></Error><RequestId>emulator</RequestId></ErrorResponse>`;
}

// A Query protocol success envelope: <XxxResponse><XxxResult>…</XxxResult>.
function queryResponse(action, inner, { namespace = "http://queue.amazonaws.com/doc/2012-11-05/" } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?><${action}Response xmlns="${namespace}">`
    + `<${action}Result>${inner}</${action}Result>`
    + `<ResponseMetadata><RequestId>emulator</RequestId></ResponseMetadata></${action}Response>`;
}

module.exports = { xml, errorXml, queryErrorXml, queryResponse };
