import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveDownload } from "../save-download.mjs";

const root = await mkdtemp(join(tmpdir(), "hf-cli-"));
try {
  const name = await saveDownload({
    suggestedFilename: () => "image.webp",
    saveAs: async path => writeFile(path, "webp bytes"),
  }, join(root, "downloads"));
  assert.equal(name, "image.webp");
  assert.equal(await readFile(join(root, "downloads", "image.webp"), "utf8"), "webp bytes");
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("download filename check passed");
