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
    terser()
  ],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false
  }
};

