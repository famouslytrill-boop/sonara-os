/* SONARA Sensory Device Client
 * Plain browser helper for sound cues, vibration, GPS, and motion/orientation checks.
 * It does not auto-start sensors. User action and permission are required.
 */
(function () {
  const SONARA = (window.SONARA = window.SONARA || {});

  function supports() {
    return {
      audio: typeof window.AudioContext !== "undefined" || typeof window.webkitAudioContext !== "undefined",
      vibration: typeof navigator !== "undefined" && typeof navigator.vibrate === "function",
      geolocation: typeof navigator !== "undefined" && !!navigator.geolocation,
      deviceMotion: typeof window !== "undefined" && "DeviceMotionEvent" in window,
      deviceOrientation: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
      permissions: typeof navigator !== "undefined" && !!navigator.permissions
    };
  }

  function vibrate(pattern) {
    const caps = supports();
    if (!caps.vibration) return { ok: false, reason: "unsupported" };
    try {
      navigator.vibrate(pattern || [35]);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: "failed", message: error.message };
    }
  }

  function stopVibration() {
    if (supports().vibration) navigator.vibrate(0);
  }

  function playTone(options) {
    const caps = supports();
    if (!caps.audio) return Promise.resolve({ ok: false, reason: "unsupported" });

    const opts = Object.assign({ frequency: 660, durationMs: 100, volume: 0.14, type: "sine" }, options || {});
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = opts.type;
    oscillator.frequency.value = opts.frequency;
    gain.gain.value = opts.volume;
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    return new Promise((resolve) => {
      setTimeout(() => {
        oscillator.stop();
        ctx.close().finally(() => resolve({ ok: true }));
      }, opts.durationMs);
    });
  }

  function getCurrentLocation(options) {
    const caps = supports();
    if (!caps.geolocation) return Promise.resolve({ ok: false, reason: "unsupported" });

    const opts = Object.assign(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      options || {}
    );

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            ok: true,
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              speed: position.coords.speed,
              heading: position.coords.heading
            },
            timestamp: position.timestamp
          });
        },
        (error) => resolve({ ok: false, reason: "permission_or_position_error", code: error.code, message: error.message }),
        opts
      );
    });
  }

  function watchLocation(onUpdate, onError, options) {
    const caps = supports();
    if (!caps.geolocation) return { ok: false, reason: "unsupported", stop: function () {} };

    const watchId = navigator.geolocation.watchPosition(
      function (position) {
        onUpdate &&
          onUpdate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp
          });
      },
      function (error) {
        onError && onError({ code: error.code, message: error.message });
      },
      Object.assign({ enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }, options || {})
    );

    return {
      ok: true,
      watchId,
      stop: function () {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }

  async function requestMotionPermission() {
    const caps = supports();
    if (!caps.deviceMotion && !caps.deviceOrientation) return { ok: false, reason: "unsupported" };

    try {
      if (window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission === "function") {
        const motion = await window.DeviceMotionEvent.requestPermission();
        if (motion !== "granted") return { ok: false, reason: "motion_denied" };
      }
      if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === "function") {
        const orientation = await window.DeviceOrientationEvent.requestPermission();
        if (orientation !== "granted") return { ok: false, reason: "orientation_denied" };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: "failed", message: error.message };
    }
  }

  function listenOrientation(onUpdate) {
    if (!supports().deviceOrientation) return { ok: false, reason: "unsupported", stop: function () {} };
    const handler = function (event) {
      onUpdate &&
        onUpdate({
          alpha: event.alpha,
          beta: event.beta,
          gamma: event.gamma,
          absolute: event.absolute,
          capturedAt: new Date().toISOString()
        });
    };
    window.addEventListener("deviceorientation", handler);
    return {
      ok: true,
      stop: function () {
        window.removeEventListener("deviceorientation", handler);
      }
    };
  }

  function listenMotion(onUpdate) {
    if (!supports().deviceMotion) return { ok: false, reason: "unsupported", stop: function () {} };
    const handler = function (event) {
      const acc = event.acceleration || {};
      const rotation = event.rotationRate || {};
      onUpdate &&
        onUpdate({
          accelerationX: acc.x,
          accelerationY: acc.y,
          accelerationZ: acc.z,
          rotationAlpha: rotation.alpha,
          rotationBeta: rotation.beta,
          rotationGamma: rotation.gamma,
          interval: event.interval,
          capturedAt: new Date().toISOString()
        });
    };
    window.addEventListener("devicemotion", handler);
    return {
      ok: true,
      stop: function () {
        window.removeEventListener("devicemotion", handler);
      }
    };
  }

  async function feedback(kind) {
    const map = {
      success: { frequency: 740, durationMs: 90, vibration: [25] },
      error: { frequency: 220, durationMs: 160, vibration: [60, 40, 60] },
      warning: { frequency: 420, durationMs: 120, vibration: [45, 30, 45] },
      tap: { frequency: 580, durationMs: 45, vibration: [15] },
      complete: { frequency: 880, durationMs: 120, vibration: [30, 30, 30] }
    };
    const cue = map[kind] || map.tap;
    vibrate(cue.vibration);
    return playTone({ frequency: cue.frequency, durationMs: cue.durationMs });
  }

  SONARA.sensoryDevice = {
    supports,
    vibrate,
    stopVibration,
    playTone,
    feedback,
    getCurrentLocation,
    watchLocation,
    requestMotionPermission,
    listenOrientation,
    listenMotion
  };
})();
