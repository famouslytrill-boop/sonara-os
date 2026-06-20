# Tasha Keys Creator Studio System

This integrates the existing Tasha Keys creative method into Creator Studio as a reusable artist operating system.

## What the system stores

- artist persona
- private backstory controls
- sonic identity
- genre blend
- writing rules
- visual rules
- prompt rules
- album cycles
- tracks
- prompt blueprints
- quality checks
- video treatments
- release tasks

## Public UI words

Use plain labels:

- Artists
- Songs
- Albums
- Sound Profile
- Prompts
- Video Ideas
- Release Tasks
- Quality Checks
- Music Projects
- DAW Sessions
- Audio Files

Do not show users database words like schema, JSONB, migration, or RLS.

## Tasha Keys core identity

Tasha Keys is handled as an internal artist system, not as a celebrity imitation workflow.

Core direction:

- female melodic rap/trap
- grounded, emotionally restrained delivery
- slight Southern/country edge over Midwest conversational cadence
- dark premium visuals
- faith conflict, recovery, family scars, luxury/pain contrast, city/country tension
- varied structure, cadence, flow, and production by track

## Mandatory music prompt rule

Every music prompt must include:

1. unique key
2. unique rhythmic feel
3. unique harmonic identity
4. unique drum language
5. unique vocal mode

Prompts should stay under 1,000 characters unless a tool specifically allows more.

## Rights and safety rule

Do not copy copyrighted lyrics.
Do not clone living artists.
Do not use public generation prompts that ask for exact imitation of named artists.
Reference tracks may guide energy, structure, or mood, but the output must be original.

## Visual system

Default cover rules:

- square 1:1
- photorealistic
- no visible person unless explicitly requested and rights-safe
- dark luxury apartment, hotel, object, glass, smoke, leather, neon, church-shadow scenes
- explicit label only when requested

## Source files

Migration:

```text
supabase/migrations/016_creator_artist_system_schema.sql
```

Routes:

```text
routes/creator-artist-system-routes.cjs
```

Wiring script:

```text
scripts/apply-creator-artist-routes.cjs
```

## Routes added by the module

- `/creator-studio/artists`
- `/creator-studio/artists/tasha-keys`
- `/api/creator/artists/tasha-keys/template`
- `/api/creator/artists/tasha-keys/install`
- `/api/creator/artists`
- `/api/creator/sonic-profiles`
- `/api/creator/album-cycles`
- `/api/creator/tracks`
- `/api/creator/prompt-blueprints`
- `/api/creator/quality-checks`
- `/api/creator/video-treatments`
- `/api/creator/release-tasks`
- `/api/creator/tracks/:id/check-prompt`

## Manual wiring

Run:

```powershell
node scripts/apply-creator-artist-routes.cjs
node --check server.js
```

Then commit and push `server.js` if changed.
