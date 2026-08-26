/* Turning a video somebody brought into the frames a scroll site scrubs through.
 *
 * All of this runs in the browser, on the visitor's own machine, and that is a
 * decision rather than a limitation.
 *
 * A few hundred frames is twenty-odd megabytes. This application is a set of
 * serverless functions with a payload ceiling measured in single-digit
 * megabytes and no multipart parser -- there is one production dependency and
 * it is Express -- so uploading the frames is not a thing that can be made to
 * work by trying harder. Extracting them server-side is worse: it needs ffmpeg,
 * which is not in a function either.
 *
 * The browser, meanwhile, already has a video decoder, a canvas, a JPEG
 * encoder and, since `CompressionStream`, a deflate. The file is already on the
 * machine. Nothing is gained by moving twenty megabytes to a server and back.
 *
 * So: the clip never leaves the machine it was chosen on, and what comes out is
 * a finished folder — index.html, the frames, the runtime — that the person can
 * host anywhere. The site's own words and colours come from the server, so what
 * they downloaded is the site they were editing.
 */
(function () {
  "use strict";

  const plan = window.SonaraFramePlan;
  const zipCore = window.SonaraZipCore;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  ready(function () {
    const panel = document.querySelector("[data-frame-studio]");
    if (!panel) return;

    const input = panel.querySelector("input[type=file]");
    const status = panel.querySelector("[data-frame-status]");
    const preview = panel.querySelector("canvas");
    const button = panel.querySelector("[data-frame-build]");
    if (!input || !status || !preview || !button) return;

    // The controls are written disabled and turned on here. Without this script
    // -- blocked, failed, an older browser -- they would be controls that look
    // ready and do nothing, which is worse than controls that say why not.
    if (!plan || !zipCore || typeof window.CompressionStream !== "function") {
      status.textContent = "This browser cannot take frames out of a video. Chrome, Edge, Firefox and Safari all can; something older will not.";
      return;
    }
    input.disabled = false;
    button.disabled = true;
    status.textContent = "Choose a clip. A few seconds is plenty — the whole thing scrubs past as somebody scrolls.";

    let chosen = null;

    function say(text) { status.textContent = text; }

    input.addEventListener("change", async function () {
      const file = input.files && input.files[0];
      chosen = null;
      button.disabled = true;
      if (!file) return;

      say("Reading " + file.name + "…");
      let details;
      try {
        details = await inspect(file);
      } catch (error) {
        say("This file could not be opened as a video. " + (error && error.message ? error.message : ""));
        return;
      }

      const made = plan.planFor(details);
      if (!made.ok) { say(made.detail); return; }

      chosen = { file, details, plan: made };
      button.disabled = false;
      say(
        Math.round(made.duration * 10) / 10 + " seconds, " + made.count + " frames at "
        + made.width + "×" + made.height + ". Around " + plan.describeSize(made.estimatedBytes)
        + " once built — everybody who opens your site downloads that, so shorter is kinder."
      );
    });

    button.addEventListener("click", async function () {
      if (!chosen) return;
      button.disabled = true;
      input.disabled = true;
      try {
        await build(chosen, say, preview, panel);
      } catch (error) {
        // Said plainly rather than swallowed. A silent failure here looks
        // exactly like a slow build, and somebody waits for it.
        say("That did not finish: " + (error && error.message ? error.message : "something went wrong") + ". Nothing has been changed.");
      } finally {
        input.disabled = false;
        button.disabled = false;
      }
    });
  });

  // What the file actually is, according to the browser that will play it.
  function inspect(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.src = url;

      const done = function (value, error) {
        if (error) reject(error); else resolve(value);
      };

      video.addEventListener("loadedmetadata", function () {
        // MediaRecorder WebM reports Infinity until it has been seeked. Nudging
        // to the end and back is the accepted way to make the real duration
        // appear, and without it `planFor` refuses a file that is perfectly
        // fine.
        if (!Number.isFinite(video.duration)) {
          video.currentTime = 1e101;
          video.addEventListener("timeupdate", function once() {
            video.removeEventListener("timeupdate", once);
            video.currentTime = 0;
            done({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, video: video, url: url });
          });
          return;
        }
        done({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, video: video, url: url });
      }, { once: true });

      video.addEventListener("error", function () {
        URL.revokeObjectURL(url);
        done(null, new Error("The browser could not decode it."));
      }, { once: true });
    });
  }

  function seek(video, time) {
    return new Promise(function (resolve, reject) {
      // A timeout rather than waiting forever. A decoder that will not seek is
      // a real outcome, and a progress bar that stops at 41% with no
      // explanation is the worst way to report it.
      const timer = setTimeout(function () { reject(new Error("the video stopped responding while seeking")); }, 10000);
      video.addEventListener("seeked", function once() {
        clearTimeout(timer);
        video.removeEventListener("seeked", once);
        resolve();
      });
      video.currentTime = time;
    });
  }

  function toJpeg(canvas, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error("the browser would not encode a frame"));
      }, "image/jpeg", quality);
    });
  }

  async function deflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function build(chosen, say, preview, panel) {
    const made = chosen.plan;
    const video = chosen.details.video;

    const canvas = document.createElement("canvas");
    canvas.width = made.width;
    canvas.height = made.height;
    const ctx = canvas.getContext("2d");

    preview.width = made.width;
    preview.height = made.height;
    const previewCtx = preview.getContext("2d");

    const frames = [];
    for (let index = 0; index < made.count; index += 1) {
      await seek(video, made.timestamps[index]);
      ctx.drawImage(video, 0, 0, made.width, made.height);
      const blob = await toJpeg(canvas, made.quality);
      frames.push(new Uint8Array(await blob.arrayBuffer()));

      // Every tenth frame, so the preview is a picture of the work rather than
      // a slideshow that costs more than the work.
      if (index % 10 === 0 || index === made.count - 1) {
        previewCtx.drawImage(canvas, 0, 0, made.width, made.height);
        say("Taking frames… " + (index + 1) + " of " + made.count);
      }
    }

    URL.revokeObjectURL(chosen.details.url);

    say("Building the folder…");

    // The site itself, as the server renders it, with the frame pattern pointed
    // at the folder. Fetched rather than rebuilt here: the page a customer
    // downloads must be the page the server would publish, and a second
    // renderer written in this file is how those two drift apart.
    const siteUrl = panel.getAttribute("data-site-export");
    const response = await fetch(siteUrl + "?frames=" + made.count + "&width=" + made.width + "&height=" + made.height, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) throw new Error("the site could not be read back from the server");
    const built = await response.json();
    if (!built || !built.ok) throw new Error(built && built.detail ? built.detail : "the site could not be prepared");

    const entries = [];
    const push = async function (name, raw) {
      entries.push({ name: name, raw: raw, deflated: await deflate(raw) });
    };

    const encoder = new TextEncoder();
    for (const file of built.files) await push(file.name, encoder.encode(file.contents));
    for (let index = 0; index < frames.length; index += 1) {
      await push(plan.frameName(index + 1), frames[index]);
      if (index % 25 === 0) say("Packing… " + (index + 1) + " of " + frames.length);
    }

    const zip = zipCore.assemble(entries);
    const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = built.filename || "scroll-site.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoked on a delay: revoking immediately after click() cancels the
    // download in some browsers, which looks exactly like the build failing.
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);

    say(
      "Done — " + frames.length + " frames, " + plan.describeSize(zip.length) + ". "
      + "It is in your downloads. Unzip it and put the folder on any host; nothing else is needed."
    );
  }
})();
