# Favicon Alignment Report

Date: 2026-06-04

## Source of Truth

The web shell references the SONARA brand favicon and app icon paths:

- `/favicon.svg`
- `/brand/sonara-one-app-icon.svg`
- `/site.webmanifest`

## Build Verification

The web smoke checks require favicon, manifest, brand logo, app icon, OpenGraph image, and vendor assets to exist in the built `packages/web/dist` output.

## Browser Cache Note

After deployment, perform a hard refresh or clear site data before judging favicon changes. Browser favicon caches can outlive a normal deploy.
