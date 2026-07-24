import fs from 'node:fs';
import path from 'node:path';

const adminRoot = path.resolve('src/app/pages/admin');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.ts$/.test(entry.name)) files.push(full);
  }
  return files;
}

function depthFromAdmin(file) {
  const rel = path.relative(adminRoot, path.dirname(file));
  if (!rel || rel === '') return 0;
  return rel.split(path.sep).filter(Boolean).length;
}

function toAppPath(depth) {
  // from pages/admin/<...> up to app/
  // depth 0 (admin root): ../../
  // depth 1 (admin/dues): ../../../
  // depth 2 (admin/dues/modal): ../../../../
  return '../'.repeat(depth + 2);
}

const files = walk(adminRoot);
let changed = 0;

for (const file of files) {
  const depth = depthFromAdmin(file);
  const appPrefix = toAppPath(depth);
  const utilsPrefix = depth === 0 ? './utils/' : '../'.repeat(depth) + 'utils/';

  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Normalize any deep relative imports into app/shared|core
  content = content.replace(
    /from '(\.\.\/)+(shared\/[^']+|core\/[^']+)'/g,
    (_m, _dots, rest) => `from '${appPrefix}${rest}'`,
  );

  // Normalize admin-labels utils imports
  content = content.replace(
    /from '(\.\.\/)*utils\/admin-labels'/g,
    `from '${utilsPrefix}admin-labels'`,
  );

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changed += 1;
    console.log('fixed', path.relative(process.cwd(), file), 'depth', depth);
  }
}

console.log('files changed', changed);
