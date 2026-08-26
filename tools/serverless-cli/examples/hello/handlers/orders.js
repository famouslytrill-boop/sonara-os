"use strict";

// Four handlers over one table.
//
// They keep their orders in memory so the example runs with no AWS account and
// no network. A real handler would talk to DynamoDB; what this example is
// showing is the shape -- the event, the reply, and the fact that the table name
// arrives through the environment rather than being written in the code.

const ORDERS = new Map([
  ["abc-123", { id: "abc-123", item: "a desk", createdAt: "2026-08-01T09:00:00.000Z" }]
]);

const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body, null, 2)
});

exports.list = async () => json(200, {
  orders: [...ORDERS.values()],
  count: ORDERS.size,
  stage: process.env.STAGE
});

exports.getOne = async (event) => {
  // `pathParameters` is absent rather than empty when a route has no
  // parameters, so it is read defensively even here, where the route always
  // has one.
  const id = event.pathParameters?.id;
  const order = id ? ORDERS.get(id) : null;
  // A missing order is a 404 with a reason, not an empty 200. An empty 200 is
  // indistinguishable from an order with no fields.
  return order ? json(200, order) : json(404, { message: `There is no order ${id}.` });
};

exports.create = async (event) => {
  let submitted;
  try {
    submitted = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { message: "That body is not JSON." });
  }

  const item = String(submitted.item || "").trim();
  if (!item) return json(400, { message: "An order needs an item.", expected: { item: "a desk" } });

  const order = { id: `ord-${Date.now()}`, item, createdAt: new Date().toISOString() };
  ORDERS.set(order.id, order);
  return json(201, order);
};

exports.expire = async () => {
  // Invoked on a schedule rather than by a request, so there is no HTTP reply
  // to make. What is returned goes into the logs.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [id, order] of ORDERS) {
    if (new Date(order.createdAt).getTime() < cutoff) { ORDERS.delete(id); removed += 1; }
  }
  return { removed, remaining: ORDERS.size };
};
