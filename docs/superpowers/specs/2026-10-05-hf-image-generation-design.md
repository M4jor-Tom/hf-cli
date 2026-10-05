# hf-cli — Hugging Face image generation design

**Date:** 2026-10-05  
**Status:** Design agreed in chat; written-spec review pending  
**Technical dependency:** `../replay_right`

## Purpose

Provide a small Nix-flake consumer repo that reads a user-selected JSON generation request, fills the Anima V1 Hugging Face Space, launches generation, and downloads the produced image.

## Goals and non-goals

**Goals**
- Use `../replay_right` as a local flake input; do not change that technical flake.
- Select the request at invocation time: `nix run .#default -- path/to/request.json`.
- Validate the request against a checked-in JSON Schema before launching the browser.
- Automate the visible Space UI and preserve the downloaded file's suggested name and extension (normally `image.webp`). Save it under `downloads/` without converting or renaming it.
- Reuse `replay_right`'s persistent browser profile; if Hugging Face login is needed, let the user log in manually.

**Non-goals**
- Additional Spaces, a Space selector, direct/private Gradio API calls, image post-processing, retries, and automatic authentication.
- Changes to `../replay_right`.

## Live Space controls and request contract

The current Space is `https://huggingface.co/spaces/mrfakename/anima-v1`. Its Gradio config exposes these generation inputs:

| JSON property | Space control | Constraint |
| --- | --- | --- |
| `positive_prompt` | Prompt | Non-empty string |
| `negative_prompt` | Negative prompt | String; may be empty |
| `prepend_recommended_prefix` | Prepend recommended prefix | Boolean |
| `width`, `height` | Width, Height | Integer 512–1536, divisible by 16 |
| `steps` | Steps | Integer 10–60 |
| `cfg_scale` | CFG scale | Number 1–8, increments of 0.1 |
| `sigma_shift` | Sigma shift | Number 0–8, increments of 0.1 |
| `seed` | Seed (`-1` means random) | Integer ≥ -1 |

All nine properties are required and extra properties are rejected. The checked-in sample must conform to `generation.schema.json`.

## Architecture and flow

- `flake.nix` consumes `replay_right` using `path:../replay_right`, follows its nixpkgs input, and wires `replay_right.lib.mkApp` to `task.ts` and `./cookies`.
- Because `mkApp` does not forward arbitrary command-line arguments to the task, a small wrapper accepts one JSON path, resolves it, validates it with the JSON Schema, exports the resolved path for the task, then invokes the generated `mkApp` program.
- `task.ts` reads that path from the environment, opens the one configured Space, maps the nine JSON fields to the visible labeled controls, and clicks **Generate**.
- Once the output is ready, the script uses the Space's download control and saves the browser download as `downloads/<download.suggestedFilename()>`. It preserves the suggested basename and extension; it does not force `result.png` or convert the image.
- Invalid/missing JSON or schema violations fail before Chromium starts. A missing generated image/download after the wait deadline fails with an error instead of reporting success.

## Authentication and operation

The first inspection of the live public Space required no login. The app uses `replay_right`'s Chromium profile, not the user's Firefox profile. If a run requires Hugging Face authentication, the user logs in manually with:

```sh
nix run .#browser -- ./cookies
```

After closing that browser, run the generator:

```sh
nix run .#default -- path/to/request.json
```

The image is placed in `downloads/` under the server/browser-suggested filename. Cookies and generated downloads are gitignored.

## Error handling and verification

- Validate both JSON syntax and the full JSON Schema before browser startup.
- Reject missing or extra fields and out-of-range/non-step-aligned values.
- Wait for generation and the image download; propagate browser errors and timeouts.
- Check that the sample validates, an invalid request fails before launching a browser, and the flake app evaluates as an app.
- Perform a manual live generation/download check when browser authentication and the Space are available; preserve the actual downloaded filename and extension.

## Example request

```json
{
  "positive_prompt": "A red fox in a snowy forest, soft morning light",
  "negative_prompt": "blurry, low quality, watermark",
  "prepend_recommended_prefix": true,
  "width": 1408,
  "height": 1408,
  "steps": 35,
  "cfg_scale": 6.0,
  "sigma_shift": 0.0,
  "seed": -1
}
```
