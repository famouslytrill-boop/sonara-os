# A submitted link directory, and the one usable thing in it — 18 August 2026

Checked: 2026-08-18
Review by: 2027-02-18

A saved MHTML archive of `learn-code-tiles.lovable.app` was submitted with the
instruction to use its information in the product and in the Claude setup. This
records what it turned out to be, so nobody re-opens the question.

## What it is

The archive is 125 KB and its **entire visible text is 1,746 characters**: a
heading, fourteen resource tiles — each a title, a category and a one-line
description — and a footer reading `© 2026 The Code Newsletter`.

There is no code, no data, no specification, no attachment. Every tile is an
outbound link to a separate hosted site: eleven on `lovable.app`, one on
Netlify, one on Vercel, one other. **None of the fourteen is a repository**, so
none is something the open-source register can assess for a licence; they are
hosted products carrying their own terms.

It is registered in `data/open-source-tools.ts` as **blocked**, on the same
reading applied to the IONOS guide: a document that is free to view and carries
an explicit copyright notice has granted nothing. Free is a price, not a licence.

## The one thing that can honestly be taken

A count is a fact. Somebody's sentences are not.

**Eight of the fourteen resources are about Claude Code, the Claude Agent SDK, or
building AI agents.** Two more are about coding agents and agent orchestration
under different names. That is a dated, checkable observation about where a
developer newsletter believes its subscribers' attention is in August 2026 — and
it is consistent with what this repository has been doing rather than a reason to
change course.

## Where the named subjects already exist here

The topics a page names are not ownable, and mapping them against what is already
built is more useful than the page is. Of the recurring subjects across those
fourteen tiles:

| Subject named | What this repository already has |
| --- | --- |
| Orchestrating agents | `lib/sonara-agent-runner.cjs` — the one path that classifies, decides, runs and records |
| Agent approval and control | `lib/sonara-agent-authority.cjs`, seven owner-approval categories enforced on every release |
| Agents running unattended | `/api/agents/schedule/tick`, an hourly secret-gated cron over `agent_schedules` |
| Re-running work after approval | `lib/sonara-agent-queue.cjs`, which re-asks the gate rather than bypassing it |
| Code review tooling | `pnpm run verify:launch`, 23 commands, plus a suite that must fail on bad input before it is trusted |

Nothing on that list came from this document, and the table exists to say so
plainly: **the subjects are current, and the work is already here.**

## What was deliberately not done

- No wording, category or description copied into the product or its docs.
- None of the fourteen destinations fetched to extract its content. Reading
  somebody's guide in order to lift it is the thing the register exists to
  refuse, and a page being publicly reachable is not a grant.
- No resource list republished in the product. If a curated list is ever wanted
  for customers, it has to be written here and linked with permission, not
  inherited from a page that reserved its rights.
