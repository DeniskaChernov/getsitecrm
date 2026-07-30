# GetSite OS

Внутренняя CRM и операционная система getsite.uz: заявки, клиенты, сметы,
проекты, задачи, оплаты, расходы, себестоимость, аналитика и контроль сдачи.

## Стек

- Node.js 18+ и Express
- React-клиент, собранный в `public/assets`
- PostgreSQL в production; локально допустим `data/db.json`
- Playwright для 75 браузерных проверок
- Railway для production-деплоя

## Быстрый локальный запуск

```powershell
npm install
npx playwright install chromium
Copy-Item .env.example .env
```

В `.env` задайте:

```dotenv
NODE_ENV=development
PORT=3100
SESSION_SECRET=replace-with-a-long-local-secret
ALLOW_DEV_BOOTSTRAP=1
```

`ALLOW_DEV_BOOTSTRAP=1` разрешён только локально. При первой инициализации
пустой локальной БД он создаёт тестовые аккаунты из `lib/auth.js`. В production
эта настройка не работает и не должна задаваться.

Запуск:

```powershell
npm run dev
```

Приложение: `http://127.0.0.1:3100`  
Health check: `http://127.0.0.1:3100/api/health`

Локальные тестовые аккаунты при включённом `ALLOW_DEV_BOOTSTRAP=1`:

- основатель: `denis@getsite.uz` / `denis123`
- учредитель: `nikita@getsite.uz` / `nikita123`
- менеджер: `manager@getsite.uz` / `manager123`
- дизайнер: `designer@getsite.uz` / `designer123`

Эти пароли не используются как production fallback.

## Проверки

Сервер должен отдельно работать на порту `3100`.

```powershell
npm test
npm run qa
npm run qa:stress
npm run qa:wave2
npm run qa:ui
npm run qa:all
```

`qa:all` выполняет acceptance, две стресс-волны по 75 проверок и 75
браузерных UI-прогонов. Отчёт UI сохраняется в игнорируемый
`qa-ui-75-report.json`.

## Архитектура

- `server.js` — HTTP, auth endpoints, security middleware, static assets.
- `lib/auth.js` — роли, пароли, подписанные сессии, фильтрация данных.
- `lib/actions.js` — бизнес-действия и аудит изменений.
- `lib/store.js` — единое состояние в PostgreSQL или локальном JSON.
- `lib/login-rate-limit.js` — лимиты входа по IP и email.
- `public/assets/main.js` — login/bootstrap клиента.
- `public/assets/nav-shell.js` — единственная пользовательская навигация.
- `scripts/patch-*.js` — воспроизводимые точечные патчи исходного bundle.
- `test/`, `scripts/qa-*.js` — unit, API, stress и browser QA.

Навигация использует внутренние идентификаторы из `lib/auth.js`; пользовательские
названия централизованы в `SECTIONS` внутри `nav-shell.js`. Страница
`Unit Economics` показывается пользователю как «Себестоимость».

## Безопасность

- В production обязательны `SESSION_SECRET` и `DATABASE_URL`.
- Bootstrap-пользователь создаётся только при заданном сильном
  `AUTH_*_PASSWORD` от 12 символов.
- Смена пароля, logout и отключение пользователя инвалидируют старые сессии.
- В production login rate-limit хранится в PostgreSQL и учитывает IP и email;
  локальный файловый режим использует память процесса.
- Helmet включает CSP, frame deny, no-referrer и HSTS.
- Изменяющие API-запросы проверяют `Origin` и `Sec-Fetch-Site`.
- Публичный PostgreSQL требует `DATABASE_CA`; Railway private URL работает
  внутри приватной сети.

Секреты нельзя хранить в git, логах, `State.md` или скриншотах.

## Документация

- [Деплой на Railway](DEPLOY.md)
- [Роли и права](docs/ROLES.md)
- [Бизнес-процессы](docs/BUSINESS_FLOWS.md)
- [Эксплуатационный runbook](docs/RUNBOOK.md)
- `.env.example` — полный шаблон переменных
- `State.md` — краткий машинный журнал текущего состояния
