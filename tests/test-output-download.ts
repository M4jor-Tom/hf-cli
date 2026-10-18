import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
  const previousInput = process.env.HF_CLI_INPUT;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let task: Promise<void> | undefined;
  const server = createServer((req, res) => {
    if (req.url === '/image' || req.url === '/download') {
      res.setHeader('content-type', 'image/png');
      if (req.url === '/download') res.setHeader('content-disposition', 'attachment; filename="browser.original.png"');
      res.end(png);
    } else {
      const { port } = server.address() as { port: number };
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(req.url === '/' ? `<iframe aria-label="Space app" src="http://localhost:${port}/form"></iframe>` : `${form}
        <div class="block"><label>Unrelated preview</label><img src="/image" alt="">
          <a data-testid="download-link" href="/wrong"><button aria-label="Download">Wrong download</button></a>
        </div>
        <button onclick="document.getElementById('result').hidden = false">Generate</button>
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
    process.chdir(dir);
    // The production wait is ten minutes; a broken fixture must fail promptly.
    task = generate(page);
    await Promise.race([
      task,
      new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Visible Gradio result was not downloaded')), 20_000); }),
    ]);
    assert.deepEqual(readdirSync(join(dir, 'downloads')), ['browser.original.png']);
    assert.deepEqual(readFileSync(join(dir, 'downloads/browser.original.png')), png);
    console.log('Output/download regression passed (empty alt, scoped link, original filename).');
  } finally {
    clearTimeout(deadline);
    await page.close();
    await task?.catch(() => {});
    process.chdir(cwd);
    if (previousInput === undefined) delete process.env.HF_CLI_INPUT;
    else process.env.HF_CLI_INPUT = previousInput;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
}
