"use strict";

// The application, as a CloudFormation template.
//
// CloudFormation is what makes `plan` honest. A tool that deployed by calling
// CreateFunction and PutBucket itself would have to work out what changed by
// comparing its own idea of the world against reality -- and would be wrong the
// first time somebody changed something in the console. A change set is
// CloudFormation's own answer to "what would happen if I did this", computed
// against the deployed stack rather than against a local guess.
//
// Everything below therefore has one job: produce a template that means exactly
// what the YAML said, with logical IDs stable enough that renaming nothing
// causes a replacement of nothing.
//
// ## Logical IDs are a promise
//
// A logical ID is how CloudFormation knows that the function in the new
// template is the *same* function as the one in the deployed stack. Change the
// ID and it deletes one resource and creates another -- which for a table means
// the data is gone. So IDs are derived from the name the author wrote, and the
// derivation is pure and tested. It must never depend on ordering, on a hash of
// the whole file, or on anything that changes when an unrelated line does.

// A name from the YAML to a CloudFormation logical ID: alphanumeric, first
// letter capitalised, hyphens consumed by capitalising what follows. "orders-api"
// becomes "OrdersApi". Deterministic and reversible enough to read in a plan.
function logicalId(prefix, name) {
  const cleaned = String(name)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `${prefix}${cleaned}`;
}

const idFor = Object.freeze({
  fn: (name) => logicalId("Fn", name),
  role: (name) => logicalId("Role", name),
  logGroup: (name) => logicalId("Logs", name),
  table: (name) => logicalId("Table", name),
  bucket: (name) => logicalId("Bucket", name),
  queue: (name) => logicalId("Queue", name),
  schedule: (name, index) => `${logicalId("Schedule", name)}${index}`,
  schedulePermission: (name, index) => `${logicalId("SchedulePerm", name)}${index}`,
  route: (name, index) => `${logicalId("Route", name)}${index}`,
  integration: (name) => logicalId("Integration", name)
});

// What each permission level allows, per resource type. Written out rather than
// generated, because "readwrite" on a queue is not the same set of actions as
// "readwrite" on a bucket and a clever abstraction over the three would be a
// place for a wrong action to hide.
const ACTIONS = Object.freeze({
  table: {
    read: ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query", "dynamodb:Scan"],
    write: ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:BatchWriteItem"]
  },
  bucket: {
    read: ["s3:GetObject", "s3:ListBucket"],
    write: ["s3:PutObject", "s3:DeleteObject"]
  },
  queue: {
    read: ["sqs:ReceiveMessage", "sqs:GetQueueAttributes", "sqs:DeleteMessage"],
    write: ["sqs:SendMessage"]
  }
});

function actionsFor(type, level) {
  const set = ACTIONS[type];
  if (!set) throw new TypeError(`no actions defined for resource type ${type}`);
  if (level === "read") return set.read.slice();
  if (level === "write") return set.write.slice();
  return [...set.read, ...set.write];
}

// A bucket grant needs both the bucket and everything in it. Granting only the
// bucket ARN is the single most common way an s3:GetObject policy silently
// denies -- the actions look right and the resource is wrong.
function resourceArnsFor(resource) {
  const id = idFor[resource.type](resource.name);
  if (resource.type === "bucket") {
    return [
      { "Fn::GetAtt": [id, "Arn"] },
      { "Fn::Join": ["", [{ "Fn::GetAtt": [id, "Arn"] }, "/*"]] }
    ];
  }
  if (resource.type === "table") {
    return [
      { "Fn::GetAtt": [id, "Arn"] },
      // A query against a table's index is denied by a policy that names only
      // the table, and the error says AccessDenied on the table, which sends
      // everyone to the wrong place.
      { "Fn::Join": ["", [{ "Fn::GetAtt": [id, "Arn"] }, "/index/*"]] }
    ];
  }
  return [{ "Fn::GetAtt": [id, "Arn"] }];
}

/**
 * Build the CloudFormation template for an application.
 *
 *   app          the validated manifest
 *   codeBucket   where the deployment package was uploaded
 *   codeKey      the object key of the package
 *
 * Pure: the same application and the same key always give the same template,
 * byte for byte. `plan` relies on that -- a template that varied between calls
 * would show phantom changes and train people to ignore the plan.
 */
function buildTemplate(app, { codeBucket = null, codeKey = null } = {}) {
  const Resources = {};
  const Outputs = {};

  for (const resource of app.resources) {
    if (resource.type === "table") {
      const attributes = [{ AttributeName: resource.key, AttributeType: "S" }];
      const schema = [{ AttributeName: resource.key, KeyType: "HASH" }];
      if (resource.sort) {
        attributes.push({ AttributeName: resource.sort, AttributeType: "S" });
        schema.push({ AttributeName: resource.sort, KeyType: "RANGE" });
      }
      Resources[idFor.table(resource.name)] = {
        Type: "AWS::DynamoDB::Table",
        // Retain, deliberately. `sonara-serverless remove` deleting a stack
        // should not be the thing that loses a customer's orders, and a table
        // left behind is recoverable in a way a deleted one is not.
        DeletionPolicy: "Retain",
        UpdateReplacePolicy: "Retain",
        Properties: {
          BillingMode: "PAY_PER_REQUEST",
          AttributeDefinitions: attributes,
          KeySchema: schema
        }
      };
    }

    if (resource.type === "bucket") {
      Resources[idFor.bucket(resource.name)] = {
        Type: "AWS::S3::Bucket",
        DeletionPolicy: "Retain",
        UpdateReplacePolicy: "Retain",
        Properties: {
          // Private, encrypted and blocking public access, with no way to say
          // otherwise in the YAML. A public bucket is a decision that should
          // involve reading a console warning, not a line in a file.
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true
          },
          BucketEncryption: {
            ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }]
          },
          ...(resource.versioned ? { VersioningConfiguration: { Status: "Enabled" } } : {})
        }
      };
    }

    if (resource.type === "queue") {
      Resources[idFor.queue(resource.name)] = {
        Type: "AWS::SQS::Queue",
        Properties: { VisibilityTimeout: resource.visibilityTimeout }
      };
    }
  }

  for (const fn of app.functions) {
    const fnId = idFor.fn(fn.name);
    const roleId = idFor.role(fn.name);
    const logsId = idFor.logGroup(fn.name);

    const statements = [];
    for (const [resourceName, level] of Object.entries(fn.uses)) {
      const resource = app.resources.find((entry) => entry.name === resourceName);
      statements.push({
        Effect: "Allow",
        Action: actionsFor(resource.type, level),
        Resource: resourceArnsFor(resource)
      });
    }

    Resources[roleId] = {
      Type: "AWS::IAM::Role",
      Properties: {
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [{ Effect: "Allow", Principal: { Service: "lambda.amazonaws.com" }, Action: "sts:AssumeRole" }]
        },
        Policies: [{
          PolicyName: "logs",
          PolicyDocument: {
            Version: "2012-10-17",
            Statement: [{
              Effect: "Allow",
              Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
              // Scoped to this function's own log group. The managed
              // AWSLambdaBasicExecutionRole grants logs:* on every group in the
              // account, which is a great deal more than "may write its logs".
              Resource: { "Fn::GetAtt": [logsId, "Arn"] }
            }]
          }
        },
        // An empty Policies entry is not the same as no entry: CloudFormation
        // rejects a policy document with an empty Statement list, so a function
        // that uses nothing gets logs only.
        ...(statements.length ? [{ PolicyName: "resources", PolicyDocument: { Version: "2012-10-17", Statement: statements } }] : [])
        ]
      }
    };

    Resources[logsId] = {
      Type: "AWS::Logs::LogGroup",
      // Declared rather than left to Lambda to create implicitly, for two
      // reasons: an implicitly created group never expires, and the role above
      // needs its ARN to exist before the function runs.
      Properties: {
        LogGroupName: { "Fn::Join": ["", ["/aws/lambda/", { Ref: fnId }]] },
        RetentionInDays: 14
      }
    };

    Resources[fnId] = {
      Type: "AWS::Lambda::Function",
      DependsOn: [roleId],
      Properties: {
        Runtime: fn.runtime,
        Handler: fn.handler,
        MemorySize: fn.memory,
        Timeout: fn.timeout,
        Role: { "Fn::GetAtt": [roleId, "Arn"] },
        ...(fn.description ? { Description: fn.description } : {}),
        ...(Object.keys(fn.environment).length ? { Environment: { Variables: { ...fn.environment } } } : {}),
        Code: codeBucket && codeKey
          ? { S3Bucket: codeBucket, S3Key: codeKey }
          // A template built for `plan` before anything is uploaded still has
          // to be a valid template. This placeholder is never deployed --
          // `deploy` always passes a real key -- and `plan` says so.
          : { ZipFile: "exports.handler = async () => ({ statusCode: 503 });" }
      }
    };

    fn.events.forEach((event, index) => {
      if (event.kind !== "schedule") return;
      const ruleId = idFor.schedule(fn.name, index);
      Resources[ruleId] = {
        Type: "AWS::Events::Rule",
        Properties: {
          ScheduleExpression: event.expression,
          State: "ENABLED",
          Targets: [{ Id: `${fnId}Target`, Arn: { "Fn::GetAtt": [fnId, "Arn"] } }]
        }
      };
      Resources[idFor.schedulePermission(fn.name, index)] = {
        Type: "AWS::Lambda::Permission",
        Properties: {
          Action: "lambda:InvokeFunction",
          FunctionName: { "Fn::GetAtt": [fnId, "Arn"] },
          Principal: "events.amazonaws.com",
          // Without SourceArn any EventBridge rule in the account could invoke
          // this function.
          SourceArn: { "Fn::GetAtt": [ruleId, "Arn"] }
        }
      };
    });
  }

  if (app.hasHttp) {
    Resources.HttpApi = {
      Type: "AWS::ApiGatewayV2::Api",
      Properties: { Name: `${app.name}-http`, ProtocolType: "HTTP" }
    };
    Resources.HttpStage = {
      Type: "AWS::ApiGatewayV2::Stage",
      Properties: { ApiId: { Ref: "HttpApi" }, StageName: "$default", AutoDeploy: true }
    };

    for (const fn of app.functions) {
      const httpEvents = fn.events.filter((event) => event.kind === "http");
      if (!httpEvents.length) continue;
      const fnId = idFor.fn(fn.name);
      const integrationId = idFor.integration(fn.name);

      Resources[integrationId] = {
        Type: "AWS::ApiGatewayV2::Integration",
        Properties: {
          ApiId: { Ref: "HttpApi" },
          IntegrationType: "AWS_PROXY",
          IntegrationUri: { "Fn::GetAtt": [fnId, "Arn"] },
          PayloadFormatVersion: "2.0"
        }
      };
      Resources[`${logicalId("Perm", fn.name)}Http`] = {
        Type: "AWS::Lambda::Permission",
        Properties: {
          Action: "lambda:InvokeFunction",
          FunctionName: { "Fn::GetAtt": [fnId, "Arn"] },
          Principal: "apigateway.amazonaws.com",
          SourceArn: {
            "Fn::Join": ["", ["arn:aws:execute-api:", { Ref: "AWS::Region" }, ":", { Ref: "AWS::AccountId" }, ":", { Ref: "HttpApi" }, "/*"]]
          }
        }
      };
      httpEvents.forEach((event, index) => {
        Resources[idFor.route(fn.name, index)] = {
          Type: "AWS::ApiGatewayV2::Route",
          Properties: {
            ApiId: { Ref: "HttpApi" },
            RouteKey: `${event.method} ${event.path}`,
            Target: { "Fn::Join": ["", ["integrations/", { Ref: integrationId }]] }
          }
        };
      });
    }

    Outputs.ApiUrl = {
      Description: "The address this application answers on",
      Value: { "Fn::Join": ["", ["https://", { Ref: "HttpApi" }, ".execute-api.", { Ref: "AWS::Region" }, ".amazonaws.com"]] }
    };
  }

  return {
    AWSTemplateFormatVersion: "2010-09-09",
    Description: `${app.name}, deployed by sonara-serverless`,
    Resources,
    ...(Object.keys(Outputs).length ? { Outputs } : {})
  };
}

module.exports = { buildTemplate, logicalId, idFor, actionsFor, ACTIONS };
