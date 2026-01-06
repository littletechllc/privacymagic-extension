import chokidar from 'chokidar';
import path from 'node:path';
import { mkdir, copyFile, readdir, stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const srcDir: string = process.argv[2] || 'src';
const distDir: string = process.argv[3] || 'dist';
const watchMode: boolean = process.argv.includes('--watch');

const isExcluded = (file: string): boolean => /\.(js|ts|mjs)$/.test(file) || path.parse(file).base.startsWith('.');

const fileChanged = async (srcPath: string, destPath: string): Promise<boolean> => {
  try {
    const srcStat = await stat(srcPath);
    const destStat = await stat(destPath);
    // First check size - if different, definitely changed
    if (srcStat.size !== destStat.size) {
      return true;
    }
    // Sizes match, check content hash to be sure
    const srcContent = await readFile(srcPath);
    const destContent = await readFile(destPath);
    const srcHash = createHash('md5').update(srcContent).digest('hex');
    const destHash = createHash('md5').update(destContent).digest('hex');
    return srcHash !== destHash;
  } catch (error) {
    // Destination doesn't exist or can't be accessed, file has changed
    return true;
  }
};

const copyOne = async (filePath: string): Promise<void> => {
  if (isExcluded(filePath)) return;

  const rel = path.relative(srcDir, filePath);
  const dest = path.join(distDir, rel);

  // Check if file has changed
  if (!(await fileChanged(filePath, dest))) {
    // File content is identical, skip copying
    return;
  }

  // Only copy if we get here (file doesn't exist or content is different)
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(filePath, dest);
  console.log(`copied ${filePath} to ${dest}`);
};

const copyAll = async (dir: string): Promise<void> => {
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
