/**
 * Patch pipeline stage matchers so "в работе" counts in the sales funnel.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'assets', 'os-client-DeMZwioN.js');
let code = fs.readFileSync(file, 'utf8');

const from =
  '{label:`Квалификация`,matches:e=>e.includes(`квалиф`)}';
const to =
  '{label:`Квалификация`,matches:e=>e.includes(`квалиф`)||e.includes(`работ`)}';

if (!code.includes(from)) {
  if (code.includes(to)) {
    console.log('Already patched');
    process.exit(0);
  }
  console.error('Pattern not found');
  process.exit(1);
}

code = code.replace(from, to);
fs.writeFileSync(file, code);
console.log('Patched funnel matcher for «в работе»');
