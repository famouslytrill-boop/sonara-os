# Calling, texting, scheduling, GPS and messaging without a per-use bill

Researched 26 August 2026.

Review by: 2027-02-26

The brief: find ways to do calls, texts, scheduling, GPS, calendar, clock and
messaging at **zero marginal cost to us**, chargeable to the customer.

The honest headline is that **five of the seven can be done with no per-use bill
at all**, and the sixth — messaging — can be done for free to anyone who has
visited the site once. Only *carrier* SMS and *carrier* voice genuinely cannot,
and those are the two things customers ask for least once the alternatives
exist.

Every figure below is dated and sourced at the foot.

---

## The scoreboard

| Capability | Zero-margin path | What it actually costs us | Status here |
| --- | --- | --- | --- |
| **Calendar** | `.ics` files, generated in-process | Nothing | **Already built** — `lib/sonara-calendar-invite.cjs` |
| **Clock / time tracking** | Arithmetic over rows | Nothing | **Already built** — `/business-builder/owner/time` |
| **Scheduling** | Arithmetic + a public booking page | Nothing | **Already built** — `/book/:slug` |
| **GPS** | Browser Geolocation API | Nothing | Not built. The API is free and needs no server. |
| **Maps** | PMTiles served from our own storage | ~$11/month at 10M tile requests | Not built |
| **Messaging** | Web Push (VAPID) | Nothing per message | Not built |
| **Calling** | WebRTC peer-to-peer | Nothing for 80–85% of calls | Not built |
| **Carrier SMS / voice** | — | Per message, per minute | Priced as a paid capability |

---

## Calling: WebRTC, and the number that decides it

A WebRTC call between two browsers is **direct**. The audio does not pass
through our server, so it costs us nothing however long the call lasts. The only
infrastructure is a signalling exchange — a few kilobytes to introduce the two
peers — which our existing serverless function already has the shape for.

The catch is NAT traversal, and this is the figure the whole decision turns on:
**approximately 15–20% of connections need a TURN relay**, when both peers are
behind symmetric NAT or a corporate firewall. STUN, which handles the other
80–85%, is free.

TURN is not free but it is astonishingly cheap for voice: a 1 Gbps link handles
**7,000+ concurrent voice-only sessions** at roughly 100 kbps each. That is a
fixed monthly server cost covering a call volume no small-business customer base
will approach, rather than a per-minute bill.

So the shape is: **peer-to-peer by default, one small TURN box as fallback.** A
customer-to-business call placed from a booking page or an invoice costs us
nothing 80–85% of the time and a fraction of a fixed monthly cost the rest.

**What it does not replace:** a call from someone who has not opened the page —
a stranger dialling a phone number. That is carrier voice and it has a bill.

---

## Messaging: Web Push is genuinely free

The Push API, Notifications API and Service Worker API are standard browser
features. You generate your own **VAPID** key pair, store subscriptions on your
own server, and send. The browser vendor's push service (FCM for Chrome,
Mozilla's for Firefox) does the delivery and **is free and part of the browser**
— no vendor account, no per-message charge, no subscriber tier.

For comparison, this is the capability SMS is usually bought for: "your job is
confirmed", "your invoice is due", "your booking is tomorrow". Every one of those
reaches a customer who has already used the site, which is exactly the population
Web Push covers.

**Three things to be honest about.** It reaches only people who granted
permission; iOS requires the site be added to the home screen; and a person who
never opens the browser never sees it. Those are real limits and they are why
carrier SMS stays on the paid list rather than being deleted from it.

`AGENTS.md` also applies directly: *"Sounds, voice announcements, haptics, SMS,
push, and email alerts must be off or explicitly user-controlled by default."*
Web Push being free does not make it default-on.

---

## Texting without a carrier

Two paths, both zero:

**Click-to-text from the customer's own handset.** An `sms:` link opens the
business owner's own messaging app with the number and body pre-filled. They
send it from their own phone, on their own plan. No API, no number to rent, no
per-message charge — and the reply arrives where they already look for replies.

**Email, which we already have.** `RESEND_API_KEY` is a required variable and
already configured. For anything longer than a line, email is the channel that
costs nothing extra and is already wired.

---

## GPS and maps

**Geolocation is free.** The browser's `navigator.geolocation` gives a position
with the user's permission and touches no server of ours. Vehicle check-in,
job-site arrival, mileage between two recorded points — all arithmetic once the
positions exist.

**Maps are where the bill usually hides**, and the numbers are stark. For
10 million tile requests per month:

| Provider | Monthly |
| --- | --- |
| Google Maps | ~$3,600 |
| Self-hosted PMTiles on AWS S3 | ~$120 |
| Self-hosted PMTiles on Cloudflare R2 | **~$11** |

Mapbox gives 50,000 free map loads and then charges — an extra 10,000 loads
takes the bill to $50. Usage-based map pricing is the shape that escalates
without warning.

**PMTiles** packages global OpenStreetMap data into a single file served from
object storage. It is a static file, not an API, so there is no per-request fee
and no key that can be rate-limited out from under a shipped feature. This is the
same architectural argument as browser-side inference: prefer the thing whose
cost is bandwidth over the thing whose cost is per use.

---

## Calendar, clock and scheduling: already done

Worth stating plainly because the brief listed them as things to add:

- **Calendar** — `lib/sonara-calendar-invite.cjs` writes real `.ics` with CRLF
  line endings, octet-correct folding, UTC timestamps and stable UIDs. It costs
  a CPU-millisecond.
- **Clock** — `/business-builder/owner/time` records hours and pay rates.
- **Scheduling** — `/book/:slug` takes a booking from a stranger, re-derives the
  time on submit so a hand-made request cannot book 03:00 on a Sunday, and
  supports staff assignment and multi-site availability.

The gap is not capability. It is that none of them talks to the others yet: a
booking does not push a notification, a job does not record where it happened,
and a call cannot be placed from a customer record. **The zero-margin work is
connection, not construction.**

---

## What to build, in order

1. **Web Push** — free, already-permitted audience, replaces the most common
   reason to buy SMS. Off by default per `AGENTS.md`.
2. **Geolocation capture** — free, needs no map to be useful; a recorded
   position on a job is worth having before anything draws it.
3. **WebRTC calling from a customer record** — free for 80–85% of calls, and
   the TURN fallback is a fixed cost, decided later and only if used.
4. **PMTiles map** — only once positions are being recorded and somebody wants
   to see them.

Carrier SMS and voice stay where they are: priced in
`lib/sonara-paid-capabilities.cjs` as `telephony`, sold per message or minute,
and never a launch dependency.

---

## Sources

- [WebRTC infrastructure guide 2026 — RTC League](https://rtcleague.com/blogs/webrtc-infrastructure)
- [STUN vs TURN — GetStream](https://getstream.io/resources/projects/webrtc/advanced/stun-turn/)
- [Web push notifications without a vendor — CoderCops, 2026](https://blog.codercops.com/blog/web-push-notifications-implementation-guide-2026)
- [Implementing push notifications with the Web Push API — OpenReplay](https://blog.openreplay.com/implementing-push-notifications-web-push-api/)
- [Estimating the cost of hosting a global PMTiles dataset — Lat × Long](https://latlong.blog/2023/11/estimating-the-cost-of-hosting-a-global-pmtiles-dataset.html)
- [Google Maps alternatives compared — Stadia Maps](https://stadiamaps.com/switch-to-stadia/from-google/)
- [Self-host OpenStreetMap vector tiles with PMTiles](https://www.hititmedya.com/blog/self-host-openstreetmap-tiles-pmtiles)
