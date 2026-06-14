/*
 * i18n parity + usage check (CI + local).
 * - DA and EN must have identical key sets, no empty values
 * - every t('key') / data-t / data-t-placeholder used in consumer files must be defined
 * Exit 0 = pass, 1 = fail.   Run: node tests/i18n-parity.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const NEXT = path.join(__dirname, '..', 'next');
const sandbox = {
  console,
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: { language: 'da' },
  document: { querySelectorAll() { return []; } }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(NEXT, 'b-i18n.js'), 'utf8'), sandbox, { filename: 'b-i18n.js' });

const T = sandbox._translations;
const errors = [];
if (!T || !T.da || !T.en) { console.error('i18n FAIL: _translations.da/en not found'); process.exit(1); }

const da = Object.keys(T.da), en = Object.keys(T.en);
const daS = new Set(da), enS = new Set(en);

const missEn = da.filter(k => !enS.has(k));
const missDa = en.filter(k => !daS.has(k));
if (missEn.length) errors.push('Missing in EN: ' + missEn.join(', '));
if (missDa.length) errors.push('Missing in DA: ' + missDa.join(', '));

const emptyDa = da.filter(k => T.da[k] === '');
const emptyEn = en.filter(k => T.en[k] === '');
if (emptyDa.length) errors.push('Empty DA values: ' + emptyDa.join(', '));
if (emptyEn.length) errors.push('Empty EN values: ' + emptyEn.join(', '));

// undefined keys used in consumer files (exclude the definitions file itself)
const defined = new Set(da);
const used = new Map();
const consumers = fs.readdirSync(NEXT)
  .filter(f => (f.endsWith('.js') || f.endsWith('.html')) && f !== 'b-i18n.js');
for (const f of consumers) {
  const s = fs.readFileSync(path.join(NEXT, f), 'utf8');
  let m;
  const reT = /\bt\(\s*['"]([a-z0-9_]+)['"]/gi;
  while ((m = reT.exec(s))) used.set(m[1], f);
  const reD = /data-t=['"]([a-z0-9_]+)['"]/gi;
  while ((m = reD.exec(s))) used.set(m[1], f);
  const reP = /data-t-placeholder=['"]([a-z0-9_]+)['"]/gi;
  while ((m = reP.exec(s))) used.set(m[1], f);
}
const undef = [...used.keys()].filter(k => !defined.has(k));
if (undef.length) errors.push('Undefined i18n keys: ' + undef.map(k => k + ' (' + used.get(k) + ')').join(', '));

if (errors.length) {
  console.error('i18n FAIL:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
console.log('i18n OK \u2014 ' + da.length + ' DA / ' + en.length + ' EN, parity + no empty + no undefined keys');
process.exit(0);
