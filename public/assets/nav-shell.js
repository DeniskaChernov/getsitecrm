/**
 * Компактная навигация GetSite OS.
 * Скрывает разрозненный sidebar приложения и ведёт по рабочим сценариям.
 */

const DISPLAY_TO_INTERNAL = {
  Главная: 'Главная',
  Заявки: 'Заявки',
  Клиенты: 'Клиенты',
  Сметы: 'Сметы',
  Проекты: 'Проекты',
  'Команда и сроки': 'Команда и сроки',
  Деньги: 'Деньги',
  'Расчёт стоимости': 'Расчёт стоимости',
  Прайс: 'Прайс',
  'Скрипты продаж': 'Скрипты продаж',
  История: 'История',
  Отчёты: 'Отчёты',
  Настройки: 'Настройки',
  'Готовность системы': 'Готовность системы',
};

const NAV_TREE = [
  {
    id: 'home',
    title: null,
    items: [{ id: 'home', label: 'Главная', target: 'Главная', icon: 'home' }],
  },
  {
    id: 'sales',
    title: 'Продажи',
    items: [
      { id: 'leads', label: 'Заявки', target: 'Заявки', icon: 'inbox', hint: 'Воронка' },
      { id: 'clients', label: 'Клиенты', target: 'Клиенты', icon: 'users' },
      { id: 'estimates', label: 'Сметы', target: 'Сметы', icon: 'file', hint: 'КП и состав' },
      { id: 'scripts', label: 'Скрипты', target: 'Скрипты продаж', icon: 'chat' },
    ],
  },
  {
    id: 'work',
    title: 'Производство',
    items: [
      { id: 'projects', label: 'Проекты', target: 'Проекты', icon: 'layers' },
      { id: 'team', label: 'Сроки и команда', target: 'Команда и сроки', icon: 'calendar' },
    ],
  },
  {
    id: 'money',
    title: 'Деньги',
    items: [
      { id: 'payments', label: 'Оплаты и расходы', target: 'Деньги', icon: 'wallet' },
      { id: 'calc', label: 'Калькулятор цены', target: 'Расчёт стоимости', icon: 'calc' },
      { id: 'price', label: 'Прайс', target: 'Прайс', icon: 'tag' },
    ],
  },
];

const MORE_ITEMS = [
  { id: 'history', label: 'История изменений', target: 'История', icon: 'clock' },
  { id: 'reports', label: 'Отчёты', target: 'Отчёты', icon: 'chart' },
  { id: 'settings', label: 'Настройки', target: 'Настройки', icon: 'gear' },
  { id: 'ready', label: 'Готовность системы', target: 'Готовность системы', icon: 'check' },
];

const CREATE_ACTIONS = [
  { label: 'Новая заявка', desc: 'Лид в воронку', target: 'Заявки', click: 'Новая заявка|Создать заявку|Добавить заявку' },
  { label: 'Клиент', desc: 'Компания и контакт', target: 'Клиенты', click: 'Добавить клиента' },
  { label: 'Смета', desc: 'Состав и цена', target: 'Сметы', click: 'Новая смета' },
  { label: 'Проект', desc: 'В производство', target: 'Проекты', click: 'Создать проект' },
  { label: 'Оплата', desc: 'Доход по проекту', target: 'Деньги', click: 'Зафиксировать оплату|Добавить оплату' },
];

const ROLE_ALLOWED = {
  founder: null,
  sales_manager: new Set([
    'Главная',
    'Заявки',
    'Клиенты',
    'Сметы',
    'Проекты',
    'Деньги',
    'Прайс',
    'Скрипты продаж',
    'История',
  ]),
  designer: new Set(['Главная', 'Проекты', 'Команда и сроки', 'История']),
};

function iconSvg(name) {
  const paths = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/>',
    inbox: '<path d="M4 6h16v12H4z"/><path d="m4 10 8 5 8-5"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M21 19a4.5 4.5 0 0 0-4-4.4"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    chat: '<path d="M5 5h14v10H8l-3 3z"/>',
    layers: '<path d="m12 4 8 4-8 4-8-4 8-4z"/><path d="m4 12 8 4 8-4"/><path d="m4 16 8 4 8-4"/>',
    calendar: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4M16 4v4M4 11h16"/>',
    wallet: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h2M12 12h2M16 12h1M8 16h2M12 16h2"/>',
    tag: '<path d="M4 12V5h7l9 9-7 7z"/><circle cx="8.5" cy="8.5" r="1.2"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
    chart: '<path d="M4 19h16M7 16V10M12 16V6M17 16v-3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.9 6.3l1.5 1.5M17.6 16.2l1.5 1.5M3 12h2M19 12h2M4.9 17.7l1.5-1.5M17.6 7.8l1.5-1.5"/>',
    check: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.home}</svg>`;
}

function isAllowed(role, target, rolesFromApi) {
  if (rolesFromApi?.[role]?.sections) {
    const sections = rolesFromApi[role].sections;
    // Map nav targets to API section labels
    const apiLabel =
      target === 'Деньги'
        ? 'Оплаты и расходы'
        : target === 'Расчёт стоимости'
          ? 'Unit Economics'
          : target === 'Отчёты'
            ? 'Аналитика'
            : target === 'Готовность системы'
              ? 'Готовность'
              : target;
    return sections.includes(apiLabel) || sections.includes(target);
  }
  const set = ROLE_ALLOWED[role];
  if (!set) return true;
  return set.has(target);
}

function findOriginalButton(target) {
  const buttons = [...document.querySelectorAll('nav button.nav-item, .nav-list button.nav-item, .sidebar button')];
  return buttons.find((btn) => {
    const text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    return text.startsWith(target) || text.includes(target);
  });
}

function goToSection(target) {
  const btn = findOriginalButton(target);
  if (btn) {
    btn.click();
    return true;
  }
  // fallback: session key uses internal labels sometimes
  const internal =
    target === 'Деньги'
      ? 'Оплаты и расходы'
      : target === 'Расчёт стоимости'
        ? 'Unit Economics'
        : target === 'Отчёты'
          ? 'Аналитика'
          : target === 'Готовность системы'
            ? 'Готовность'
            : target;
  window.sessionStorage.setItem('getsite-os-section', internal);
  const retry = findOriginalButton(target) || findOriginalButton(internal);
  retry?.click();
  return Boolean(retry);
}

function syncActive(target) {
  document.querySelectorAll('#gs-nav .gs-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.target === target);
  });
}

function watchActiveSection() {
  const update = () => {
    const strong = document.querySelector('.topbar .crumb strong, banner strong, .crumb strong');
    const title = (strong?.textContent || '').trim();
    if (!title) return;
    const match = Object.keys(DISPLAY_TO_INTERNAL).find((k) => title === k || title.startsWith(k));
    if (match) syncActive(match);
  };
  update();
  const obs = new MutationObserver(update);
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function filterCreateActions(role, rolesFromApi) {
  return CREATE_ACTIONS.filter((a) => isAllowed(role, a.target, rolesFromApi));
}

function findActionButton(clickPattern) {
  const patterns = String(clickPattern || '')
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  const buttons = [...document.querySelectorAll('main button, .heading-actions button, .toolbar button, .button, [role="main"] button')];
  for (const pat of patterns) {
    const re = new RegExp(pat, 'i');
    const found = buttons.find((b) => re.test((b.textContent || '').replace(/\s+/g, ' ').trim()));
    if (found) return found;
  }
  return null;
}

function openCreateAction(clickPattern, attempts = 12) {
  const tryClick = (left) => {
    const btn = findActionButton(clickPattern);
    if (btn) {
      btn.click();
      return;
    }
    if (left <= 0) return;
    setTimeout(() => tryClick(left - 1), 120);
  };
  tryClick(attempts);
}

function buildNav(user, rolesFromApi) {
  if (document.getElementById('gs-nav')) return;

  const role = user.systemRole || 'designer';
  const roleMeta = rolesFromApi?.[role];
  const initials = (user.displayName || user.fullName || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const roleLabel =
    roleMeta?.label ||
    (role === 'founder'
      ? 'Основатель'
      : role === 'sales_manager'
        ? 'Менеджер продаж'
        : role === 'designer'
          ? 'Дизайнер'
          : user.position || 'Пользователь');

  const groupsHtml = NAV_TREE.map((group) => {
    const items = group.items.filter((item) => isAllowed(role, item.target, rolesFromApi));
    if (!items.length) return '';
    return `
      <div class="gs-group" data-group="${group.id}">
        ${group.title ? `<div class="gs-group-title">${group.title}</div>` : ''}
        ${items
          .map(
            (item) => `
          <button type="button" class="gs-item" data-target="${item.target}" data-id="${item.id}">
            ${iconSvg(item.icon)}
            <span>${item.label}</span>
          </button>`
          )
          .join('')}
      </div>`;
  }).join('');

  const moreItems = MORE_ITEMS.filter((item) => isAllowed(role, item.target, rolesFromApi));
  const createItems = filterCreateActions(role, rolesFromApi);

  const root = document.createElement('aside');
  root.id = 'gs-nav';
  root.innerHTML = `
    <button type="button" class="gs-brand" data-target="Главная" aria-label="На главную">
      <span class="g">get</span>site<span class="star">*</span><small>OS</small>
    </button>
    <div class="gs-create" style="position:relative">
      <button type="button" class="button primary" id="gs-create-btn">${iconSvg('plus')} Создать</button>
      <div class="gs-create-menu" id="gs-create-menu" role="menu">
        ${createItems
          .map(
            (a) => `
          <button type="button" data-create-target="${a.target}" data-create-click="${a.click}">
            ${a.label}<small>${a.desc}</small>
          </button>`
          )
          .join('')}
      </div>
    </div>
    <div class="gs-scroll">
      ${groupsHtml}
      ${
        moreItems.length
          ? `<div class="gs-group">
              <button type="button" class="gs-item" id="gs-more-toggle">
                ${iconSvg('more')}<span>Ещё</span>
              </button>
              <div class="gs-more-panel" id="gs-more-panel">
                ${moreItems
                  .map(
                    (item) => `
                  <button type="button" class="gs-item" data-target="${item.target}">
                    ${iconSvg(item.icon)}<span>${item.label}</span>
                  </button>`
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }
    </div>
    <div class="gs-footer">
      <div class="gs-user">
        <div class="gs-avatar">${initials}</div>
        <div>
          <strong>${user.displayName || 'Пользователь'}</strong>
          <span>${roleLabel}</span>
        </div>
      </div>
      <div class="gs-footer-actions">
        ${isAllowed(role, 'Настройки', rolesFromApi) ? `<button type="button" data-target="Настройки">Настройки</button>` : `<button type="button" data-target="История">История</button>`}
        <button type="button" id="gs-nav-logout">Выйти</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  document.body.classList.add('gs-nav-ready');

  const go = (target) => {
    document.getElementById('gs-create-menu')?.classList.remove('open');
    document.body.classList.remove('gs-nav-open');
    if (goToSection(target)) syncActive(target);
  };

  root.addEventListener('click', async (e) => {
    const createBtn = e.target.closest('#gs-create-btn');
    if (createBtn) {
      e.preventDefault();
      document.getElementById('gs-create-menu')?.classList.toggle('open');
      return;
    }

    const moreToggle = e.target.closest('#gs-more-toggle');
    if (moreToggle) {
      document.getElementById('gs-more-panel')?.classList.toggle('open');
      return;
    }

    const logout = e.target.closest('#gs-nav-logout');
    if (logout) {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      location.reload();
      return;
    }

    const createItem = e.target.closest('[data-create-target]');
    if (createItem) {
      const target = createItem.dataset.createTarget;
      go(target);
      openCreateAction(createItem.dataset.createClick);
      return;
    }

    const item = e.target.closest('[data-target]');
    if (item?.dataset.target) go(item.dataset.target);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#gs-nav .gs-create')) {
      document.getElementById('gs-create-menu')?.classList.remove('open');
    }
  });

  // Mobile: open via original hamburger if present
  document.addEventListener(
    'click',
    (e) => {
      if (e.target.closest('.mobile-menu')) {
        document.body.classList.add('gs-nav-open');
      }
    },
    true
  );

  document.getElementById('gs-nav-overlay')?.addEventListener('click', () => {
    document.body.classList.remove('gs-nav-open');
  });

  // Wait for React sidebar then sync
  const boot = setInterval(() => {
    if (findOriginalButton('Главная')) {
      clearInterval(boot);
      syncActive('Главная');
      watchActiveSection();
    }
  }, 120);
  setTimeout(() => clearInterval(boot), 8000);
}

export function mountNavShell(user, rolesFromApi) {
  // ensure stylesheet
  if (!document.querySelector('link[href="/assets/nav-shell.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/nav-shell.css';
    document.head.appendChild(link);
  }
  buildNav(user, rolesFromApi);
}
