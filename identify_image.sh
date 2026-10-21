#!/bin/sh

if [ $# -ne 1 ]; then
	echo "USAGE: identify_image <prompt-path>"
	exit 0
fi

# Archive the prompt in the same operation that mints the reference to it
# (ADR 0001). Git history IS the archive; without this the digest below is a
# dangling pointer, which is how 86% of past prompts were lost.
#
# Every failure warns and continues (ADR 0004): priority is image > prompt >
# link between them, and rename_image.sh moves a fixed ~/Downloads/image.webp,
# so a non-zero exit here strands the image at a path the next generation
# overwrites. Warnings go to stderr - stdout is captured as the filename.
warn() { echo "$*" >&2; }

# git -C resolves pathspecs against -C, not the caller's cwd, so both the
# target and the repo root must be absolute before they are combined.
target="$(CDPATH= cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")"
if repo="$(git -C "$(dirname -- "$target")" rev-parse --show-toplevel 2>/dev/null)"; then
	if git -C "$repo" check-ignore -q -- "$target"; then
		warn "WARNING: $1 is gitignored - this image's prompt can never be archived."
	elif ! git -C "$repo" add -- "$target" 2>/dev/null; then
		warn "WARNING: could not stage $1 - the link will dangle until this"
		warn "         content is committed. The digest resolves retroactively."
	elif ! git -C "$repo" diff --cached --quiet -- "$target" \
	     && ! git -C "$repo" commit -q -m "snapshot: ${target#"$repo"/}" -- "$target" 2>/dev/null; then
		warn "WARNING: could not commit $1 - the link will dangle until this"
		warn "         content is committed. The digest resolves retroactively."
	fi
else
	warn "WARNING: $1 is not inside a git repository - prompt will not be archived."
fi

echo "$(basename "$1")_$(sha1sum "$1" | cut -d ' ' -f 1)_$(uuidgen)"
