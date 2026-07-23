/**
 * Каталог переменных окружения GetSite OS.
 * Используется для документации и проверки при старте.
 * Значения задаются в Railway Variables / .env — не храните секреты в git.
 */
module.exports = {
  /** Fail-fast при старте в production */
  requiredInProduction: ['SESSION_SECRET'],
  /** Рекомендуются для Railway (без DATABASE_URL — файловое хранилище) */
  recommendedInProduction: ['DATABASE_URL'],
  optional: [
    'DATABASE_URL',
    'DATABASE_PRIVATE_URL',
    'POSTGRES_URL',
    'DATABASE_SSL',
    'PORT',
    'NODE_ENV',
  ],
  /** Шаблон для Railway → Variables (пустые — заполните сами) */
  railwayTemplate: {
    SESSION_SECRET: '',
    DATABASE_URL: '',
    DATABASE_PRIVATE_URL: '',
    POSTGRES_URL: '',
    DATABASE_SSL: '',
    NODE_ENV: 'production',
  },
};
