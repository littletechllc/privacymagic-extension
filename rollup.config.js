import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import commonjs from '@rollup/plugin-commonjs';

const isProduction = process.env.NODE_ENV === 'production';

const commonPlugins = [
  copy({
    targets: [
      { src: 'src/manifest.json', dest: 'dist' },
      { src: 'src/_locales', dest: 'dist' },
      { src: 'src/content_scripts/youtube.js', dest: 'dist/content_scripts' },
      { src: 'src/logo', dest: 'dist' },
      { src: 'src/default_popup/popup.html', dest: 'dist/default_popup' },
      { src: 'src/default_popup/dummy-module-object.js', dest: 'dist/default_popup' },
      { src: 'src/default_popup/popup.css', dest: 'dist/default_popup' },
      { src: 'src/privacymagic/options.html', dest: 'dist/privacymagic' },
      { src: 'src/privacymagic/options.css', dest: 'dist/privacymagic' },
      { src: 'src/privacymagic/http-warning.html', dest: 'dist/privacymagic' },
      { src: 'src/rules', dest: 'dist' },
      { src: 'src/common/*.css', dest: 'dist/common' },
      { src: 'src/content_scripts/adblock_css', dest: 'dist/content_scripts' }
    ]
  })
];

const createTerserPolicy = () => (
  terser({
    // Don't compress; we dont want inlining of helper functions
    // because it could make us vulnerable to monkey patching.
    compress: false,
    // Mangle variable names to reduce the size of the bundle in production.
    mangle: isProduction,
    // Remove comments from the output.
    output: {
      comments: false
    }
  })
);

const createPolicy = (inputFile, outputFile, additionalOutputSettings) => ({
  input: inputFile,
  output: {
    file: outputFile,
    format: 'iife',
    sourcemap: isProduction ? false : 'inline',
    ...additionalOutputSettings
  },
  plugins: [
    commonjs(),
    ...commonPlugins,
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
  createPolicy('src/privacymagic/options.js', 'dist/privacymagic/options.js'),
  createPolicy('src/privacymagic/http-warning.js', 'dist/privacymagic/http-warning.js'),
  createPolicy('src/default_popup/popup.js', 'dist/default_popup/popup.js')
];
