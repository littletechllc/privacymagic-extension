import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const EDGE_UPDATES_URL = 'https://edgeupdates.microsoft.com/api/products'

const PRODUCT_BY_CHANNEL = {
  stable: 'Stable',
  dev: 'Dev',
  canary: 'Canary'
}

const fail = (message) => {
  const text = message instanceof Error ? (message.stack ?? message.message) : String(message)
  console.error(`ERROR: ${text}`)
  process.exit(1)
}

process.on('uncaughtException', fail)
process.on('unhandledRejection', fail)

const writeOutput = (name, value) => {
  const outputPath = process.env.GITHUB_OUTPUT
  if (outputPath == null || outputPath === '') {
    console.log(`${name}=${value}`)
    return
  }
  fs.appendFileSync(outputPath, `${name}=${value}\n`)
}

const run = (command, args, options) => {
  try {
    execFileSync(command, args, { stdio: 'inherit', ...options })
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : 'unknown'
    fail(`${command} ${args.join(' ')} failed (exit ${status})`)
  }
}

const channel = process.argv[2] ?? ''
const productName = PRODUCT_BY_CHANNEL[channel]
if (productName == null) {
  fail(`Unsupported Edge channel "${channel}". Expected one of: ${Object.keys(PRODUCT_BY_CHANNEL).join(', ')}`)
}

let products
try {
  const response = await fetch(EDGE_UPDATES_URL)
  if (!response.ok) {
    const body = await response.text()
    fail(`Edge updates API returned ${response.status} for ${EDGE_UPDATES_URL}: ${body.slice(0, 500)}`)
  }
  products = await response.json()
} catch (error) {
  fail(`Edge updates API request failed (${EDGE_UPDATES_URL}): ${error instanceof Error ? error.stack : error}`)
}

if (!Array.isArray(products)) {
  fail(`Edge updates API returned ${typeof products}, expected a product list`)
}

const product = products.find((entry) => entry?.Product === productName)
if (product == null) {
  const names = products.map((entry) => entry?.Product).join(', ') || '(none)'
  fail(`No "${productName}" product in the Edge updates API. Products: ${names}`)
}

const releases = Array.isArray(product.Releases) ? product.Releases : []
const release = releases.find((entry) =>
  entry?.Platform === 'Linux' && (entry.Architecture === 'x64' || entry.Architecture === 'universal')
)
if (release == null) {
  const platforms = releases.map((entry) => `${entry?.Platform}/${entry?.Architecture}`).join(', ') || '(none)'
  fail(`No Linux x64 release for Edge ${productName}. Releases: ${platforms}`)
}

const artifacts = Array.isArray(release.Artifacts) ? release.Artifacts : []
const deb = artifacts.find((entry) => entry?.ArtifactName === 'deb')
if (deb?.Location == null || deb.Location === '') {
  const names = artifacts.map((entry) => entry?.ArtifactName).join(', ') || '(none)'
  fail(
    `No deb artifact for Edge ${productName} ${release.ProductVersion ?? '(unknown version)'} ` +
    `Linux/${release.Architecture}. Artifacts: ${names}`
  )
}

console.log(`Acquiring ${channel} (${release.ProductVersion}) from ${deb.Location}`)

const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'msedge-install-'))
const debPath = path.join(workDir, 'edge.deb')
const debResponse = await fetch(deb.Location)
if (!debResponse.ok || debResponse.body == null) {
  const body = await debResponse.text().catch(() => '')
  fail(`Download failed (${debResponse.status}) for ${deb.Location}: ${body.slice(0, 500)}`)
}
await pipeline(Readable.fromWeb(debResponse.body), fs.createWriteStream(debPath))

const extractDir = path.join(workDir, 'extract')
await fs.promises.mkdir(extractDir)
run('ar', ['x', debPath], { cwd: extractDir })

const dataArchiveName = ['data.tar.xz', 'data.tar.zst', 'data.tar.gz']
  .find((name) => fs.existsSync(path.join(extractDir, name)))
if (dataArchiveName == null) {
  const files = (await fs.promises.readdir(extractDir)).join(', ') || '(none)'
  fail(`deb archive has no data.tar payload. Extracted files: ${files}`)
}

const installDir = path.join(workDir, 'msedge')
await fs.promises.mkdir(installDir)
run('tar', [
  '-xf',
  path.join(extractDir, dataArchiveName),
  '--directory',
  installDir,
  '--strip-components',
  '4',
  './opt/microsoft'
])

await fs.promises.unlink(path.join(installDir, 'microsoft-edge')).catch((error) => {
  if (error?.code !== 'ENOENT') {
    fail(error)
  }
})

const executablePath = path.join(installDir, 'msedge')
if (!fs.existsSync(executablePath)) {
  const files = (await fs.promises.readdir(installDir)).join(', ') || '(none)'
  fail(`Extracted Edge package has no msedge binary. Files: ${files}`)
}

writeOutput('edge-path', executablePath)
writeOutput('edge-version', String(release.ProductVersion ?? ''))
console.log(`Installed Microsoft Edge ${release.ProductVersion} at ${executablePath}`)
