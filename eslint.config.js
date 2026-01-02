import semistandard from 'eslint-config-semistandard';
import { FlatCompat } from '@eslint/eslintrc';
import globals from 'globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

export default [
  {
    ignores: [
      'artifacts/**',
      'dist/**',
      'src/thirdparty/**',
      'node_modules/**'
    ]
  },
  ...compat.config(semistandard), // Convert semistandard to flat config
  {
    languageOptions: {
      globals: {
        ...globals.browser, // Enable DOM globals
        ...globals.node, // Enable Node.js globals if needed
        chrome: 'readonly', // Chrome extension API
        self: 'readonly' // Worker/global scope
      }
    },
    rules: {
      // You can still add custom overrides here
    }
  }
];
