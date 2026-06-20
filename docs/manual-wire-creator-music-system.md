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
npm run build
npm test -- --grep "Creator Studio music system config"
```

## Routes added by the module

- `/creator-studio/music-system`
- `/creator-studio/music-system/new`
- `/creator-studio/music-system/song`
- `/creator-studio/music-system/prompts`
- `/api/creator/music-system/readiness`

## Client helper

The route module loads:

```text
/creator-music-system.js
```

This helper connects forms to the Creator Studio music system API routes once the write APIs are wired.
