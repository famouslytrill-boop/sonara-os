# Consented bounded motion capture — 9 October 2026

This change closes one concrete capability gap without widening background device access.

## Problem

`POST /api/motion/events` existed and persisted tenant-scoped `motion_sensor_events`, while the repository's own reachability test correctly recorded that **no browser client called it**. The device helper could listen for motion, but no product page connected an explicit customer action to the endpoint. Keeping the route while describing motion as a capability therefore overstated what a customer could actually do.

## Implemented path

`/settings/device-feedback` now contains an explicit **Save a 5-second motion sample** control. It loads `public/sonara-motion-capture.js` from the same origin.

The client:

- starts only from that button;
- requests motion permission only when required by the browser;
- remains foreground-only and cancels on `visibilitychange` or `pagehide`;
- samples at no more than 10 Hz for at most 5 seconds and accepts at most 50 samples;
- keeps only running sums/counts in browser memory;
- uploads one aggregate mean rather than individual sensor events;
- rounds transmitted sensor values to one decimal place;
- performs no automatic retry or background resume;
- aborts an in-flight save if the page leaves the foreground.

The server repeats the privacy boundary rather than trusting the browser. `lib/sonara-motion-sample.cjs` validates the database event vocabulary, refuses empty or non-finite samples, caps numeric values to the PostgreSQL `numeric(12,6)` domain, and quantizes stored sensor values to one decimal place. Organization and user IDs remain derived from the authenticated server context.

## Permission boundary

The site-wide Permissions-Policy remains unchanged. Only `/settings/device-feedback` adds `accelerometer=(self)` and `gyroscope=(self)`; camera stays denied on this page. That keeps the additional sensor authority scoped to the one signed-in surface that exposes the control.

## Research basis

- W3C Device Orientation and Motion: https://www.w3.org/TR/orientation-event/
- MDN Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

The design follows two practical consequences of those standards: motion/orientation is a permission/privacy-sensitive sensor surface, and a page becoming hidden is an appropriate lifecycle boundary for stopping work the user did not ask to continue in the background.

## What this does not claim

This is not background tracking, gesture recognition, route tracking, fall detection, health monitoring, motion capture for animation, or a native-device telemetry service. It does not add an always-on listener, worker, queue, external provider, new database table, new permission default, or production release.

The route remains authenticated and tenant-scoped. Production remains subject to the repository's separate exact-head CI, release-governance and owner-authorization requirements.
