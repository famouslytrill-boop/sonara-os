// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";
  const panel = document.querySelector("[data-local-capture]");
  if (!panel) return;
  const camera = panel.querySelector("[data-start-camera]");
  const voice = panel.querySelector("[data-start-voice]");
  const stop = panel.querySelector("[data-stop-capture]");
  const photo = panel.querySelector("[data-take-photo]");
  const video = panel.querySelector("video");
  const audio = panel.querySelector("audio");
  const status = panel.querySelector("[role=status]");
  const download = panel.querySelector("[data-capture-download]");
  let sequence = 0, stream = null, recorder = null, timer = null, poll = null, url = null, controller = null;

  function clearOutput() {
    if (url) URL.revokeObjectURL(url);
    url = null; download.hidden = true; download.removeAttribute("href");
    audio.pause(); audio.removeAttribute("src"); audio.hidden = true;
  }
  function release() {
    window.clearTimeout(timer); window.clearInterval(poll); timer = poll = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null; video.srcObject = null; video.hidden = true;
    camera.disabled = voice.disabled = false; stop.disabled = true; photo.hidden = true;
  }
  function abort(message, keepOutput = false) {
    sequence++;
    controller?.abort(); controller = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorder = null; release(); if (!keepOutput) clearOutput();
    if (message) status.textContent = message;
  }
  function output(blob, name) {
    clearOutput(); url = URL.createObjectURL(blob);
    download.href = url; download.download = name; download.hidden = false;
  }
  async function start(kind) {
    abort();
    controller = new window.AbortController();
    const revision = sequence, keys = [kind === "camera" ? "camera" : "microphone"];
    camera.disabled = voice.disabled = true; stop.disabled = false;
    status.textContent = "Checking device permissions…";
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Capture is unavailable in this browser. You can still open your own files.");
      if (kind === "voice" && typeof MediaRecorder === "undefined") throw new Error("Voice recording is unavailable in this browser.");
      await window.SonaraDeviceAccess.verify(keys, panel.dataset.userId, controller.signal);
      if (revision !== sequence || document.hidden) return;
      const captured = await navigator.mediaDevices.getUserMedia(kind === "camera"
        ? { audio: false, video: { width: { ideal: 1920, max: 4096 }, height: { ideal: 1080, max: 4096 }, facingMode: "environment" } }
        : { audio: true, video: false });
      if (revision !== sequence || document.hidden) { captured.getTracks().forEach((track) => track.stop()); return; }
      // The account decision can change while a browser prompt remains open.
      try { await window.SonaraDeviceAccess.verify(keys, panel.dataset.userId, controller.signal); }
      catch (error) { captured.getTracks().forEach((track) => track.stop()); throw error; }
      if (revision !== sequence || document.hidden) { captured.getTracks().forEach((track) => track.stop()); return; }
      stream = captured;
      stream.getTracks().forEach((track) => track.addEventListener("ended", () => { if (revision === sequence) abort("Capture ended. Nothing is being recorded."); }, { once: true }));
      let checking = false;
      poll = window.setInterval(async () => {
        if (checking || revision !== sequence) return;
        checking = true;
        try { await window.SonaraDeviceAccess.verify(keys, panel.dataset.userId); }
        catch { if (revision === sequence) abort("Capture stopped because account access or device permissions could not be confirmed."); }
        finally { checking = false; }
      }, 5000);
      timer = window.setTimeout(() => stop.click(), 60000);
      if (kind === "camera") {
        video.srcObject = stream; video.hidden = false;
        await video.play();
        if (revision !== sequence) return;
        photo.hidden = false;
        status.textContent = "Camera preview is on. It stops after 60 seconds. Take a photo or stop when finished.";
      } else {
        const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((value) => MediaRecorder.isTypeSupported(value));
        const recording = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        recorder = recording;
        let chunks = [], bytes = 0;
        recording.ondataavailable = (event) => {
          if (revision !== sequence) return;
          bytes += event.data.size;
          if (bytes > 8 * 1024 * 1024) { chunks = []; abort("Recording exceeded 8 MB and was discarded. Try a shorter recording."); return; }
          if (event.data.size) chunks.push(event.data);
        };
        recording.onerror = () => { if (revision === sequence) abort("Recording failed. Nothing was uploaded."); };
        recording.onstop = () => {
          if (revision !== sequence) return;
          recorder = null; release();
          const mime = recording.mimeType || type || "audio/webm";
          if (!bytes) { status.textContent = "No recorded audio was available."; return; }
          output(new Blob(chunks, { type: mime }), `creator-voice.${mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm"}`);
          chunks = []; audio.src = url; audio.hidden = false;
          status.textContent = "Voice recording is ready to play or download. Nothing was uploaded or published.";
        };
        recording.start(500);
        status.textContent = "Recording your microphone locally. Stop to keep a download. Limit: 60 seconds and 8 MB.";
      }
    } catch (error) {
      if (revision === sequence) abort(error.name === "NotAllowedError" ? "Your browser refused capture. You can still open your own files." : error.message);
    }
  }
  camera.addEventListener("click", () => start("camera"));
  voice.addEventListener("click", () => start("voice"));
  stop.addEventListener("click", () => {
    if (recorder?.state === "recording") {
      // MediaRecorder.stop() queues the final dataavailable event *before*
      // onstop. Releasing the microphone tracks here can cause Firefox to
      // produce an empty final blob. The onstop handler releases the stream
      // after the last chunk has arrived; abort() still stops immediately.
      stop.disabled = true;
      status.textContent = "Finishing your recording on this device…";
      try { recorder.stop(); }
      catch { abort("Recording could not be finalized. Nothing was uploaded."); }
    } else if (recorder) {
      // While an asynchronous recorder stop is being finalized, do not
      // invalidate its revision or discard its pending final audio chunk.
      return;
    } else abort("Camera stopped. Any photo you took is still available to download.", true);
  });
  photo.addEventListener("click", async () => {
    const revision = sequence;
    photo.disabled = true;
    try {
      await window.SonaraDeviceAccess.verify(["camera", "local_compute"], panel.dataset.userId);
      if (revision !== sequence || !stream) return;
      const width = video.videoWidth, height = video.videoHeight;
      if (!width || !height || width * height > 16777216 || width > 4096 || height > 4096) throw new Error("The camera frame exceeds this device's capture budget.");
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(video, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      canvas.width = canvas.height = 1;
      if (revision !== sequence) return;
      if (!blob || blob.size > 20 * 1024 * 1024) throw new Error("The photo could not be exported within the 20 MB limit.");
      output(blob, "creator-camera-photo.png");
      window.dispatchEvent(new CustomEvent("sonara-local-image", { detail: blob }));
      status.textContent = "Photo ready to download or process below. The camera stays on until you stop it. Nothing was uploaded.";
    } catch (error) { if (revision === sequence) status.textContent = error.message; }
    finally { photo.disabled = false; }
  });
  window.addEventListener("pagehide", () => abort());
  document.addEventListener("visibilitychange", () => { if (document.hidden) abort("Capture stopped because this page is no longer visible."); });
}());
