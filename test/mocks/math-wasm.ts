import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmPath = join(__dirname, '../../math/math.wasm')
const base64 = readFileSync(wasmPath).toString('base64')

export default base64
