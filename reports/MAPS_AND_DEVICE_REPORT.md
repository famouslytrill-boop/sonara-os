# SONARA Maps and Device Report

Date: 2026-07-15

## Implemented capability

- `public/sensory-device-client.js` feature-detects geolocation, device motion, device orientation, vibration, permissions, and Web Audio.
- Location and orientation/motion listeners start only after application/user action; iOS permission requests are handled explicitly.
- Authenticated endpoints accept organization-scoped location and motion events when Supabase is configured.
- The main interface haptics preference defaults off and is suppressed under reduced motion.
- Unsupported devices return explicit unsupported/setup states.

## Privacy boundary

Sensors are not auto-started. A production workflow must explain purpose, request permission in context, minimize precision and retention, stop watchers when no longer needed, and provide a non-sensor alternative.

## Not implemented or not proven

- No customer-facing map renderer or map-provider integration is claimed.
- No geocoding, route optimization, geofencing enforcement, background tracking, or offline map package is claimed.
- GPS, gyroscope, vibration, audio, and persistence were not tested on physical devices in this run.

## Required proof

Perform permission-denied, unsupported, approximate-location, watcher-stop, data-retention, cross-tenant, and physical-device tests before enabling a sensor workflow for customers.
