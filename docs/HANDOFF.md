# Handoff: Complete Anima V1 image generation

**Date:** 2026-10-05

**Status:** In progress — waiting for manual Hugging Face sign-in

## Context

The local JSON-to-Hugging-Face app is implemented and committed, but a live generation has not produced an image. The Anima V1 Space loaded, all request fields were populated, and Generate was clicked. Hugging Face then displayed **“Guest quota reached”** and requested sign-in; the app consequently timed out waiting for output. No `downloads/` directory or image exists yet.

## Decision

Continue with the approved jailed Firefox backend. It uses Nixpkgs’ matching Playwright Core and patched Firefox, retains the bubblewrap jail and shared persistent profile, and intentionally gives up Patchright’s Chromium stealth behavior. Authentication remains manual; do not add tokens or automate login.

## Alternatives considered

- Keep troubleshooting Chromium/Patchright: rejected because Chromium networking failed even against localhost outside the jail, while Firefox automation and jailed networking work.
- Use stock Firefox with Playwright: rejected because it is not compatible with Playwright’s Firefox/Juggler driver. Use the browser from the same Nixpkgs `playwright-driver` as Playwright Core.

## Consequences

- A user must sign in through the persistent Firefox profile if Hugging Face’s guest quota blocks generation.
- Close Firefox before running automation; Firefox locks a profile to one process.
- Firefox is not stealth-patched; bot challenges may still occur.
- `hf-cli/flake.nix` intentionally references `/home/theta/repos/replay_right`; a sibling-relative flake path escapes the consumer Git tree and is rejected by Nix.

## Resumption (for Agent)

### Current state

- `replay_right`, branch `feature/firefox-support`: commit `6ff4849` (`feat(browser): switch jailed automation to Firefox`).
- `hf-cli`, branch `feature/hf-image-generation`: commit `49f293f` (`feat(hf-cli): generate and save Anima images`).
- Both worktrees were clean after those commits. Changes are local; no merge or push has been done.
- Verified: both flake checks, Firefox localhost/profile-persistence and runner tests, jail isolation, consumer scaffold test, request validation, task-package import, form mapping, and download-filename test.
- The real Space exposes slider accessible names as `range slider for <label>`; the task and fixture already use those names.
- The Nix task bundle must copy `task.ts` and `save-download.mjs` to explicit names in one output directory, plus `package.json` with `type: module`. A lone `${./task.ts}` store path breaks its relative helper import.
- The profile is `/home/theta/repos/hf-cli/cookies`; no authenticated session has been verified. `downloads/` does not exist.

### Next steps, in order

1. **User:** From `/home/theta/repos/hf-cli`, run `nix run .#browser -- ./cookies`, sign in to Hugging Face in the opened Firefox window, close Firefox completely, then tell the assistant the profile is ready. Keep credentials private; do not provide tokens.
2. **Assistant:** Confirm the browser is closed, then run `nix run .#default -- ./generation.example.json` from `hf-cli`.
3. **Assistant:** If generation succeeds, verify the non-empty image is under `downloads/` and that its basename and format match the browser download’s `suggestedFilename()`. Do not rename or convert it.
4. **Assistant:** If it still fails, capture the current Space error and diagnose that failure before editing. Keep the jail, fixed Space URL, manual-auth boundary, and download-name preservation intact.
5. **Assistant:** Re-run the consumer checks after any code change; commit follow-up changes separately with a Conventional Commit message. Update this handoff with the verified result. Do not merge or push without the user’s direction.

### How to verify

```sh
cd /home/theta/repos/hf-cli
nix flake check
node tests/test-save-download.mjs
nix run .#default -- ./generation.example.json
```

Form mapping can be rechecked with the committed Firefox runner:

```sh
cd /home/theta/repos/replay_right
nix develop . --command node --experimental-strip-types pw/runner.ts \
  /home/theta/repos/hf-cli/cookies \
  /home/theta/repos/hf-cli/tests/test-form-mapping.ts
```

### Related

- Implementation plans: `/tmp/replay_right-firefox-plan.md` and `/tmp/hf-image-generation-plan.md`.
- Fixed Space: <https://huggingface.co/spaces/mrfakename/anima-v1>.
