import { createElement } from "./dom.ts";

export type SignalOrbModel = Readonly<{
  title: string;
  status: string;
  bands: readonly string[];
}>;

export function createSignalOrbModel(): SignalOrbModel {
  return Object.freeze({
    title: "Signal OS",
    status: "Creative operating system active",
    bands: Object.freeze(["Create", "Optimize", "Release", "Scale"])
  });
}

export function renderSignalOrb(model: SignalOrbModel = createSignalOrbModel()) {
  const shell = createElement("div", { className: "signal-orb-shell" });
  const orb = createElement("div", { className: "signal-orb" });
  const copy = createElement("div", { className: "signal-orb-copy" });
  copy.append(
    createElement("span", { className: "signal-orb-kicker", textContent: model.status }),
    createElement("strong", { textContent: model.title }),
    createElement("p", { textContent: model.bands.join(" / ") })
  );
  shell.append(orb, copy);
  return shell;
}
