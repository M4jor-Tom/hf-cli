import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const [joinApp, generateApp, request] = process.argv.slice(2);
assert.ok(joinApp && generateApp && request, 'provide join app, generation app, and a valid request');
const dir = mkdtempSync(join(tmpdir(), 'hf-cli browser '));
const profile = join(dir, 'home/.config/mozilla/firefox/privacy');
const log = join(dir, 'browser-args.json');
mkdirSync(profile, { recursive: true });
mkdirSync(join(dir, 'bin'));
writeFileSync(join(profile, '../profiles.ini'), '[Profile0]\nName=privacy\nIsRelative=1\nPath=privacy\n');
// Stop at the browser process boundary: never navigate to Hugging Face in this check.
writeFileSync(join(dir, 'bin/firefox'), `#!${process.execPath}
require('node:fs').writeFileSync(process.env.HF_CLI_BROWSER_ARGS, JSON.stringify(process.argv.slice(2)));
process.exit(process.argv.includes('--remote-debugging-port=0') ? 1 : 0);
`, { mode: 0o700 });
const env = {
  ...process.env, HOME: join(dir, 'home'), XDG_CONFIG_HOME: join(dir, 'home/.config'),
  PATH: `${join(dir, 'bin')}:${process.env.PATH}`, HF_CLI_BROWSER_ARGS: log,
};
const run = (app, args) => spawnSync(app, args, { env, encoding: 'utf8' });
try {
  const manual = run(joinApp, ['--browser', 'firefox', 'privacy']);
  assert.equal(manual.status, 0, manual.stderr);
  assert.deepEqual(JSON.parse(readFileSync(log, 'utf8')), [
    '-no-remote', '-profile', profile, 'https://huggingface.co/join',
  ]);
  rmSync(log);

  const replay = run(generateApp, ['--browser', 'firefox', 'privacy', request]);
  assert.notEqual(replay.status, 0, 'fake automation browser must stop before navigation');
  assert.ok(existsSync(log), `generation must forward the browser override: ${replay.stderr}`);
  const args = JSON.parse(readFileSync(log, 'utf8'));
  assert.equal(args[args.indexOf('--profile') + 1], profile);
  assert.ok(args.includes('--remote-debugging-port=0'));
  rmSync(log);

  const invalid = join(dir, 'invalid.json');
  writeFileSync(invalid, '{}');
  assert.notEqual(run(generateApp, ['--browser', 'firefox', 'privacy', invalid]).status, 0);
  assert.ok(!existsSync(log), 'invalid requests must not open a browser');
  for (const app of [joinApp, generateApp]) {
    for (const argv of [['--browser'], ['--browser', 'firefox'], ['--browser', 'firefox', 'unknown']]) {
      assert.notEqual(run(app, argv).status, 0);
      assert.ok(!existsSync(log), 'invalid overrides must not open a browser');
    }
  }
  console.log('browser/profile forwarding and validation passed; no Hugging Face connections');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
