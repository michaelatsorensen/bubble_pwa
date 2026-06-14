/*
 * Build guards (CI + local).
 * - node --check on every .js in next/ and tests/
 * - app.css must not use dvh/svh/lvh as a value (the white-bar trap)
 * - b-config BUILD_VERSION and sw.js CACHE_NAME must agree
 * - index.html cache-busters must all be identical (no stale ref left behind)
 * Exit 0 = pass, 1 = fail.   Run: node tests/build-guards.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const NEXT = path.join(ROOT, 'next');
const errors = [];

// 1. syntax
const jsFiles = [];
for (const dir of [NEXT, path.join(ROOT, 'tests')]) {
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.js')) jsFiles.push(path.join(dir, f));
}
for (const f of jsFiles) {
  try { execSync('node --check ' + JSON.stringify(f), { stdio: 'pipe' }); }
  catch (e) {
    const msg = e.stderr ? e.stderr.toString().split('\n').find(Boolean) : e.message;
    errors.push('Syntax error: ' + path.relative(ROOT, f) + ' \u2014 ' + msg);
  }
}

// 2. dvh/svh/lvh guard (value usage only; comments mentioning 100dvh are fine)
const css = fs.readFileSync(path.join(NEXT, 'app.css'), 'utf8');
const dvhLines = css.split('\n')
  .map((l, i) => ({ l, n: i + 1 }))
  .filter(o => /:\s*[\d.]+(dvh|svh|lvh)\b/.test(o.l));
if (dvhLines.length) errors.push('app.css uses forbidden dvh/svh/lvh value at line(s): ' + dvhLines.map(o => o.n).join(', '));

// 3. version consistency: b-config <-> sw.js
const cfg = fs.readFileSync(path.join(NEXT, 'b-config.js'), 'utf8');
const sw = fs.readFileSync(path.join(NEXT, 'sw.js'), 'utf8');
const cfgV = (cfg.match(/BUILD_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1];
const swV = (sw.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/) || [])[1];
if (!cfgV) errors.push('BUILD_VERSION not found in b-config.js');
if (!swV) errors.push('CACHE_NAME not found in sw.js');
if (cfgV && swV && swV !== 'bubble-' + cfgV)
  errors.push('Version mismatch: b-config=' + cfgV + ' but sw.js=' + swV + ' (expected bubble-' + cfgV + ')');

// 4. index.html cache-buster uniformity
const html = fs.readFileSync(path.join(NEXT, 'index.html'), 'utf8');
const busters = [...html.matchAll(/[?&]v=(\d+)/g)].map(m => m[1]);
const uniq = [...new Set(busters)];
if (uniq.length > 1) errors.push('Non-uniform cache-busters in index.html: ' + uniq.join(', ') + ' (all must match)');

if (errors.length) {
  console.error('Build-guards FAIL:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
console.log('Build-guards OK \u2014 ' + jsFiles.length + ' files syntax-checked, no dvh, version ' +
  cfgV + ' consistent, ' + busters.length + ' uniform cache-busters');
process.exit(0);
