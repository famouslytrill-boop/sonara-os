/* global document, customElements */

// Experimental presentation-only adapter.
//
// Nothing in this module is imported by SONARA's production runtime. The
// upstream viewer is fetched only after a person explicitly enables the demo.
// Version and Three.js peer dependency are pinned so this experiment cannot
// silently drift to a new SDK release.

export const THREE_WS_PRESENTATION_VERSION = "0.2.3";
export const THREE_JS_PEER_VERSION = "0.180.0";
export const PINNED_THREE_WS_MODULE_URL =
  "https://esm.sh/@three-ws/avatar@0.2.3?bundle&deps=three@0.180.0";

const VIEWER_TAG = "three-ws-viewer";

export function createThreeWsPresentationAdapter({ target, statusTarget, moduleUrl = PINNED_THREE_WS_MODULE_URL } = {}) {
  if (!target || typeof target.replaceChildren !== "function") {
    throw new TypeError("A DOM target is required for the three.ws presentation prototype.");
  }

  let viewer = null;
  let mounted = false;

  return Object.freeze({
    get mounted() {
      return mounted;
    },

    async mount({ modelUrl, alt = "Experimental SONARA 3D presentation" } = {}) {
      const safeModelUrl = validateModelUrl(modelUrl);
      setStatus(statusTarget, "Loading the optional 3D presentation layer…", "loading");

      try {
        await import(moduleUrl);
        if (!customElements.get(VIEWER_TAG)) {
          throw new Error("The pinned three.ws module did not register the expected viewer element.");
        }

        viewer = document.createElement(VIEWER_TAG);
        viewer.setAttribute("src", safeModelUrl);
        viewer.setAttribute("alt", alt);
        viewer.setAttribute("background", "transparent");
        viewer.setAttribute("aria-label", alt);
        viewer.setAttribute("data-sonara-presentation-only", "true");

        // Viewer-only: no brain, model provider, memory, wallet, tools, or
        // agent authority is connected by this prototype.
        target.replaceChildren(viewer);
        mounted = true;
        setStatus(statusTarget, "3D presentation enabled. Core SONARA remains independent.", "ready");
        return viewer;
      } catch (error) {
        mounted = false;
        viewer = null;
        target.replaceChildren(createFallback(error));
        setStatus(statusTarget, "3D presentation unavailable; fallback remains active.", "fallback");
        throw error;
      }
    },

    unmount() {
      mounted = false;
      viewer = null;
      target.replaceChildren(createFallback());
      setStatus(statusTarget, "3D presentation disabled.", "disabled");
    }
  });
}

export function validateModelUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new TypeError("Enter a valid HTTPS URL for a GLB/glTF asset you own or are licensed to use.");
  }

  if (parsed.protocol !== "https:") {
    throw new TypeError("The experimental viewer accepts HTTPS model URLs only.");
  }

  if (parsed.username || parsed.password) {
    throw new TypeError("Model URLs must not contain embedded credentials.");
  }

  const lowerPath = parsed.pathname.toLowerCase();
  if (!lowerPath.endsWith(".glb") && !lowerPath.endsWith(".gltf")) {
    throw new TypeError("Use a direct .glb or .gltf model URL for this prototype.");
  }

  return parsed.toString();
}

function createFallback(error) {
  const fallback = document.createElement("div");
  fallback.className = "viewer-fallback";
  fallback.setAttribute("role", "status");
  fallback.textContent = error
    ? "The optional 3D layer could not load. SONARA's normal text and voice experience is unaffected."
    : "3D presentation is off. SONARA's normal text and voice experience remains available.";
  return fallback;
}

function setStatus(target, message, state) {
  if (!target) return;
  target.textContent = message;
  target.dataset.state = state;
}
