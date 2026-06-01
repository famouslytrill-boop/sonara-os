# Creator Asset Vault

## Problem

Creators need an organized place to reference creative assets without introducing unsafe uploads, unclear rights, or accidental public exposure.

## Users

- Creators
- Creator collaborators
- Owner/admin reviewers

## User Stories

- As a creator, I can organize asset records.
- As a creator, I can mark assets as private or public-ready.
- As a reviewer, I can see rights and provenance notes before use.

## Non-Goals

- No heavy media processing in MVP.
- No copyrighted asset claims without review.
- No public file listing by default.

## Data Model Notes

- Track asset metadata, status, rights notes, provenance notes, organization, and timestamps.
- Store files later through reviewed storage policy.
- Separate asset records from public display.

## Route Requirements

- Owner asset vault route.
- Optional public display only for approved assets.
- Setup-mode when storage is not configured.

## API Requirements

- Validate metadata fields.
- Do not accept sensitive or unsafe files in MVP.
- Storage writes require reviewed bucket policy.

## Security Requirements

- Organization members manage asset records.
- No public bucket access by default.
- No service-role key in browser code.

## Privacy Requirements

- Private assets stay private.
- Collaborator access must be explicit.
- Rights notes must not be hidden from owner review.

## Acceptance Criteria

- Asset vault can render without storage configured.
- Public UI does not expose private assets.
- Rights/provenance note fields are planned before upload support.

## Test Requirements

- Test setup-mode without storage.
- Test private/public visibility assumptions.
- Test required metadata validation when writes exist.

## Launch Gate Requirements

- Typecheck passes.
- Build passes.
- Storage and rights review completed before file uploads.
