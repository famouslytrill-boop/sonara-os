"use strict";

// The Supabase CLI is not a dependency of this repository, and `pnpm run
// db:push` used to fail as if something were broken.
//
// `pnpm exec supabase db push` answers `[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL]
// Command "supabase" not found`, which reads like a corrupted install rather
// than a tool nobody has installed yet. Four documents in docs/ instruct
// somebody to run that command, so the first person to follow them meets a
// message that does not say what to do.
//
// It is deliberately not a dependency. The npm package pulls a 155 MB platform
// binary as an optional dependency, and Vercel runs `pnpm install
// --frozen-lockfile` on every deploy -- so adding it would put 155 MB on the
// critical path of every production build, for a tool only a person ever runs.
//
// This says so instead.

const { spawnSync } = require("node:child_process");

const INSTALL = `
The Supabase CLI is not installed on this machine.

It is not a dependency of this repository on purpose: the npm package pulls a
155 MB platform binary, and Vercel installs dependencies on every deploy. This
is a tool a person runs by hand a few times, so it is installed by hand.

Install it whichever way suits your machine:

  macOS / Linux (Homebrew)   brew install supabase/tap/supabase
  Windows (Scoop)            scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
                             scoop install supabase
  Any platform, no installer pnpm dlx supabase@latest --version
                             (then use \`pnpm dlx supabase@latest\` wherever
                             this guide says \`supabase\`)

Then check it:

  supabase --version

Full instructions: https://supabase.com/docs/guides/local-development/cli/getting-started
`.trim();

function found() {
  const probe = spawnSync("supabase", ["--version"], { stdio: "ignore", shell: process.platform === "win32" });
  // `error` covers ENOENT. A non-zero status from a CLI that did run is a
  // different problem and is not this check's business, so only absence fails
  // here -- a check that also failed on a bad flag would send somebody to
  // reinstall a tool that is already installed.
  return !probe.error;
}

if (!found()) {
  console.error(INSTALL);
  process.exit(1);
}

console.log("Supabase CLI found.");
