/**
 * Price list shows unit-economics floor; clarify Прайс vs себестоимость.
 */
const fs = require('fs');
const path = 'public/assets/os-client-DeMZwioN.js';
let os = fs.readFileSync(path, 'utf8');

function mustReplace(oldStr, newStr, label) {
  if (!os.includes(oldStr)) {
    console.error('MISS', label);
    console.error(oldStr.slice(0, 120));
    process.exit(1);
  }
  os = os.replace(oldStr, newStr);
  console.log('OK', label);
}

mustReplace(
  'children:`Как читать цены`}),(0,J.jsx)(`span`,{children:`«От» — для рекламы. Обычная цена — для типовой сметы. Перед КП проверьте себестоимость в калькуляторе.`})',
  'children:`Прайс и себестоимость`}),(0,J.jsx)(`span`,{children:`Здесь продажник меняет цены и описание состава. Часы и пол себестоимости считаются в разделе «Себестоимость» / калькуляторе — ниже пола продавать нельзя.`})'
);

mustReplace(
  '(0,J.jsx)(`th`,{children:`Часы работы`})',
  '(0,J.jsx)(`th`,{children:`Себестоимость`})'
);

mustReplace(
  '(0,J.jsx)(`td`,{children:e.plannedHours>0?(0,J.jsxs)(`span`,{className:`service-hours`,children:[(0,J.jsxs)(`strong`,{children:[e.plannedHours,` ч`]}),(0,J.jsxs)(`small`,{children:[e.founderHours,` ч руководитель · `,e.contractorHours,` ч команда`]})]}):`Не заданы`})',
  '(0,J.jsx)(`td`,{children:(0,J.jsxs)(`span`,{className:`service-hours`,children:[(0,J.jsxs)(`strong`,{className:e.belowFloor?`price-below-floor`:``,children:[e.costFloor>0?`пол ${q(e.costFloor)}`:`Нет расчёта`]}),(0,J.jsxs)(`small`,{children:[e.recommendedPrice>0?`реком. ${q(e.recommendedPrice)} · `:`` ,e.plannedHours>0?`${e.plannedHours} ч`: `задайте часы в себестоимости`]})]})})'
);

// Form section hints: section 3 = cost for founders
mustReplace(
  'children:`Часы работы`}),(0,J.jsxs)(`small`,{children:[`Всего сейчас: `,t.plannedHours,` ч`]})',
  'children:`Себестоимость (часы)`}),(0,J.jsxs)(`small`,{children:[`Считается в юнит-экономике. Всего: `,t.plannedHours,` ч`]})'
);

mustReplace(
  'children:`Услуга`}),(0,J.jsx)(`small`,{children:`После сохранения сразу видно в прайсе`})',
  'children:`Услуга`}),(0,J.jsx)(`small`,{children:`Цены — для продаж. Часы ниже — для расчёта себестоимости`})'
);

fs.writeFileSync(path, os);
console.log('patched price/ue split');
