const fs = require('fs');
const path = 'public/assets/os-client-DeMZwioN.js';
let os = fs.readFileSync(path, 'utf8');
const before = os.length;

function mustReplace(oldStr, newStr, label) {
  if (!os.includes(oldStr)) {
    console.error('NOT FOUND:', label);
    console.error(oldStr.slice(0, 120));
    process.exit(1);
  }
  os = os.replace(oldStr, newStr);
  console.log('OK', label);
}

mustReplace(
  'function rt({settings:e,calculations:t,services:n,setData:r,toast:i}){let a=Number(e.plannedProjects??0),s=a>0?Number(e.fixedMonthly??0)/a:0',
  'function rt({settings:e,calculations:t,services:n,projectCount:pc=0,setData:r,toast:i}){let a=Math.max(Number(e.plannedProjects??0)||0,Number(pc)||0,1),s=Number(e.fixedMonthly??0)/a',
  'rt signature + divisor'
);

mustReplace(
  '(0,J.jsx)(rt,{settings:i.settings,calculations:i.calculations,services:i.services,setData:a,toast:K})',
  '(0,J.jsx)(rt,{settings:i.settings,calculations:i.calculations,services:i.services,projectCount:i.projects.length,setData:a,toast:K})',
  'rt call site'
);

mustReplace(
  't.input&&typeof t.input==`object`&&(l({...t.input,extraCosts:Array.isArray(t.input.extraCosts)?t.input.extraCosts:[]}),f(String(t.projectName??``)),m(String(t.selectedServiceId??``)))',
  't.input&&typeof t.input==`object`&&(l({...t.input,extraCosts:Array.isArray(t.input.extraCosts)?t.input.extraCosts:[],fixedShare:s,hourlyRate:Number(e.hourlyRate??0),taxRate:Number(e.taxRate??0),riskRate:Number(e.riskRate??0),targetMargin:Number(e.targetMargin??0)}),f(String(t.projectName??``)),m(String(t.selectedServiceId??``)))',
  'draft restore fixedShare'
);

mustReplace(
  'function ye(e){let t=K(e.subtotal),n=Math.min(100,K(e.discount)),r=t*(1-n/100),i=K(e.hours),a=K(e.hourlyRate),o=K(e.plannedProjects),s=o>0?K(e.fixedMonthly)/o:0,',
  'function ye(e){let t=K(e.subtotal),n=Math.min(100,K(e.discount)),r=t*(1-n/100),i=K(e.hours),a=K(e.hourlyRate),o=Math.max(K(e.plannedProjects),K(e.projectCount),1),s=K(e.fixedMonthly)/o,',
  'ye divisor'
);

const yeCallOld =
  'fixedMonthly:Number(e.settings.fixedMonthly??0),plannedProjects:Number(e.settings.plannedProjects??0),taxRate:A,riskRate:j}';
const yeCallNew =
  'fixedMonthly:Number(e.settings.fixedMonthly??0),plannedProjects:Number(e.settings.plannedProjects??0),projectCount:(e.projects||[]).length,taxRate:A,riskRate:j}';
const yeCount = os.split(yeCallOld).length - 1;
if (yeCount < 1) {
  console.error('ye call sites not found');
  process.exit(1);
}
os = os.split(yeCallOld).join(yeCallNew);
console.log('OK ye call sites', yeCount);

os = os.split('getsite-finance-draft-v2').join('getsite-finance-draft-v3');
console.log('OK draft key bump');

os = os.split('label:`Постоянные расходы`,value:c.fixedShare').join(
  'label:`Доля постоянных на проект`,value:c.fixedShare'
);
console.log('OK label');

// Keep settings summary hint stronger
os = os.split('постоянные расходы ÷ план проектов').join(
  'постоянные расходы ÷ max(план проектов, текущие проекты)'
);

fs.writeFileSync(path, os);
console.log('done', before, '->', os.length);
