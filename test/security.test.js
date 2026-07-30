const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  createSessionToken,
  defaultUsers,
  getSessionUser,
  validateDisplayName,
  validatePassword,
} = require('../lib/auth');

const ENV_KEYS = [
  'NODE_ENV',
  'ALLOW_DEV_BOOTSTRAP',
  'AUTH_DENIS_PASSWORD',
  'AUTH_NIKITA_PASSWORD',
  'AUTH_MANAGER_PASSWORD',
  'AUTH_DESIGNER_PASSWORD',
];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] == null) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe('production bootstrap', () => {
  it('не создаёт пользователей из известных fallback-паролей', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DENIS_PASSWORD = '__SET_ME__';
    delete process.env.AUTH_NIKITA_PASSWORD;
    delete process.env.AUTH_MANAGER_PASSWORD;
    delete process.env.AUTH_DESIGNER_PASSWORD;
    assert.deepEqual(defaultUsers(), []);
  });

  it('принимает только явно заданный сильный секрет', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DENIS_PASSWORD = 'a-strong-production-secret';
    const users = defaultUsers();
    assert.equal(users.length, 1);
    assert.equal(users[0].email, 'denis@getsite.uz');
    assert.equal(users[0]._passwordFromEnv, true);
  });

  it('отклоняет короткий AUTH-пароль', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DENIS_PASSWORD = 'short';
    assert.throws(() => defaultUsers(), /не менее 12 символов/);
  });
});

describe('security validation', () => {
  it('блокирует HTML и управляющие символы в имени', () => {
    assert.equal(validateDisplayName('<img src=x onerror=alert(1)>').ok, false);
    assert.equal(validateDisplayName('Иван\u0000').ok, false);
    assert.deepEqual(validateDisplayName(' Иван '), { ok: true, value: 'Иван' });
  });

  it('требует сильный пароль', () => {
    assert.equal(validatePassword('123456').ok, false);
    assert.equal(validatePassword('qwerty123456').ok, false);
    assert.equal(validatePassword('long-and-unique-secret').ok, true);
  });

  it('помещает sessionVersion в подписанную сессию', () => {
    const token = createSessionToken({
      id: 'u-1',
      email: 'user@getsite.uz',
      displayName: 'User',
      systemRole: 'designer',
      sessionVersion: 7,
    });
    const session = getSessionUser({ headers: { cookie: `getsite_session=${token}` } });
    assert.equal(session.sessionVersion, 7);
  });
});
