import { readFile } from 'node:fs/promises';
import type { Page } from 'playwright-core';
import { saveDownload } from './save-download.mjs';

type GenerationRequest = {
  positive_prompt: string;
  negative_prompt: string;
  prepend_recommended_prefix: boolean;
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  sigma_shift: number;
  seed: number;
};

const SPACE_URL = 'https://huggingface.co/spaces/mrfakename/anima-v1';
const GENERATION_TIMEOUT = 10 * 60 * 1000;

async function setSlider(page: Page, label: string, value: number): Promise<void> {
  const slider = page.getByRole('slider', { name: `range slider for ${label}`, exact: true });
  await slider.evaluate((element, nextValue) => {
    if (!(element instanceof HTMLInputElement)) throw new Error('Expected a range input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Range input value setter not found');
    setter.call(element, String(nextValue));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  const actual = Number(await slider.inputValue());
  if (actual !== value) throw new Error(`${label}: expected ${value}, got ${actual}`);
}

export async function populateForm(page: Page, request: GenerationRequest): Promise<void> {
  await page.getByLabel('Prompt', { exact: true }).fill(request.positive_prompt);
  await page.getByLabel('Negative prompt', { exact: true }).fill(request.negative_prompt);
  await page.getByRole('checkbox', { name: /^Prepend recommended prefix:/ }).setChecked(
    request.prepend_recommended_prefix,
  );
  await setSlider(page, 'Width', request.width);
  await setSlider(page, 'Height', request.height);
  await setSlider(page, 'Steps', request.steps);
  await setSlider(page, 'CFG scale', request.cfg_scale);
  await setSlider(page, 'Sigma shift (0 = default)', request.sigma_shift);
  await page.getByLabel('Seed (-1 random)', { exact: true }).fill(String(request.seed));
}

export async function openSpaceApp(page: Page): Promise<void> {
  const iframe = page.locator('iframe[aria-label="Space app"]');
  // Let the embedded navigation settle before navigating to the same URL.
  await iframe.contentFrame().getByLabel('Prompt', { exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
  const src = await iframe.getAttribute('src');
  if (!src) throw new Error('Space app iframe has no URL');
  // Stock Firefox/BiDi drops input and clicks across frame origins. Open the
  // same app as a top-level page, retaining any authentication/theme query.
  await page.goto(new URL(src, page.url()).href, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Prompt', { exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
}

export async function run(page: Page): Promise<void> {
  const inputPath = process.env.HF_CLI_INPUT;
  if (!inputPath) throw new Error('HF_CLI_INPUT is not set; run through the flake app');
  const request = JSON.parse(await readFile(inputPath, 'utf8')) as GenerationRequest;

  await page.goto(SPACE_URL, { waitUntil: 'domcontentloaded' });
  await openSpaceApp(page);
  await populateForm(page, request);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();

  const output = page.getByRole('img', { name: 'Output', exact: true });
  await output.waitFor({ state: 'visible', timeout: GENERATION_TIMEOUT });
  await output.hover();
  const downloadButton = page.getByRole('button', { name: /download/i });
  await downloadButton.waitFor({ state: 'visible' });
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await downloadButton.click();
  const name = await saveDownload(await downloadPromise);
  console.log(`Downloaded downloads/${name}`);
}
