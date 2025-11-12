import terser from '@rollup/plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';

const createPolicy = (inputFile, outputFile) => ({
  input: inputFile,
  output: {
    file: outputFile,
    format: 'iife',
    sourcemap: isProduction ? false : 'inline'
  },
  plugins: [
    terser({
      // Don't compress; we dont want inlining of helper functions
      // because it could make us vulnerable to monkey patching.
      compress: false,
      // Mangle variable names to reduce the size of the bundle.
      mangle: true,
      // Remove comments from the output.
      output: {
        comments: false
      }
    })
  ],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false
  }
});

export default [
  createPolicy('inject/main.js', 'extension/content_scripts/foreground.js'),
  createPolicy('inject/isolated.js', 'extension/content_scripts/isolated.js')
];
