import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SRC = path.join(root, 'src');
const PUBLIC = path.join(root, 'public');

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (/\.(jsx?|tsx?|html|css)$/.test(entry.name)) result.push(full);
  }
  return result;
}

const files = walk(SRC).concat([path.join(root, 'index.html')]).filter(fs.existsSync);
const textByFile = new Map(files.map(file => [file, fs.readFileSync(file, 'utf8')]));
const app = textByFile.get(path.join(SRC, 'App.jsx')) || '';
const routeSet = new Set([...app.matchAll(/<Route\s+path=[\"']([^\"']+)[\"']/g)].map(m => m[1]));
const normalize = value => {
  const clean = value.split('?')[0].split('#')[0].replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  return clean;
};

const failures = [];
const warnings = [];

for (const [file, source] of textByFile) {
  for (const m of source.matchAll(/(?:\bto|\bhref)\s*=\s*[\"'`]([^\"'`]+)[\"'`]/g)) {
    const target = m[1];
    if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/img/')) continue;
    const route = normalize(target);
    if (route.startsWith('/api/') || route === '#') continue;
    if (!routeSet.has(route) && !routeSet.has(target) && !route.startsWith('/contact')) {
      failures.push(path.relative(root, file) + ' -> internal route not declared in App.jsx: ' + target);
    }
  }

  for (const m of source.matchAll(/(?:src|content)\s*=\s*[\"'](\/img\/[^\"']+)[\"']/g)) {
    const asset = path.join(PUBLIC, m[1].replace(/^\//, ''));
    if (!fs.existsSync(asset)) failures.push(path.relative(root, file) + ' -> missing public asset: ' + m[1]);
  }
}

const sitemap = path.join(PUBLIC, 'sitemap.xml');
if (fs.existsSync(sitemap)) {
  const xml = fs.readFileSync(sitemap, 'utf8');
  for (const m of xml.matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g)) {
    const route = normalize(m[1]);
    if (!routeSet.has(route)) failures.push('sitemap -> route not declared in App.jsx: ' + route);
  }
}

for (const [file, source] of textByFile) {
  if (!file.endsWith('.jsx')) continue;
  for (const m of source.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\bsrc=/.test(tag)) continue;
    if (!/\balt=/.test(tag)) failures.push(path.relative(root, file) + ' -> image missing alt text');
    if (!/\bdecoding=/.test(tag)) warnings.push(path.relative(root, file) + ' -> image has no decoding hint');
    const src = tag.match(/\bsrc=[\"']([^\"']+)[\"']/)?.[1] || '';
    const hero = file.endsWith('Home.jsx') && src.includes('/img/hero_lab.jpg');
    if (!hero && !/\bloading=/.test(tag)) warnings.push(path.relative(root, file) + ' -> non-hero image has no loading hint');
    if (hero && !/\bfetchPriority=/.test(tag)) warnings.push(path.relative(root, file) + ' -> hero image has no fetchPriority');
  }
}


const publicSource = files
  .filter(file => file.includes(path.sep + 'src' + path.sep))
  .filter(file => !file.includes(path.sep + 'pixiu-lms-portal' + path.sep))
  .map(file => [file, fs.readFileSync(file, 'utf8')]);

for (const [file, source] of publicSource) {
  if (/IntersectionObserver|class(Name)?=.*\brev\b|cursor[-_ ]?(beam|spotlight)|pointermove|mousemove/i.test(source)) {
    failures.push(path.relative(root, file) + ' -> interactive cursor/scroll reveal pattern detected');
  }
}
const revealFile = path.join(SRC, 'components', 'Reveal.jsx');
if (fs.existsSync(revealFile)) {
  const revealSource = fs.readFileSync(revealFile, 'utf8');
  if (/IntersectionObserver|opacity:\s*0|translateY\(/i.test(revealSource)) {
    failures.push('src/components/Reveal.jsx -> scroll reveal animation has returned');
  }
}

const globalCss = fs.readFileSync(path.join(SRC, 'styles', 'global.css'), 'utf8');
if (/\.btn:hover[^}]*opacity\s*:\s*(?:0|0\.[0-9]+)/i.test(globalCss)) {
  failures.push('src/styles/global.css -> button opacity/fade interaction detected');
}

const designFiles = files.filter(file => file.startsWith(SRC + path.sep) || file.startsWith(path.join(root, 'pixiu-lms-portal', 'src') + path.sep));
for (const file of designFiles) {
  const source = fs.readFileSync(file, 'utf8');
  if (/Space Grotesk|Instrument Serif|font-serif|font-style\\s*:\\s*italic|\\bitalic\\b/i.test(source)) failures.push(path.relative(root, file) + ' -> forbidden serif/italic design pattern detected');
  if (/\\bgrain\\b|\\bnoise\\b/i.test(source)) failures.push(path.relative(root, file) + ' -> grain/noise texture pattern detected');

}

for (const [file, source] of publicSource) {
  if (/—/.test(source)) failures.push(path.relative(root, file) + ' -> em dash found in public UI/copy; use direct punctuation or wording');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(source)) failures.push(path.relative(root, file) + ' -> decorative emoji found in public UI/copy');
  if (/lucide-react/.test(source) && !file.endsWith(path.sep + 'Verify.jsx')) failures.push(path.relative(root, file) + ' -> decorative Lucide icon dependency found; use typography or CSS for public marketing UI');
}

const entryHtml = textByFile.get(path.join(root, 'index.html')) || '';
if (!/name="viewport"[^>]*content="[^"]*width=device-width/i.test(entryHtml)) failures.push('index.html -> responsive viewport meta is missing');
if (!/:focus-visible\s*\{/.test(globalCss)) failures.push('src/styles/global.css -> visible keyboard focus styling is missing');

const distAssets = path.join(root, 'dist', 'assets');
if (fs.existsSync(distAssets)) {
  const built = [];
  for (const file of walk(distAssets)) built.push({ file, bytes: fs.statSync(file).size });
  const totalJs = built.filter(item => item.file.endsWith('.js')).reduce((sum, item) => sum + item.bytes, 0);
  const totalCss = built.filter(item => item.file.endsWith('.css')).reduce((sum, item) => sum + item.bytes, 0);
  console.log('Build assets: JS ' + (totalJs / 1024).toFixed(1) + ' KiB, CSS ' + (totalCss / 1024).toFixed(1) + ' KiB');
  for (const item of built.filter(item => item.file.endsWith('.js')).sort((a, b) => b.bytes - a.bytes).slice(0, 5)) {
    console.log('Largest JS: ' + path.basename(item.file) + ' ' + (item.bytes / 1024).toFixed(1) + ' KiB');
  }
}

if (failures.length) {
  console.error('SITE AUDIT FAILED');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('SITE AUDIT PASSED');
console.log('Checked ' + files.length + ' source/entry files.');
if (warnings.length) {
  console.log('Warnings: ' + warnings.length);
  for (const warning of warnings) console.log('- ' + warning);
}