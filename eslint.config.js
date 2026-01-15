import tseslint from "typescript-eslint"

export default [
  {
    ignores: ["artifacts/**", "dist/**", "node_modules/**"]
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts", "tools/**/*.ts", "test/**/*.ts", "*.config.js"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "args": "all",
          "argsIgnorePattern": "^_",
          "caughtErrors": "all",
          "caughtErrorsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ],
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-cond-assign": ["error", "always"],
      "no-constant-condition": "error",
      "no-fallthrough": "error",
      "no-implicit-coercion": "error",
      "no-multiple-empty-lines": "error",
      "no-prototype-builtins": "error",
      "no-trailing-spaces": "error",
      "use-isnan": "error",
    }
  }
];