# Screenshot Tool Radar — 2026-09-20 — Batch 16

## Scope

This batch converts the owner's 20 September screenshot/resource intake into governed SONARA research records and application/infrastructure placement decisions.

The batch follows `.ai/shared/EXTERNAL_TOOL_RESEARCH_SKILL.md`: social posts and screenshots are discovery evidence, not execution authority. Exact upstream repository identity and the repository licence file were verified before a project was classified as a verified repository. Items whose submitted paths no longer resolve or whose exact upstream remains ambiguous stay outside the executable repository catalog.

**Third-party repositories installed or enabled by this batch: 0.**

The implementation intentionally separates:

- research/catalog inclusion;
- architecture lessons;
- optional developer or isolated-worker candidates;
- actual dependency installation;
- production activation.

Only the first two happen in this batch.

## Newly verified repositories

| Project | Repository | Licence posture | SONARA placement |
| --- | --- | --- | --- |
| drawDB | `drawdb-io/drawdb` | AGPL-3.0 | External/local schema-design reference; migrations/RLS remain authoritative |
| Agent Reach | `Panniantong/Agent-Reach` | MIT | Security-gated internet-tooling research; no anti-bot/access-control bypass |
| LobeHub | `lobehub/lobehub` | LobeHub Community License | Agent-operator UX/reference only; not plain Apache-2.0 |
| FastMCP | `PrefectHQ/fastmcp` | Apache-2.0 | Optional isolated Python MCP-worker candidate after comparison with the existing official MCP SDK lane |
| Jev Ultrafast | `browser-use/jev-ultrafast` | MIT | Isolated browser-worker benchmark with independent postcondition verification |
| ShareX | `ShareX/ShareX` | GPL-3.0 | Developer workstation capture/redaction/release-evidence reference |
| Munder Difflin | `chaitanyagiri/munder-difflin` | MIT source; bundled assets separately reviewed | Local multi-agent engineering-harness research |
| SearchPhone | `HackUnderway/SearchPhone` | MIT | Restricted privacy/security research only |
| VibeOS | `kaansenol5/VibeOS` | MIT | ARM64/embedded OS research only; upstream describes incomplete/untested areas |
| LiveCharts2 | `Live-Charts/LiveCharts2` | MIT | .NET visualization reference, not a new SONARA runtime |
| Cline | `cline/cline` | Apache-2.0 | Optional developer coding client; not merge/release authority |
| Spectacles Dimensional OS | `V4C38/spectacles-dimensional-os` | MIT | Simulator-first Physical AI/AR research only |
| OpenStock | `44510/OpenStock` | AGPL-3.0 | Market dashboard/provider architecture reference only |
| BitChord | `kushagrasinghx/BitChord` | GPL-3.0 | Creator Studio playback/library UX reference only |
| LLM Engineer Toolkit | `KalyanKS-NLP/llm-engineer-toolkit` | Apache-2.0 | Dependency-discovery catalog; linked projects keep their own licences |

## Important corrections from the screenshots

### LobeHub is not plain Apache-2.0

The screenshot badge suggested Apache-style licensing, but the repository's current `LICENSE` is the **LobeHub Community License**, based on Apache-2.0 with additional commercial and derivative-work conditions. SONARA therefore treats it as a high-risk licence-gated reference instead of a permissive dependency.

### SearchPhone is now resolved

Batch 15 deliberately left the screenshot unresolved. The 20 September verification pass established `HackUnderway/SearchPhone` as the upstream matching the submitted screenshot and confirmed its MIT licence. The technical identity is now verified, but the product decision remains restrictive: phone-linked OSINT is personal-data processing and is not exposed as an unrestricted customer capability.

### OpenStock source and licence are now resolved

The screenshot corresponds to `44510/OpenStock`, whose README identifies Open Dev Society and whose root licence is AGPL-3.0. Its market-data/provider/UI ideas can inform research; its source does not enter proprietary hosted SONARA code.

## Unresolved / non-repository references

The following remain outside the repository catalog:

- GitHub dot-key / `github.dev` browser editing — developer workflow, not a dependency.
- OSINTALL / Start.me — lead directory only; every individual tool needs its own identity/licence/privacy/security review.
- Claude Code for Beginners screenshot — submitted repository path did not resolve; no replacement was guessed.
- WA-AKG WhatsApp gateway screenshot — submitted repository path did not resolve; production messaging should prefer official/approved WhatsApp Business provider paths.
- `claude-mem` screenshot — exact authoritative upstream not established in this pass.
- Bubble GitHub profile screenshot — exact upstream not established; low-priority branding reference.
- Agent-assisted website-building workflow — useful process pattern, not a source-code dependency.
- Netlify drag-and-drop publishing — optional static export/prototype workflow, not SONARA production release authority.

Previously governed items such as Unsloth, Recordly, Concat, Grok Build, GitHub Codespaces, Higgsfield, the database taxonomy, HTTPS/TLS, Netflix-style control/data-plane separation, and HackProduct architecture diagrams are confirmed rather than duplicated.

## Architecture integrated

### 1. Tool gateways expose capability, not authority

MCP frameworks, browser agents, coding agents, and external connectors sit behind the same sequence:

`authenticate -> tenant/scope authorize -> schema validate -> policy/approval -> isolated execution -> verify postcondition -> audit`

Protocol compatibility never implies permission.

### 2. Developer agents are interchangeable clients

Cline, Codex, Grok Build, terminal agents, and future IDE clients can participate only through repository-native rules and deterministic verification. `AGENTS.md`, project memory, branch/PR rules, pnpm verification commands, and exact-head CI define the engineering contract.

### 3. Multi-agent speed requires deterministic ownership

Parallel agents are useful only when each task has:

- a bounded scope;
- branch/worktree isolation;
- resource and time budgets;
- explicit file/action ownership;
- deterministic acceptance tests;
- independent verification;
- a human merge/release decision.

The harness is the reliability product; the model is replaceable.

### 4. Browser completion requires a read-back

A browser agent reporting `DONE` is not evidence that a booking, setting, form, upload, or account state actually changed. Consequential workflows require a deterministic or independently read-back postcondition, bounded retry, and explicit failure state.

### 5. Capture evidence is privacy-sensitive

Screenshot/screen-recording workflows should be local-first:

`capture -> redact -> attach evidence -> preserve source metadata/hash -> apply retention`

Raw screens can contain credentials, private customer records, personal communications, or unrelated account data. Silent capture/upload is not a SONARA feature.

### 6. Visual schema design is not schema authority

ERD tools can accelerate design, but production database work still follows:

`ERD proposal -> migration diff -> tenant/RLS review -> replay from empty DB -> exact-head CI -> controlled migration -> rollback evidence`

### 7. Specialized runtimes require a measured gap

Python MCP workers, .NET visualization, experimental ARM64 operating systems, and robotics stacks remain isolated or research-only until a real product workload proves the current Node/PostgreSQL/browser architecture insufficient.

## Product placement

### Business Builder

- schema/ERD planning patterns;
- governed connector/tool gateway;
- market-dashboard UX research with provider-rights controls;
- generated website workflow strengthened with source control, accessibility, performance, truthful-content, preview, and publish-approval gates.

### Creator Studio

- local capture/redaction/release evidence;
- playback/library UX research;
- existing Concat/Recordly/local-video research remains isolated by licence and media-rights boundaries.

### Growth Studio

- web-native visualization patterns where customer analytics require them;
- browser/tool automation remains consented, platform-compliant, rate-limited, approval-gated, and postcondition-verified.

### Founder Operations / Internal Development

- optional coding clients such as Cline;
- bounded multi-agent orchestration research from Munder Difflin/LobeHub;
- browser-agent benchmarking from Jev;
- repository-native agent interchangeability and exact-head CI remain authoritative.

### Research Lab / Physical AI

- VibeOS for ARM64/OS learning;
- Spectacles Dimensional OS for simulator-first AR/robotics control research;
- LLM Engineer Toolkit as a discovery index only.

## Release boundary

This branch does **not**:

- install any of the repositories above;
- add third-party runtime packages;
- enable provider credentials;
- execute OSINT, browser automation, robotics, media, or market-data systems;
- change tenant/RLS/database authority;
- weaken coverage, security, migration, release, or rollback gates;
- merge or deploy itself.

The next gate is exact-head CI/security/release verification of the Batch 16 branch. Production enablement of any individual adapter, worker, or developer tool is a separate decision after measured need, licence/security review, and product-specific canary evidence.
