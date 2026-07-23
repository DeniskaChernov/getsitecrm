# Деплой GetSite OS на Railway

## Чеклист

1. Добавьте плагин **Postgres** в проект Railway.
2. Variables (Railway → Variables):
   - `SESSION_SECRET` — длинная случайная строка (обязательно)
   - `DATABASE_URL` = `${{Postgres.DATABASE_PRIVATE_URL}}` (или публичный `DATABASE_URL`)
   - `NODE_ENV` = `production`
3. Deploy из GitHub (`npm start` / `railway.toml`).
4. Проверьте `GET /api/health` → `{ ok: true, storage: "postgres" }`.
5. Войдите под основателем (создайте пользователей через кнопку **Команда**).
6. В production подсказки демо-паролей на экране входа **скрыты**.

Локально: скопируйте `.env.example` → `.env`, задайте `SESSION_SECRET`, при необходимости `DATABASE_URL`.
