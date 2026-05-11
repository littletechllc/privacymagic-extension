import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ensuredDirectories = new Map<string, string>()

const ensureDirectoryInDist = async (localDir: string): Promise<string> => {
  const dir = path.join(__dirname, '../../dist/', localDir)
  if (ensuredDirectories.has(localDir)) {
    return ensuredDirectories.get(localDir)!
  }
  ensuredDirectories.set(localDir, dir)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export const writeFile = async (localDir: string, fileName: string, content: string): Promise<void> => {
  const directoryInDist = await ensureDirectoryInDist(localDir)
  const filePath = path.join(directoryInDist, fileName)
  await fs.writeFile(filePath, content)
}

export const logLineErrors = <T>(parseLine: (line: string) => T): (line: string) => T => {
  return (line: string): T => {
    try {
      return parseLine(line)
    } catch (e: unknown) {
      if (e instanceof Error) {
        e.message = `Error in line '${line}':\n${e.message}`
      }
      throw e
    }
  }
}
