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
  let original = null, url = null, width = 0, height = 0, version = 0;
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
    url = null;
    download.hidden = true;
    download.removeAttribute("href");
  }
  file.addEventListener("change", async () => {
    const revision = ++version;
    original = null; run.disabled = true; clearDownload();
    canvas.width = canvas.height = 1;
    const selected = file.files[0];
    if (!selected) { status.textContent = "Choose an image to begin."; return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type) || selected.size > 20 * 1024 * 1024) {
      status.textContent = "Choose a PNG, JPEG or WebP image up to 20 MB."; return;
    }
    let bitmap;
    try {
      bitmap = await createImageBitmap(selected);
      if (revision !== version) return;
      if (bitmap.width * bitmap.height > 4194304 || bitmap.width > 4096 || bitmap.height > 4096) {
        status.textContent = "Use an image up to 4 megapixels and 4096 pixels on each side."; return;
      }
      width = canvas.width = bitmap.width; height = canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0);
      original = context.getImageData(0, 0, width, height);
      run.disabled = false;
      status.textContent = `${width} × ${height} image ready. Processing stays on this device.`;
    } catch { if (revision === version) status.textContent = "This browser could not decode the image."; }
    finally { if (bitmap) bitmap.close(); }
  });

  gain.addEventListener("input", () => {
    clearDownload();
    if (original) status.textContent = "Brightness changed. Process the image to create a new download.";
  });

  async function gpu(bytes, percent) {
    if (!window.isSecureContext || !navigator.gpu) throw new Error("GPU unavailable");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("GPU unavailable");
    const device = await adapter.requestDevice();
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
      const pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module: device.createShaderModule({ code: shader }), entryPoint: "main" } });
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
    } finally { buffers.forEach((item) => item.destroy()); device.destroy(); }
  }
  async function cpu(bytes, percent) {
    const result = new Uint8ClampedArray(bytes.length);
    // Yield between chunks so mobile input and painting remain responsive.
    for (let start = 0; start < bytes.length; start += 262144) {
      const end = Math.min(bytes.length, start + 262144);
      for (let i = start; i < end; i += 4) {
        for (let channel = 0; channel < 3; channel++) result[i + channel] = Math.min(255, Math.floor((bytes[i + channel] * percent + 50) / 100));
        result[i + 3] = bytes[i + 3];
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return result;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const percent = Number(gain.value);
    if (!original || !Number.isInteger(percent) || percent < 0 || percent > 200) return;
    const revision = version, source = original;
    run.disabled = true; file.disabled = true; gain.disabled = true; clearDownload();
    status.textContent = "Processing on this device…";
    try {
      let pixels, engine = "WebGPU";
      try { pixels = await gpu(source.data, percent); }
      catch { engine = "CPU"; pixels = await cpu(source.data, percent); }
      if (revision !== version) return;
      canvas.getContext("2d").putImageData(new ImageData(pixels, width, height), 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Export unavailable");
      url = URL.createObjectURL(blob); download.href = url; download.download = "creator-local-image.png"; download.hidden = false;
      status.textContent = `Processed with ${engine}. Download your PNG. No image was uploaded or generation allowance used.`;
    } catch { status.textContent = "Processing failed. Your original image has not been changed."; }
    finally { run.disabled = !original; file.disabled = false; gain.disabled = false; }
  });
  window.addEventListener("pagehide", clearDownload);
}());
