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
    assert.match(workflow, /pnpm run verify:all/);
    assert.match(workflow, /supabase db push --linked --include-all/);
    assert.match(workflow, /vercel@latest deploy --prod/);
    assert.match(workflow, /githubCommitSha=\"\$GITHUB_SHA\"/);
  });

  it('does not use an ignored build step as a quota workaround', () => {
    assert.equal(config.ignoreCommand, undefined);
  });
});
