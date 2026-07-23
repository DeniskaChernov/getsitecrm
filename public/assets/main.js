import { r as jsxFactory, t as reactDomFactory } from './framework-CXnKph_e.js';
import App from './os-client-DeMZwioN.js';
import { mountNavShell } from './nav-shell.js';

const jsxRuntime = jsxFactory();
const ReactDOM = reactDomFactory();
const rootEl = document.getElementById('root');

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function renderAuth(mode = 'login') {
  document.body.classList.remove('gs-nav-ready', 'gs-nav-open');
  document.getElementById('gs-nav')?.remove();

  rootEl.innerHTML = `
    <div class="auth-shell">
      <form class="auth-card" id="auth-form">
        <div class="auth-brand">
          <span class="brand-get">get</span>site<span class="brand-star">*</span><small>OS</small>
        </div>
        <h1>${mode === 'login' ? 'Вход в систему' : 'Регистрация'}</h1>
        <p class="lead">${
          mode === 'login'
            ? 'Рабочее пространство getsite.uz — продажи, проекты и деньги в одном контуре.'
            : 'Создайте аккаунт менеджера или дизайнера. Роль основателя выдаёт только учредитель.'
        }</p>
        ${
          mode === 'register'
            ? `<label><span>Имя</span><input name="displayName" required placeholder="Как вас зовут" /></label>`
            : ''
        }
        <label><span>Email</span><input name="email" type="email" required placeholder="you@getsite.uz" autocomplete="username" /></label>
        <label><span>Пароль</span><input name="password" type="password" required minlength="6" placeholder="Минимум 6 символов" autocomplete="${
          mode === 'login' ? 'current-password' : 'new-password'
        }" /></label>
        ${
          mode === 'register'
            ? `<label><span>Роль</span>
                <select name="systemRole">
                  <option value="sales_manager">Менеджер продаж</option>
                  <option value="designer">Дизайнер</option>
                </select>
              </label>`
            : ''
        }
        <div class="auth-error" id="auth-error"></div>
        <div class="auth-actions">
          <button class="button primary" type="submit">${mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
        </div>
        <div class="auth-switch">
          ${
            mode === 'login'
              ? `Нет аккаунта? <button type="button" id="auth-switch" data-mode="register">Зарегистрироваться</button>`
              : `Уже есть аккаунт? <button type="button" id="auth-switch" data-mode="login">Войти</button>`
          }
        </div>
        <div class="auth-demos">
          <div><strong>Денис</strong> — denis@getsite.uz / denis123 (основатель)</div>
          <div><strong>Никита</strong> — nikita@getsite.uz / nikita123 (учредитель)</div>
          <div><strong>Менеджер</strong> — manager@getsite.uz / manager123</div>
          <div><strong>Дизайнер</strong> — designer@getsite.uz / designer123</div>
        </div>
      </form>
    </div>
  `;

  document.getElementById('auth-switch')?.addEventListener('click', (e) => {
    renderAuth(e.currentTarget.dataset.mode);
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const result = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      await bootApp(result.user);
    } catch (err) {
      errEl.textContent = err.message || 'Не удалось выполнить запрос';
    }
  });
}

function applyRoleToDom(user) {
  document.body.classList.remove('role-founder', 'role-sales_manager', 'role-designer');
  document.body.classList.add(`role-${user.systemRole}`);
  mountNavShell(user);
}

async function bootApp(user) {
  rootEl.innerHTML = '';
  applyRoleToDom(user);
  ReactDOM.createRoot(rootEl).render(
    jsxRuntime.jsx(App, {
      currentUser: user.displayName,
      currentEmail: user.email,
    })
  );
}

async function start() {
  try {
    const me = await api('/api/auth/me');
    if (me.authenticated && me.user) {
      await bootApp(me.user);
      return;
    }
  } catch {
    // not logged in
  }
  renderAuth('login');
}

start();
