/**
 * Clearer Russian copy for price/service modals and related UI.
 * Run: node scripts/patch-copy-clarity.js
 */
const fs = require('fs');
const path = 'public/assets/os-client-DeMZwioN.js';
let os = fs.readFileSync(path, 'utf8');

const pairs = [
  // Service form sections
  ['children:`Что продаём`', 'children:`Услуга`'],
  ['children:`Название и место в каталоге`', 'children:`Как называется и в каком разделе прайса`'],
  ['children:`Изменения сразу появятся в прайсе`', 'children:`После сохранения сразу видно в прайсе`'],
  ['children:`Минимум для рекламы и внутренние ориентиры`', 'children:`Рекламная «от» и обычная цена для смет`'],
  ['children:`Цена «от», сум *`', 'children:`Цена для рекламы (от), сум *`'],
  ['children:`Цена «от», сум`', 'children:`Цена для рекламы (от), сум`'],
  ['children:`Рабочая цена, сум`', 'children:`Обычная цена проекта, сум`'],
  ['children:`Расширенный объём, сум`', 'children:`Цена большого объёма, сум`'],
  ['children:`Трудозатраты`', 'children:`Часы работы`'],
  ['children:`Ваши часы`', 'children:`Часы основателя / менеджера`'],
  ['children:`Часы команды / подрядчика`', 'children:`Часы команды или подрядчика`'],
  ['children:`Активная позиция`', 'children:`Показывать в прайсе`'],
  ['children:`Единица расчёта`', 'children:`За что считаем (проект, час…)`'],
  ['children:`Описание для сметы`', 'children:`Что входит в услугу (текст в смете)`'],
  ['children:`Основная услуга`', 'children:`Основная`'],
  ['children:`Подуслуга`', 'children:`Дополнительная`'],
  ['children:`Обязательны название, тип и цена «от». Остальное можно дополнить позже.`', 'children:`Нужны название, тип и цена «от». Остальное можно заполнить позже.`'],
  ['children:`Все изменения сохраняются в данных системы.`', 'children:`Сохранение сразу обновляет прайс и сметы.`'],

  // Price list helper
  [
    'children:`Цена «от» подходит для рекламы. Рабочая цена — внутренний ориентир для типового проекта. Итог проверяйте по себестоимости и объёму.`',
    'children:`«От» — для рекламы. Обычная цена — для типовой сметы. Перед КП проверьте себестоимость в калькуляторе.`',
  ],
  ['children:`Как использовать цены`', 'children:`Как читать цены`'],
  ['children:`Проверить стоимость `', 'children:`Открыть калькулятор `'],

  // Table headers
  ['children:`Цена от`', 'children:`От (реклама)`'],
  ['children:`Рабочая цена`', 'children:`Обычная цена`'],

  // Common actions / empty
  ['children:`Добавить услугу`', 'children:`Новая услуга`'],
  ['text:`Соберите каталог услуг с ценами «от», рабочими ориентирами и плановыми часами.`', 'text:`Добавьте услуги с ценой для рекламы, обычной ценой и часами — это основа смет.`'],
];

let ok = 0;
let miss = 0;
for (const [from, to] of pairs) {
  if (!os.includes(from)) {
    console.warn('MISS', from.slice(0, 80));
    miss += 1;
    continue;
  }
  const count = os.split(from).length - 1;
  os = os.split(from).join(to);
  console.log('OK', count + 'x', from.slice(0, 50));
  ok += 1;
}

fs.writeFileSync(path, os);
console.log(`done ok=${ok} miss=${miss}`);
