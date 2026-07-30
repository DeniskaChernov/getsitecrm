# State

## Policy
- После любых правок: commit + push сразу (user 2026-07-30).

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
