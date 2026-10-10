# Lessons

- For generation tasks, accept the requested JSON path as an argument instead of hardcoding one input file; preserve the download's suggested filename and extension rather than choosing a replacement name or format.
- Keep approved implementation plans under `/tmp`; remove transient design docs from the repo after approval, put durable feature documentation in `docs/features/<slug>.md` only when needed, and execute inline when requested.
- For multi-repo work, commit each completed repository or milestone separately before moving to the next; do not leave substantial work uncommitted.
- Keep manual authentication navigation distinct from automation navigation: `.#join` opens `https://huggingface.co/join`, while the generation task navigates to the Space. Don't infer the signup destination from the task's target URL.
