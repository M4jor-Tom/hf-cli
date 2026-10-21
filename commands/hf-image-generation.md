# Functional command: Anima V1 image generation

Cookies dir: `./cookies` · Script: `./task.ts` · Request: `<request.json>`

## Steps
1. Open `https://huggingface.co/spaces/mrfakename/anima-v1`.
2. Read the JSON request path supplied to `nix run .#default -- [--count N | -n N] <request.json>`; the flake validates it against `generation.schema.json` before the browser starts.
3. Fill Prompt, Negative prompt, recommended prefix, Width, Height, Steps, CFG scale, Sigma shift, and Seed from the validated request.
4. Click **Generate** and wait for the output image.
5. Download the output under `~/Downloads/`, or the directory supplied with `--download-dir <path>`. Use `rename_image.sh` to name it `<request-filename>_<sha1>_<uuid>`, retaining the downloaded extension.
6. Repeat steps 1–5 for each requested image (default: one); stop on any failure, keeping completed downloads.

## Success
The requested number of non-empty images exists in the selected download directory with unique request identities and the format supplied by the Space's download. The command prints each absolute path.
