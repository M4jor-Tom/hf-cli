import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export async function saveDownload(download, outputDir = join(homedir(), "Downloads"), inputPath) {
  const name = download.suggestedFilename();
  if (!name || name === "." || name === ".." || basename(name) !== name) {
    throw new Error(`unsafe download filename: ${name}`);
  }
  await mkdir(outputDir, { recursive: true });
  // Stage separately: neither an existing download nor a failed rename may be lost.
  const staging = await mkdtemp(join(resolve(outputDir), ".hf-cli-"));
  const path = join(staging, name);
  await download.saveAs(path);
  const { stdout, stderr } = await execFile(
    fileURLToPath(new URL("./rename_image.sh", import.meta.url)), [inputPath, path, resolve(outputDir)],
  ).catch(error => {
    throw new Error(`Could not rename download; image retained at ${path}`, { cause: error });
  });
  if (stderr) process.stderr.write(stderr);
  await rm(staging, { recursive: true });
  return stdout.trimEnd();
}
