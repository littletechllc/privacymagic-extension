import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const isMain = (importMeta) => process.argv[1] === fileURLToPath(importMeta.url);
