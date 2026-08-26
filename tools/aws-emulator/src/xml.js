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
function queryErrorXml(code, message, { type = "Sender" } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?><ErrorResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><Error><Type>${xml(type)}</Type><Code>${xml(code)}</Code><Message>${xml(message)}</Message></Error><RequestId>emulator</RequestId></ErrorResponse>`;
}

// A Query protocol success envelope: <XxxResponse><XxxResult>…</XxxResult>.
function queryResponse(action, inner, { namespace = "http://queue.amazonaws.com/doc/2012-11-05/" } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?><${action}Response xmlns="${namespace}">`
    + `<${action}Result>${inner}</${action}Result>`
    + `<ResponseMetadata><RequestId>emulator</RequestId></ResponseMetadata></${action}Response>`;
}

module.exports = { xml, errorXml, queryErrorXml, queryResponse };
