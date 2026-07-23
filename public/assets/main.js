import { r as jsxFactory, t as reactDomFactory } from './framework-CXnKph_e.js';
import App from './os-client-DeMZwioN.js';
import { mountNavShell } from './nav-shell.js';
import './ui-fix.js';

const jsxRuntime = jsxFactory();
const ReactDOM = reactDomFactory();
const rootEl = document.getElementById('root');

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function hasAuthMarker() {
  return /(?:^|;\s*)getsite_auth=1(?:;|$)/.test(document.cookie);
}

async function restoreSession(retries = 3) {
  let lastError = null;
  for (let i = 0; i < retries; i++) {
    try {
      const me = await api('/api/auth/me');
      if (me.authenticated && me.user) return { user: me.user, roles: me.roles };
      return null;
    } catch (err) {
      lastError = err;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  if (hasAuthMarker()) {
    console.warn('Сессия есть, но сервер не ответил:', lastError?.message);
  }
  return null;
}

function renderAuth(demoHints = false) {
  document.body.classList.remove('gs-nav-ready', 'gs-nav-open');
  document.getElementById('gs-nav')?.remove();
  document.getElementById('gs-user-admin')?.remove();

  rootEl.innerHTML = `
    <div class="auth-shell">
      <section class="auth-hero" aria-label="getsite">
        <div class="auth-hero-inner">
          <img class="auth-logo" src="/assets/logo-getsite.png" width="220" height="220" alt="getsite*" />
          <h1>Операционная система <span>продаж и проектов</span></h1>
          <p>Один контур для заявок, смет, производства и денег getsite.uz</p>
        </div>
      </section>
      <div class="auth-panel-wrap">
        <form class="auth-card" id="auth-form">
          <div class="auth-kicker">GetSite OS</div>
          <h2>Вход</h2>
          <p class="lead">Рабочее пространство команды getsite.uz. Аккаунт выдаёт основатель.</p>
          <label><span>Email</span><input name="email" type="email" required placeholder="you@getsite.uz" autocomplete="username" /></label>
          <label><span>Пароль</span><input name="password" type="password" required minlength="6" placeholder="Минимум 6 символов" autocomplete="current-password" /></label>
          <div class="auth-error" id="auth-error"></div>
          <div class="auth-actions">
            <button class="button primary" type="submit">Войти</button>
          </div>
          ${
            demoHints
              ? `<div class="auth-demos">
            <div><strong>Денис</strong> — denis@getsite.uz / denis123 (основатель)</div>
            <div><strong>Никита</strong> — nikita@getsite.uz / nikita123 (учредитель)</div>
            <div><strong>Менеджер</strong> — manager@getsite.uz / manager123</div>
            <div><strong>Дизайнер</strong> — designer@getsite.uz / designer123</div>
          </div>`
              : ''
          }
        </form>
      </div>
    </div>
  `;

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      const me = await api('/api/auth/me').catch(() => ({ user: result.user, roles: null }));
      await bootApp(me.user || result.user, me.roles);
    } catch (err) {
      errEl.textContent = err.message || 'Не удалось выполнить запрос';
    }
  });
}

function applyRoleToDom(user, roles) {
  document.body.classList.remove('role-founder', 'role-sales_manager', 'role-designer');
  document.body.classList.add(`role-${user.systemRole}`);
  mountNavShell(user, roles);
  if (user.systemRole === 'founder') mountUserAdmin(user);
}

function mountUserAdmin(user) {
  if (document.getElementById('gs-user-admin')) return;
  const panel = document.createElement('div');
  panel.id = 'gs-user-admin';
  panel.innerHTML = `
    <button type="button" class="gs-user-admin-fab" id="gs-user-admin-open" title="Пользователи">Команда</button>
    <div class="gs-user-admin-modal" id="gs-user-admin-modal" hidden>
      <div class="gs-user-admin-card">
        <header>
          <strong>Пользователи</strong>
          <button type="button" id="gs-user-admin-close" aria-label="Закрыть">×</button>
        </header>
        <p class="hint">Создание и сброс пароля (основатель). Роли также можно менять в Настройках.</p>
        <form id="gs-user-create">
          <label><span>Имя</span><input name="displayName" required /></label>
          <label><span>Email</span><input name="email" type="email" required /></label>
          <label><span>Пароль</span><input name="password" type="password" minlength="6" required /></label>
          <label><span>Роль</span>
            <select name="systemRole">
              <option value="sales_manager">Менеджер</option>
              <option value="designer">Дизайнер</option>
              <option value="founder">Основатель</option>
            </select>
          </label>
          <button class="button primary" type="submit">Создать</button>
          <div class="auth-error" id="gs-user-create-err"></div>
        </form>
        <hr />
        <form id="gs-user-password">
          <label><span>Email пользователя</span><input name="email" type="email" required placeholder="${user.email}" /></label>
          <label><span>Новый пароль</span><input name="password" type="password" minlength="6" required /></label>
          <button class="button" type="submit">Сбросить пароль</button>
          <div class="auth-error" id="gs-user-password-err"></div>
        </form>
        <form id="gs-user-deactivate">
          <label><span>Email для отключения</span><input name="email" type="email" required /></label>
          <button class="button danger" type="submit">Отключить</button>
          <div class="auth-error" id="gs-user-deactivate-err"></div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const modal = document.getElementById('gs-user-admin-modal');
  document.getElementById('gs-user-admin-open').onclick = () => {
    modal.hidden = false;
  };
  document.getElementById('gs-user-admin-close').onclick = () => {
    modal.hidden = true;
  };
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  document.getElementById('gs-user-create').onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById('gs-user-create-err');
    err.textContent = '';
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await api('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      err.textContent = 'Создан. Обновите Настройки / список пользователей.';
      e.currentTarget.reset();
    } catch (ex) {
      err.textContent = ex.message;
    }
  };

  document.getElementById('gs-user-password').onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById('gs-user-password-err');
    err.textContent = '';
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await api('/api/auth/password', { method: 'POST', body: JSON.stringify(payload) });
      err.textContent = 'Пароль обновлён.';
      e.currentTarget.reset();
    } catch (ex) {
      err.textContent = ex.message;
    }
  };

  document.getElementById('gs-user-deactivate').onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById('gs-user-deactivate-err');
    err.textContent = '';
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await api('/api/auth/deactivate', { method: 'POST', body: JSON.stringify(payload) });
      err.textContent = 'Пользователь отключён.';
      e.currentTarget.reset();
    } catch (ex) {
      err.textContent = ex.message;
    }
  };
}

async function bootApp(user, roles) {
  rootEl.innerHTML = '';
  applyRoleToDom(user, roles);
  ReactDOM.createRoot(rootEl).render(
    jsxRuntime.jsx(App, {
      currentUser: user.displayName || user.fullName,
      currentEmail: user.email,
    })
  );
}

async function start() {
  const session = await restoreSession(3);
  if (session?.user) {
    await bootApp(session.user, session.roles);
    return;
  }
  let demoHints = false;
  try {
    const cfg = await api('/api/auth/config');
    demoHints = Boolean(cfg.showDemoAccounts);
  } catch {
    demoHints = true;
  }
  renderAuth(demoHints);
}

start();
