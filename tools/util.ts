import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const isMain = (importMeta: ImportMeta): boolean => process.argv[1] === fileURLToPath(importMeta.url);
