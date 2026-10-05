import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

test('packaged task resolves its adjacent download helper', async () => {
  const taskPath = process.env.HF_CLI_TASK_PATH;
  assert.ok(taskPath, 'set HF_CLI_TASK_PATH to the packaged task.ts path');
  const task = await import(pathToFileURL(taskPath).href);
  assert.equal(typeof task.run, 'function');
});
