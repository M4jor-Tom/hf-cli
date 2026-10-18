import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { openSpaceApp, populateForm } from '../task.ts';

const SPACE_URL = 'https://huggingface.co/spaces/mrfakename/anima-v1';
const request = {
  positive_prompt: 'A red fox in a snowy forest',
  negative_prompt: 'blurry, watermark',
  prepend_recommended_prefix: false,
  width: 1408,
  height: 1280,
  steps: 35,
  cfg_scale: 6.2,
  sigma_shift: 0.4,
  seed: 42,
};

export async function run(page: Page): Promise<void> {
  await page.goto(SPACE_URL, { waitUntil: 'domcontentloaded' });
  await openSpaceApp(page);
  await page.getByRole('button', { name: 'Generate', exact: true }).waitFor({
    state: 'visible',
    timeout: 60_000,
  });

  await populateForm(page, request);

  assert.equal(await page.getByLabel('Prompt', { exact: true }).inputValue(), request.positive_prompt);
  assert.equal(await page.getByLabel('Negative prompt', { exact: true }).inputValue(), request.negative_prompt);
  assert.equal(
    await page.getByRole('checkbox', { name: /^Prepend recommended prefix:/ }).isChecked(),
    request.prepend_recommended_prefix,
  );
  for (const [label, value] of [
    ['Width', request.width], ['Height', request.height], ['Steps', request.steps],
    ['CFG scale', request.cfg_scale], ['Sigma shift (0 = default)', request.sigma_shift],
  ] as const) {
    assert.equal(await page.getByRole('slider', { name: `range slider for ${label}`, exact: true }).inputValue(), String(value), label);
  }
  assert.equal(await page.getByLabel('Seed (-1 random)', { exact: true }).inputValue(), String(request.seed));
  console.log('Live Space form mapping passed; Generate was not submitted.');
}
