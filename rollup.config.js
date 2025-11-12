import terser from '@rollup/plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  input: 'monkey-patch/main.js',
  output: {
    file: 'extension/content_scripts/foreground.js',
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
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false
  }
};

