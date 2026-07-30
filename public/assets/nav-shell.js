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
    items: [{ id: 'home', label: 'Сегодня', target: 'Главная', icon: 'home' }],
  },
  {
    id: 'sales',
    title: '1. Продажи',
    items: [
      { id: 'leads', label: 'Заявки', target: 'Заявки', icon: 'inbox', hint: 'Входящие' },
      { id: 'clients', label: 'Клиенты', target: 'Клиенты', icon: 'users' },
      { id: 'estimates', label: 'Сметы / КП', target: 'Сметы', icon: 'file', hint: 'Цены клиенту' },
      { id: 'scripts', label: 'Скрипты', target: 'Скрипты продаж', icon: 'chat' },
    ],
  },
  {
    id: 'work',
    title: '2. Производство',
    items: [
      { id: 'projects', label: 'Проекты', target: 'Проекты', icon: 'layers' },
      { id: 'team', label: 'Сроки', target: 'Команда и сроки', icon: 'calendar' },
    ],
  },
  {
    id: 'money',
    title: '3. Деньги',
    items: [
      { id: 'payments', label: 'Оплаты', target: 'Деньги', icon: 'wallet' },
      { id: 'calc', label: 'Себестоимость', target: 'Расчёт стоимости', icon: 'calc' },
      { id: 'price', label: 'Прайс (цены)', target: 'Прайс', icon: 'tag' },
    ],
  },
];

const MORE_ITEMS = [
  { id: 'history', label: 'История', target: 'История', icon: 'clock' },
  { id: 'reports', label: 'Отчёты', target: 'Отчёты', icon: 'chart' },
  { id: 'settings', label: 'Настройки', target: 'Настройки', icon: 'gear' },
  { id: 'ready', label: 'Готовность', target: 'Готовность системы', icon: 'check' },
];

const CREATE_ACTIONS = [
  { label: 'Заявка', desc: 'Новый лид в воронку', target: 'Заявки', click: 'Новая заявка|Создать заявку|Добавить заявку' },
  { label: 'Клиент', desc: 'Карточка компании', target: 'Клиенты', click: 'Добавить клиента' },
  { label: 'Смета / КП', desc: 'Состав и цена клиенту', target: 'Сметы', click: 'Новая смета' },
  { label: 'Проект', desc: 'В работу после сделки', target: 'Проекты', click: 'Создать проект' },
  { label: 'Оплата', desc: 'Деньги по проекту', target: 'Деньги', click: 'Зафиксировать оплату|Добавить оплату' },
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
    <div class="gs-top">
      <button type="button" class="gs-brand" data-target="Главная" aria-label="getsite OS — на главную">
        <img class="gs-brand-mark" src="/assets/logo-getsite.png" alt="getsite*" />
      </button>
      <div class="gs-create">
        <button type="button" class="button primary" id="gs-create-btn" aria-label="Создать" title="Создать" aria-expanded="false" aria-haspopup="menu">
          <span class="gs-plus" aria-hidden="true"></span>
        </button>
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
      <button type="button" class="gs-collapse" id="gs-nav-collapse" title="Скрыть меню" aria-label="Скрыть левое меню">‹</button>
      <button type="button" class="gs-drawer-close" id="gs-drawer-close" aria-label="Закрыть меню" title="Закрыть">✕</button>
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

  // Floating reopen control
  let reopen = document.getElementById('gs-nav-reopen');
  if (!reopen) {
    reopen = document.createElement('button');
    reopen.id = 'gs-nav-reopen';
    reopen.className = 'gs-nav-reopen';
    reopen.type = 'button';
    reopen.title = 'Показать меню';
    reopen.setAttribute('aria-label', 'Показать левое меню');
    reopen.innerHTML = '<img src="/assets/logo-getsite.png" alt="" />';
    document.body.appendChild(reopen);
  }

  const setCreateOpen = (open) => {
    const wrap = document.querySelector('#gs-nav .gs-create');
    const menu = document.getElementById('gs-create-menu');
    const btn = document.getElementById('gs-create-btn');
    wrap?.classList.toggle('open', open);
    menu?.classList.toggle('open', open);
    btn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  const syncDrawerA11y = () => {
    const open = document.body.classList.contains('gs-nav-open');
    document.querySelectorAll('.mobile-menu').forEach((b) => {
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    });
  };

  const setNavOpen = (open) => {
    document.body.classList.toggle('gs-nav-open', open);
    syncDrawerA11y();
  };

  const setNavCollapsed = (collapsed) => {
    document.body.classList.toggle('gs-nav-collapsed', collapsed);
    try {
      localStorage.setItem('gs-nav-collapsed', collapsed ? '1' : '0');
    } catch {}
  };

  if (localStorage.getItem('gs-nav-collapsed') === '1') {
    setNavCollapsed(true);
  }

  const mobileMq = window.matchMedia('(max-width: 900px)');
  const syncMobileNavMode = () => {
    if (mobileMq.matches) {
      // На смартфоне только drawer + гамбургер — без desktop-collapse
      document.body.classList.remove('gs-nav-collapsed');
      document.getElementById('gs-nav-collapse')?.setAttribute('hidden', '');
    } else {
      document.getElementById('gs-nav-collapse')?.removeAttribute('hidden');
      if (localStorage.getItem('gs-nav-collapsed') === '1') {
        setNavCollapsed(true);
      }
    }
  };
  syncMobileNavMode();
  if (typeof mobileMq.addEventListener === 'function') {
    mobileMq.addEventListener('change', syncMobileNavMode);
  } else {
    mobileMq.addListener(syncMobileNavMode);
  }

  document.getElementById('gs-nav-collapse')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCreateOpen(false);
    setNavCollapsed(true);
  });

  const collapseBtn = document.getElementById('gs-nav-collapse');
  if (collapseBtn) {
    collapseBtn.title = 'Скрыть меню (Ctrl+B)';
    collapseBtn.setAttribute('aria-keyshortcuts', 'Control+B');
  }
  reopen.title = 'Показать меню (Ctrl+B)';

  reopen.addEventListener('click', () => setNavCollapsed(false));

  const go = (target) => {
    setCreateOpen(false);
    document.getElementById('gs-more-panel')?.classList.remove('open');
    setNavOpen(false);
    document.body.classList.add('gs-page-animating');
    window.setTimeout(() => document.body.classList.remove('gs-page-animating'), 400);
    syncActive(target);
    goToSection(target);
  };

  root.addEventListener('click', async (e) => {
    const createBtn = e.target.closest('#gs-create-btn');
    if (createBtn) {
      e.preventDefault();
      const next = !document.getElementById('gs-create-menu')?.classList.contains('open');
      setCreateOpen(next);
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
      setCreateOpen(false);
    }
  });

  document.addEventListener(
    'keydown',
    (e) => {
      const typing =
        e.target &&
        (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.tagName === 'SELECT' ||
          e.target.isContentEditable);

      if (e.key === 'Escape') {
        if (document.body.classList.contains('gs-nav-open')) {
          e.preventDefault();
          setNavOpen(false);
          setCreateOpen(false);
          document.getElementById('gs-more-panel')?.classList.remove('open');
          return;
        }
        const createOpen = document.getElementById('gs-create-menu')?.classList.contains('open');
        const moreOpen = document.getElementById('gs-more-panel')?.classList.contains('open');
        if (createOpen || moreOpen) {
          e.preventDefault();
          setCreateOpen(false);
          document.getElementById('gs-more-panel')?.classList.remove('open');
          return;
        }
      }

      if (!typing && (e.key === 'b' || e.key === 'B') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (window.matchMedia('(max-width: 900px)').matches) {
          setNavOpen(!document.body.classList.contains('gs-nav-open'));
          return;
        }
        const next = !document.body.classList.contains('gs-nav-collapsed');
        setCreateOpen(false);
        setNavCollapsed(next);
      }
    },
    true
  );

  document.getElementById('gs-drawer-close')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setNavOpen(false);
    setCreateOpen(false);
  });

  // Убиваем оригинальный React-drawer (светлая панель поверх контента)
  const killReactSidebar = () => {
    document.querySelectorAll('.sidebar.is-open').forEach((el) => el.classList.remove('is-open'));
    document.querySelectorAll('.sidebar-scrim').forEach((el) => el.remove());
  };

  // Клон без React onClick — обработчик только на document (capture)
  const claimMobileBurger = () => {
    const burgers = [...document.querySelectorAll('.mobile-menu:not([data-gs-owned="1"])')];
    for (const burger of burgers) {
      const clone = burger.cloneNode(true);
      clone.dataset.gsOwned = '1';
      clone.type = 'button';
      clone.setAttribute('aria-label', 'Открыть меню');
      clone.setAttribute('aria-controls', 'gs-nav');
      clone.setAttribute('aria-expanded', 'false');
      burger.replaceWith(clone);
    }
    syncDrawerA11y();
  };
  claimMobileBurger();
  new MutationObserver((mutations) => {
    let needClaim = false;
    let reactDrawer = false;
    for (const m of mutations) {
      if (m.type === 'childList') needClaim = true;
      if (
        m.type === 'attributes' &&
        m.target?.classList?.contains?.('sidebar') &&
        m.target.classList.contains('is-open')
      ) {
        reactDrawer = true;
      }
    }
    if (needClaim) claimMobileBurger();
    if (reactDrawer) killReactSidebar();
  }).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  // Capture на document: React делегирует клики на #root — перехватываем раньше
  document.addEventListener(
    'click',
    (e) => {
      const burger = e.target.closest?.('.mobile-menu');
      if (burger) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setNavOpen(!document.body.classList.contains('gs-nav-open'));
        setCreateOpen(false);
        killReactSidebar();
        requestAnimationFrame(killReactSidebar);
        return;
      }
      if (e.target.closest?.('.sidebar-scrim')) {
        setNavOpen(false);
        killReactSidebar();
      }
    },
    true
  );

  document.getElementById('gs-nav-overlay')?.addEventListener('click', () => {
    setNavOpen(false);
    setCreateOpen(false);
  });

  // Ensure overlay exists for mobile dismiss
  if (!document.getElementById('gs-nav-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'gs-nav-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.addEventListener('click', () => {
      setNavOpen(false);
      setCreateOpen(false);
    });
    document.body.appendChild(overlay);
  }

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
  // Стили уже в index.html — не дублируем link
  if (!document.querySelector('link[href*="nav-shell.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/nav-shell.css?v=20260728p';
    document.head.appendChild(link);
  }
  buildNav(user, rolesFromApi);
}
