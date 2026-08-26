"use strict";

// STS and IAM.
//
// Together because they answer the same question from two sides -- who am I,
// and what may they do -- and because what an emulator can honestly say about
// either is narrow enough that two files would mostly be headers.
//
// ## There is no authorization here, and it says so
//
// This emulator does not evaluate IAM policies. It stores them, returns them,
// and never denies a call because of one. That is a real limitation with a real
// consequence: **a test that passes here can still be denied by AWS**, and
// nothing local will have hinted at it.
//
// The alternative is worse. A partial policy evaluator gets some denials right
// and some wrong, and the wrong ones are indistinguishable from the right ones
// without reading its source. Somebody would then trust it, ship, and be denied
// in production by a rule it did not implement. Saying "this does not check
// permissions" once, in the README and in the startup banner, is the honest
// version.
//
// So IAM is here to let a deploy that *creates a role* succeed, which is what
// CloudFormation templates do constantly -- not to gate anything.

const { xml, queryResponse, queryErrorXml } = require("../xml.js");
const { DEFAULT_ACCOUNT } = require("../store.js");

const STS_NAMESPACE = "https://sts.amazonaws.com/doc/2011-06-15/";
const IAM_NAMESPACE = "https://iam.amazonaws.com/doc/2010-05-08/";

function roles(store, region) {
  // IAM is global in real AWS. Kept under one pseudo-region here so a role
  // created while pointed at eu-west-1 is visible from us-east-1, which is what
  // callers expect and what a per-region map would quietly get wrong.
  return store.scope("aws-global", "iam", "roles");
}

function policies(store) {
  return store.scope("aws-global", "iam", "policies");
}

function form(body) {
  const out = {};
  for (const [key, value] of new URLSearchParams(String(body || ""))) out[key] = value;
  return out;
}

function fail(code, message, namespace) {
  return { status: 400, headers: { "content-type": "application/xml" }, body: queryErrorXml(code, message) };
}

function xmlAnswer(action, inner, namespace) {
  return { status: 200, headers: { "content-type": "application/xml" }, body: queryResponse(action, inner, { namespace }) };
}

// The access key on the request, echoed back. It is whatever the caller signed
// with -- this emulator issues no keys and checks none -- and reflecting it is
// more useful than inventing one, because a test asserting "I am the key I
// configured" then holds.
function callerArn(request) {
  const key = request.accessKeyId || "emulator";
  return `arn:aws:iam::${DEFAULT_ACCOUNT}:user/${key}`;
}

function handleSts(request, { store }) {
  const values = form(request.body ? request.body.toString("utf8") : "");
  const action = request.action;

  switch (action) {
    case "GetCallerIdentity":
      return xmlAnswer("GetCallerIdentity",
        `<Arn>${xml(callerArn(request))}</Arn>`
        + `<UserId>${xml(request.accessKeyId || "emulator")}</UserId>`
        + `<Account>${DEFAULT_ACCOUNT}</Account>`,
        STS_NAMESPACE);

    case "AssumeRole": {
      const roleArn = String(values.RoleArn || "");
      const sessionName = String(values.RoleSessionName || "session");
      // Always granted. See the note at the top: this does not evaluate trust
      // policies, and pretending to would be the dangerous half-measure.
      const expiry = new Date(Date.now() + 3600 * 1000).toISOString();
      return xmlAnswer("AssumeRole",
        `<Credentials>`
        + `<AccessKeyId>ASIA${"EMULATOR".padEnd(16, "X")}</AccessKeyId>`
        + `<SecretAccessKey>emulator-secret-not-a-real-credential</SecretAccessKey>`
        + `<SessionToken>emulator-session-token</SessionToken>`
        + `<Expiration>${expiry}</Expiration>`
        + `</Credentials>`
        + `<AssumedRoleUser><Arn>${xml(roleArn)}/${xml(sessionName)}</Arn><AssumedRoleId>AROAEMULATOR:${xml(sessionName)}</AssumedRoleId></AssumedRoleUser>`,
        STS_NAMESPACE);
    }

    case "GetSessionToken": {
      const expiry = new Date(Date.now() + 3600 * 1000).toISOString();
      return xmlAnswer("GetSessionToken",
        `<Credentials>`
        + `<AccessKeyId>ASIA${"EMULATOR".padEnd(16, "X")}</AccessKeyId>`
        + `<SecretAccessKey>emulator-secret-not-a-real-credential</SecretAccessKey>`
        + `<SessionToken>emulator-session-token</SessionToken>`
        + `<Expiration>${expiry}</Expiration>`
        + `</Credentials>`,
        STS_NAMESPACE);
    }

    default:
      return fail("InvalidAction", `This emulator does not implement STS's ${action}.`, STS_NAMESPACE);
  }
}

function handleIam(request, { store }) {
  const values = form(request.body ? request.body.toString("utf8") : "");
  const action = request.action;
  const all = roles(store);

  const roleXml = (role) => `<Role>`
    + `<Path>/</Path>`
    + `<RoleName>${xml(role.name)}</RoleName>`
    + `<RoleId>${xml(role.id)}</RoleId>`
    + `<Arn>${xml(role.arn)}</Arn>`
    + `<CreateDate>${role.created}</CreateDate>`
    + `<AssumeRolePolicyDocument>${xml(role.assumePolicy)}</AssumeRolePolicyDocument>`
    + `</Role>`;

  switch (action) {
    case "CreateRole": {
      const name = String(values.RoleName || "");
      if (!name) return fail("ValidationError", "RoleName is required.", IAM_NAMESPACE);
      if (all.has(name)) return fail("EntityAlreadyExists", `Role with name ${name} already exists.`, IAM_NAMESPACE);
      const role = {
        name,
        id: `AROA${name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16).padEnd(16, "X")}`,
        arn: `arn:aws:iam::${DEFAULT_ACCOUNT}:role/${name}`,
        created: new Date().toISOString(),
        assumePolicy: String(values.AssumeRolePolicyDocument || ""),
        inline: new Map(),
        attached: []
      };
      all.set(name, role);
      store.save();
      return xmlAnswer("CreateRole", roleXml(role), IAM_NAMESPACE);
    }

    case "GetRole": {
      const role = all.get(String(values.RoleName || ""));
      if (!role) return fail("NoSuchEntity", `The role with name ${values.RoleName} cannot be found.`, IAM_NAMESPACE);
      return xmlAnswer("GetRole", roleXml(role), IAM_NAMESPACE);
    }

    case "ListRoles":
      return xmlAnswer("ListRoles",
        `<Roles>${[...all.values()].map(roleXml).map((entry) => `<member>${entry.replace(/^<Role>|<\/Role>$/g, "")}</member>`).join("")}</Roles><IsTruncated>false</IsTruncated>`,
        IAM_NAMESPACE);

    case "DeleteRole": {
      const name = String(values.RoleName || "");
      if (!all.has(name)) return fail("NoSuchEntity", `The role with name ${name} cannot be found.`, IAM_NAMESPACE);
      all.delete(name);
      store.save();
      return xmlAnswer("DeleteRole", "", IAM_NAMESPACE);
    }

    case "PutRolePolicy": {
      const role = all.get(String(values.RoleName || ""));
      if (!role) return fail("NoSuchEntity", `The role with name ${values.RoleName} cannot be found.`, IAM_NAMESPACE);
      // Stored, never evaluated. See the note at the top of this file.
      role.inline.set(String(values.PolicyName || ""), String(values.PolicyDocument || ""));
      store.save();
      return xmlAnswer("PutRolePolicy", "", IAM_NAMESPACE);
    }

    case "DeleteRolePolicy": {
      const role = all.get(String(values.RoleName || ""));
      if (!role) return fail("NoSuchEntity", `The role with name ${values.RoleName} cannot be found.`, IAM_NAMESPACE);
      role.inline.delete(String(values.PolicyName || ""));
      store.save();
      return xmlAnswer("DeleteRolePolicy", "", IAM_NAMESPACE);
    }

    case "ListRolePolicies": {
      const role = all.get(String(values.RoleName || ""));
      if (!role) return fail("NoSuchEntity", `The role with name ${values.RoleName} cannot be found.`, IAM_NAMESPACE);
      return xmlAnswer("ListRolePolicies",
        `<PolicyNames>${[...role.inline.keys()].map((name) => `<member>${xml(name)}</member>`).join("")}</PolicyNames><IsTruncated>false</IsTruncated>`,
        IAM_NAMESPACE);
    }

    case "AttachRolePolicy": {
      const role = all.get(String(values.RoleName || ""));
      if (!role) return fail("NoSuchEntity", `The role with name ${values.RoleName} cannot be found.`, IAM_NAMESPACE);
      role.attached.push(String(values.PolicyArn || ""));
      store.save();
      return xmlAnswer("AttachRolePolicy", "", IAM_NAMESPACE);
    }

    case "DetachRolePolicy": {
      const role = all.get(String(values.RoleName || ""));
      if (!role) return fail("NoSuchEntity", `The role with name ${values.RoleName} cannot be found.`, IAM_NAMESPACE);
      role.attached = role.attached.filter((arn) => arn !== String(values.PolicyArn || ""));
      store.save();
      return xmlAnswer("DetachRolePolicy", "", IAM_NAMESPACE);
    }

    case "TagRole":
    case "UntagRole":
      return xmlAnswer(action, "", IAM_NAMESPACE);

    // The one worth refusing loudly rather than answering. Somebody calling
    // this is asking "would AWS allow it", and an emulator that says "allowed"
    // without evaluating anything is answering a question it did not consider.
    case "SimulatePrincipalPolicy":
    case "SimulateCustomPolicy":
      return fail("NotImplemented",
        "This emulator does not evaluate IAM policies, so it cannot simulate them. It stores policies and never denies a "
        + "call because of one -- which means a test that passes here can still be denied by AWS.",
        IAM_NAMESPACE);

    default:
      return fail("InvalidAction", `This emulator does not implement IAM's ${action}.`, IAM_NAMESPACE);
  }
}

module.exports = { handleSts, handleIam, callerArn, roles, policies, STS_NAMESPACE, IAM_NAMESPACE };
