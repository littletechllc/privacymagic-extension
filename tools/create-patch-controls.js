import fs from 'node:fs/promises';
import * as acorn from 'acorn';
import esquery from 'esquery';
import { isMain } from './util.js';

const foregroundScriptPath = '../extension/content_scripts/foreground.js';

const readFile = async (path) => {
  return await fs.readFile(path, 'utf8');
};

const parseFile = async (content) => {
  const ast = acorn.parse(content, {
    ecmaVersion: 'latest',
    sourceType: 'module'
  });
  return ast;
};

const getObjectKeys = (ast, variableName) => {
  return esquery.query(ast,
    `VariableDeclarator[id.name="${variableName}"] > ObjectExpression > Property > Identifier.key`)
    .map(node => node.name);
};

const composePatchControlFile = (patchName, enable) => `
  console.log('${enable ? 'enable' : 'disable'}/${patchName}.js loaded', Date.now());
  window.__patch_decisions__ ||= {};
  window.__patch_decisions__.${patchName} = ${enable};
  if (window.__inject_if_ready__) {
    window.__inject_if_ready__();
  }`.replace(/^\s\s/gm, '').trim() + '\n';

const writePatchControlFile = async (patchName, enable) => {
  const content = composePatchControlFile(patchName, enable);
  const path = `../extension/content_scripts/${enable ? 'enable' : 'disable'}/${patchName}.js`;
  await fs.writeFile(path, content.trim() + '\n');
  console.log(`wrote ${path}`);
};

const main = async () => {
  const content = await readFile(foregroundScriptPath);
  const ast = await parseFile(content);
  const patches = getObjectKeys(ast, 'privacyMagicPatches');
  for (const patch of patches) {
    await writePatchControlFile(patch, true);
    await writePatchControlFile(patch, false);
  }
};

if (isMain(import.meta)) {
  main();
}
