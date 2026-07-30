/**
 * Каталог переменных окружения GetSite OS.
 * Используется для документации и проверки при старте.
 * Значения задаются в Railway Variables / .env — не храните секреты в git.
 */
module.exports = {
  /** Fail-fast при старте в production */
  requiredInProduction: ['SESSION_SECRET', 'DATABASE_URL'],
  recommendedInProduction: [],
  optional: [
    'DATABASE_URL',
    'DATABASE_PRIVATE_URL',
    'POSTGRES_URL',
    'DATABASE_SSL',
    'DATABASE_CA',
    'PORT',
    'NODE_ENV',
    'AUTH_DENIS_EMAIL',
    'AUTH_DENIS_PASSWORD',
    'AUTH_NIKITA_EMAIL',
    'AUTH_NIKITA_PASSWORD',
    'AUTH_MANAGER_EMAIL',
    'AUTH_MANAGER_PASSWORD',
    'AUTH_DESIGNER_EMAIL',
    'AUTH_DESIGNER_PASSWORD',
    'ALLOW_DEV_BOOTSTRAP',
  ],
  /**
   * Шаблон для Railway → Variables.
   * Пароли: замените __SET_ME__ на свой секрет. После сохранения Railway
   * перезапустит сервис — хеш в БД обновится при старте.
   */
  railwayTemplate: {
    SESSION_SECRET: '',
    DATABASE_URL: '',
    DATABASE_PRIVATE_URL: '',
    POSTGRES_URL: '',
    DATABASE_SSL: '',
    NODE_ENV: 'production',
    AUTH_DENIS_EMAIL: 'denis@getsite.uz',
    AUTH_DENIS_PASSWORD: '__SET_ME__',
    AUTH_NIKITA_EMAIL: 'nikita@getsite.uz',
    AUTH_NIKITA_PASSWORD: '__SET_ME__',
    AUTH_MANAGER_EMAIL: 'manager@getsite.uz',
    AUTH_MANAGER_PASSWORD: '__SET_ME__',
    AUTH_DESIGNER_EMAIL: 'designer@getsite.uz',
    AUTH_DESIGNER_PASSWORD: '__SET_ME__',
  },
};
