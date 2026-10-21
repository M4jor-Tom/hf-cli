import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from 'playwright-core';
import { run as generate } from '../task.ts';
import { form, request } from './test-form-mapping.ts';

// Valid 1×1 PNG; older Firefox rejects incorrect chunk CRCs.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

export async function run(page: Page): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'hf-cli-download-'));
  const cwd = process.cwd();
  const previousEnv = {
    HOME: process.env.HOME,
    HF_CLI_INPUT: process.env.HF_CLI_INPUT,
    HF_CLI_DOWNLOAD_DIR: process.env.HF_CLI_DOWNLOAD_DIR,
    HF_CLI_COUNT: process.env.HF_CLI_COUNT,
  };
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let task: Promise<void> | undefined;
  let resultMode: 'image' | 'limit' = 'image';
  let downloadName = 'browser.original.png';
  let generations = 0;
  let downloads = 0;
  let limitAt = 0;
  const server = createServer((req, res) => {
    if (req.url === '/generate') {
      generations++;
      res.end(resultMode === 'limit' || generations === limitAt ? 'limit' : 'result');
    } else if (req.url === '/image' || req.url === '/download') {
      res.setHeader('content-type', 'image/png');
      if (req.url === '/download') {
        downloads++;
        res.setHeader('content-disposition', `attachment; filename="${downloadName}"`);
      }
      res.end(png);
    } else {
      const { port } = server.address() as { port: number };
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(req.url === '/' ? `<iframe aria-label="Space app" src="http://localhost:${port}/form"></iframe>` : `${form}
        <div class="block"><label>Unrelated preview</label><img src="/image" alt="">
          <a data-testid="download-link" href="/wrong"><button aria-label="Download">Wrong download</button></a>
        </div>
        <button onclick="fetch('/generate').then(r => r.text()).then(id => document.getElementById(id).hidden = false)">Generate</button>
        <div id="limit" role="alert" hidden>Guest quota reached</div>
        <div class="block"><label data-testid="block-label">Output</label>
          <div id="result" hidden><img src="/image" alt="">
            <a data-testid="download-link" href="/download" download="link-name.png"><button aria-label="Download">Download</button></a>
          </div>
        </div>`);
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  // Exercise the real task, including its fixed entry URL, without contacting HF.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://huggingface.co') {
      const { port } = server.address() as { port: number };
      return route.fulfill({ status: 302, headers: { location: `http://127.0.0.1:${port}/` }, body: '' });
    }
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
  try {
    writeFileSync(join(dir, 'request.json'), JSON.stringify(request));
    process.env.HF_CLI_INPUT = join(dir, 'request.json');
    process.env.HOME = dir;
    delete process.env.HF_CLI_COUNT;
    process.chdir(dir);
    // The request identity replaces the suggested basename, retaining its format.
    for (const [outputDir, expectedName] of [
      [undefined, 'browser.original.png'], ['custom output', 'browser.custom.png'],
    ] as const) {
      downloadName = expectedName;
      if (outputDir === undefined) delete process.env.HF_CLI_DOWNLOAD_DIR;
      else process.env.HF_CLI_DOWNLOAD_DIR = outputDir;
      // The production wait is ten minutes; a broken fixture must fail promptly.
      task = generate(page);
      await Promise.race([
        task,
        new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Visible Gradio result was not downloaded')), 20_000); }),
      ]);
      clearTimeout(deadline);
      const destination = join(dir, outputDir ?? 'Downloads');
      const files = readdirSync(destination);
      assert.equal(files.length, 1);
      assert.match(files[0], /^request\.json_[0-9a-f]{40}_[0-9a-f-]{36}\.png$/);
      assert.deepEqual(readFileSync(join(destination, files[0])), png);
      rmSync(destination, { recursive: true, force: true });
    }

    process.env.HF_CLI_COUNT = '5';
    generations = downloads = 0;
    task = generate(page);
    await Promise.race([
      task,
      new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Batch did not finish')), 40_000); }),
    ]);
    clearTimeout(deadline);
    assert.equal(generations, 5, 'submit each generation, never reuse stale output');
    assert.equal(downloads, 5);
    const destination = join(dir, 'custom output');
    const files = readdirSync(destination);
    assert.equal(files.length, 5, 'keep all five downloads despite identical suggested filenames');
    for (const file of files) assert.deepEqual(readFileSync(join(destination, file)), png);
    rmSync(destination, { recursive: true, force: true });

    // A quota error mid-batch must preserve completed files and stop submission.
    generations = downloads = 0;
    limitAt = 2;
    task = generate(page);
    await assert.rejects(Promise.race([
      task,
      new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Usage limit was not reported')), 20_000); }),
    ]), /Guest quota reached/);
    clearTimeout(deadline);
    assert.equal(generations, 2, 'stop the batch at the first quota error');
    assert.equal(downloads, 1);
    assert.equal(readdirSync(destination).length, 1, 'retain completed images on failure');
    rmSync(destination, { recursive: true, force: true });

    resultMode = 'limit';
    task = generate(page);
    await assert.rejects(Promise.race([
      task,
      new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Usage limit was not reported')), 20_000); }),
    ]), /Guest quota reached/);
    clearTimeout(deadline);
    assert.ok(!existsSync(destination), 'quota errors must not download an image');
    console.log('Output/download, five-image batch, and usage-limit regressions passed.');
  } finally {
    clearTimeout(deadline);
    await page.close();
    await task?.catch(() => {});
    process.chdir(cwd);
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
}
