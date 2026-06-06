import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const isMain = (importMeta: ImportMeta): boolean => process.argv[1] === fileURLToPath(importMeta.url)

export const entries = <K extends string, V>(obj: Record<K, V>): Array<[K, V]> => {
  return Object.entries(obj) as Array<[K, V]>
}

export const fromEntries = <K extends string, V>(entries: [K, V][]): Record<K, V> => {
  return Object.fromEntries(entries) as Record<K, V>
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const filterListDir = path.join(__dirname, '..', 'third_party', 'filter_lists')
