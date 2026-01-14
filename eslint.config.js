import tseslint from "typescript-eslint"

export default [
  {
    ignores: ["artifacts/**", "dist/**", "node_modules/**", "*.config.js"]
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts", "tools/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      eqeqeq: ["error", "always"],
      "no-implicit-coercion": "error",
      "no-cond-assign": ["error", "always"],
      "no-constant-condition": "error",
      "no-fallthrough": "error",
      "no-prototype-builtins": "error",
      "use-isnan": "error",
    }
  }
];