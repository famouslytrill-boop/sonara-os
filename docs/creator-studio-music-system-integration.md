# Creator Studio Music System Integration

This integrates the reusable music creation system into Creator Studio without seeding any private artist name or private artist persona.

## Product goal

Creator Studio should let users build original music systems that produce real project outputs:

- artist or project identity
- voice profile
- sound map
- story arc
- song blueprint
- song sections
- production notes
- prompt packs
- release packages
- quality checks
- export packages

## Public language

Use plain words in the interface:

- Music System
- Voice Profile
- Sound Map
- Story Arc
- Song Blueprint
- Song Sections
- Production Notes
- Prompt Pack
- Release Package
- Quality Check
- Export Package

Avoid showing users database words.

## Required music prompt fields

Every music generation plan should include:

- key
- rhythmic feel
- harmonic identity
- drum language
- vocal mode

This keeps outputs specific and repeatable instead of generic.

## Safety and originality rules

- Build original systems only.
- Do not seed private artist names.
- Do not depend on direct artist-name imitation.
- Do not paste protected lyrics into records.
- Do not store provider keys in browser-visible data.
- Review quality and release readiness before export.

## Database migration

The schema is added in:

```text
supabase/migrations/016_creator_studio_music_creation_system.sql
```

It adds:

- creator_artist_systems
- creator_voice_profiles
- creator_influence_maps
- creator_narrative_arcs
- creator_song_blueprints
- creator_song_sections
- creator_production_notes
- creator_prompt_packs
- creator_release_packages
- creator_quality_checks
- creator_export_packages

## Source configuration

The shared source config is:

```text
lib/creator-music-system-config.cjs
```

It defines routes, table names, public labels, required fields, and safety rules.

## Required UI pages

- `/creator-studio/music-system`
- `/creator-studio/music-system/new`
- `/creator-studio/music-system/song`
- `/creator-studio/music-system/prompts`

## Required API routes

- `GET /api/creator/music-system/readiness`
- `GET /api/creator/artist-systems`
- `POST /api/creator/artist-systems`
- `GET /api/creator/voice-profiles`
- `POST /api/creator/voice-profiles`
- `GET /api/creator/influence-maps`
- `POST /api/creator/influence-maps`
- `GET /api/creator/narrative-arcs`
- `POST /api/creator/narrative-arcs`
- `GET /api/creator/song-blueprints`
- `POST /api/creator/song-blueprints`
- `GET /api/creator/song-sections`
- `POST /api/creator/song-sections`
- `GET /api/creator/production-notes`
- `POST /api/creator/production-notes`
- `GET /api/creator/prompt-packs`
- `POST /api/creator/prompt-packs`
- `GET /api/creator/release-packages`
- `POST /api/creator/release-packages`
- `GET /api/creator/quality-checks`
- `POST /api/creator/quality-checks`
- `GET /api/creator/export-packages`
- `POST /api/creator/export-packages`

## Real result definition

A user creates a music system and gets a saved row in `creator_artist_systems`.

A user creates a song blueprint and gets a saved row in `creator_song_blueprints`.

A user creates production notes and gets saved rows in `creator_production_notes`.

A user creates a prompt pack and gets saved rows in `creator_prompt_packs`.

A user creates a release package and gets saved rows in `creator_release_packages`.

A user runs quality review and gets saved rows in `creator_quality_checks`.

A user exports a package and gets saved rows in `creator_export_packages`.

## Implementation order

1. Apply migration 016.
2. Add route wiring in `server.js` using the shared config.
3. Add Creator Studio navigation to Music System.
4. Add forms for systems, blueprints, prompt packs, notes, releases, and exports.
5. Add readiness API checks.
6. Add tests that verify records save and missing tables return setup-required.

No fake generation. No dead buttons. No private artist names seeded into the product.
