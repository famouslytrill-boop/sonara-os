"use strict";

// DynamoDB.
//
// JSON in, JSON out, with the operation in `X-Amz-Target`. The awkward part is
// not the protocol -- it is that DynamoDB's values are typed maps,
// `{"S":"a"}` rather than `"a"`, and every comparison has to be done on the
// typed form.
//
// ## Keys are compared by their typed value, not by JSON text
//
// `{"N":"1"}` and `{"N":"1.0"}` are the same key to DynamoDB and different
// strings to JSON. An emulator keying its map on the JSON text lets somebody
// write an item and then fail to read it back with a key their code considers
// identical -- and the code is right, the emulator is wrong. So a key becomes a
// canonical string through `keyOf`, with numbers normalised.
//
// ## What is implemented, and what is refused by name
//
// Put, Get, Delete, Update (SET and REMOVE), Query, Scan, the batch pair, and
// the table operations. Anything else answers with a real DynamoDB error naming
// the operation, rather than a 200 with an empty body -- which is the failure
// that makes an emulator worse than nothing, because the caller carries on with
// a result that looks like "no items".

const { DEFAULT_ACCOUNT } = require("../store.js");

const NAME = "dynamodb";

function tables(store, region) {
  return store.scope(region, NAME, "tables");
}

function fail(code, message, status = 400) {
  return {
    status,
    headers: { "content-type": "application/x-amz-json-1.0" },
    body: JSON.stringify({ __type: `com.amazonaws.dynamodb.v20120810#${code}`, message })
  };
}

function ok(payload) {
  return {
    status: 200,
    headers: { "content-type": "application/x-amz-json-1.0" },
    body: JSON.stringify(payload || {})
  };
}

// One attribute value to a comparable string. Numbers go through Number() so
// "1" and "1.0" land on the same key; binary compares by its base64, which is
// what came over the wire.
function scalarOf(value) {
  if (!value || typeof value !== "object") return String(value);
  if ("S" in value) return `S:${value.S}`;
  if ("N" in value) return `N:${Number(value.N)}`;
  if ("B" in value) return `B:${value.B}`;
  if ("BOOL" in value) return `BOOL:${Boolean(value.BOOL)}`;
  return `?:${JSON.stringify(value)}`;
}

function keyOf(schema, item) {
  return schema.map((part) => scalarOf(item[part.AttributeName])).join(" ");
}

function tableArn(region, account, name) {
  return `arn:aws:dynamodb:${region}:${account}:table/${name}`;
}

function describe(table) {
  return {
    TableName: table.name,
    TableStatus: "ACTIVE",
    CreationDateTime: table.created,
    ItemCount: table.items.size,
    TableSizeBytes: table.bytes,
    KeySchema: table.keySchema,
    AttributeDefinitions: table.attributes,
    BillingModeSummary: { BillingMode: table.billingMode },
    TableArn: table.arn,
    ProvisionedThroughput: { ReadCapacityUnits: 0, WriteCapacityUnits: 0, NumberOfDecreasesToday: 0 }
  };
}

function handle(request, { store }) {
  const region = request.region;
  const all = tables(store, region);
  const action = request.action;

  let input = {};
  try {
    input = request.body && request.body.length ? JSON.parse(request.body.toString("utf8")) : {};
  } catch {
    return fail("SerializationException", "The request body is not JSON.");
  }

  const named = () => all.get(String(input.TableName || ""));
  const noSuchTable = () =>
    fail("ResourceNotFoundException", `Requested resource not found: Table: ${input.TableName} not found`);

  switch (action) {
    case "CreateTable": {
      const name = String(input.TableName || "");
      if (!name) return fail("ValidationException", "TableName is required.");
      if (all.has(name)) return fail("ResourceInUseException", `Table already exists: ${name}`);
      const keySchema = Array.isArray(input.KeySchema) ? input.KeySchema : [];
      if (!keySchema.length) return fail("ValidationException", "KeySchema is required and must name at least a HASH key.");
      all.set(name, {
        name,
        created: Date.now() / 1000,
        keySchema,
        attributes: input.AttributeDefinitions || [],
        billingMode: input.BillingMode || "PROVISIONED",
        arn: tableArn(region, store.account || DEFAULT_ACCOUNT, name),
        items: new Map(),
        bytes: 0
      });
      store.save();
      return ok({ TableDescription: describe(all.get(name)) });
    }

    case "DescribeTable": {
      const table = named();
      if (!table) return noSuchTable();
      return ok({ Table: describe(table) });
    }

    case "ListTables":
      return ok({ TableNames: [...all.keys()].sort() });

    case "DeleteTable": {
      const table = named();
      if (!table) return noSuchTable();
      all.delete(table.name);
      store.save();
      return ok({ TableDescription: { ...describe(table), TableStatus: "DELETING" } });
    }

    case "PutItem": {
      const table = named();
      if (!table) return noSuchTable();
      const item = input.Item || {};
      for (const part of table.keySchema) {
        if (!item[part.AttributeName]) {
          return fail("ValidationException", `One of the required keys was not given a value: ${part.AttributeName}`);
        }
      }
      const key = keyOf(table.keySchema, item);
      const previous = table.items.get(key);
      table.items.set(key, item);
      table.bytes += JSON.stringify(item).length;
      store.save();
      // ALL_OLD returns what was there; anything else returns nothing, which is
      // what the SDK expects rather than an empty Attributes object.
      return ok(input.ReturnValues === "ALL_OLD" && previous ? { Attributes: previous } : {});
    }

    case "GetItem": {
      const table = named();
      if (!table) return noSuchTable();
      const item = table.items.get(keyOf(table.keySchema, input.Key || {}));
      // An absent item is `{}` with no `Item`, never `{Item: null}`. SDKs check
      // for the key's presence, and a null reads as "found, and it is empty".
      return ok(item ? { Item: item } : {});
    }

    case "DeleteItem": {
      const table = named();
      if (!table) return noSuchTable();
      const key = keyOf(table.keySchema, input.Key || {});
      const previous = table.items.get(key);
      table.items.delete(key);
      store.save();
      return ok(input.ReturnValues === "ALL_OLD" && previous ? { Attributes: previous } : {});
    }

    case "Scan": {
      const table = named();
      if (!table) return noSuchTable();
      const items = [...table.items.values()];
      const limit = Number(input.Limit) > 0 ? Number(input.Limit) : items.length;
      const page = items.slice(0, limit);
      return ok({ Items: page, Count: page.length, ScannedCount: items.length });
    }

    case "Query": {
      const table = named();
      if (!table) return noSuchTable();
      const hash = table.keySchema.find((part) => part.KeyType === "HASH");
      const expression = String(input.KeyConditionExpression || "");
      const values = input.ExpressionAttributeValues || {};
      const names = input.ExpressionAttributeNames || {};
      // The equality form on the partition key, which is what nearly every
      // Query is. Anything more is refused by name rather than answered with
      // every item in the table, which would look like a working query.
      const match = expression.match(/^\s*(#?[A-Za-z0-9_]+)\s*=\s*(:[A-Za-z0-9_]+)\s*$/);
      if (!match) {
        return fail("ValidationException",
          `This emulator answers Query only for "partitionKey = :value", and was given: ${expression || "(nothing)"}. `
          + "It refuses rather than returning every item, which would look like a working query.");
      }
      const attribute = match[1].startsWith("#") ? names[match[1]] : match[1];
      if (!hash || attribute !== hash.AttributeName) {
        return fail("ValidationException", `Query condition missed key schema element: ${hash ? hash.AttributeName : "(none)"}`);
      }
      const wanted = scalarOf(values[match[2]]);
      const items = [...table.items.values()].filter((item) => scalarOf(item[attribute]) === wanted);
      return ok({ Items: items, Count: items.length, ScannedCount: items.length });
    }

    case "UpdateItem": {
      const table = named();
      if (!table) return noSuchTable();
      const key = keyOf(table.keySchema, input.Key || {});
      const item = { ...(table.items.get(key) || input.Key || {}) };
      const expression = String(input.UpdateExpression || "");
      const values = input.ExpressionAttributeValues || {};
      const names = input.ExpressionAttributeNames || {};

      // SET and REMOVE, and it says so when given anything else. ADD and DELETE
      // have set semantics that are easy to get subtly wrong, and a subtly
      // wrong counter is exactly the bug that survives into production.
      const unsupported = expression.match(/\b(ADD|DELETE)\b/i);
      if (unsupported) {
        return fail("ValidationException",
          `This emulator supports SET and REMOVE in an UpdateExpression, not ${unsupported[1].toUpperCase()}.`);
      }
      const setPart = expression.match(/\bSET\b([\s\S]*?)(?=\bREMOVE\b|$)/i);
      if (setPart) {
        for (const clause of setPart[1].split(",")) {
          const assign = clause.match(/\s*(#?[A-Za-z0-9_.]+)\s*=\s*(:[A-Za-z0-9_]+)\s*/);
          if (!assign) continue;
          const attribute = assign[1].startsWith("#") ? names[assign[1]] : assign[1];
          if (attribute) item[attribute] = values[assign[2]];
        }
      }
      const removePart = expression.match(/\bREMOVE\b([\s\S]*?)(?=\bSET\b|$)/i);
      if (removePart) {
        for (const clause of removePart[1].split(",")) {
          const trimmed = clause.trim();
          if (!trimmed) continue;
          const attribute = trimmed.startsWith("#") ? names[trimmed] : trimmed;
          if (attribute) delete item[attribute];
        }
      }
      table.items.set(key, item);
      store.save();
      return ok(input.ReturnValues && input.ReturnValues !== "NONE" ? { Attributes: item } : {});
    }

    case "BatchWriteItem": {
      const requested = input.RequestItems || {};
      for (const [tableName, operations] of Object.entries(requested)) {
        const table = all.get(tableName);
        if (!table) return fail("ResourceNotFoundException", `Requested resource not found: Table: ${tableName} not found`);
        for (const operation of operations || []) {
          if (operation.PutRequest && operation.PutRequest.Item) {
            table.items.set(keyOf(table.keySchema, operation.PutRequest.Item), operation.PutRequest.Item);
          } else if (operation.DeleteRequest && operation.DeleteRequest.Key) {
            table.items.delete(keyOf(table.keySchema, operation.DeleteRequest.Key));
          }
        }
      }
      store.save();
      // Nothing is throttled here, so nothing is ever unprocessed.
      return ok({ UnprocessedItems: {} });
    }

    case "BatchGetItem": {
      const requested = input.RequestItems || {};
      const responses = {};
      for (const [tableName, spec] of Object.entries(requested)) {
        const table = all.get(tableName);
        if (!table) return fail("ResourceNotFoundException", `Requested resource not found: Table: ${tableName} not found`);
        responses[tableName] = (spec.Keys || [])
          .map((key) => table.items.get(keyOf(table.keySchema, key)))
          .filter(Boolean);
      }
      return ok({ Responses: responses, UnprocessedKeys: {} });
    }

    case "TagResource":
    case "UntagResource":
    case "UpdateTimeToLive":
      // Accepted and ignored, which is all they would do to this state anyway.
      // Named explicitly so they do not fall into the refusal below: a deploy
      // script that tags a table should not stop.
      return ok({});

    default:
      // Named, not swallowed. A 200 with an empty body here is the failure that
      // makes an emulator worse than none: the caller carries on with something
      // that looks like a valid empty result.
      return fail("UnknownOperationException",
        `This emulator does not implement DynamoDB's ${action}. It refuses rather than answering with an empty result, `
        + "which would look like success.");
  }
}

module.exports = { NAME, handle, keyOf, scalarOf, describe };
