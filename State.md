# State

## Policy
- После любых правок: commit + push сразу (user 2026-07-30).

## 2026-07-30 фиксы по скриншотам юзера (3 дефекта)
- `.status-pill` превращалась в эллипс: наш `brand.css` ставил `border-radius:999px !important`, а flex-родитель растягивал её по высоте (161px). Fix: `border-radius:14px` (браузер сам режет до половины высоты → однострочная остаётся таблеткой), `align-self:center` + `width:fit-content` → h 161→52.
- Текст «Есть Несохранённые Изменения»: базовый `text-transform:capitalize` капитализировал каждое слово. Fix: `uppercase` (как остальные чипы/заголовки таблиц). `::first-letter` не подошёл — не работает на `inline-flex`.
- Пустое состояние сметы уезжало вправо и требовало h-прокрутки: `.estimate-lines-empty{min-width:680px}` в базе. Fix: `min-width:0` → w 680→390.
- Зелёные скроллбары со стрелками: `scrollbar-color` наследуется, `scrollbar-width` — НЕТ. Вложенные скроллы (`.estimate-table` и др.) получали `auto` (широкий, с кнопками), а Chrome/Windows красил кнопки в лаймовый. Fix: `* { scrollbar-width: thin }`.
- Вход: локально форма и API работают (200, founder). Rate-limit — только НЕудачные попытки, 12/15мин на IP+email, in-memory (перезапуск сбрасывает). Аккаунты-подсказки показываются при `!IS_PROD`.
- Проверки: qa:ui 75/75, npm test 26/26, qa-acceptance OK. Cache `?v=20260730c`.

## 2026-07-30 UI-аудит (42 экрана) + 5 фиксов визуала
- Временный аудитор (эвристики: internal overflow / clipped / tiny tap / under-topbar) прогнал 14 разделов × 3 вьюпорта (390/768/1440), после — удалён.
- Планшет 768px чист. Doc-overflow нигде. Найдено и исправлено:
- KPI «Сегодня» (`.today-grid>button>div`): 2-колоночный грид → число наезжало на подпись, `p` (в т.ч. сумма) резался ellipsis. Fix: вертикальный стек (подпись→число→подзаголовок, `p` переносится). `brand.css`.
- Мобильный провал шапки «Проекты»/«Команда» (~292px): дети `.page-heading` с `flex-grow:1` растягивались по высоте после перевода в колонку. Fix: `.page-heading{display:block}` на мобиле (height 572→152). `mobile.css`.
- Тап-таргеты <44px: `.project-card-actions button`, `.card-link`, `.row-menu`, `.service-edit-button`, `.receive-payment` → min-height 44 на мобиле. `mobile.css`.
- FAB «Команда» наезжал на карточки: поднят до 84px, `page-wrap` padding-bottom 96→132. `mobile.css`.
- Шапка «Сметы» (desktop) распирала панель на 24px: `.page-heading/.heading-actions{flex-wrap:wrap}`. `brand.css`.
- Проверки: qa:ui 75/75, npm test 26/26, qa-acceptance OK. Cache `?v=20260730b`.

## 2026-07-30 UI-прогоны (75) + 2 фикса
- Новый `scripts/qa-ui-75.js` (`npm run qa:ui`, playwright devDep): 28 founder + 18 sales + 8 designer + 21 краевых.
- Проверяет: pageerror/console.error, `#root` не пуст, шапка = раздел, нет NaN/undefined/Infinity, нет h-оверфлоу, меню живо.
- 1-й прогон: 67/75. Фикс 1: `goToSection` ретраил синхронно → клик по меню до монтирования React-сайдбара терялся (юзер оставался на «Главной»); теперь async retry 24×120ms.
- Фикс 2: `.commercial-actions/.commercial-route` (Сметы) — flex nowrap + min-width auto давали оверфлоу 26px; wrap + min-width 0 в `brand.css`.
- Рефактор: маппинг подписей → `TARGET_TO_INTERNAL`/`toInternalLabel` (было дублировано), `DISPLAY_TO_INTERNAL` → `SECTION_TITLES`.
- 2-й прогон: 75/75. Плюс: npm test 26, qa 26 checks, qa:stress 75/75, qa:wave2 75/75.
- Cache: `?v=20260730a`. Отчёт `qa-ui-75-report.json` в .gitignore.

## 2026-07-30 hotfix: «Себестоимость» белый экран
- Причина: margin nullable (price=0 → null, от фикса маржи), клиент звал `.toFixed(1)` → TypeError → React unmount всего `#root`.
- Fix: `__gsMoney.fmtPct()` в `public/assets/money.js` (null → «—»); 5 мест рендера через `scripts/patch-margin-precision.js`.
- Места: donut, cost-bar «Прибыль», формула в Unit Economics, история расчётов, command palette.
- Tests: 26 pass (`npm test`), добавлены formatMarginPct + browser money.js через vm.

## 2026-07-28 mobile/nav
- Bug: React `.sidebar.is-open` + scrim поверх `#gs-nav` на смартфоне.
- Fix: clone `.mobile-menu` + document capture; CSS hide `.sidebar`; z `#gs-nav` 120 / overlay 110.
- mobile.css: bottom tabs, filters scroll, iOS 16px, FAB над tabs, drawer ✕, create-menu на всю ширину top.
- Cache: `?v=20260728p`. Desktop OK (rail 248, collapse visible).
- Pushed: `c39cfde` → origin/main.
