import { mkdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

export async function saveDownload(download, outputDir = "downloads") {
  const name = download.suggestedFilename();
  if (!name || name === "." || name === ".." || basename(name) !== name) {
    throw new Error(`unsafe download filename: ${name}`);
  }
  await mkdir(outputDir, { recursive: true });
  await download.saveAs(resolve(outputDir, name));
  return name;
}
