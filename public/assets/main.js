import { r as jsxFactory, t as reactDomFactory } from './framework-CXnKph_e.js';
import App from './os-client-DeMZwioN.js';

const jsxRuntime = jsxFactory();
const ReactDOM = reactDomFactory();
const rootEl = document.getElementById('root');

const ROLE_NAV = {
  founder: null, // all
  sales_manager: [
    'Главная',
    'Заявки',
    'Клиенты',
    'Сметы',
    'Проекты',
    'Деньги',
    'Прайс',
    'Скрипты продаж',
    'История',
  ],
  designer: ['Главная', 'Проекты', 'Команда и сроки', 'История'],
};

const ROLE_BLOCKED_INTERNAL = {
  sales_manager: ['Unit Economics', 'Готовность', 'Аналитика', 'Настройки', 'Команда и сроки'],
  designer: [
    'Заявки',
    'Клиенты',
    'Сметы',
    'Оплаты и расходы',
    'Unit Economics',
    'Прайс',
    'Скрипты продаж',
    'Готовность',
    'Аналитика',
    'Настройки',
  ],
};

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

  const allowed = ROLE_NAV[user.systemRole];
  const hideNav = () => {
    document.querySelectorAll('nav button.nav-item, .nav-list button.nav-item').forEach((btn) => {
      const label = (btn.textContent || '').replace(/\d+/g, '').trim();
      // Map display labels
      const normalized = label
        .replace(/^Деньги.*/, 'Деньги')
        .replace(/^Расчёт стоимости.*/, 'Расчёт стоимости')
        .replace(/^Готовность.*/, 'Готовность системы')
        .replace(/^Отчёты.*/, 'Отчёты')
        .replace(/^Команда и сроки.*/, 'Команда и сроки')
        .replace(/^Скрипты продаж.*/, 'Скрипты продаж')
        .replace(/^Заявки.*/, 'Заявки')
        .replace(/^Клиенты.*/, 'Клиенты')
        .replace(/^Сметы.*/, 'Сметы')
        .replace(/^Проекты.*/, 'Проекты')
        .replace(/^Прайс.*/, 'Прайс')
        .replace(/^История.*/, 'История')
        .replace(/^Настройки.*/, 'Настройки')
        .replace(/^Главная.*/, 'Главная');

      if (!allowed) {
        btn.style.display = '';
        return;
      }
      const ok = allowed.some((a) => normalized.startsWith(a) || label.startsWith(a));
      btn.style.display = ok ? '' : 'none';
    });
  };

  hideNav();
  const obs = new MutationObserver(() => hideNav());
  obs.observe(document.body, { childList: true, subtree: true });

  // Block opening forbidden sections via sessionStorage / click interception
  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target.closest('button.nav-item');
      if (!btn || !allowed) return;
      const text = (btn.textContent || '').trim();
      const blockedDisplay = {
        sales_manager: ['Расчёт стоимости', 'Готовность', 'Отчёты', 'Настройки', 'Команда и сроки'],
        designer: [
          'Заявки',
          'Клиенты',
          'Сметы',
          'Деньги',
          'Расчёт стоимости',
          'Прайс',
          'Скрипты',
          'Готовность',
          'Отчёты',
          'Настройки',
        ],
      }[user.systemRole];
      if (blockedDisplay?.some((b) => text.startsWith(b))) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  // Logout on user card double-click context — add floating logout
  if (!document.getElementById('gs-logout')) {
    const logout = document.createElement('button');
    logout.id = 'gs-logout';
    logout.className = 'button secondary';
    logout.textContent = 'Выйти';
    logout.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:9999;opacity:.85';
    logout.onclick = async () => {
      await api('/api/auth/logout', { method: 'POST', body: '{}' });
      location.reload();
    };
    document.body.appendChild(logout);
  }
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
