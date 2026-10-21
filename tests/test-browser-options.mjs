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
require('node:fs').writeFileSync(process.env.HF_CLI_BROWSER_ARGS, JSON.stringify({
  args: process.argv.slice(2), downloadDir: process.env.HF_CLI_DOWNLOAD_DIR,
  count: process.env.HF_CLI_COUNT,
}));
process.exit(process.argv.includes('--remote-debugging-port=0') ? 1 : 0);
`, { mode: 0o700 });
const env = {
  ...process.env, HOME: join(dir, 'home'), XDG_CONFIG_HOME: join(dir, 'home/.config'),
  PATH: `${join(dir, 'bin')}:${process.env.PATH}`, HF_CLI_BROWSER_ARGS: log,
  HF_CLI_DOWNLOAD_DIR: 'inherited value must not override the default',
  HF_CLI_COUNT: '5',
};
const run = (app, args) => spawnSync(app, args, { env, encoding: 'utf8' });
try {
  const manual = run(joinApp, ['--browser', 'firefox', 'privacy']);
  assert.equal(manual.status, 0, manual.stderr);
  assert.deepEqual(JSON.parse(readFileSync(log, 'utf8')).args, [
    '-no-remote', '-profile', profile, 'https://huggingface.co/join',
  ]);
  rmSync(log);

  const replay = run(generateApp, ['--browser', 'firefox', 'privacy', request]);
  assert.notEqual(replay.status, 0, 'fake automation browser must stop before navigation');
  assert.ok(existsSync(log), `generation must forward the browser override: ${replay.stderr}`);
  const replayLog = JSON.parse(readFileSync(log, 'utf8'));
  assert.equal(replayLog.downloadDir, join(dir, 'home/Downloads'));
  assert.equal(replayLog.count, '1', 'batching must be opt-in');
  const args = replayLog.args;
  assert.equal(args[args.indexOf('--profile') + 1], profile);
  assert.ok(args.includes('--remote-debugging-port=0'));
  assert.ok(args.includes('--headless'), 'headless remains the default');
  rmSync(log);

  const headed = run(generateApp, ['--headed', '--browser', 'firefox', 'privacy', request]);
  assert.notEqual(headed.status, 0, 'fake automation browser must stop before navigation');
  assert.ok(existsSync(log), `headed generation must launch Firefox: ${headed.stderr}`);
  const headedArgs = JSON.parse(readFileSync(log, 'utf8')).args;
  assert.equal(headedArgs[headedArgs.indexOf('--profile') + 1], profile);
  assert.ok(!headedArgs.includes('--headless'), 'headed mode must not pass Firefox --headless');
  assert.ok(headedArgs.includes('--foreground'), 'headed mode must pass Firefox --foreground');
  rmSync(log);

  for (const options of [
    ['--count', '5', '--download-dir', 'custom output', '--headed', '--browser', 'firefox', 'privacy'],
    ['--browser', 'firefox', 'privacy', '--download-dir', 'custom output', '-n', '5', '--headed'],
  ]) {
    const custom = run(generateApp, [...options, request]);
    assert.notEqual(custom.status, 0, 'fake automation browser must stop before navigation');
    assert.ok(existsSync(log), `custom directory must reach the browser: ${custom.stderr}`);
    const customLog = JSON.parse(readFileSync(log, 'utf8'));
    assert.equal(customLog.downloadDir, 'custom output');
    assert.equal(customLog.count, '5');
    assert.ok(!customLog.args.includes('--headless'));
    rmSync(log);
  }
  for (const argv of [['--download-dir'], ['--download-dir', '', request]]) {
    assert.equal(run(generateApp, argv).status, 2);
    assert.ok(!existsSync(log), 'invalid download directory options must not open a browser');
  }

  for (const option of ['--count', '-n']) {
    for (const argv of [[option], ...['', '0', '-1', '1.5', 'abc'].map(value => [option, value, request])]) {
      assert.equal(run(generateApp, argv).status, 2);
      assert.ok(!existsSync(log), 'invalid counts must not open a browser');
    }
  }

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
  console.log('browser/profile, download directory, and validation checks passed; no Hugging Face connections');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
