#!/bin/sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 3 ]; then
	echo "usage: rename_image.sh <request.json> [downloaded-image] [output-dir]" >&2
	exit 2
fi

downloaded_image_path="${2:-${HOME}/Downloads/image.webp}"
if ! [ -f "$1" ] || ! [ -f "$downloaded_image_path" ]; then
	echo "Request or downloaded image not found" >&2
	exit 1
fi
output_dir="${3:-$(dirname -- "$downloaded_image_path")}"
output_dir="$(CDPATH= cd -- "$output_dir" && pwd)"
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
new_image_identity="$("$script_dir/identify_image.sh" "$1")"
filename="$(basename -- "$downloaded_image_path")"
extension=""
case "$filename" in *.*) extension=".${filename##*.}" ;; esac
new_image_path="$output_dir/$new_image_identity$extension"

mv -nT -- "$downloaded_image_path" "$new_image_path"
if [ -e "$downloaded_image_path" ]; then
	echo "$new_image_path already exists" >&2
	exit 3
fi
printf '%s\n' "$new_image_path"
