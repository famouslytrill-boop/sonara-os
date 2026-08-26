"use strict";

// The Whisper adapter, and the three ways a transcription feature lies.
//
// It reports a transcript nobody produced; it forwards a request it should have
// refused; or it fails for a reason it does not say, leaving somebody to guess
// at a flag on a process they did not know existed.

const assert = require("node:assert/strict");
const base = require("../lib/sonara-service-adapter.cjs");
const whisper = require("../lib/sonara-whisper-adapter.cjs");

// Readiness reads process.env, the same as every other adapter, so the tests
// set it and put it back rather than passing a pretend environment in.
const saved = {};
function setEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in saved)) saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const key of Object.keys(saved)) delete saved[key];
}

function configured(overrides = {}) {
  setEnv({ SONARA_WHISPER_ENABLED: "true", SONARA_WHISPER_URL: "http://whisper.internal:8080" });
  return whisper.getWhisperReadiness(overrides);
}

function turnedOff() {
  setEnv({ SONARA_WHISPER_ENABLED: undefined, SONARA_WHISPER_URL: undefined });
  return whisper.getWhisperReadiness();
}

/** A download of `bytes` with whatever headers the test wants. */
function downloadOf(bytes, headers = {}) {
  const map = new Map(Object.entries({ "content-type": "audio/wav", ...headers }));
  const buffer = Buffer.from(bytes);
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => map.get(String(name).toLowerCase()) ?? null },
    // Sliced from byteOffset, not from 0. Node pools small Buffers, so
    // `Buffer.from(x).buffer` is the whole pool and starting at 0 hands back
    // somebody else's bytes -- which is how the first version of this helper
    // produced a request with no audio in it and a passing-looking adapter.
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length)
  };
}

/** A whisper-server that answers with whatever the test wants, recording the call. */
function serverThatSays(payload, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return downloadOf(Buffer.from("RIFF....WAVEfmt "));
    return {
      ok,
      status,
      headers: { get: () => null },
      json: async () => payload
    };
  };
  return { fetchImpl, calls };
}

describe("the Whisper adapter", () => {
  afterEach(restoreEnv);

  describe("is off until somebody turns it on", () => {
    it("reports setup-required rather than failing", () => {
      const readiness = turnedOff();
      assert.equal(readiness.enabled, false);
      assert.match(readiness.detail, /off/i);
    });

    it("says the thing that will otherwise be discovered at 2am", () => {
      // whisper-server takes WAV unless started with --convert. That is a flag
      // on somebody else's process, so it belongs where they can read it.
      assert.match(turnedOff().note, /--convert/);
    });

    it("does not transcribe when it is off", async () => {
      const answer = await whisper.transcribe("https://example.com/a.wav", {
        readiness: turnedOff(),
        fetchImpl: async () => downloadOf(Buffer.from("RIFF"))
      });
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "disabled");
    });
  });

  describe("refuses a target it should not fetch", () => {
    // This server fetches a URL somebody typed, which makes it a request
    // forwarder with its own network position behind it if nothing checks.
    const refused = [
      ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
      ["loopback", "http://127.0.0.1:8080/audio.wav"],
      ["localhost by name", "http://localhost/audio.wav"],
      ["a private range", "http://10.1.2.3/audio.wav"],
      ["another private range", "http://192.168.0.5/audio.wav"],
      ["the third private range", "http://172.20.0.1/audio.wav"],
      ["IPv6 loopback", "http://[::1]/audio.wav"],
      ["a file path", "file:///etc/passwd"],
      ["credentials in the URL", "https://user:secret@example.com/a.wav"],
      ["not a URL at all", "not a url"]
    ];

    for (const [what, target] of refused) {
      it(`refuses ${what}`, async () => {
        let fetched = false;
        const answer = await whisper.transcribe(target, {
          readiness: configured(),
          fetchImpl: async () => {
            fetched = true;
            return downloadOf(Buffer.from("RIFF"));
          }
        });
        assert.equal(answer.ok, false, what);
        assert.equal(answer.code, "refused_target", what);
        assert.equal(fetched, false, "it must refuse before it fetches, not after");
      });
    }

    it("uses the same check as the crawler, rather than a second copy of it", () => {
      // Two copies of a security check drift, and only one gets the next fix.
      const crawl = require("../lib/sonara-crawl4ai-adapter.cjs");
      assert.equal(crawl.reasonNotCrawlable, base.reasonNotFetchable);
    });
  });

  describe("bounds what it will download", () => {
    it("refuses a file whose declared size is over the limit, without reading it", async () => {
      let read = false;
      const answer = await whisper.collectAudio("https://example.com/big.wav", {
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          headers: { get: (n) => (n === "content-length" ? String(whisper.MAX_AUDIO_BYTES + 1) : "audio/wav") },
          arrayBuffer: async () => {
            read = true;
            return Buffer.alloc(0).buffer;
          }
        })
      });
      assert.equal(answer.code, "too_large");
      assert.equal(read, false);
    });

    it("refuses a file that lied about its size", async () => {
      // content-length is a claim, not a measurement.
      const answer = await whisper.collectAudio("https://example.com/liar.wav", {
        maxBytes: 32,
        fetchImpl: async () => downloadOf(Buffer.alloc(100, 1), { "content-length": "8" })
      });
      assert.equal(answer.code, "too_large");
      assert.match(answer.detail, /100 bytes/);
    });

    it("refuses an address that returns nothing", async () => {
      const answer = await whisper.collectAudio("https://example.com/none.wav", {
        fetchImpl: async () => downloadOf(Buffer.alloc(0))
      });
      assert.equal(answer.code, "empty_file");
    });

    it("never passes a fetch error message through, because it carries the URL", async () => {
      const answer = await whisper.collectAudio("https://example.com/a.wav", {
        fetchImpl: async () => {
          throw new Error("getaddrinfo ENOTFOUND whisper-secret-host.internal");
        }
      });
      assert.equal(answer.ok, false);
      assert.doesNotMatch(answer.detail, /whisper-secret-host/);
    });
  });

  describe("what it puts on the wire", () => {
    it("posts the audio as multipart to /inference", async () => {
      const { fetchImpl, calls } = serverThatSays({ text: "hello there" });
      const answer = await whisper.transcribe("https://example.com/a.wav", { readiness: configured(), fetchImpl });
      assert.equal(answer.ok, true);
      assert.equal(answer.text, "hello there");

      const posted = calls[1];
      assert.match(posted.url, /\/inference$/);
      assert.match(posted.options.headers["Content-Type"], /^multipart\/form-data; boundary=----sonara[0-9a-f]{32}$/);
      const body = posted.options.body.toString("latin1");
      assert.match(body, /name="file"; filename="audio\.wav"/);
      assert.match(body, /name="response_format"\r\n\r\njson/);
      assert.ok(body.includes("RIFF"), "the audio bytes have to actually be in there");
    });

    it("gives every request its own boundary", () => {
      // A fixed boundary appearing inside an uploaded file would split the body
      // in the wrong place, and audio can contain any byte sequence.
      const first = base.multipartBody({ a: "1" }).boundary;
      const second = base.multipartBody({ a: "1" }).boundary;
      assert.notEqual(first, second);
    });

    it("carries binary through unchanged", () => {
      const bytes = Buffer.from([0, 255, 13, 10, 45, 45, 200]);
      const { body } = base.multipartBody({ file: { filename: "x.wav", contentType: "audio/wav", bytes } });
      assert.ok(body.includes(bytes), "the bytes must survive being framed");
    });
  });

  describe("what it says came back", () => {
    it("refuses to call an empty transcript a success", async () => {
      // Somebody shown "here is your transcript" and no words cannot tell
      // whether the recording was silent or the service was misconfigured.
      const { fetchImpl } = serverThatSays({ text: "   " });
      const answer = await whisper.transcribe("https://example.com/a.wav", { readiness: configured(), fetchImpl });
      assert.equal(answer.ok, false);
      assert.equal(answer.code, "empty_response");
    });

    it("reads segments whichever way the server names them", async () => {
      const { fetchImpl } = serverThatSays({
        text: "one two",
        segments: [{ start: 0, end: 1, text: " one " }, { t0: 1, t1: 2, text: "two" }, { text: "  " }]
      });
      const answer = await whisper.transcribe("https://example.com/a.wav", { readiness: configured(), fetchImpl });
      assert.deepEqual(answer.segments, [
        { start: 0, end: 1, text: "one" },
        { start: 1, end: 2, text: "two" }
      ]);
    });

    it("says when the file was not WAV and the server had to convert it", async () => {
      const calls = [];
      const fetchImpl = async (url) => {
        calls.push(url);
        if (calls.length === 1) return downloadOf(Buffer.from("ID3mp3"), { "content-type": "audio/mpeg" });
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ text: "words" }) };
      };
      const answer = await whisper.transcribe("https://example.com/a.mp3", { readiness: configured(), fetchImpl });
      assert.equal(answer.ok, true);
      assert.equal(answer.converted, true, "'it worked' and 'it worked because ffmpeg was there' are different facts");
    });

    it("names the missing flag when a non-WAV file is rejected by the server", async () => {
      const calls = [];
      const fetchImpl = async () => {
        calls.push(1);
        if (calls.length === 1) return downloadOf(Buffer.from("ID3mp3"), { "content-type": "audio/mpeg" });
        return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      };
      const answer = await whisper.transcribe("https://example.com/a.mp3", { readiness: configured(), fetchImpl });
      assert.equal(answer.code, "needs_conversion");
      assert.match(answer.detail, /--convert/);
      assert.match(answer.detail, /audio\/mpeg/);
    });

    it("does not blame conversion for a WAV file the server rejected", async () => {
      // The guess is only allowed where it is the likely cause. A WAV that
      // fails is a real failure and must be reported as one.
      const calls = [];
      const fetchImpl = async () => {
        calls.push(1);
        if (calls.length === 1) return downloadOf(Buffer.from("RIFF"));
        return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      };
      const answer = await whisper.transcribe("https://example.com/a.wav", { readiness: configured(), fetchImpl });
      assert.equal(answer.code, "unreachable");
    });
  });
});
