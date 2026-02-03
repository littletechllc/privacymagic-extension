import * as esbuild from 'esbuild'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'

const isProduction = process.env.NODE_ENV === 'production'

const baseBuildOptions = {
  bundle: true,
  format: /** @type {const} */ ('iife'),
  sourcemap: isProduction ? false : /** @type {const} */ ('inline'),
  target: /** @type {const} */ ('es2020'),
  platform: /** @type {const} */ ('browser'),
  minifyIdentifiers: isProduction,
  // Don't minify syntax/whitespace to avoid inlining helper functions
  // which could make us vulnerable to monkey patching
  // TODO: re-examine what kind of minification is safe to do
  minifySyntax: false,
  minifyWhitespace: false,
  legalComments: /** @type {const} */ ('none'),
  treeShaking: true,
  // Node resolution for browser environment
  packages: /** @type {const} */ ('bundle'),
  mainFields: ['browser', 'module', 'main'],
  conditions: ['browser'],
  alias: {
    '@src': 'src',
    '@tools': 'tools',
    '@test': 'test'
  }
}

const builds = [
  {
    entryPoints: ['src/content_scripts/main.ts'],
    outfile: 'dist/content_scripts/main.js',
    banner: {
      js: 'const __PRIVACY_MAGIC_INJECT__ = function(__disabledSettings) {'
    },
    footer: {
      js: '};\n__PRIVACY_MAGIC_INJECT__();'
    }
  },
  {
    entryPoints: ['src/content_scripts/isolated.ts'],
    outfile: 'dist/content_scripts/isolated.js'
  },
  {
    entryPoints: ['src/background/index.ts'],
    outfile: 'dist/background/index.js'
  },
  {
    entryPoints: ['src/content_scripts/youtube.ts'],
    outfile: 'dist/content_scripts/youtube.js'
  },
  {
    entryPoints: ['src/default_popup/popup.ts'],
    outfile: 'dist/default_popup/popup.js'
  },
  {
    entryPoints: ['src/privacymagic/http-warning.ts'],
    outfile: 'dist/privacymagic/http-warning.js'
  },
  {
    entryPoints: ['src/privacymagic/options.ts'],
    outfile: 'dist/privacymagic/options.js'
  },
  {
    entryPoints: ['src/privacymagic/sidepanel.ts'],
    outfile: 'dist/privacymagic/sidepanel.js'
  }
]

/**
 * Ensures that the directory for a given file path exists.
 * @param {string} filePath - The path to the file.
 */
async function ensureDir (filePath) {
  const dir = dirname(filePath)
  try {
    await mkdir(dir, { recursive: true })
  } catch {
    // Directory might already exist, ignore
  }
}

async function build () {
  for (const buildConfig of builds) {
    await ensureDir(buildConfig.outfile)
    await esbuild.build({
      ...baseBuildOptions,
      ...buildConfig
    })
  }
}

async function watch () {
  // Watch all builds individually
  /** @type {esbuild.BuildContext[]} */
  const contexts = []
  for (const buildConfig of builds) {
    await ensureDir(buildConfig.outfile)
    const ctx = await esbuild.context({
      ...baseBuildOptions,
      ...buildConfig
    })
    await ctx.watch()
    contexts.push(ctx)
  }
  // Keep process alive
  process.on('SIGINT', () => {
    Promise.all(contexts.map(ctx => ctx.dispose())).then(() => {
      process.exit(0)
    }).catch(console.error)
  })
}

const command = process.argv[2]
if (command === 'watch') {
  watch().catch(console.error)
} else {
  build().catch(console.error)
}
