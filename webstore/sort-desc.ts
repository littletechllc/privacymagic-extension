/**
 * Sorts bullet items within each category in Chrome Web Store description files.
 *
 * Each locale has a `locales/<locale>/description.txt` with this structure:
 * - Lines starting with "- " are category headers (e.g. "Blocks ads, trackers...").
 * - Lines starting with "  · " are sub-items under the previous category.
 *
 * This script reorders those sub-items alphabetically within each category,
 * using the locale's collation when possible (e.g. "de" for German).
 *
 * Run after adding or editing description bullets so lists stay alphabetically ordered:
 *
 *   npx tsx webstore/sort-desc.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, 'locales');

/**
 * Sorts the bullet items under a category using locale-aware string comparison.
 * Falls back to default comparison if the locale is not supported by the runtime.
 */
function sortBulletItems(items: string[], localeCode: string): void {
  items.sort((a, b) => {
    const textA = a.slice(4); // strip "  · "
    const textB = b.slice(4);
    try {
      return textA.localeCompare(textB, localeCode);
    } catch {
      return textA.localeCompare(textB);
    }
  });
}

/**
 * Processes a single description.txt: finds each category block and sorts its bullet items.
 */
function processDescriptionFile(filePath: string, locale: string): void {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  const localeCode = locale.replace('_', '-');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    output.push(line);

    if (line.startsWith('- ')) {
      i++;
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('  · ')) {
        items.push(lines[i]);
        i++;
      }
      sortBulletItems(items, localeCode);
      output.push(...items);
      continue;
    }
    i++;
  }

  fs.writeFileSync(filePath, output.join('\n') + '\n', 'utf8');
}

/** Sorts bullet items in every locale's description.txt under webstore/locales/. */
function main(): void {
  const entries = fs.readdirSync(localesDir, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const descPath = path.join(localesDir, entry.name, 'description.txt');
    if (!fs.existsSync(descPath)) continue;

    processDescriptionFile(descPath, entry.name);
    count++;
  }

  console.log(`Sorted ${count} description file(s).`);
}

main();
