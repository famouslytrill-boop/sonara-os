---
name: reviewing-an-outside-repository
description: Review an external repository before adopting, adapting, or recommending it, and record the decision in data/open-source-tools.ts. Use whenever somebody shares a GitHub repo - as a link, a screenshot, or a social-media post - and asks to add it, use it, take an idea from it, or install it as a plugin or skill. Covers reading the real licence rather than the advertised one, measuring what the repository actually contains, and writing a register record the release chain will accept.
---

# Reviewing an outside repository

`CLAUDE.md` says to check the record before adapting anything. This is how the
record gets made.

The rule that produces most of the work here: **what a post claims and what a
repository grants are different things, and only one of them is enforceable.**
Repositories arrive in this project as screenshots of social-media posts. A
screenshot shows a star count, a badge and a sentence somebody wrote to get
clicks. It does not show the licence.

## The sequence

### 1. Establish which repository it actually is

A screenshot often does not show the owner — only a repository name and a
committer handle in small type. Do not guess an owner into a permanent register.

- `git ls-remote --heads https://github.com/<owner>/<name>` confirms existence
  cheaply and needs no clone.
- If the owner is unknown, search for it rather than probing names. Handles are
  easy to misread: `Imbad0202` was read as `lmbad0202` from a screenshot, capital
  I against lowercase l, and every probe failed until it was searched for.
- `api.github.com` is scoped to this session's own repositories and answers 403
  for anything else. That is not the repository being missing. Clone instead.

### 2. Read the licence file, not the badge

Clone it. `git clone --depth 1` is enough and costs seconds.

```
git clone --depth 1 https://github.com/<owner>/<name> /var/tmp/review/<name>
head -5 /var/tmp/review/<name>/LICENSE      # may be LICENSE.md, or absent
```

What the first few lines say is the answer. Three findings that have each
already happened here:

- **A repository advertised as a Claude skill library, with 44.3k stars and a
  `.claude-plugin` directory, was CC BY-NC 4.0.** NonCommercial forbids use
  "primarily intended for or directed towards commercial advantage". SONARA One
  is sold on paid plans. Popularity, plugin format and a skills directory say
  nothing about whether a licence permits commercial use.
- **A repository whose post called it open source was Elastic License 2.0** —
  source-available, and explicitly forbidding offering the software as a hosted
  service, which is what this product is.
- **No licence file means all rights reserved.** Absence is not permission, and
  nobody here can grant what the author has not.

A reciprocal licence (AGPL, GPL, OSL) triggers on *network* use, so a hosted
product is the case it is written for. Set `reciprocalLicense` from reading the
licence, never from a substring search — see the comment on that field for the
record where prose naming four reciprocal licences was miscounted as being one.

### 3. Measure what is in it, rather than describing it

The README describes the aspiration. Count the reality.

```
find <name> -type f -not -path '*/.git/*' | wc -l
ls <name>
```

Two questions worth answering every time, because both have changed a verdict:

**Is there any code at all?** A repository of twelve starters turned out to be
57 markdown files and nothing executable. That makes it reference-only as a
fact rather than as a caution — there is no dependency to take.

**Is the content what it says it is?** Two "curated API directories" were
affiliate placement lists: 2,273 of 2,283 links and 1,090 of 1,096 links carried
an `?fpr=` parameter, both synced from the same upstream. Grep for it:

```
grep -oh 'https://[^)]*' <name>/**/*.md | wc -l
grep -oh 'https://[^)]*fpr=[a-z0-9]*' <name>/**/*.md | wc -l
```

Affiliate links are a disclosure problem before they are a licence problem, and
they are invisible in a screenshot.

### 4. Separate the tool's licence from the rights in what you feed it

A permissive licence on a tool says nothing about the material it processes.
`book-to-skill` is MIT and its headline use — distilling a purchased technical
book into a redistributable skill — is a copyright question about the book,
which its own licence cannot answer. Record the boundary, not just the licence.

### 5. Cost is a constraint of the same weight as licence

A free tier is a price, not a licence. A shipped feature resting on one stops
working when the tier changes, and that is the vendor's decision rather than
this project's. If a starter's `stack.md` names paid APIs, that is a costing
somebody has to do, not a recommendation to inherit.

### 6. Write the record

Add to `data/open-source-tools.ts`. Use the values the type union declares —
several existing records use strings outside it, and adding another does not
help. Then:

```
node scripts/verify-open-source-registry.mjs
node scripts/generate-product-integration-map.mjs
node scripts/verify-doc-counts.mjs --check     # the register count is quoted in docs
```

`notes` is the field that matters. Say what you opened, on what date, and what
you measured — `LICENSE read 27 August 2026: MIT, Copyright (c) 2026 …` is
checkable; "reviewed and approved" is not. If a status name understates the
truth, say so in `recommendedAction`: a CC BY-NC repository is recorded as
`blocked_until_review` because that is the declared value, and the action line
has to add that no internal review can unblock it, only the author relicensing.

## What this skill will not do

It will not tell you a repository is safe. It tells you what the licence says,
what the repository contains, and what somebody has to decide. Adopting a
repository whose licence permits it is still a judgement about quality,
maintenance and cost, and none of those are in the LICENSE file.
