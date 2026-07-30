# Деплой GetSite OS на Railway

## Чеклист

1. Добавьте плагин **Postgres** в проект Railway.
2. Variables (Railway → Variables):
   - `SESSION_SECRET` — длинная случайная строка (обязательно)
   - `DATABASE_URL` = `${{Postgres.DATABASE_PRIVATE_URL}}` (обязательно)
   - `NODE_ENV` = `production`
   - `AUTH_DENIS_PASSWORD`, `AUTH_NIKITA_PASSWORD`, `AUTH_MANAGER_PASSWORD`,
     `AUTH_DESIGNER_PASSWORD` — уникальные пароли от 12 символов для нужных
     bootstrap-аккаунтов. Пустое значение / `__SET_ME__` игнорируется.
3. Deploy из GitHub (`npm start` / `railway.toml`).
4. Проверьте `GET /api/health` → `{ ok: true, storage: "postgres" }`.
5. Войдите под основателем, чей `AUTH_*_PASSWORD` вы задали.
6. В production подсказки демо-паролей на экране входа **скрыты**.
7. Никогда не задавайте `ALLOW_DEV_BOOTSTRAP=1` в production.

Локальный bootstrap и тестовые аккаунты описаны в [README](README.md).

После деплоя и при инцидентах следуйте [эксплуатационному runbook](docs/RUNBOOK.md).
Модель доступа описана в [документе ролей](docs/ROLES.md).
