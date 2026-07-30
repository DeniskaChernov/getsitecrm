/**
 * Убирает скрытый React-sidebar и связывает единственную навигацию #gs-nav
 * напрямую с React state через window.__gsNavigate. Также фильтрует mobile
 * tabs по серверному списку разрешённых разделов.
 */
const fs = require('fs');

const path = 'public/assets/os-client-DeMZwioN.js';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(oldValue, newValue, label, allowAbsent = false) {
  const count = source.split(oldValue).length - 1;
  if (count === 0 && newValue && source.includes(newValue)) {
    console.log(`SKIP ${label} (уже применён)`);
    return;
  }
  if (count === 0 && allowAbsent) {
    console.log(`SKIP ${label} (уже применён)`);
    return;
  }
  if (count !== 1) {
    throw new Error(`${label}: ожидалось 1 совпадение, найдено ${count}`);
  }
  source = source.replace(oldValue, newValue);
  console.log(`OK ${label}`);
}

const mobileWithInvalidTeamIcon =
  'nav`,{className:`mobile-tabs`,"aria-label":`Мобильная навигация`,children:[{label:`Главная`,icon:z},{label:`Заявки`,icon:te},{label:`Сметы`,icon:N},{label:`Проекты`,icon:h},{label:`Оплаты и расходы`,icon:ve},{label:`Команда и сроки`,icon:y}].filter(e=>window.__gsAllowedSections?.includes(e.label)).map(e=>(0,J.jsxs)(`button`,{className:n===e.label?`active`:``,onClick:()=>G(e.label),"aria-current":n===e.label?`page`:void 0,children:[(0,J.jsx)(e.icon,{size:19}),(0,J.jsx)(`span`,{children:e.label===`Оплаты и расходы`?`Деньги`:e.label===`Команда и сроки`?`Сроки`:e.label})]},e.label))}';
const roleAwareMobileTabs =
  'nav`,{className:`mobile-tabs`,"aria-label":`Мобильная навигация`,children:[{label:`Главная`,icon:z},{label:`Заявки`,icon:te},{label:`Сметы`,icon:N},{label:`Проекты`,icon:h},{label:`Оплаты и расходы`,icon:ve}].filter(e=>window.__gsAllowedSections?.includes(e.label)).map(e=>(0,J.jsxs)(`button`,{className:n===e.label?`active`:``,onClick:()=>G(e.label),"aria-current":n===e.label?`page`:void 0,children:[(0,J.jsx)(e.icon,{size:19}),(0,J.jsx)(`span`,{children:e.label===`Оплаты и расходы`?`Деньги`:e.label})]},e.label))}';

if (source.includes(mobileWithInvalidTeamIcon)) {
  source = source.replace(mobileWithInvalidTeamIcon, roleAwareMobileTabs);
  console.log('OK remove invalid team icon from mobile tabs');
}

replaceOnce(
  'let G=e=>{r(e),window.sessionStorage.setItem(`getsite-os-section`,e),c(!1),f(!1),g(!1),window.scrollTo({top:0,behavior:`auto`})},K=e=>{',
  'let G=e=>{je.some(t=>t.label===e)&&(r(e),window.sessionStorage.setItem(`getsite-os-section`,e),c(!1),f(!1),g(!1),window.scrollTo({top:0,behavior:`auto`}))},_gs=(window.__gsNavigate=G),K=e=>{',
  'direct navigation API'
);

replaceOnce(
  '(0,J.jsxs)(`aside`,{className:`sidebar ${s?`is-open`:``}`,children:[(0,J.jsxs)(`button`,{className:`brand`,"aria-label":`Открыть главную GetSite OS`,onClick:()=>G(`Главная`),children:[(0,J.jsx)(`span`,{className:`brand-get`,children:`get`}),(0,J.jsx)(`span`,{children:`site`}),(0,J.jsx)(`span`,{className:`brand-star`,children:`*`}),(0,J.jsx)(`span`,{className:`brand-os`,children:`OS`})]}),(0,J.jsxs)(`button`,{className:`create-button`,onClick:()=>u(!0),children:[(0,J.jsx)(U,{size:18}),` Создать`,(0,J.jsx)(`span`,{className:`keycap`,children:`N`})]}),(0,J.jsx)(`nav`,{className:`nav-list`,"aria-label":`Основная навигация`,children:je.map((e,t)=>(0,J.jsxs)(`div`,{children:[e.group&&t>0?(0,J.jsx)(`div`,{className:`nav-group`,children:e.group}):null,(0,J.jsxs)(`button`,{className:`nav-item ${n===e.label?`active`:``} ${ie&&Fe[ae].target===e.label?`tour-focus`:``}`,onClick:()=>G(e.label),"aria-current":n===e.label?`page`:void 0,children:[(0,J.jsx)(e.icon,{size:18,strokeWidth:1.8}),(0,J.jsx)(`span`,{children:Me(e.label)}),e.label===`Заявки`?(0,J.jsx)(`span`,{className:`nav-count`,children:i.leads.length}):null]})]},e.label))}),(0,J.jsxs)(`div`,{className:`sidebar-bottom`,children:[(0,J.jsxs)(`div`,{className:`health-row`,children:[(0,J.jsx)(`span`,{className:`health-dot ${me?`error`:``}`}),me?`Нет связи с данными`:`Все системы работают`]}),(0,J.jsxs)(`button`,{className:`user-card`,onClick:()=>G(`Настройки`),children:[(0,J.jsx)(`span`,{className:`avatar`,children:We(Te)}),(0,J.jsxs)(`span`,{className:`user-copy`,children:[(0,J.jsx)(`strong`,{children:Te}),(0,J.jsx)(`small`,{children:B?.profile?.systemRole===`founder`||B?.profile?.systemRole===`administrator`?`Основатель`:B?.profile?.systemRole===`sales_manager`?`Менеджер продаж`:B?.profile?.systemRole===`designer`?`Дизайнер`:B?.profile?.position??`Пользователь`})]}),(0,J.jsx)(M,{size:18})]})]})]}),s?(0,J.jsx)(`button`,{className:`sidebar-scrim`,"aria-label":`Закрыть меню`,onClick:()=>c(!1)}):null,',
  '',
  'remove duplicate React sidebar',
  true
);

replaceOnce(
  'nav`,{className:`mobile-tabs`,"aria-label":`Мобильная навигация`,children:[{label:`Главная`,icon:z},{label:`Заявки`,icon:te},{label:`Сметы`,icon:N},{label:`Проекты`,icon:h},{label:`Оплаты и расходы`,icon:ve}].map(e=>(0,J.jsxs)(`button`,{className:n===e.label?`active`:``,onClick:()=>G(e.label),"aria-current":n===e.label?`page`:void 0,children:[(0,J.jsx)(e.icon,{size:19}),(0,J.jsx)(`span`,{children:e.label===`Оплаты и расходы`?`Деньги`:e.label})]},e.label))}',
  roleAwareMobileTabs,
  'role-aware mobile tabs'
);

const oldCostTitle = 'Расчёт стоимости';
const oldCostTitleCount = source.split(oldCostTitle).length - 1;
if (oldCostTitleCount) {
  source = source.split(oldCostTitle).join('Себестоимость');
  console.log(`OK canonical cost title x${oldCostTitleCount}`);
} else {
  console.log('SKIP canonical cost title (уже применён)');
}

fs.writeFileSync(path, source);
console.log(`patched ${path}`);
