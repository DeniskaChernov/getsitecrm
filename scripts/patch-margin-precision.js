/**
 * Patch client calculator to use half-up margin (no float drift / banker's round).
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'assets', 'os-client-DeMZwioN.js');
let code = fs.readFileSync(file, 'utf8');
const before = code;

const replacements = [
  [
    'margin:u&&r>0?(r-d)/r*100:null',
    'margin:u&&r>0?(globalThis.__gsMoney?globalThis.__gsMoney.calcMarginPct(r,d):((p,c)=>{if(!(p>0)||!Number.isFinite(c))return null;const x=(p-c)/p*100,s=x<0?-1:1,u=Math.abs(x)*100,w=Math.floor(u+1e-12),b=u-w>=0.5-1e-12?w+1:w;return s*b/100})(r,d)):null',
  ],
  [
    'y=t>0?v/t*100:0',
    'y=t>0?(globalThis.__gsMoney?globalThis.__gsMoney.calcMarginPct(t,t-v):((p,profit)=>{if(!(p>0)||!Number.isFinite(profit))return null;const x=profit/p*100,s=x<0?-1:1,u=Math.abs(x)*100,w=Math.floor(u+1e-12),b=u-w>=0.5-1e-12?w+1:w;return s*b/100})(t,v)):null',
  ],
  [
    'Фактическая маржа ${e.margin.toFixed(1)}%',
    'Фактическая маржа ${Number(e.margin).toFixed(2)}%',
  ],
  [
    'Маржа ${e.margin.toFixed(1)}% выше',
    'Маржа ${Number(e.margin).toFixed(2)}% выше',
  ],
  [
    'маржа — ${e.margin.toFixed(1)}%',
    'маржа — ${Number(e.margin).toFixed(2)}%',
  ],
];

let changed = 0;
for (const [from, to] of replacements) {
  if (!code.includes(from)) {
    if (code.includes(to)) {
      console.log('Already patched:', from.slice(0, 48));
      continue;
    }
    console.error('Pattern not found:', from);
    process.exitCode = 1;
    continue;
  }
  const count = code.split(from).length - 1;
  code = code.split(from).join(to);
  changed += count;
  console.log('Patched x' + count + ':', from.slice(0, 48));
}

if (code !== before) {
  fs.writeFileSync(file, code);
  console.log('Wrote', file, 'replacements=', changed);
} else {
  console.log('No file changes');
}
