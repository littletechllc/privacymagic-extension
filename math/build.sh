#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

EMSDK_VERSION="$(tr -d '[:space:]' < EMSDK_VERSION)"
if ! command -v emcc >/dev/null 2>&1; then
  echo "error: emcc not on PATH. Install and activate emsdk ${EMSDK_VERSION}, then source emsdk_env.sh" >&2
  exit 1
fi
EMCC_VERSION="$(emcc -v 2>&1 | sed -n 's/.*) \([0-9][0-9.]*\) (.*/\1/p' | head -1)"
if [ "$EMCC_VERSION" != "$EMSDK_VERSION" ]; then
  echo "error: active emcc is ${EMCC_VERSION}, expected ${EMSDK_VERSION} (see math/EMSDK_VERSION)" >&2
  exit 1
fi

emcc \
  -Oz \
  -fno-builtin \
  -fno-fast-math \
  -fno-exceptions \
  -Wl,--no-entry \
  -Wl,--strip-all \
  -Wl,--gc-sections \
  -Wl,--lto-O3 \
  -s EXPORTED_FUNCTIONS='["_acos","_acosh","_asin","_asinh","_atan","_atanh","_cbrt","_cos","_cosh","_exp","_expm1","_log","_log1p","_log2","_log10","_sin","_sinh","_sqrt","_tan","_tanh","_atan2","_pow"]' \
  -s EXPORTED_RUNTIME_METHODS='[]' \
  -o math.wasm

wasm2js math.wasm -o math.js --enable-nontrapping-float-to-int --enable-sign-ext --pedantic

npx esbuild math.js --minify --format=esm --outfile=math.min.js