import chokidar from 'chokidar';
import path from 'node:path';
import { mkdir, copyFile, readdir } from 'node:fs/promises';

const srcDir = process.argv[2] || 'src';
const distDir = process.argv[3] || 'dist';
const watchMode = process.argv.includes('--watch');

const isExcluded = file => /\.(js|ts|mjs)$/.test(file) || path.parse(file).base.startsWith('.');

const copyOne = async (filePath) => {
  if (isExcluded(filePath)) return;

  const rel = path.relative(srcDir, filePath);
  const dest = path.join(distDir, rel);

  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(filePath, dest);
  console.log(`copied ${filePath} to ${dest}`);
};

const copyAll = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await copyAll(full);
    } else {
      await copyOne(full);
    }
  }
};

await copyAll(srcDir);

if (watchMode) {
  const watcher = chokidar.watch(srcDir, {
    ignored: /\.(js|ts)$/,
    ignoreInitial: true
  });

  watcher.on('add', copyOne);
  watcher.on('change', copyOne);
}
