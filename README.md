# hf-cli

A Nix-flake consumer of [`replay_right`](../replay_right) for generating images in the [Anima V1 Hugging Face Space](https://huggingface.co/spaces/mrfakename/anima-v1).

## Generate

If the Space requires Hugging Face login, open the persistent jailed Firefox profile and log in manually:

```sh
nix run .#join -- ./cookies
```

Close that browser, then select a JSON request file:

```sh
nix run .#default -- ./generation.example.json
```

Use any JSON file conforming to [`generation.schema.json`](generation.schema.json). The app validates it before launching Firefox. Downloads go in `downloads/` and keep the filename and extension suggested by the Space.

## Check

```sh
nix flake check
node tests/test-save-download.mjs
```

The validation contract is also covered by the flake check. The local form fixture checks locator behavior offline; to check the current Hugging Face UI without starting a generation, run the live smoke test from this repo:

```sh
HF_CLI_DIR="$(pwd)"
(cd ../replay_right && nix develop . --command node --experimental-strip-types \
  pw/runner.ts "$HF_CLI_DIR/cookies" "$HF_CLI_DIR/tests/test-live-form-mapping.ts")
```
