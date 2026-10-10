import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { populateForm } from '../task.ts';

const SPACE_URL = 'https://huggingface.co/spaces/mrfakename/anima-v1';
const request = {
  positive_prompt: 'A red fox in a snowy forest',
  negative_prompt: 'blurry, watermark',
  prepend_recommended_prefix: true,
  width: 1408,
  height: 1280,
  steps: 35,
  cfg_scale: 6.2,
  sigma_shift: 0.4,
  seed: -1,
};

export async function run(page: Page): Promise<void> {
  await page.goto(SPACE_URL, { waitUntil: 'domcontentloaded' });
  const app = page.frameLocator('iframe[aria-label="Space app"]');
  await app.getByLabel('Prompt', { exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
  await app.getByRole('button', { name: 'Generate', exact: true }).waitFor({
    state: 'visible',
    timeout: 60_000,
  });

  await populateForm(app, request);

  assert.equal(await app.getByLabel('Prompt', { exact: true }).inputValue(), request.positive_prompt);
  assert.equal(await app.getByLabel('Negative prompt', { exact: true }).inputValue(), request.negative_prompt);
  assert.equal(
    await app.getByRole('checkbox', { name: /^Prepend recommended prefix:/ }).isChecked(),
    request.prepend_recommended_prefix,
  );
  assert.equal(await app.getByLabel('Seed (-1 random)', { exact: true }).inputValue(), String(request.seed));
  console.log('Live Space form mapping passed; Generate was not submitted.');
}
