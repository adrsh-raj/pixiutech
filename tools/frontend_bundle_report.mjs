import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] || 'pixiu-lms-portal/dist/assets';

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const files = walk(root)
  .map(file => ({ file, bytes: statSync(file).size }))
  .sort((a, b) => b.bytes - a.bytes);

const js = files.filter(item => item.file.endsWith('.js'));
const css = files.filter(item => item.file.endsWith('.css'));
const totalJs = js.reduce((sum, item) => sum + item.bytes, 0);
const totalCss = css.reduce((sum, item) => sum + item.bytes, 0);

const format = bytes => `${(bytes / 1024).toFixed(1)} KiB`;

console.log(`bundle_root=${root}`);
console.log(`js_files=${js.length} js_total=${format(totalJs)}`);
console.log(`css_files=${css.length} css_total=${format(totalCss)}`);
console.log('largest_js_files=');
for (const item of js.slice(0, 15)) console.log(`${format(item.bytes)} ${relative(root, item.file)}`);
