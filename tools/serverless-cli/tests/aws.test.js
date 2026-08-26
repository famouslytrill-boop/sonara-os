"use strict";

// The AWS layer, driven through a fake fetch.
//
// The calls themselves have never been made against a live account -- that is
// stated in the README rather than implied away. What is tested here is
// everything this code decides: what it sends, and what it concludes from each
// shape of answer.
//
// The conclusions matter more than the requests. CloudFormation reports "no
// changes" as a **failed** change set, which is its strangest interface: treat
// every failure as empty and a broken template looks up-to-date; treat every
// failure as an error and an unchanged stack looks broken.

const test = require("node:test");
const assert = require("node:assert/strict");

const aws = require("../src/aws.js");
const { AwsError } = aws;

const CREDS = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" };
const BASE = { region: "eu-west-1", credentials: CREDS };

function answering(status, xml, capture) {
  return async (url, options) => {
    if (capture) capture.push({ url, options, body: options?.body });
    return { ok: status >= 200 && status < 300, status, text: async () => xml, json: async () => ({}) };
  };
}

test("signs the request and posts a form-encoded action", async () => {
  const sent = [];
  await aws.callerIdentity({
    ...BASE,
    fetchImpl: answering(200, "<GetCallerIdentityResponse><GetCallerIdentityResult><Account>1111</Account><Arn>arn:aws:iam::1111:user/x</Arn></GetCallerIdentityResult></GetCallerIdentityResponse>", sent)
  });
  assert.equal(sent[0].url, "https://sts.eu-west-1.amazonaws.com/");
  assert.match(sent[0].body, /Action=GetCallerIdentity/);
  assert.match(sent[0].options.headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/);
});

test("reads who the credentials belong to", async () => {
  const identity = await aws.callerIdentity({
    ...BASE,
    fetchImpl: answering(200, "<r><Account>111122223333</Account><Arn>arn:aws:iam::111122223333:role/Deploy</Arn></r>")
  });
  assert.equal(identity.account, "111122223333");
  assert.match(identity.arn, /role\/Deploy/);
});

test("a stack that does not exist is an answer, not a failure", async () => {
  const result = await aws.describeStack({
    ...BASE, stackName: "orders-api",
    fetchImpl: answering(400, "<ErrorResponse><Error><Code>ValidationError</Code><Message>Stack with id orders-api does not exist</Message></Error></ErrorResponse>")
  });
  assert.equal(result.exists, false);
});

test("but an unreachable account is a failure, not an empty stack", async () => {
  await assert.rejects(
    aws.describeStack({
      ...BASE, stackName: "orders-api",
      fetchImpl: answering(403, "<ErrorResponse><Error><Code>AccessDenied</Code><Message>Not authorised</Message></Error></ErrorResponse>")
    }),
    (error) => error instanceof AwsError && error.code === "AccessDenied",
    "an access failure was reported as a stack that does not exist, which would then try to create one"
  );
});

test("reads a stack's outputs", async () => {
  const result = await aws.describeStack({
    ...BASE, stackName: "orders-api",
    fetchImpl: answering(200, `<r><Stacks><member><StackStatus>CREATE_COMPLETE</StackStatus><Outputs><member><OutputKey>ApiUrl</OutputKey><OutputValue>https://abc.execute-api.eu-west-1.amazonaws.com</OutputValue></member></Outputs></member></Stacks></r>`)
  });
  assert.equal(result.exists, true);
  assert.equal(result.status, "CREATE_COMPLETE");
  assert.equal(result.outputs.ApiUrl, "https://abc.execute-api.eu-west-1.amazonaws.com");
});

test("asks for the IAM capability, and only the narrow one", async () => {
  const sent = [];
  await aws.createChangeSet({
    ...BASE, stackName: "orders-api", templateBody: "{}", exists: false, changeSetName: "cs-1",
    fetchImpl: answering(200, "<r><Id>arn:cs</Id></r>", sent)
  });
  assert.match(sent[0].body, /Capabilities\.member\.1=CAPABILITY_IAM/);
  assert.ok(!/CAPABILITY_NAMED_IAM/.test(sent[0].body),
    "the wider named-IAM capability was requested when nothing here names a role");
  assert.match(sent[0].body, /ChangeSetType=CREATE/);
});

test("asks for an UPDATE change set when the stack is already there", async () => {
  const sent = [];
  await aws.createChangeSet({
    ...BASE, stackName: "a", templateBody: "{}", exists: true, changeSetName: "cs",
    fetchImpl: answering(200, "<r><Id>arn:cs</Id></r>", sent)
  });
  assert.match(sent[0].body, /ChangeSetType=UPDATE/);
});

test("reads a change set's changes", async () => {
  const result = await aws.describeChangeSet({
    ...BASE, changeSetId: "arn:cs",
    fetchImpl: answering(200, `<r><Status>CREATE_COMPLETE</Status><Changes>
      <member><ResourceChange><Action>Add</Action><LogicalResourceId>FnCheckout</LogicalResourceId><ResourceType>AWS::Lambda::Function</ResourceType></ResourceChange></member>
      <member><ResourceChange><Action>Modify</Action><LogicalResourceId>TableOrders</LogicalResourceId><ResourceType>AWS::DynamoDB::Table</ResourceType><Replacement>True</Replacement></ResourceChange></member>
    </Changes></r>`)
  });
  assert.equal(result.status, "ready");
  assert.equal(result.changes.length, 2);
  assert.equal(result.changes[0].LogicalResourceId, "FnCheckout");
  assert.equal(result.changes[1].Replacement, "True");
});

test("reads CloudFormation's failed-but-actually-empty change set as empty", async () => {
  const result = await aws.describeChangeSet({
    ...BASE, changeSetId: "arn:cs",
    fetchImpl: answering(200, "<r><Status>FAILED</Status><StatusReason>The submitted information didn't contain changes.</StatusReason></r>")
  });
  assert.equal(result.status, "empty", "an up-to-date stack was reported as a broken change set");
});

test("but a genuinely failed change set still throws", async () => {
  await assert.rejects(
    aws.describeChangeSet({
      ...BASE, changeSetId: "arn:cs",
      fetchImpl: answering(200, "<r><Status>FAILED</Status><StatusReason>Template format error: unknown resource type</StatusReason></r>")
    }),
    /Template format error/,
    "a broken template was reported as a stack with no changes, which reads as everything being fine"
  );
});

test("reports a change set still being worked out as pending, not as empty", async () => {
  const result = await aws.describeChangeSet({
    ...BASE, changeSetId: "arn:cs",
    fetchImpl: answering(200, "<r><Status>CREATE_IN_PROGRESS</Status></r>")
  });
  assert.equal(result.status, "pending",
    "a change set that had not finished was read as having no changes");
});

test("lists what is actually in the stack", async () => {
  const resources = await aws.listStackResources({
    ...BASE, stackName: "orders-api",
    fetchImpl: answering(200, `<r><StackResourceSummaries>
      <member><LogicalResourceId>FnCheckout</LogicalResourceId><PhysicalResourceId>orders-api-FnCheckout-ABC</PhysicalResourceId><ResourceType>AWS::Lambda::Function</ResourceType><ResourceStatus>CREATE_COMPLETE</ResourceStatus></member>
      <member><LogicalResourceId>TableOrders</LogicalResourceId><PhysicalResourceId>orders-api-TableOrders-DEF</PhysicalResourceId><ResourceType>AWS::DynamoDB::Table</ResourceType><ResourceStatus>CREATE_COMPLETE</ResourceStatus></member>
    </StackResourceSummaries></r>`)
  });
  assert.equal(resources.length, 2);
  assert.equal(resources[0].logicalId, "FnCheckout");
  assert.equal(resources[1].physicalId, "orders-api-TableOrders-DEF",
    "the real AWS name was not read, and it is the only thing that helps somebody clean up by hand");
});

test("asks CloudFormation to delete the stack by name", async () => {
  const sent = [];
  await aws.deleteStack({ ...BASE, stackName: "orders-api", fetchImpl: answering(200, "<r/>", sent) });
  assert.match(sent[0].body, /Action=DeleteStack/);
  assert.match(sent[0].body, /StackName=orders-api/);
});

test("uploads a package to the bucket and key it was given", async () => {
  const sent = [];
  await aws.putObject({ ...BASE, bucket: "code-bucket", key: "app/abc.zip", body: Buffer.from("zip"), fetchImpl: answering(200, "", sent) });
  assert.equal(sent[0].url, "https://code-bucket.s3.eu-west-1.amazonaws.com/app/abc.zip");
  assert.equal(sent[0].options.method, "PUT");
  assert.ok(sent[0].options.headers["x-amz-content-sha256"], "S3 requires the payload hash header and it is missing");
});

test("reports a missing object as absent and a broken check as an error", async () => {
  assert.equal(await aws.objectExists({ ...BASE, bucket: "b", key: "k", fetchImpl: answering(404, "") }), false);
  assert.equal(await aws.objectExists({ ...BASE, bucket: "b", key: "k", fetchImpl: answering(200, "") }), true);
  await assert.rejects(
    aws.objectExists({ ...BASE, bucket: "b", key: "k", fetchImpl: answering(500, "") }),
    /Could not check/,
    "a failed existence check was read as the object being present"
  );
});

test("treats a bucket this account already owns as created", async () => {
  const created = await aws.createBucket({
    ...BASE, bucket: "b",
    fetchImpl: answering(409, "<Error><Code>BucketAlreadyOwnedByYou</Code></Error>")
  });
  assert.equal(created, true, "a second deploy failed because the bucket it made last time was still there");
});

test("omits the location constraint in us-east-1, where it is an error", async () => {
  const sent = [];
  await aws.createBucket({ region: "us-east-1", credentials: CREDS, bucket: "b", fetchImpl: answering(200, "", sent) });
  assert.equal(sent[0].options.body, undefined, "us-east-1 was sent a LocationConstraint, which it rejects");

  const other = [];
  await aws.createBucket({ ...BASE, bucket: "b", fetchImpl: answering(200, "", other) });
  assert.match(other[0].options.body, /<LocationConstraint>eu-west-1<\/LocationConstraint>/);
});

test("carries AWS's own message rather than replacing it", async () => {
  await assert.rejects(
    aws.callerIdentity({ ...BASE, fetchImpl: answering(403, "<ErrorResponse><Error><Code>InvalidClientTokenId</Code><Message>The security token included in the request is invalid.</Message></Error></ErrorResponse>") }),
    (error) => error.code === "InvalidClientTokenId" && /security token/.test(error.message)
  );
});

// This was a real bug, and it failed silently: a non-greedy regex closed the
// outer <member> at the inner one, so a stack's outputs vanished with nothing
// thrown and nothing logged.
test("reads a tag that contains another tag of the same name", () => {
  const xml = "<Stacks><member><Name>outer</Name><Outputs><member><Key>k</Key></member></Outputs></member></Stacks>";
  const stacks = aws.members(xml, "Stacks");
  assert.equal(stacks.length, 1);
  assert.equal(aws.element(stacks[0], "Name"), "outer");
  assert.ok(
    stacks[0].includes("</Outputs>"),
    "the outer member was truncated at the inner closing tag, so everything after it is silently missing"
  );
  assert.equal(aws.members(stacks[0], "Outputs").length, 1);
});

test("reads several siblings, and does not choke on an empty element", () => {
  assert.deepEqual(aws.elements("<a>1</a><a>2</a><a>3</a>", "a"), ["1", "2", "3"]);
  assert.deepEqual(aws.elements("<a/><a>x</a>", "a"), ["", "x"]);
});

test("stops rather than guessing when a tag never closes", () => {
  assert.deepEqual(aws.elements("<a>1</a><a>unterminated", "a"), ["1"]);
});

test("decodes XML entities rather than leaving them in a message", () => {
  assert.equal(aws.decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot;"), 'a & b <c> "d"');
});
