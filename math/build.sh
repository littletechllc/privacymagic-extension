emcc math.c \
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