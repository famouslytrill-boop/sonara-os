import { createElement, createMetric } from "../../dom.ts";
import { growthState } from "../../growthState.ts";

export function renderSubmissionsPage() {
  const page = createElement("section", { className: "work-screen" });
  const submission = growthState.submissionPackage;

  page.append(
    createElement("h1", { textContent: "A&R Submission" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Assemble a private submission package for executive evaluation."
    }),
    createMetric("Bio", submission.bio),
    createMetric("EPK", submission.epk),
    createMetric("Private Links", submission.privateLink),
    createMetric("Pitch Sheets", submission.pitchSheet)
  );

  return page;
}
