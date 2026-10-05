import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { populateForm } from '../task.ts';

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
  await page.setContent(`
    <label for="prompt">Prompt</label><textarea id="prompt"></textarea>
    <label for="negative">Negative prompt</label><textarea id="negative"></textarea>
    <label for="prefix">Prepend recommended prefix: yes</label><input id="prefix" type="checkbox">
    <label for="width">Width</label><input id="width" type="range" aria-label="range slider for Width" min="512" max="1536" step="16" value="1408">
    <label for="height">Height</label><input id="height" type="range" aria-label="range slider for Height" min="512" max="1536" step="16" value="1408">
    <label for="steps">Steps</label><input id="steps" type="range" aria-label="range slider for Steps" min="10" max="60" step="1" value="35">
    <label for="cfg">CFG scale</label><input id="cfg" type="range" aria-label="range slider for CFG scale" min="1" max="8" step="0.1" value="6">
    <label for="sigma">Sigma shift (0 = default)</label><input id="sigma" type="range" aria-label="range slider for Sigma shift (0 = default)" min="0" max="8" step="0.1" value="0">
    <label for="seed">Seed (-1 random)</label><input id="seed" type="number" value="-1">
  `);

  await populateForm(page, request);
  assert.equal(await page.getByLabel('Prompt', { exact: true }).inputValue(), request.positive_prompt);
  assert.equal(await page.getByLabel('Negative prompt', { exact: true }).inputValue(), request.negative_prompt);
  assert.equal(await page.getByLabel('Prepend recommended prefix: yes').isChecked(), true);
  for (const [label, value] of [
    ['Width', request.width], ['Height', request.height], ['Steps', request.steps],
    ['CFG scale', request.cfg_scale], ['Sigma shift (0 = default)', request.sigma_shift],
  ] as const) {
    assert.equal(await page.getByRole('slider', { name: `range slider for ${label}`, exact: true }).inputValue(), String(value), label);
  }
  assert.equal(await page.getByLabel('Seed (-1 random)').inputValue(), String(request.seed));
}
