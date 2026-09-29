# Manual Wire: Creator Studio Music System

The source modules are added. Wire them into `server.js` manually if the automated patch script is unavailable.

## Add require

Near the top of `server.js`, after the built-in `node:url` require, add:

```js
const registerCreatorMusicSystemReadOnlyRoutes = require("./routes/creator-music-system-readonly.cjs");
```

## Register routes

After this line:

```js
app.use(express.json({ limit: "64kb" }));
```

add:

```js
registerCreatorMusicSystemReadOnlyRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess
});
```

## Verify

Run:

```powershell
pnpm run build
pnpm test -- --grep "Creator Studio music system config"
```

## Routes added by the module

- `/creator-studio/music-system`
- `/creator-studio/music-system/new`
- `/creator-studio/music-system/song`
- `/creator-studio/music-system/prompts`
- `/api/creator/music-system/readiness`

## Client helper

There is none, and there is nothing for one to call.

`public/creator-music-system.js` used to be loaded by `basicLayout` in the route
module, and it called eleven `/api/creator/*` endpoints -- artist systems, voice
profiles, influence maps, narrative arcs, song blueprints, song sections,
production notes, prompt packs, release packages, quality checks and export
packages. None of the eleven was ever registered. `basicLayout` is also a
fallback that the real caller never reaches, since it passes a `layout`, so the
script tag reached no browser either.

The file, the eleven declarations in `lib/creator-music-system-config.cjs` and
the page copy that recommended the helper have all been removed.
`pnpm run verify:declared-api-paths` now fails if a library declares an `/api`
path the running application does not serve, so a write surface cannot be
announced again before it exists.

The eleven tables themselves are real: migration 020 creates them with row-level
security, and `CREATOR_MUSIC_SYSTEM_TABLES` is checked against the database
contract. Building the write path is a separate decision, and the pattern to
follow is `RESOURCES` in `lib/sonara-module-crud.cjs` together with
`buildDomainModuleRecord` in `lib/sonara-module-records.cjs`, which is how the
three resources that do persist are wired.
