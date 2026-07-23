const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Vercel deployment policy', () => {
  const configPath = path.join(__dirname, '..', 'vercel.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  it('allows automatic production deployments from main', () => {
    assert.equal(config.git?.deploymentEnabled?.main, true);
  });

  it('disables automatic deployments from every other branch', () => {
    assert.equal(config.git?.deploymentEnabled?.['*'], false);
  });

  it('does not use an ignored build step as a quota workaround', () => {
    assert.equal(config.ignoreCommand, undefined);
  });
});
