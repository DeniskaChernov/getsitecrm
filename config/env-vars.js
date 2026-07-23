/**
 * Каталог переменных окружения GetSite OS.
 * Используется для документации и проверки при старте.
 * Значения задаются в Railway Variables / .env — не храните секреты в git.
 */
module.exports = {
  requiredInProduction: ['SESSION_SECRET', 'DATABASE_URL'],
  optional: [
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
