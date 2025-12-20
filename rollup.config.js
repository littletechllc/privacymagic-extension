import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';

const createTerserPolicy = () => terser({
  // Don't compress; we dont want inlining of helper functions
  // because it could make us vulnerable to monkey patching.
  compress: false,
  // Mangle variable names to reduce the size of the bundle in production.
  mangle: isProduction,
  // Remove comments from the output.
  output: {
    comments: false
  }
});

const createPolicy = (inputFile, outputFile, additionalOutputSettings) => ({
  input: inputFile,
  output: {
    file: outputFile,
    format: 'iife',
    sourcemap: isProduction ? false : 'inline',
    ...additionalOutputSettings
  },
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    ...(isProduction ? [createTerserPolicy()] : [])
  ],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false
  },
  watch: {
    clearScreen: false
  }
});

export default [
  createPolicy('src/content_scripts/content.js', 'dist/content_scripts/content.js', {
    intro: 'const __PRIVACY_MAGIC_INJECT__ = function(__disabledSettings) {',
    outro: '};\n__PRIVACY_MAGIC_INJECT__();'
  }),
  createPolicy('src/background/index.js', 'dist/background/index.js'),
  createPolicy('src/content_scripts/youtube.js', 'dist/content_scripts/youtube.js'),
  createPolicy('src/default_popup/popup.js', 'dist/default_popup/popup.js'),
  createPolicy('src/privacymagic/http-warning.js', 'dist/privacymagic/http-warning.js'),
  createPolicy('src/privacymagic/options.js', 'dist/privacymagic/options.js')
];
