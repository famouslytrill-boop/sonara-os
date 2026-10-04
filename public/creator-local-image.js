// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";
  const form = document.querySelector("[data-local-image]");
  if (!form) return;
  const file = form.querySelector("input[type=file]");
  const gain = form.querySelector("input[name=local_gain]");
  const canvas = form.querySelector("canvas");
  const status = form.querySelector("[role=status]");
  const download = form.querySelector("[data-local-download]");
  const run = form.querySelector("button[type=submit]");
  let original = null, url = null, width = 0, height = 0, version = 0, budget = null, active = null;
  const cancel = form.querySelector("[data-local-cancel]");
  const core = window.SonaraImageCore;
  const shader = `
    @group(0) @binding(0) var<storage, read> source: array<u32>;
    @group(0) @binding(1) var<storage, read_write> output: array<u32>;
    @group(0) @binding(2) var<uniform> gain: u32;
    fn scale(value: u32) -> u32 { return min(255u, (value * gain + 50u) / 100u); }
    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x >= arrayLength(&source)) { return; }
      let pixel = source[id.x];
      output[id.x] = scale(pixel & 255u) | (scale((pixel >> 8u) & 255u) << 8u)
        | (scale((pixel >> 16u) & 255u) << 16u) | (pixel & 0xff000000u);
    }`;

  function clearDownload() {
    if (url) URL.revokeObjectURL(url);
    url = null; download.hidden = true; download.removeAttribute("href");
  }
  async function loadImage(selected) {
    const revision = ++version;
    original = null; run.disabled = true; clearDownload(); file.required = true;
    canvas.width = canvas.height = 1;
    if (!selected) { status.textContent = "Choose an image to begin."; return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type) || selected.size > 20 * 1024 * 1024) {
      status.textContent = "Choose a PNG, JPEG or WebP image up to 20 MB."; return;
    }
    let bitmap;
    try {
      bitmap = await createImageBitmap(selected);
      if (revision !== version) return;
      budget = core.imageBudget({ width: bitmap.width, height: bitmap.height, inputBytes: selected.size, deviceMemory: navigator.deviceMemory });
      if (!budget.ok) {
        status.textContent = `Use an image up to ${budget.maxPixels === 4194304 ? "4" : "16"} megapixels and 8192 pixels per side. This device has a bounded processing budget.`; return;
      }
      width = canvas.width = bitmap.width; height = canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0); original = context.getImageData(0, 0, width, height);
      file.required = false; run.disabled = false;
      status.textContent = `${width} × ${height} image ready. Processing stays on this device.`;
    } catch { if (revision === version) status.textContent = "This browser could not decode the image."; }
    finally { if (bitmap) bitmap.close(); }
  }
  file.addEventListener("change", () => loadImage(file.files[0]));
  window.addEventListener("sonara-local-image", (event) => { if (!active) loadImage(event.detail); });
  gain.addEventListener("input", () => {
    clearDownload();
    if (original) status.textContent = "Brightness changed. Process the image to create a new download.";
  });

  async function gpu(bytes, percent, device, pipeline) {
    const buffers = [];
    try {
      device.pushErrorScope("validation");
      const pixels = new Uint32Array(bytes.length / 4);
      for (let i = 0; i < pixels.length; i++) {
        const at = i * 4;
        pixels[i] = bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24);
      }
      function buffer(size, usage) { const item = device.createBuffer({ size, usage }); buffers.push(item); return item; }
      const source = buffer(pixels.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      const output = buffer(pixels.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
      const settings = buffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
      const read = buffer(pixels.byteLength, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
      device.queue.writeBuffer(source, 0, pixels);
      device.queue.writeBuffer(settings, 0, new Uint32Array([percent, 0, 0, 0]));
      const bindings = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [source, output, settings].map((item, binding) => ({ binding, resource: { buffer: item } })) });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline); pass.setBindGroup(0, bindings); pass.dispatchWorkgroups(Math.ceil(pixels.length / 256)); pass.end();
      encoder.copyBufferToBuffer(output, 0, read, 0, pixels.byteLength);
      device.queue.submit([encoder.finish()]);
      const error = await device.popErrorScope();
      if (error) throw new Error("GPU validation failed");
      await read.mapAsync(GPUMapMode.READ);
      const packed = new Uint32Array(read.getMappedRange());
      const result = new Uint8ClampedArray(bytes.length);
      for (let i = 0; i < packed.length; i++) {
        const at = i * 4, pixel = packed[i];
        result[at] = pixel & 255; result[at + 1] = (pixel >>> 8) & 255;
        result[at + 2] = (pixel >>> 16) & 255; result[at + 3] = pixel >>> 24;
      }
      read.unmap(); return result;
    } finally { buffers.forEach((item) => item.destroy()); }
  }
  function cpuSession() {
    let worker = null, pending = null, nextId = 0;
    try { worker = new window.Worker("/creator-image-worker.js"); } catch { /* cooperative fallback */ }
    function close() {
      if (worker) worker.terminate(); worker = null;
      if (pending) { window.clearTimeout(pending.timer); pending.reject(new Error("Processing stopped")); pending = null; }
    }
    if (worker) {
      worker.onmessage = (event) => {
        if (!pending || event.data.id !== pending.id) return;
        const current = pending; pending = null; window.clearTimeout(current.timer);
        if (event.data.error) current.reject(new Error("Worker failed"));
        else current.resolve(new Uint8ClampedArray(event.data.pixels));
      };
      worker.onerror = close;
    }
    return {
      close,
      label: () => worker ? "CPU worker" : "CPU (cooperative fallback)",
      async run(bytes, percent) {
        if (!worker) return core.scalePixels(bytes, percent);
        try {
          return await new Promise((resolve, reject) => {
            const id = ++nextId, copy = bytes.slice();
            pending = { id, resolve, reject, timer: window.setTimeout(close, 10000) };
            worker.postMessage({ id, pixels: copy.buffer, percent }, [copy.buffer]);
          });
        } catch { close(); return core.scalePixels(bytes, percent); }
      }
    };
  }
  function stopProcessing() {
    version++; if (active) active.close(); clearDownload();
  }
  cancel.addEventListener("click", () => {
    stopProcessing(); status.textContent = "Processing cancelled. Your original image is available for another edit.";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const percent = Number(gain.value);
    if (active || !original || !Number.isInteger(percent) || percent < 0 || percent > 200) return;
    const revision = version, source = original;
    let device = null, pipeline = null, cpu = null, poll = null;
    const controller = new window.AbortController();
    const session = { close() { controller.abort(); window.clearInterval(poll); if (device) device.destroy(); if (cpu) cpu.close(); } };
    active = session;
    run.disabled = true; file.disabled = true; gain.disabled = true; cancel.hidden = false; clearDownload();
    status.textContent = "Checking device permissions…";
    try {
      await window.SonaraDeviceAccess.verify(["local_compute"], form.dataset.userId, controller.signal);
      if (revision !== version) return;
      let checking = false;
      poll = window.setInterval(async () => {
        if (checking || revision !== version) return;
        checking = true;
        try { await window.SonaraDeviceAccess.verify(["local_compute"], form.dataset.userId, controller.signal); }
        catch { if (revision === version) { stopProcessing(); status.textContent = "Processing stopped because device access could not be confirmed. Your original image is available."; } }
        finally { checking = false; }
      }, 5000);
      if (window.isSecureContext && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (revision !== version) return;
          if (adapter) {
            device = await adapter.requestDevice();
            if (revision !== version) return;
            pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module: device.createShaderModule({ code: shader }), entryPoint: "main" } });
          }
        } catch { if (device) device.destroy(); device = null; }
      }
      cpu = cpuSession();
      const engines = new Set();
      for (let y = 0; y < height; y += budget.tileRows) {
        if (revision !== version) return;
        const rows = Math.min(budget.tileRows, height - y);
        const bytes = source.data.subarray(y * width * 4, (y + rows) * width * 4);
        let pixels;
        if (device) {
          try { pixels = await gpu(bytes, percent, device, pipeline); engines.add("WebGPU"); }
          catch { device.destroy(); device = null; }
        }
        if (!pixels) { pixels = await cpu.run(bytes, percent); engines.add(cpu.label()); }
        if (revision !== version) return;
        canvas.getContext("2d").putImageData(new ImageData(pixels, width, rows), 0, y);
        status.textContent = `Processing on this device: ${Math.round((y + rows) / height * 100)}%.`;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (revision !== version) return;
      if (!blob) throw new Error("Export unavailable");
      url = URL.createObjectURL(blob); download.href = url; download.download = "creator-local-image.png"; download.hidden = false;
      status.textContent = `Processed ${width} × ${height} pixels with ${[...engines].join(" + ")}. Download your PNG. No image was uploaded or generation allowance used.`;
    } catch (error) {
      if (revision === version) status.textContent = `${error.message} Your original image has not been changed.`;
    } finally {
      session.close(); active = null;
      if (download.hidden && original) canvas.getContext("2d").putImageData(original, 0, 0);
      run.disabled = !original; file.disabled = false; gain.disabled = false; cancel.hidden = true;
    }
  });
  window.addEventListener("pagehide", stopProcessing);
}());
