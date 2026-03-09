/**
 * Replaces all `from 'src/...'` path aliases with relative imports.
 * Run once: node scripts/fix-path-aliases.js
 */
const fs = require('fs');
const path = require('path');

const backRoot = path.resolve(__dirname, '..');

function getAllTsFiles(dir, files = []) {
  const ignore = new Set(['node_modules', 'dist', 'dist-vercel', '.git', 'scripts']);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllTsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getAllTsFiles(backRoot);
let totalChanged = 0;

for (const filePath of files) {
  const fileDir = path.dirname(filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace: from 'src/...' → from './relative/path'
  const newContent = content.replace(/from '(src\/[^']+)'/g, (match, importPath) => {
    const targetAbs = path.join(backRoot, importPath);
    let rel = path.relative(fileDir, targetAbs).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    changed = true;
    return `from '${rel}'`;
  });

  if (changed) {
    fs.writeFileSync(filePath, newContent);
    totalChanged++;
    console.log('  ✓', path.relative(backRoot, filePath));
  }
}

console.log(`\nDone. Updated ${totalChanged} files.`);
