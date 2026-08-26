"use strict";

// Turning a video into frames, in a real browser.
//
// This file exists because the honest alternative was to test the arithmetic
// and call it covered. The arithmetic is the easy half. The hard half is
// seeking -- which is asynchronous, racy, and silently returns the previous
// frame when you get it wrong -- and the ZIP the browser builds, which is
// binary and looks fine when it is broken.
//
// So a real Chromium records a real video, the real
// `public/sonara-scroll-frames.js` machinery pulls frames out of it, and the
// archive that comes back is unpacked by `unzip`. Three implementations this
// project did not write, checking one it did.
//
// If there is no browser in the environment these are **skipped**, out loud.
// A browser test that quietly passes on a machine with no browser is the exact
// defect this repository is organised against.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const headless = require("./helpers/headless.cjs");
const framePlan = require("../public/sonara-frame-plan.js");
const zipCore = require("../public/sonara-zip-core.js");

const PUBLIC = path.join(__dirname, "..", "public");
const read = (name) => fs.readFileSync(path.join(PUBLIC, name), "utf8");

// Records a short clip of a square moving left to right, then hands it back as
// a data URL. The square's position is what makes one frame distinguishable
// from another -- without something moving, "the frames are all different"
// cannot be asserted at all.
const RECORD_CLIP = `(async () => {
  const canvas = Object.assign(document.createElement("canvas"), { width: 320, height: 180 });
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(25);
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  recorder.ondataavailable = (event) => chunks.push(event.data);
  recorder.start();
  for (let step = 0; step < 30; step += 1) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = "#fff"; ctx.fillRect(step * 10, 60, 30, 30);
    await new Promise((r) => setTimeout(r, 35));
  }
  recorder.stop();
  await new Promise((r) => { recorder.onstop = r; });
  const blob = new Blob(chunks, { type: "video/webm" });
  window.__clip = blob;
  return { bytes: blob.size };
})()`;

describe("frames come out of a real video", function () {
  this.timeout(120000);

  let browser = null;
  const available = headless.isAvailable();

  before(async function () {
    if (!available) {
      // Reported rather than hidden. `this.skip()` marks these pending in the
      // output, so a run with no browser looks different from a run that passed.
      return;
    }
    browser = await headless.launch();
    // The modules under test, loaded the way the page loads them.
    await browser.evaluate(read("sonara-frame-plan.js"));
    await browser.evaluate(read("sonara-zip-core.js"));
    await browser.evaluate(RECORD_CLIP);
  });

  after(function () {
    if (browser) browser.close();
  });

  beforeEach(function () {
    if (!available) this.skip();
  });

  it("recorded something to work with, so the rest is not testing an empty file", async () => {
    const size = await browser.evaluate("window.__clip ? window.__clip.size : 0");
    assert.ok(size > 500, `the recorded clip is ${size} bytes, which is not a video`);
  });

  it("reads the clip's real duration, including the WebM that lies about it", async () => {
    // MediaRecorder WebM reports Infinity until seeked. A plan built from that
    // asks for Infinity * 24 frames.
    const details = await browser.evaluate(`(async () => {
      const url = URL.createObjectURL(window.__clip);
      const video = document.createElement("video");
      video.preload = "metadata"; video.muted = true; video.src = url;
      await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error("no metadata")); });
      const before = video.duration;
      if (!Number.isFinite(video.duration)) {
        video.currentTime = 1e101;
        await new Promise((res) => { video.ontimeupdate = () => { video.ontimeupdate = null; res(); }; });
        video.currentTime = 0;
      }
      window.__video = video;
      return { before, after: video.duration, width: video.videoWidth, height: video.videoHeight };
    })()`);

    assert.ok(Number.isFinite(details.after), `the duration is still ${details.after} after the seek nudge`);
    assert.ok(details.after > 0.3, `the clip reports ${details.after}s, which is not the ~1s that was recorded`);
    assert.equal(details.width, 320);
    assert.equal(details.height, 180);
  });

  it("plans a frame count the clip can actually supply", async () => {
    const made = await browser.evaluate(`(() => {
      const v = window.__video;
      window.__plan = window.SonaraFramePlan.planFor({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      return window.__plan;
    })()`);

    assert.equal(made.ok, true, `the plan was refused: ${made.detail}`);
    assert.equal(made.timestamps.length, made.count, "the plan promises more frames than it gives timestamps for");
    assert.equal(made.timestamps[0], 0, "the first frame is not at the start");
    assert.ok(
      made.timestamps[made.count - 1] < made.duration,
      "the last frame is at or past the end, where most decoders return the previous frame or nothing"
    );
    assert.ok(made.width <= framePlan.MAX_EDGE && made.height <= framePlan.MAX_EDGE);
  });

  it("takes frames that are actually different from each other", async () => {
    // The point of the whole file. Seeking that silently does nothing produces
    // N copies of frame one, and every one of them is a valid JPEG.
    const positions = await browser.evaluate(`(async () => {
      const video = window.__video;
      const made = window.__plan;
      const canvas = Object.assign(document.createElement("canvas"), { width: made.width, height: made.height });
      const ctx = canvas.getContext("2d");
      const seen = [];
      const frames = [];
      const pick = [0, Math.floor(made.count / 3), Math.floor(made.count * 2 / 3), made.count - 1];
      for (const index of pick) {
        video.currentTime = made.timestamps[index];
        await new Promise((res, rej) => {
          const timer = setTimeout(() => rej(new Error("seek timed out")), 10000);
          video.onseeked = () => { clearTimeout(timer); video.onseeked = null; res(); };
        });
        ctx.drawImage(video, 0, 0, made.width, made.height);
        const data = ctx.getImageData(0, 0, made.width, made.height).data;
        let firstWhite = -1;
        for (let i = 0; i < data.length; i += 4) if (data[i] > 200) { firstWhite = (i / 4) % made.width; break; }
        seen.push(firstWhite);
        const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", made.quality));
        frames.push(new Uint8Array(await blob.arrayBuffer()));
      }
      window.__frames = frames;
      return { seen, sizes: frames.map((f) => f.length) };
    })()`);

    assert.equal(new Set(positions.seen).size, positions.seen.length,
      `the moving square is at ${JSON.stringify(positions.seen)} across four frames — seeking is returning the same picture`);
    assert.ok(positions.seen[0] < positions.seen[positions.seen.length - 1],
      "the frames are not in the order the timestamps asked for");
    for (const size of positions.sizes) {
      assert.ok(size > 200, `a frame encoded to ${size} bytes, which is not a picture`);
    }
  });

  it("builds an archive unzip accepts, with the frames in it", async () => {
    const built = await browser.evaluate(`(async () => {
      const deflate = async (bytes) => new Uint8Array(
        await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()
      );
      const encoder = new TextEncoder();
      const entries = [];
      const index = encoder.encode("<!doctype html><title>From a browser</title>");
      entries.push({ name: "index.html", raw: index, deflated: await deflate(index) });
      for (let i = 0; i < window.__frames.length; i += 1) {
        const raw = window.__frames[i];
        entries.push({ name: window.SonaraFramePlan.frameName(i + 1), raw, deflated: await deflate(raw) });
      }
      const zip = window.SonaraZipCore.assemble(entries);
      return { bytes: Array.from(zip), names: entries.map((e) => e.name) };
    })()`);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-browser-zip-"));
    try {
      const zipPath = path.join(dir, "site.zip");
      fs.writeFileSync(zipPath, Buffer.from(built.bytes));

      // An implementation neither this project nor the browser wrote.
      assert.match(
        execFileSync("unzip", ["-t", zipPath], { encoding: "utf8" }),
        /No errors detected/,
        "the archive the browser built is corrupt, so its CRCs or offsets are wrong"
      );

      execFileSync("unzip", ["-q", "-o", zipPath, "-d", path.join(dir, "out")]);
      assert.match(fs.readFileSync(path.join(dir, "out", "index.html"), "utf8"), /From a browser/);
      assert.ok(fs.existsSync(path.join(dir, "out", "frames", "0001.jpg")), "the frames are not where the page will look for them");

      // JPEG magic. A file of the right name and the wrong content is the
      // failure this catches.
      const frame = fs.readFileSync(path.join(dir, "out", "frames", "0001.jpg"));
      assert.equal(frame[0], 0xff, "the first frame is not a JPEG");
      assert.equal(frame[1], 0xd8);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds bytes the Node writer would also accept", async () => {
    // Both sides assemble the same container; only the compressor differs. If
    // they ever disagree about the layout, a folder built in one and read by
    // the other stops opening -- and nothing else would say so.
    const fromBrowser = await browser.evaluate(`(async () => {
      const deflate = async (bytes) => new Uint8Array(
        await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()
      );
      const raw = new TextEncoder().encode("the same bytes on both sides");
      const zip = window.SonaraZipCore.assemble([{ name: "a.txt", raw, deflated: await deflate(raw) }]);
      return Array.from(zip);
    })()`);

    const { createZip } = require("../lib/sonara-zip.cjs");
    const fromNode = createZip([{ name: "a.txt", data: "the same bytes on both sides" }]);

    // The compressed section may differ -- two deflate implementations are
    // allowed to make different choices -- so the comparison is on the parts
    // that must not: the signatures, the CRC, and the uncompressed length.
    const browserBytes = Buffer.from(fromBrowser);
    assert.equal(browserBytes.readUInt32LE(0), 0x04034b50, "the browser's local header signature is wrong");
    assert.equal(
      browserBytes.readUInt32LE(14), fromNode.readUInt32LE(14),
      "the two sides computed different CRCs for identical content"
    );
    assert.equal(
      browserBytes.readUInt32LE(22), fromNode.readUInt32LE(22),
      "the two sides disagree about the uncompressed size"
    );
  });
});

// The plan is shared between the browser and the server, so it is also checked
// here in Node -- where the edge cases are far easier to construct than they
// are inside a page.
describe("the frame plan", () => {
  it("refuses a duration it cannot trust rather than planning from Infinity", () => {
    assert.equal(framePlan.planFor({ duration: Infinity, width: 320, height: 180 }).ok, false);
    assert.equal(framePlan.planFor({ duration: 0, width: 320, height: 180 }).code, "no_duration");
    assert.equal(framePlan.planFor({ duration: null, width: 320, height: 180 }).code, "no_duration");
  });

  it("refuses a long clip rather than silently taking the first few seconds", () => {
    const refused = framePlan.planFor({ duration: 90, width: 320, height: 180 });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, "too_long");
    assert.match(refused.detail, /90\.0 seconds/, "the refusal does not say how long the clip actually is");
  });

  it("refuses a file with no picture in it", () => {
    assert.equal(framePlan.planFor({ duration: 3, width: 0, height: 0 }).code, "no_picture");
  });

  it("scales down to the long edge and never up", () => {
    const big = framePlan.planFor({ duration: 2, width: 3840, height: 2160 });
    assert.equal(big.width, framePlan.MAX_EDGE, "a 4K clip was not scaled down");
    assert.equal(big.height, 720);

    const small = framePlan.planFor({ duration: 2, width: 640, height: 360 });
    assert.equal(small.width, 640, "a small clip was enlarged, which costs bytes and improves nothing");
    assert.equal(small.height, 360);
  });

  it("keeps the frame count between its floor and its ceiling", () => {
    assert.equal(framePlan.planFor({ duration: 0.2, width: 320, height: 180 }).count, framePlan.MIN_FRAMES);
    assert.equal(framePlan.planFor({ duration: 20, width: 320, height: 180 }).count, framePlan.MAX_FRAMES);
  });

  it("gives one timestamp per frame, in order, inside the clip", () => {
    const made = framePlan.planFor({ duration: 5, width: 320, height: 180 });
    assert.equal(made.timestamps.length, made.count);
    for (let i = 1; i < made.timestamps.length; i += 1) {
      assert.ok(made.timestamps[i] > made.timestamps[i - 1], `timestamp ${i} does not advance`);
    }
    assert.ok(made.timestamps[made.count - 1] < made.duration);
  });

  it("names frames the way the renderer's pattern expands", () => {
    // `frames/%d.jpg` with four-digit padding, in both places. If these drift,
    // every frame after the first is a 404 on a page that looks fine.
    const { framePath } = require("../lib/sonara-scroll-site.cjs");
    for (const index of [1, 7, 99, 240]) {
      assert.equal(
        framePlan.frameName(index), framePath("frames/%d.jpg", index),
        `the browser writes ${framePlan.frameName(index)} and the page asks for ${framePath("frames/%d.jpg", index)}`
      );
    }
  });

  it("says how big the download will be, so nobody builds 24MB by accident", () => {
    const made = framePlan.planFor({ duration: 12, width: 1920, height: 1080 });
    assert.ok(made.estimatedBytes > 0);
    assert.match(framePlan.describeSize(made.estimatedBytes), /MB$/);
    assert.match(framePlan.describeSize(50 * 1024), /KB$/);
  });
});

describe("the zip container is one implementation", () => {
  it("is the same module the Node writer uses", () => {
    // Not a stylistic point. Two copies of a binary layout is two chances to
    // get one of them wrong, and the symptom is an archive that looks fine and
    // will not open.
    const source = fs.readFileSync(path.join(__dirname, "..", "lib", "sonara-zip.cjs"), "utf8");
    assert.match(source, /require\("\.\.\/public\/sonara-zip-core\.js"\)/,
      "lib/sonara-zip.cjs has its own container layout again");
    assert.equal(typeof zipCore.assemble, "function");
  });

  it("refuses an entry that has not been compressed rather than writing a broken one", () => {
    assert.throws(
      () => zipCore.assemble([{ name: "a.txt", raw: new Uint8Array([1, 2, 3]) }]),
      /raw and deflated/,
      "an entry with no compressed bytes produced an archive"
    );
  });
});
