/**
 * Patch Settings role UI to match API roles: founder / sales_manager / designer.
 */
const fs = require('fs');
const path = 'public/assets/os-client-DeMZwioN.js';
let os = fs.readFileSync(path, 'utf8');

function mustReplace(oldStr, newStr, label) {
  if (!os.includes(oldStr)) {
    console.error('NOT FOUND:', label);
    console.error(oldStr.slice(0, 160));
    process.exit(1);
  }
  os = os.replace(oldStr, newStr);
  console.log('OK', label);
}

function replaceAll(oldStr, newStr, label) {
  const count = os.split(oldStr).length - 1;
  if (count < 1) {
    console.error('NOT FOUND:', label);
    process.exit(1);
  }
  os = os.split(oldStr).join(newStr);
  console.log('OK', label, 'x' + count);
}

mustReplace(
  `(0,J.jsxs)(\`select\`,{value:e.systemRole,disabled:n?.systemRole!==\`administrator\`||j===e.email,onChange:t=>I(e.email,t.target.value),children:[(0,J.jsx)(\`option\`,{value:\`administrator\`,children:\`Администратор\`}),(0,J.jsx)(\`option\`,{value:\`member\`,children:\`Участник\`})]})`,
  `(0,J.jsxs)(\`select\`,{value:e.systemRole===\`administrator\`?\`founder\`:e.systemRole===\`member\`?\`sales_manager\`:e.systemRole,disabled:!(n?.systemRole===\`founder\`||n?.systemRole===\`administrator\`)||j===e.email,onChange:t=>I(e.email,t.target.value),children:[(0,J.jsx)(\`option\`,{value:\`founder\`,children:\`Основатель\`}),(0,J.jsx)(\`option\`,{value:\`sales_manager\`,children:\`Менеджер\`}),(0,J.jsx)(\`option\`,{value:\`designer\`,children:\`Дизайнер\`})]})`,
  'settings role select'
);

replaceAll(
  `B?.profile?.systemRole===\`administrator\`?\`Администратор\`:B?.profile?.position??\`Пользователь\``,
  `B?.profile?.systemRole===\`founder\`||B?.profile?.systemRole===\`administrator\`?\`Основатель\`:B?.profile?.systemRole===\`sales_manager\`?\`Менеджер продаж\`:B?.profile?.systemRole===\`designer\`?\`Дизайнер\`:B?.profile?.position??\`Пользователь\``,
  'sidebar role label'
);

replaceAll(
  `n?.systemRole===\`administrator\`?\`Администратор\`:\`Участник\``,
  `n?.systemRole===\`founder\`||n?.systemRole===\`administrator\`?\`Основатель\`:n?.systemRole===\`sales_manager\`?\`Менеджер\`:n?.systemRole===\`designer\`?\`Дизайнер\`:\`Участник\``,
  'readiness role label'
);

replaceAll(
  `e.users.some(e=>e.systemRole===\`administrator\`)`,
  `e.users.some(e=>e.systemRole===\`founder\`||e.systemRole===\`administrator\`)`,
  'has admin check'
);

fs.writeFileSync(path, os);
console.log('patched roles', path);
