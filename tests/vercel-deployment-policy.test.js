const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Vercel deployment policy', () => {
  const root = path.join(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'controlled-production-deploy.yml'), 'utf8');

  it('disables every automatic Git deployment', () => {
    assert.equal(config.git?.deploymentEnabled, false);
  });

  it('deploys only through the validated main-branch production workflow', () => {
    assert.match(workflow, /branches:\s*\[main\]/);

    const releaseGates = [
      // The generators no longer run during the build. Their output is
      // committed, and this gate proves the committed tree still matches them.
      'pnpm run build',
      'pnpm test',
      'pnpm run scan:client-secrets',
      'pnpm run lint',
      'pnpm run smoke:routes',
      'pnpm run verify:db',
      'pnpm run verify:config',
      'pnpm run verify:api',
      'pnpm run verify:open-source'
    ];

    let previousPosition = -1;
    for (const command of releaseGates) {
      const position = workflow.indexOf(command);
      assert.ok(position > previousPosition, `Missing or out-of-order production release gate: ${command}`);
      previousPosition = position;
    }

    const migrationPosition = workflow.indexOf('supabase db push --linked --include-all');
    const deployPosition = workflow.indexOf('vercel@latest deploy --prod');
    assert.ok(migrationPosition > previousPosition, 'Production migration must run after every release gate');
    assert.ok(deployPosition > migrationPosition, 'Vercel deployment must run after production migration and verification');
    assert.match(workflow, /githubCommitSha="\$GITHUB_SHA"/);
    assert.match(workflow, /release-validation\.log/);
  });

  it('does not use an ignored build step as a quota workaround', () => {
    assert.equal(config.ignoreCommand, undefined);
  });

  // On 2026-08-04 this workflow deployed main, verified the apex was serving the
  // deployed commit, and reported success. Ten seconds later a manual
  // "Redeploy" of a deployment from that morning was created in the Vercel
  // dashboard, became the newest production deployment, and took the alias.
  // Production ran a twelve-hour-old build for three and a half hours with four
  // merged pull requests unshipped, while every signal stayed green.
  //
  // Two things were missing, and these hold both of them in place.
  it('can be re-run on demand, so redeploying does not mean going around the gates', () => {
    // The dashboard button was reached for because there was no other way in --
    // the workflow only ran on push. Going around it skips the migration gate,
    // the catalog boundary gate and the post-deploy checks.
    assert.match(workflow, /^\s*workflow_dispatch:\s*$/m, 'production cannot be redeployed through the gated pipeline');
  });

  it('keeps watching whether production still runs what main says it runs', () => {
    // The deploy gate answers this at the moment of deploying and never again,
    // so it cannot see drift that happens afterwards. This one asks on a
    // schedule.
    const driftPath = path.join(root, '.github', 'workflows', 'production-commit-drift.yml');
    assert.ok(fs.existsSync(driftPath), 'no workflow checks production for commit drift');
    const drift = fs.readFileSync(driftPath, 'utf8');
    assert.match(drift, /schedule:/, 'the drift check does not run on a schedule, so nothing would notice');
    assert.match(drift, /\/api\/health/, 'the drift check does not read the live commit');
    assert.match(drift, /git rev-parse HEAD/, 'the drift check does not read the commit it expects');
    // A merge lands on main before its deploy finishes, so a fresh mismatch is
    // a deploy in flight rather than drift. Without the grace window this would
    // fail on every merge and be switched off within a week.
    assert.match(drift, /GRACE_SECONDS/, 'the drift check has no grace window for a deploy in flight');
  });
});
