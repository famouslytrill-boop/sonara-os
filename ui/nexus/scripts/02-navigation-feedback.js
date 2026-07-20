  }

  function prepareNavigation() {
    const path = location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll(".sonara-site-header a[href]").forEach((link) => {
      const url = new URL(link.href, location.href);
      const linkPath = url.pathname.replace(/\/$/, "") || "/";
      if (linkPath === path || (linkPath !== "/" && path.startsWith(`${linkPath}/`))) link.setAttribute("aria-current", "page");
    });
    document.querySelectorAll(".sonara-mobile-menu nav a").forEach((link) => link.addEventListener("click", () => link.closest("details")?.removeAttribute("open")));
  }

  function prepareRouteTransitions() {
    const progress = document.querySelector(".nexus-route-progress");
    document.addEventListener("click", (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.hash || anchor.target || anchor.hasAttribute("download")) return;
      if (preferences.motion === "off" || reducedMotion || "startViewTransition" in document) return;
      event.preventDefault();
      progress?.classList.add("is-active");
      document.body.classList.add("nexus-leaving");
      setTimeout(() => { location.href = url.href; }, 150);
    });
    window.addEventListener("pageshow", () => {
      progress?.classList.remove("is-active");
      progress?.classList.add("is-complete");
      setTimeout(() => progress?.classList.remove("is-complete"), 320);
      document.body.classList.remove("nexus-leaving");
    });
  }

  function createAudioContext() {
    if (audioContext) return audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
    return audioContext;
  }

  function playTone(kind = "tap") {
    if (preferences.sound !== "on") return;
    const context = createAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "success" ? .055 : .032, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === "success" ? .24 : .12));
    gain.connect(context.destination);
    const frequencies = kind === "success" ? [440, 660] : kind === "open" ? [320, 480] : [420];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + index * .04);
      oscillator.connect(gain);
      oscillator.start(now + index * .04);
      oscillator.stop(now + (kind === "success" ? .26 : .14));
    });
  }

  function vibrate(pattern = 8) {
    if (preferences.haptics !== "on" || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch {}
  }

  function prepareTactileFeedback() {
    document.addEventListener("pointerdown", (event) => {
      const control = event.target.closest?.("a, button, summary");
      if (!control) return;
      control.classList.add("nexus-press");
      vibrate(7);
      playTone(control.matches("[data-nexus-command], [data-nexus-settings], summary") ? "open" : "tap");
    });
    document.addEventListener("pointerup", () => document.querySelectorAll(".nexus-press").forEach((element) => element.classList.remove("nexus-press")));
    document.addEventListener("pointercancel", () => document.querySelectorAll(".nexus-press").forEach((element) => element.classList.remove("nexus-press")));
    document.addEventListener("submit", () => { vibrate([8, 35, 12]); playTone("success"); });
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.classList.add("nexus-no-scroll");
    playTone("open");
    vibrate(10);
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    document.body.classList.remove("nexus-no-scroll");
  }

  function prepareDialogs() {
    const commandDialog = document.querySelector("#nexus-command-dialog");
    const settingsDialog = document.querySelector("#nexus-settings-dialog");
    const commandInput = commandDialog?.querySelector("input[type=search]");
    const commandList = commandDialog?.querySelector(".nexus-command-list");

    commandItems = [...document.querySelectorAll(".sonara-desktop-nav a[href]")].map((link, index) => ({
      href: link.getAttribute("href"),
      label: link.textContent.trim(),
