import tseslint from "typescript-eslint"

export default [
  {
    ignores: ["artifacts/**", "dist/**", "node_modules/**"]
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts", "tools/**/*.ts", "*.config.js"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-implicit-coercion": "error",
      "no-cond-assign": ["error", "always"],
      "no-constant-condition": "error",
      "no-fallthrough": "error",
      "no-prototype-builtins": "error",
      "no-trailing-spaces": "error",
      "use-isnan": "error",
    }
  }
];