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
if (/\.btn[^\{]*\{[^}]*opacity|\.btn:hover[^}]*opacity\s*:\s*0/i.test(globalCss)) {
  failures.push('src/styles/global.css -> button opacity/fade interaction detected');
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