# Functional command: Anima V1 image generation

Cookies dir: `./cookies` · Script: `./task.ts` · Request: `<request.json>`

## Steps
1. Open `https://huggingface.co/spaces/mrfakename/anima-v1`.
2. Read the JSON request path supplied to `nix run .#default -- <request.json>`; the flake validates it against `generation.schema.json` before the browser starts.
3. Fill Prompt, Negative prompt, recommended prefix, Width, Height, Steps, CFG scale, Sigma shift, and Seed from the validated request.
4. Click **Generate** and wait for the output image.
5. Download the output and preserve its suggested filename and extension under `downloads/`.

## Success
A non-empty generated image exists under `downloads/` with the filename and format supplied by the Space's download.
