import tseslint from "typescript-eslint"
import globals from "globals"

// Browser-only globals (exclude standard ES); patches must use globalObject.XXX instead.
const browserOnlyGlobalNames = Object.keys(globals.browser).filter(
  (name) => !(name in globals.es2021)
)
const noRestrictedBrowserGlobals = browserOnlyGlobalNames.map((name) => ({
  name,
  message: `Use globalObject.${name} from the patch parameter instead of the global ${name}.`
}))

export default [
  {
    ignores: [
      "artifacts/**",
      "dist/**",
      "node_modules/**",
      // Generated wasm2js — huge, not typed as TS; keep sibling math.min.d.ts in the program instead.
      "math/math.js",
      "math/math.min.js",
      "math/math.wasm"
    ]
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: [
      "src/**/*.ts",
      "math/**/*.d.ts",
      "tools/**/*.ts",
      "test/**/*.ts",
      "webstore/**/*.ts",
      "*.config.js"
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
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
  },
  // Patches must use globalObject.XXX only; no bare browser globals.
  {
    files: ["src/content_scripts/patches/**/*.ts"],
    rules: {
      "no-restricted-globals": ["error", ...noRestrictedBrowserGlobals]
    }
  }
];