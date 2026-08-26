/* The ZIP container, assembled from entries somebody else compressed.
 *
 * This exists because the same archive has to be built in two places. The
 * server builds a scroll site's export with `node:zlib`; the browser builds one
 * from frames it just pulled out of a video, using `CompressionStream`. The
 * compressors are different and unavoidably so -- one is synchronous and
 * Node-only, the other is a stream and browser-only.
 *
 * What must NOT differ is the container: local headers, the central directory,
 * the end record, and the offsets tying them together. Two copies of that is
 * two chances to get a binary format subtly wrong in one of them, and the
 * symptom is an archive that looks fine, has a plausible size, and will not
 * open. So the layout lives here, once, and each side passes in bytes it has
 * already deflated.
 *
 * Loadable from both runtimes on purpose: `module.exports` for `lib/`, and
 * `window.SonaraZipCore` for the browser. `vercel.json` bundles `public/**`
 * alongside `lib/**`, so a lib module requiring this is present in production.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SonaraZipCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 1980-01-01, the earliest a DOS timestamp can express, and the same constant
  // on both sides. A real modification time makes the bytes differ on every
  // build: for the CLI that means CloudFormation reporting every function as
  // changed on every deploy, and for a site export it means a customer cannot
  // tell whether today's download differs from yesterday's.
  const DOS_TIME = 0;
  const DOS_DATE = 33;

  let table = null;
  function crcTable() {
    if (table) return table;
    table = new Int32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    return table;
  }

  function crc32(bytes) {
    const lookup = crcTable();
    let crc = -1;
    for (let i = 0; i < bytes.length; i += 1) crc = (crc >>> 8) ^ lookup[(crc ^ bytes[i]) & 0xff];
    return (crc ^ -1) >>> 0;
  }

  // Little-endian writes into a Uint8Array, so this file needs neither Buffer
  // nor DataView-per-field. Both runtimes have Uint8Array; only one has Buffer.
  function u16(target, offset, value) {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
  }

  function u32(target, offset, value) {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
    target[offset + 2] = (value >>> 16) & 0xff;
    target[offset + 3] = (value >>> 24) & 0xff;
  }

  function utf8(text) {
    return new TextEncoder().encode(String(text).replace(/\\/g, "/"));
  }

  function concat(parts) {
    let total = 0;
    for (const part of parts) total += part.length;
    const out = new Uint8Array(total);
    let at = 0;
    for (const part of parts) { out.set(part, at); at += part.length; }
    return out;
  }

  /**
   * Assemble the archive.
   *
   *   entries  [{ name, raw, deflated, executable? }]
   *
   * `raw` is the original bytes -- needed for the CRC and the uncompressed
   * size -- and `deflated` is what the caller's compressor produced. Both are
   * required: computing the CRC over the compressed bytes is the classic way to
   * produce an archive every unpacker rejects, and it is not obvious from
   * reading the result.
   */
  function assemble(entries) {
    const locals = [];
    const central = [];
    let offset = 0;

    for (const entry of entries) {
      const name = utf8(entry.name);
      const raw = entry.raw;
      const deflated = entry.deflated;
      if (!(raw instanceof Uint8Array) || !(deflated instanceof Uint8Array)) {
        throw new TypeError(`zip entry "${entry.name}" needs both raw and deflated bytes`);
      }
      const crc = crc32(raw);

      const local = new Uint8Array(30);
      u32(local, 0, 0x04034b50);
      u16(local, 4, 20);          // version needed
      u16(local, 6, 0);           // flags
      u16(local, 8, 8);           // deflate
      u16(local, 10, DOS_TIME);
      u16(local, 12, DOS_DATE);
      u32(local, 14, crc);
      u32(local, 18, deflated.length);
      u32(local, 22, raw.length);
      u16(local, 26, name.length);
      u16(local, 28, 0);
      locals.push(local, name, deflated);

      const header = new Uint8Array(46);
      u32(header, 0, 0x02014b50);
      u16(header, 4, 0x031e);     // made by: unix, zip 3.0
      u16(header, 6, 20);
      u16(header, 8, 0);
      u16(header, 10, 8);
      u16(header, 12, DOS_TIME);
      u16(header, 14, DOS_DATE);
      u32(header, 16, crc);
      u32(header, 20, deflated.length);
      u32(header, 24, raw.length);
      u16(header, 28, name.length);
      u16(header, 30, 0);         // extra
      u16(header, 32, 0);         // comment
      u16(header, 34, 0);         // disk
      u16(header, 36, 0);         // internal attrs
      // Unix mode in the high 16 bits. `>>> 0` is load-bearing: JavaScript's
      // bitwise operators work on signed 32-bit integers, so 0o100644 << 16
      // overflows negative and the write is refused.
      u32(header, 38, ((entry.executable ? 0o100755 : 0o100644) << 16) >>> 0);
      u32(header, 42, offset);
      central.push(header, name);

      offset += local.length + name.length + deflated.length;
    }

    const directory = concat(central);
    const end = new Uint8Array(22);
    u32(end, 0, 0x06054b50);
    u16(end, 4, 0);
    u16(end, 6, 0);
    u16(end, 8, entries.length);
    u16(end, 10, entries.length);
    u32(end, 12, directory.length);
    u32(end, 16, offset);
    u16(end, 20, 0);

    return concat([...locals, directory, end]);
  }

  return { assemble, crc32, DOS_TIME, DOS_DATE };
});
