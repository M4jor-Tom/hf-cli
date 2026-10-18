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

## Use your installed Firefox

To use a normal named Firefox profile outside the jail:

```sh
nix run .#join -- --browser firefox privacy
# Close that Firefox profile, then generate:
nix run .#default -- --browser firefox privacy ./generation.example.json
# Add --headed to watch the generation in Firefox:
nix run .#default -- --headed --browser firefox privacy ./generation.example.json
```

`--headed` opens the automation browser visibly; it is headless by default.
`--browser firefox` requires a profile name (`default`, `privacy`, or another
registered name). `privacy` is **not** a private window. Close that profile before
each command; leave other profiles open. Your normal cookies, settings and
extensions are used, and the app does not overwrite `user.js` with automation
preferences. This mode uses installed `firefox` from `PATH`, bypasses bubblewrap,
and does not use `./cookies`. Without the option, the existing jailed flow remains.
Using stock Firefox does not guarantee that Hugging Face will lift an IP block.
The script follows the Space iframe's URL into a top-level page, keeping its query
parameters, because stock Firefox/BiDi can drop input and clicks across frame origins.

## Check

```sh
nix flake check
node tests/test-save-download.mjs
```

The validation contract is also covered by the flake check. The form fixture tests
cross-origin app navigation, retained query parameters, input events, and all fields offline:

```sh
(
  profile="$(mktemp -d)"
  trap 'rm -rf "$profile"' EXIT
  nix run ../replay_right#run -- "$profile" ./tests/test-form-mapping.ts
)
```

The output/download regression uses a local fixture (no HF requests or quota),
including an empty-alt result image, an unrelated download, and the browser's
suggested filename. With the selected Firefox profile closed:

```sh
nix run ../replay_right#run -- --browser firefox privacy ./tests/test-output-download.ts
```

Jailed downloads currently have a separate filesystem issue: Firefox writes its
Playwright artifact inside bubblewrap's private `/tmp`, where the host-side runner
cannot read it. The installed-Firefox flow is verified end to end.

To check the current Hugging Face UI without starting a generation, close the
selected Firefox profile and run:

```sh
nix run ../replay_right#run -- --browser firefox privacy ./tests/test-live-form-mapping.ts
```
