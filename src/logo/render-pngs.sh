#!/usr/bin/env bash
# Render logo.svg to the PNG sizes used by the extension.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v magick >/dev/null 2>&1; then
  echo "error: magick (ImageMagick) is required" >&2
  exit 1
fi

if [[ ! -f logo.svg ]]; then
  echo "error: logo.svg not found in $(pwd)" >&2
  exit 1
fi

sizes=(16 19 32 38 48 64 128 192 300)

for size in "${sizes[@]}"; do
  out="logo-${size}.png"
  magick -background none -density 2400 logo.svg -resize "${size}x${size}" "PNG32:${out}"
  echo "wrote ${out}"
done
