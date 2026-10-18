import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Page } from 'playwright-core';
import { openSpaceApp, populateForm } from '../task.ts';

export const request = {
  positive_prompt: 'A red fox 🦊 in a snowy forest\nsoft morning light',
  negative_prompt: 'blurry, watermark',
  prepend_recommended_prefix: true,
  width: 1408,
  height: 1280,
  steps: 35,
  cfg_scale: 6.2,
  sigma_shift: 0.4,
  seed: 42,
};

export const form = `
  <label for="prompt">Prompt</label><textarea id="prompt">old prompt</textarea>
  <label for="negative">Negative prompt</label><textarea id="negative">old negative</textarea>
  <label for="prefix">Prepend recommended prefix: yes</label><input id="prefix" type="checkbox">
  <label for="width">Width</label><input id="width" type="range" aria-label="range slider for Width" min="512" max="1536" step="16" value="1024">
  <label for="height">Height</label><input id="height" type="range" aria-label="range slider for Height" min="512" max="1536" step="16" value="1408">
  <label for="steps">Steps</label><input id="steps" type="range" aria-label="range slider for Steps" min="10" max="60" step="1" value="35">
  <label for="cfg">CFG scale</label><input id="cfg" type="range" aria-label="range slider for CFG scale" min="1" max="8" step="0.1" value="6">
  <label for="sigma">Sigma shift (0 = default)</label><input id="sigma" type="range" aria-label="range slider for Sigma shift (0 = default)" min="0" max="8" step="0.1" value="0">
  <label for="seed">Seed (-1 random)</label><input id="seed" type="number" value="-1">
  <script>
    for (const type of ['input', 'change']) {
      document.addEventListener(type, event => event.target.setAttribute('data-' + type, event.target.value));
    }
  </script>
`;

async function checkForm(page: Page): Promise<void> {
  await populateForm(page, request);
  await page.getByLabel('Prompt', { exact: true }).click();
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
  for (const [id, value] of [
    ['prompt', request.positive_prompt], ['negative', request.negative_prompt], ['seed', '42'],
  ]) {
    for (const type of ['input', 'change']) {
      assert.equal(await page.locator(`#${id}`).getAttribute(`data-${type}`), value, `${id} must dispatch ${type}`);
    }
  }
}

export async function run(page: Page): Promise<void> {
  // Stock Firefox/BiDi drops input and clicks in cross-origin iframes.
  // Follow the embedded app into a top-level page, preserving its query.
  let embeddedReady = false;
  let followedBeforeReady = false;
  let formRequests = 0;
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    const { port } = server.address() as { port: number };
    if (req.url === '/') {
      res.end(`<iframe aria-label="Space app" src="http://localhost:${port}/form?__theme=dark&amp;__sign=fixture"></iframe>`);
    } else if (req.url?.startsWith('/form?')) {
      if (++formRequests === 1) {
        setTimeout(() => { embeddedReady = true; res.end(form); }, 2000);
      } else {
        followedBeforeReady = !embeddedReady;
        res.end(form);
      }
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const { port } = server.address() as { port: number };
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
    await openSpaceApp(page);
    assert.equal(page.url(), `http://localhost:${port}/form?__theme=dark&__sign=fixture`);
    assert.equal(formRequests, 2, 'load the embedded app before following it');
    assert.equal(followedBeforeReady, false, 'do not interrupt the pending iframe navigation');
    await checkForm(page);
    await page.setContent(form);
    await checkForm(page);
    console.log('Offline form mapping passed (page and cross-origin iframe).');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
