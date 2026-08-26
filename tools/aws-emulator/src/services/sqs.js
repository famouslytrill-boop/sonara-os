"use strict";

// SQS.
//
// A form-encoded Query protocol with the action in the body, answering XML.
// Newer SDKs can also speak JSON to SQS, so both are accepted -- an emulator
// that only understood one would work from the CLI and fail from the SDK, or
// the other way round, and either is a bad afternoon.
//
// ## Visibility timeout is real, and that is the whole point
//
// A queue emulator that hands the same message to two consumers is not
// emulating a queue. `ReceiveMessage` hides what it returns until the timeout
// passes or the message is deleted, so a worker written against this behaves
// the way it will against AWS: it must delete, and if it crashes the message
// comes back.
//
// The timeout is checked lazily, when the queue is next read, rather than by a
// timer. A timer per in-flight message is a lot of timers, and there is nothing
// to observe the expiry between reads anyway.

const { xml, queryResponse, queryErrorXml } = require("../xml.js");
const { DEFAULT_ACCOUNT } = require("../store.js");
const crypto = require("node:crypto");

const NAME = "sqs";
const NAMESPACE = "http://queue.amazonaws.com/doc/2012-11-05/";

function queues(store, region) {
  return store.scope(region, NAME, "queues");
}

function form(body) {
  const params = new URLSearchParams(String(body || ""));
  const out = {};
  for (const [key, value] of params) out[key] = value;
  return out;
}

// The request may be form-encoded or JSON. Both are read into one shape so the
// rest of this file does not care which arrived.
function inputOf(request) {
  const text = request.body ? request.body.toString("utf8") : "";
  const contentType = String(request.headers["content-type"] || "");
  if (contentType.includes("json") || (text.trim().startsWith("{") && text.includes(":"))) {
    try {
      const parsed = JSON.parse(text);
      return { values: parsed, json: true };
    } catch {
      return { values: {}, json: true };
    }
  }
  return { values: form(text), json: false };
}

function queueUrl(request, name) {
  const host = request.headers.host || "localhost:4566";
  const scheme = String(host).startsWith("localhost") || String(host).startsWith("127.") ? "http" : "https";
  return `${scheme}://${host}/${DEFAULT_ACCOUNT}/${name}`;
}

function nameFromUrl(value) {
  const text = String(value || "");
  if (!text) return "";
  const trimmed = text.split("?")[0].replace(/\/+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1);
}

function fail(code, message, json) {
  if (json) {
    return {
      status: 400,
      headers: { "content-type": "application/x-amz-json-1.0" },
      body: JSON.stringify({ __type: `com.amazonaws.sqs#${code}`, message })
    };
  }
  return { status: 400, headers: { "content-type": "application/xml" }, body: queryErrorXml(code, message) };
}

function answer(action, innerXml, jsonPayload, json) {
  if (json) {
    return { status: 200, headers: { "content-type": "application/x-amz-json-1.0" }, body: JSON.stringify(jsonPayload || {}) };
  }
  return {
    status: 200,
    headers: { "content-type": "application/xml" },
    body: queryResponse(action, innerXml, { namespace: NAMESPACE })
  };
}

function bodyMd5(text) {
  return crypto.createHash("md5").update(String(text), "utf8").digest("hex");
}

// Messages whose visibility has lapsed come back. Done on read rather than on a
// timer: a timer per in-flight message is a great many timers, and nothing can
// observe the expiry between reads anyway.
function release(queue, now) {
  for (const message of queue.messages) {
    if (message.hiddenUntil && message.hiddenUntil <= now) {
      message.hiddenUntil = 0;
      message.receiptHandle = null;
    }
  }
}

function handle(request, { store }) {
  const region = request.region;
  const all = queues(store, region);
  const { values, json } = inputOf(request);
  // The JSON protocol puts the action in X-Amz-Target; the form protocol puts
  // it in the body, which `protocol.js` has already read.
  const action = request.action;
  const now = Date.now();

  const named = () => {
    const name = values.QueueName || nameFromUrl(values.QueueUrl);
    return { name, queue: all.get(name) };
  };

  switch (action) {
    case "CreateQueue": {
      const name = String(values.QueueName || "");
      if (!name) return fail("InvalidParameterValue", "QueueName is required.", json);
      if (!all.has(name)) {
        all.set(name, {
          name,
          created: now,
          messages: [],
          // The AWS default, so a queue made here behaves like a queue made
          // there when nobody sets it.
          visibilityTimeout: Number(values["Attribute.1.Value"] || values.VisibilityTimeout || 30),
          arn: `arn:aws:sqs:${region}:${DEFAULT_ACCOUNT}:${name}`
        });
        store.save();
      }
      const url = queueUrl(request, name);
      return answer("CreateQueue", `<QueueUrl>${xml(url)}</QueueUrl>`, { QueueUrl: url }, json);
    }

    case "GetQueueUrl": {
      const { name, queue } = named();
      if (!queue) {
        return fail("AWS.SimpleQueueService.NonExistentQueue", `The specified queue does not exist: ${name}`, json);
      }
      const url = queueUrl(request, name);
      return answer("GetQueueUrl", `<QueueUrl>${xml(url)}</QueueUrl>`, { QueueUrl: url }, json);
    }

    case "ListQueues": {
      const names = [...all.keys()].sort();
      const urls = names.map((name) => queueUrl(request, name));
      return answer(
        "ListQueues",
        urls.map((url) => `<QueueUrl>${xml(url)}</QueueUrl>`).join(""),
        { QueueUrls: urls },
        json
      );
    }

    case "DeleteQueue": {
      const { name, queue } = named();
      if (!queue) return fail("AWS.SimpleQueueService.NonExistentQueue", `The specified queue does not exist: ${name}`, json);
      all.delete(name);
      store.save();
      return answer("DeleteQueue", "", {}, json);
    }

    case "SendMessage": {
      const { name, queue } = named();
      if (!queue) return fail("AWS.SimpleQueueService.NonExistentQueue", `The specified queue does not exist: ${name}`, json);
      const body = String(values.MessageBody === undefined ? "" : values.MessageBody);
      const id = crypto.randomUUID();
      queue.messages.push({
        messageId: id,
        body,
        md5: bodyMd5(body),
        sent: now,
        receiveCount: 0,
        hiddenUntil: 0,
        receiptHandle: null
      });
      store.save();
      return answer(
        "SendMessage",
        `<MessageId>${xml(id)}</MessageId><MD5OfMessageBody>${bodyMd5(body)}</MD5OfMessageBody>`,
        { MessageId: id, MD5OfMessageBody: bodyMd5(body) },
        json
      );
    }

    case "ReceiveMessage": {
      const { name, queue } = named();
      if (!queue) return fail("AWS.SimpleQueueService.NonExistentQueue", `The specified queue does not exist: ${name}`, json);
      release(queue, now);

      const max = Math.min(10, Math.max(1, Number(values.MaxNumberOfMessages) || 1));
      const timeout = Number(values.VisibilityTimeout) > 0 ? Number(values.VisibilityTimeout) : queue.visibilityTimeout;
      const taken = queue.messages.filter((message) => !message.hiddenUntil).slice(0, max);

      for (const message of taken) {
        message.receiveCount += 1;
        message.hiddenUntil = now + timeout * 1000;
        message.receiptHandle = crypto.randomUUID();
      }
      store.save();

      const asXml = taken.map((message) => `<Message>`
        + `<MessageId>${xml(message.messageId)}</MessageId>`
        + `<ReceiptHandle>${xml(message.receiptHandle)}</ReceiptHandle>`
        + `<MD5OfBody>${message.md5}</MD5OfBody>`
        + `<Body>${xml(message.body)}</Body>`
        + `<Attribute><Name>ApproximateReceiveCount</Name><Value>${message.receiveCount}</Value></Attribute>`
        + `</Message>`).join("");

      return answer("ReceiveMessage", asXml, {
        Messages: taken.map((message) => ({
          MessageId: message.messageId,
          ReceiptHandle: message.receiptHandle,
          MD5OfBody: message.md5,
          Body: message.body,
          Attributes: { ApproximateReceiveCount: String(message.receiveCount) }
        }))
      }, json);
    }

    case "DeleteMessage": {
      const { name, queue } = named();
      if (!queue) return fail("AWS.SimpleQueueService.NonExistentQueue", `The specified queue does not exist: ${name}`, json);
      const handle_ = String(values.ReceiptHandle || "");
      const before = queue.messages.length;
      queue.messages = queue.messages.filter((message) => message.receiptHandle !== handle_);
      store.save();
      if (before === queue.messages.length) {
        // A handle that matches nothing. Real SQS accepts this silently, and so
        // does this -- a worker retrying a delete after a reconnect is normal,
        // and failing it would make correct code look broken.
        return answer("DeleteMessage", "", {}, json);
      }
      return answer("DeleteMessage", "", {}, json);
    }

    case "ChangeMessageVisibility": {
      const { name, queue } = named();
      if (!queue) return fail("AWS.SimpleQueueService.NonExistentQueue", `The specified queue does not exist: ${name}`, json);
      const handle_ = String(values.ReceiptHandle || "");
      const seconds = Number(values.VisibilityTimeout) || 0;
      for (const message of queue.messages) {
        if (message.receiptHandle === handle_) message.hiddenUntil = seconds === 0 ? 0 : now + seconds * 1000;
      }
      store.save();
      return answer("ChangeMessageVisibility", "", {}, json);
    }

    case "PurgeQueue": {
      const { name, queue } = named();
      if (!queue) return fail("AWS.SimpleQueueService.NonExistentQueue", `The specified queue does not exist: ${name}`, json);
      queue.messages = [];
      store.save();
      return answer("PurgeQueue", "", {}, json);
    }

    case "GetQueueAttributes": {
      const { name, queue } = named();
      if (!queue) return fail("AWS.SimpleQueueService.NonExistentQueue", `The specified queue does not exist: ${name}`, json);
      release(queue, now);
      const visible = queue.messages.filter((message) => !message.hiddenUntil).length;
      const attributes = {
        QueueArn: queue.arn,
        ApproximateNumberOfMessages: String(visible),
        ApproximateNumberOfMessagesNotVisible: String(queue.messages.length - visible),
        VisibilityTimeout: String(queue.visibilityTimeout),
        CreatedTimestamp: String(Math.floor(queue.created / 1000))
      };
      const asXml = Object.entries(attributes)
        .map(([key, value]) => `<Attribute><Name>${xml(key)}</Name><Value>${xml(value)}</Value></Attribute>`).join("");
      return answer("GetQueueAttributes", asXml, { Attributes: attributes }, json);
    }

    case "SetQueueAttributes": {
      const { name, queue } = named();
      if (!queue) return fail("AWS.SimpleQueueService.NonExistentQueue", `The specified queue does not exist: ${name}`, json);
      const timeout = Number(values["Attribute.VisibilityTimeout"] || values.VisibilityTimeout);
      if (Number.isFinite(timeout) && timeout >= 0) queue.visibilityTimeout = timeout;
      store.save();
      return answer("SetQueueAttributes", "", {}, json);
    }

    default:
      return fail("InvalidAction",
        `This emulator does not implement SQS's ${action}. It refuses rather than answering with an empty result, `
        + "which a consumer would read as an empty queue.", json);
  }
}

module.exports = { NAME, handle, nameFromUrl, bodyMd5, release };
