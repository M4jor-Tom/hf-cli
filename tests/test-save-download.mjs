import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveDownload } from "../save-download.mjs";

const root = await mkdtemp(join(tmpdir(), "hf-cli-"));
const previousHome = process.env.HOME;
const cwd = process.cwd();
try {
  process.env.HOME = root;
  process.chdir(root);
  const request = join(root, "request with spaces.json");
  await writeFile(request, '{"positive_prompt":"test"}\n');
  for (const [outputDir, expectedDir] of [
    [undefined, join(root, "Downloads")],
    ["custom output", join(root, "custom output")],
  ]) {
    await mkdir(expectedDir, { recursive: true });
    await writeFile(join(expectedDir, "image.webp"), "existing image");
    const paths = [];
    for (let i = 0; i < 2; i++) {
      const path = await saveDownload({
        suggestedFilename: () => "image.webp",
        saveAs: async path => writeFile(path, `webp bytes ${i}`),
      }, outputDir, request);
      assert.ok(existsSync(path), `download must be saved to ${path}`);
      assert.equal(join(path, ".."), expectedDir);
      assert.match(path.slice(expectedDir.length + 1), /^request with spaces\.json_fad99262fb0330c9e4c09372d66b3479e3343b5d_[0-9a-f-]{36}\.webp$/);
      assert.equal(await readFile(path, "utf8"), `webp bytes ${i}`);
      paths.push(path);
    }
    assert.notEqual(paths[0], paths[1], "repeated downloads must never overwrite each other");
    assert.equal((await readdir(expectedDir)).length, 3, "remove successful staging directories");
    assert.equal(await readFile(join(expectedDir, "image.webp"), "utf8"), "existing image");
  }
  const failedDir = join(root, "failed rename");
  await assert.rejects(saveDownload({
    suggestedFilename: () => "image.webp",
    saveAs: async path => writeFile(path, "retained image"),
  }, failedDir, join(root, "missing.json")), /image retained at/);
  const [staging] = await readdir(failedDir);
  assert.equal(await readFile(join(failedDir, staging, "image.webp"), "utf8"), "retained image");

  for (const name of ["", ".", "..", "../escape.webp", "/escape.webp"]) {
    await assert.rejects(saveDownload({ suggestedFilename: () => name }), /unsafe download filename/);
  }
} finally {
  process.chdir(cwd);
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
console.log("download directory and filename checks passed");
