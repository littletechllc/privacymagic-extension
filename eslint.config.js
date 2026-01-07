import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["src/**/*.ts", "tools/**/*.ts"],
  extends: [...tseslint.configs.recommendedTypeChecked],
  languageOptions: {
    parserOptions: {
      project: "./tsconfig.json",
    }
  }
});