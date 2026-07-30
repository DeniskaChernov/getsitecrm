# State

## Policy
- После любых правок: commit + push сразу (user 2026-07-30).

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
