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
      }
    }
  }
];