import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const isMain = (importMeta: ImportMeta): boolean => process.argv[1] === fileURLToPath(importMeta.url);

export const entries = <K extends string, V>(obj: Record<K, V>): [K, V][] => {
  return Object.entries(obj) as [K, V][];
};