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
});
