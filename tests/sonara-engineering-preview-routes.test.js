"use strict";
const assert = require("node:assert/strict");
const { registerEngineeringPreviewRoutes, PREVIEW_ROUTES } = require("../routes/sonara-engineering-preview-routes.cjs");

function makeApp() {
  const registry = new Map();
  const counts = { auth: [], limited: 0 };
  const config = [];
  const app = { post: (path, ...middleware) => registry.set(path, middleware) };
  registerEngineeringPreviewRoutes(app, {
    requireWorkspaceAccess: (workspace) => (req, res, next) => {
      counts.auth.push(workspace);
      if (req.workspace !== workspace) return res.status(403).json({ ok: false, code: "forbidden" });
      req.sonaraUser = { id: "authorized-test-subject" };
      next();
    },
    createRateLimiter: (options) => {
      config.push(options);
      return (req, res, next) => {
        counts.limited++;
        if (req.forceRateLimited) return res.status(429).json({ok:false,code:"rate_limited"});
        next();
      };
    },
    getSupabaseServerConfig: () => ({ok:false})
  });
  function run(path, body, opts = {}) {
    const req = {
      workspace: opts.workspace || "business_builder", body,
      forceRateLimited: !!opts.forceRateLimited,
      headers: { "content-type": opts.contentType || "application/json" }
    };
    const res = {
      statusCode: 200, headers: {}, body: null,
      setHeader(key, value) { this.headers[key] = value; return this; },
      status(n) { this.statusCode=n; return this; },
      json(value) { this.body=value; return this; }
    };
    const handlers = registry.get(path);
    assert.ok(handlers, "Expected registered route " + path);
    for (const handler of handlers) {
      if (res.body !== null) break;
      handler(req, res, () => {});
    }
    return res;
  }
  return { run, registry, config, counts };
}

function sampleDxf() {
  return [
    0, "SECTION", 2, "HEADER", 9, "$INSUNITS", 70, 6, 0, "ENDSEC",
    0, "SECTION", 2, "ENTITIES",
    0, "LINE", 10, 0, 20, 0, 11, 3, 21, 4,
    0, "ENDSEC", 0, "EOF"
  ].join("\n")+"\n";
}
function poseInput() {
  const landmarks = Array.from({length:33}, () => ({x:0,y:0,z:0,visibility:0.95}));
  landmarks[11].x=1;
  landmarks[15].y=1;
  return {
    schemaVersion:1,
    coordinateSpace:"mediapipe_pose_world_meters_hip_centered",
    source:{origin:"manual_export",reference:"clip-01"},
    jointIndices:[11,13,15],minVisibility:0.8,
    frames:[{timestampUs:0,landmarks}]
  };
}

describe("authenticated stateless engineering JSON previews", () => {
  it("registers exactly three named endpoints with actual access and rate-limit middleware", () => {
    const setup=makeApp();
    assert.deepEqual([...setup.registry.keys()], [
      PREVIEW_ROUTES.dxf, PREVIEW_ROUTES.estimate, PREVIEW_ROUTES.pose
    ]);
    assert.equal(setup.config.length,1);
    assert.equal(setup.config[0].windowSeconds,3600);
    assert.equal(setup.config[0].maxAttempts,30);
    assert.deepEqual(setup.config[0].scopes,["ip","subject"]);
    assert.equal(typeof setup.config[0].subjectFrom,"function");
  });
  it("gates the business preview from creator-only users and unauthorized callers", () => {
    const setup=makeApp();
    const denied=setup.run(PREVIEW_ROUTES.dxf,{dxfText:sampleDxf()},{workspace:"creator_studio"});
    assert.equal(denied.statusCode,403);
    assert.equal(denied.body.code,"forbidden");
    assert.equal(setup.counts.limited,0);
  });
  it("gates pose previews separately to creator workspace access", () => {
    const setup=makeApp();
    const denied=setup.run(PREVIEW_ROUTES.pose,poseInput(),{workspace:"business_builder"});
    assert.equal(denied.statusCode,403);
    const allowed=setup.run(PREVIEW_ROUTES.pose,poseInput(),{workspace:"creator_studio"});
    assert.equal(allowed.statusCode,200);
    assert.equal(allowed.body.validFrameCount,1);
    assert.equal(allowed.body.measurements[0].angleDegrees,90);
    assert.equal(Object.hasOwn(allowed.body,"frames"),false);
  });
  it("produces read-only DXF length, no raw input, and no caching", () => {
    const setup=makeApp();
    const ok=setup.run(PREVIEW_ROUTES.dxf,{dxfText:sampleDxf()});
    assert.equal(ok.statusCode,200);
    assert.equal(ok.body.totalLengthMeters,5);
    assert.equal(ok.body.sourceUnit,"m");
    assert.equal(ok.headers["Cache-Control"],"no-store");
    assert.equal(JSON.stringify(ok.body).includes("$INSUNITS"),false);
  });
  it("connects approved business intake to cost preview, without material purchase", () => {
    const setup=makeApp();
    const out=setup.run(PREVIEW_ROUTES.estimate,{
      dxfText:sampleDxf(),materialCostPerMeter:20,wastePercent:10,
      laborHours:2,loadedLaborCostPerHour:50,otherCosts:25,currency:"USD"
    });
    assert.equal(out.statusCode,200);
    assert.equal(out.body.measuredLengthMeters,5);
    assert.equal(out.body.estimatedTotal,235);
    assert.equal(Object.hasOwn(out.body,"purchaseOrder"),false);
  });
  it("checks JSON Content-Type and refuses oversized source strings", () => {
    const setup=makeApp();
    const unsupported=setup.run(PREVIEW_ROUTES.dxf,{dxfText:sampleDxf()},{contentType:"multipart/form-data"});
    assert.equal(unsupported.statusCode,415);
    const long=setup.run(PREVIEW_ROUTES.dxf,{dxfText:"x".repeat(524289)});
    assert.equal(long.statusCode,413);
    const nonJson=setup.run(PREVIEW_ROUTES.pose,"raw-pose");
    assert.equal(nonJson.statusCode,400);
  });
  it("propagates rate limiting and does not compute before denial", () => {
    const setup=makeApp();
    const refused=setup.run(PREVIEW_ROUTES.estimate,{dxfText:sampleDxf()},{forceRateLimited:true});
    assert.equal(refused.statusCode,429);
    assert.equal(refused.body.code,"rate_limited");
    assert.equal(setup.counts.limited,1);
  });
  it("returns typed validation failures without echoing submitted personal or CAD source data", () => {
    const setup=makeApp();
    const bad=setup.run(PREVIEW_ROUTES.dxf,{dxfText:"private customer drawing"});
    assert.equal(bad.statusCode,400);
    assert.equal(JSON.stringify(bad.body).includes("private customer drawing"),false);
    const invalidPose=setup.run(PREVIEW_ROUTES.pose,{...poseInput(),coordinateSpace:"image_normalized"},
      {workspace:"creator_studio"});
    assert.equal(invalidPose.statusCode,400);
    assert.equal(invalidPose.body.code,"unsupported_coordinate_space");
  });
  it("fails closed when app registration omits its actual authorization or limiter contracts", () => {
    assert.throws(()=>registerEngineeringPreviewRoutes({post(){}},{}),/Missing required/);
    assert.throws(()=>registerEngineeringPreviewRoutes({post(){}},{
      requireWorkspaceAccess:()=>()=>{},
      createRateLimiter:()=>null,
      getSupabaseServerConfig:()=>({ok:false})
    }),/must be middleware/);
  });
});
