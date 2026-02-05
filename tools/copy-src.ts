import chokidar from 'chokidar'
import { execSync } from 'node:child_process'
import type { ExecSyncOptionsWithStringEncoding } from 'node:child_process'
import * as path from 'node:path'
import { mkdir, copyFile, readdir, stat, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const srcDir: string = process.argv[2] ?? 'src'
const distDir: string = process.argv[3] ?? 'dist'
const watchMode: boolean = process.argv.includes('--watch')

const isExcluded = (file: string): boolean => /\.(js|ts|mjs)$/.test(file) || path.parse(file).base.startsWith('.')

const gitOpts : ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf8' as const,
  maxBuffer: 64,
  stdio: ['pipe', 'pipe', 'ignore']
}

/** Version for dist manifest: latest git tag (strip "v") or short hash. */
const getBuildVersion = (): string => {
  try {
    const exact = execSync('git describe --tags --exact-match', gitOpts).trim()
    if (exact) return exact.replace(/^v/, '')
  } catch {
    // no exact tag
  }
  try {
    const hash = execSync('git rev-parse --short=7 HEAD', gitOpts).trim()
    if (hash) return hash
  } catch {
    // not a git repo or git unavailable
  }
  return 'unknown'
}

const fileChanged = async (srcPath: string, destPath: string): Promise<boolean> => {
  try {
    const srcStat = await stat(srcPath)
    const destStat = await stat(destPath)
    // First check size - if different, definitely changed
    if (srcStat.size !== destStat.size) {
      return true
    }
    // Sizes match, check content hash to be sure
    const srcContent = await readFile(srcPath)
    const destContent = await readFile(destPath)
    const srcHash = createHash('md5').update(srcContent).digest('hex')
    const destHash = createHash('md5').update(destContent).digest('hex')
    return srcHash !== destHash
  } catch {
    // Destination doesn't exist or can't be accessed, file has changed
    return true
  }
}

const specialFiles: Record<string, Record<string, string>> = {
  'manifest.json': {
    '__EXTENSION_VERSION__': getBuildVersion()
  }
}

const copyOne = async (filePath: string): Promise<void> => {
  if (isExcluded(filePath)) return

  const rel = path.relative(srcDir, filePath)
  const dest = path.join(distDir, rel)

  const baseName = path.basename(filePath)
  const isSpecial = Object.keys(specialFiles).includes(baseName)
  if (isSpecial) {
    const raw = await readFile(filePath, 'utf8')
    const content = raw.replace(new RegExp(Object.keys(specialFiles[baseName]).join('|'), 'g'), (match) => specialFiles[baseName][match])
    await writeFile(dest, content, 'utf8')
    return
  }

  // Check if file has changed
  if (!(await fileChanged(filePath, dest))) {
    // File content is identical, skip copying
    return
  }

  // Only copy if we get here (file doesn't exist or content is different)
  await mkdir(path.dirname(dest), { recursive: true })
  await copyFile(filePath, dest)
  console.log(`copied ${filePath} to ${dest}`)
}

const copyAll = async (dir: string): Promise<void> => {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await copyAll(full)
    } else {
      await copyOne(full)
    }
  }
}

await copyAll(srcDir)

if (watchMode) {
  const watcher = chokidar.watch(srcDir, {
    ignored: /\.(js|ts)$/,
    ignoreInitial: true
  })

  watcher.on('add', (filePath) => {
    copyOne(filePath).catch(error => {
      console.error(`Error copying ${filePath}:`, error)
    })
  })
  watcher.on('change', (filePath) => {
    copyOne(filePath).catch(error => {
      console.error(`Error copying ${filePath}:`, error)
    })
  })
}
