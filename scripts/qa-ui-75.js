/**
 * UI-прогоны через реальный браузер: 75 проверок.
 *
 * Ловит класс ошибок, невидимый для API-тестов: рантайм-исключения в рендере,
 * размонтирование React-дерева, NaN/undefined в тексте, горизонтальный оверфлоу.
 *
 * Блоки:
 *   A — 28: 14 разделов founder × 2 вьюпорта
 *   B — 18: 9 разделов sales_manager × 2 вьюпорта
 *   C —  8: 4 раздела designer × 2 вьюпорта
 *   D — 21: краевые данные и взаимодействия
 *
 * Запуск: npm run qa:ui   (сервер должен быть поднят, по умолчанию :3100)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
const HEADLESS = process.env.QA_HEADED !== '1';
const REPORT = path.join(__dirname, '..', 'qa-ui-75-report.json');

const DESKTOP = { width: 1440, height: 900, name: 'desktop' };
const MOBILE = { width: 390, height: 844, name: 'mobile' };

const USERS = {
  founder: { email: 'denis@getsite.uz', password: 'denis123' },
  sales_manager: { email: 'manager@getsite.uz', password: 'manager123' },
  designer: { email: 'designer@getsite.uz', password: 'designer123' },
};

/** Разделы навигации: подпись в шапке = data-target нашего меню */
const SECTIONS = {
  founder: [
    'Главная',
    'Заявки',
    'Клиенты',
    'Сметы',
    'Скрипты продаж',
    'Проекты',
    'Команда и сроки',
    'Деньги',
    'Себестоимость',
    'Прайс',
    'История',
    'Отчёты',
    'Настройки',
    'Готовность системы',
  ],
  sales_manager: [
    'Главная',
    'Заявки',
    'Клиенты',
    'Сметы',
    'Скрипты продаж',
    'Проекты',
    'Деньги',
    'Прайс',
    'История',
  ],
  designer: ['Главная', 'Проекты', 'Команда и сроки', 'История'],
};

const results = [];
let runNo = 0;

function record(block, name, problems, extra = {}) {
  runNo += 1;
  const ok = problems.length === 0;
  results.push({ run: runNo, block, name, ok, problems, ...extra });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${String(runNo).padStart(2, '0')}/75] ${mark} ${block} · ${name}`);
  for (const p of problems) console.log(`         → ${p}`);
}

/** Ошибки страницы собираются в page.__qaErrors через хуки Playwright */
function attachCollectors(page) {
  page.__qaErrors = [];
  page.on('pageerror', (err) => page.__qaErrors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Шум браузера про autocomplete не относится к логике приложения
    if (/autocomplete attributes/i.test(text)) return;
    page.__qaErrors.push(`console.error: ${text.slice(0, 220)}`);
  });
}

async function login(page, role) {
  const creds = USERS[role];
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  const res = await page.evaluate(async (c) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, creds);
  if (res.status !== 200) throw new Error(`login ${role} failed: ${res.status} ${JSON.stringify(res.body)}`);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('gs-nav-ready'), { timeout: 15000 });
  page.__qaErrors.length = 0;
}

/** Проверки состояния страницы, общие для всех прогонов */
async function inspect(page, { expectTitle } = {}) {
  const problems = [...page.__qaErrors];

  const state = await page.evaluate(() => {
    const root = document.getElementById('root');
    const main = document.querySelector('main');
    const visibleText = main ? main.innerText : '';
    const doc = document.documentElement;
    return {
      rootChildren: root ? root.children.length : 0,
      crumb: document.querySelector('.crumb strong')?.textContent?.trim() || '',
      heading: document.querySelector('main h1')?.textContent?.trim() || '',
      mainLength: visibleText.length,
      badTokens: (visibleText.match(/\b(NaN|undefined|null|Infinity)\b/g) || []).slice(0, 5),
      overflow: doc.scrollWidth - doc.clientWidth,
      navItems: document.querySelectorAll('#gs-nav .gs-item').length,
    };
  });

  if (state.rootChildren === 0) problems.push('React-дерево размонтировано (#root пуст)');
  if (state.mainLength < 20) problems.push(`пустой контент (main text = ${state.mainLength} симв.)`);
  if (state.badTokens.length) problems.push(`мусор в тексте: ${state.badTokens.join(', ')}`);
  if (state.overflow > 2) problems.push(`горизонтальный оверфлоу ${state.overflow}px`);
  if (state.navItems === 0) problems.push('меню не отрисовано');
  if (expectTitle && state.crumb && state.crumb !== expectTitle) {
    problems.push(`шапка «${state.crumb}» вместо «${expectTitle}»`);
  }

  page.__qaErrors.length = 0;
  return { problems, state };
}

async function openSection(page, target) {
  const clicked = await page.evaluate((t) => {
    const item = [...document.querySelectorAll('#gs-nav .gs-item')].find((el) => el.dataset.target === t);
    if (!item) return false;
    item.click();
    return true;
  }, target);
  if (!clicked) return false;
  await page.waitForTimeout(650);
  return true;
}

/** Блоки A/B/C — обход разделов по роли на двух вьюпортах */
async function runNavigationBlock(browser, block, role, viewports) {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    attachCollectors(page);
    try {
      await login(page, role);
      for (const section of SECTIONS[role]) {
        const name = `${role} · ${section} · ${vp.name}`;
        const opened = await openSection(page, section);
        if (!opened) {
          record(block, name, [`раздел недоступен в меню роли ${role}`]);
          continue;
        }
        const { problems, state } = await inspect(page, { expectTitle: section });
        if (role === 'founder' && section === 'Настройки' && vp.name === 'desktop') {
          const teamButton = page.locator('#gs-nav-team');
          if (!(await teamButton.isVisible())) {
            problems.push('кнопка управления командой недоступна в навигации');
          } else {
            await teamButton.click();
            const teamModal = page.locator('#gs-user-admin-modal');
            if (!(await teamModal.isVisible())) problems.push('модалка управления командой не открылась');
            await page.locator('#gs-user-admin-close').click();
          }
        }
        if (vp.name === 'mobile' && ['Деньги', 'Прайс'].includes(section)) {
          const tableCards = await page.evaluate(() => {
            const table = document.querySelector('.table-panel table');
            if (!table) return null;
            const cells = [...table.querySelectorAll('tbody td')];
            return {
              cells: cells.length,
              labeled: cells.filter((cell) => cell.hasAttribute('data-label')).length,
              minWidth: getComputedStyle(table).minWidth,
            };
          });
          if (!tableCards) problems.push('mobile table не найдена');
          if (tableCards?.cells && tableCards.labeled !== tableCards.cells) {
            problems.push(`mobile table labels: ${tableCards.labeled}/${tableCards.cells}`);
          }
          if (tableCards && tableCards.minWidth !== '0px') {
            problems.push(`mobile table min-width=${tableCards.minWidth}`);
          }
        }
        record(block, name, problems, { heading: state.heading });
      }
    } catch (err) {
      record(block, `${role} · ${vp.name} · сбой блока`, [`исключение: ${err.message}`]);
    } finally {
      await context.close();
    }
  }
}

/** Блок D — краевые данные и взаимодействия */
async function runEdgeBlock(browser) {
  const block = 'D-краевые';

  // D1–D6: калькулятор себестоимости на краевых числах (регрессия белого экрана)
  const calcCases = [
    { name: 'калькулятор: цена 0', price: '0', hours: '0', founderHours: '0' },
    { name: 'калькулятор: цена 0, часы есть', price: '0', hours: '40', founderHours: '20' },
    { name: 'калькулятор: цена ниже себестоимости', price: '100000', hours: '40', founderHours: '30' },
    { name: 'калькулятор: часы 0 при цене', price: '10000000', hours: '0', founderHours: '0' },
    { name: 'калькулятор: очень большая цена', price: '999999999999', hours: '1', founderHours: '1' },
    { name: 'калькулятор: дробные часы', price: '5000000', hours: '7.5', founderHours: '2.5' },
  ];

  for (const c of calcCases) {
    const context = await browser.newContext({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });
    const page = await context.newPage();
    attachCollectors(page);
    try {
      await login(page, 'founder');
      await openSection(page, 'Себестоимость');
      await page.getByRole('spinbutton', { name: 'Цена продажи сум' }).fill(c.price);
      await page.getByRole('spinbutton', { name: 'Всего часов' }).fill(c.hours);
      await page.getByRole('spinbutton', { name: 'Часы основателя' }).fill(c.founderHours);
      await page.waitForTimeout(400);
      const { problems, state } = await inspect(page, { expectTitle: 'Себестоимость' });
      const margin = await page.evaluate(() => document.querySelector('.donut span strong')?.textContent?.trim() || '');
      if (!margin) problems.push('маржа не отрисована');
      record(block, c.name, problems, { margin, heading: state.heading });
    } catch (err) {
      record(block, c.name, [`исключение: ${err.message}`]);
    } finally {
      await context.close();
    }
  }

  // D7–D12: краевые входные данные в разделах со списками и фильтрами
  const filterCases = [
    { name: 'Заявки: поиск по мусорной строке', section: 'Заявки', query: 'zzz-нет-такого-\u00a0<>&' },
    { name: 'Заявки: поиск очень длинной строкой', section: 'Заявки', query: 'я'.repeat(300) },
    { name: 'Клиенты: поиск по спецсимволам', section: 'Клиенты', query: '"\'\\<script>' },
    { name: 'Сметы: поиск пустой после ввода', section: 'Сметы', query: '   ' },
    { name: 'Прайс: поиск по числу', section: 'Прайс', query: '0' },
    { name: 'Проекты: поиск по эмодзи', section: 'Проекты', query: '🔥🔥🔥' },
  ];

  for (const c of filterCases) {
    const context = await browser.newContext({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });
    const page = await context.newPage();
    attachCollectors(page);
    try {
      await login(page, 'founder');
      await openSection(page, c.section);
      const box = page.locator('main input[type="search"], main input[type="text"]').first();
      if (await box.count()) {
        await box.fill(c.query);
        await page.waitForTimeout(450);
      }
      const { problems, state } = await inspect(page, { expectTitle: c.section });
      record(block, c.name, problems, { heading: state.heading });
    } catch (err) {
      record(block, c.name, [`исключение: ${err.message}`]);
    } finally {
      await context.close();
    }
  }

  // D13–D16: перезагрузка внутри раздела — состояние должно восстанавливаться
  for (const section of ['Себестоимость', 'Отчёты', 'Готовность системы', 'Настройки']) {
    const context = await browser.newContext({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });
    const page = await context.newPage();
    attachCollectors(page);
    try {
      await login(page, 'founder');
      await openSection(page, section);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.classList.contains('gs-nav-ready'), { timeout: 15000 });
      await page.waitForTimeout(600);
      const { problems, state } = await inspect(page);
      record(block, `reload в разделе: ${section}`, problems, { crumb: state.crumb });
    } catch (err) {
      record(block, `reload в разделе: ${section}`, [`исключение: ${err.message}`]);
    } finally {
      await context.close();
    }
  }

  // D17: быстрые повторные переходы — утечки и гонки рендера
  {
    const context = await browser.newContext({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });
    const page = await context.newPage();
    attachCollectors(page);
    try {
      await login(page, 'founder');
      for (let i = 0; i < 3; i += 1) {
        for (const s of ['Заявки', 'Себестоимость', 'Отчёты', 'Проекты']) {
          await openSection(page, s);
        }
      }
      const { problems } = await inspect(page);
      record(block, 'быстрые повторные переходы ×12', problems);
    } catch (err) {
      record(block, 'быстрые повторные переходы ×12', [`исключение: ${err.message}`]);
    } finally {
      await context.close();
    }
  }

  // D18: мобильный drawer — открыть, перейти, закрыть
  {
    const context = await browser.newContext({ viewport: { width: MOBILE.width, height: MOBILE.height } });
    const page = await context.newPage();
    attachCollectors(page);
    try {
      await login(page, 'founder');
      await page.locator('.mobile-menu').first().click();
      await page.waitForTimeout(350);
      const opened = await page.evaluate(() => document.body.classList.contains('gs-nav-open'));
      await openSection(page, 'Себестоимость');
      const closed = await page.evaluate(() => !document.body.classList.contains('gs-nav-open'));
      const { problems } = await inspect(page, { expectTitle: 'Себестоимость' });
      if (!opened) problems.push('drawer не открылся по гамбургеру');
      if (!closed) problems.push('drawer не закрылся после перехода');
      record(block, 'мобильный drawer: открыть → перейти → закрыть', problems);
    } catch (err) {
      record(block, 'мобильный drawer: открыть → перейти → закрыть', [`исключение: ${err.message}`]);
    } finally {
      await context.close();
    }
  }

  // D19: мобильное меню «Создать» не должно ломать раскладку
  {
    const context = await browser.newContext({ viewport: { width: MOBILE.width, height: MOBILE.height } });
    const page = await context.newPage();
    attachCollectors(page);
    try {
      await login(page, 'founder');
      await page.locator('.mobile-menu').first().click();
      await page.waitForTimeout(300);
      await page.locator('#gs-create-btn').click();
      await page.waitForTimeout(300);
      const menu = await page.evaluate(() => {
        const el = document.getElementById('gs-create-menu');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { open: el.classList.contains('open'), width: r.width, right: r.right, inViewport: r.right <= window.innerWidth + 1 };
      });
      const { problems } = await inspect(page);
      if (!menu?.open) problems.push('меню «Создать» не открылось');
      if (menu && !menu.inViewport) problems.push(`меню «Создать» выходит за экран (right=${Math.round(menu.right)})`);
      record(block, 'мобильное меню «Создать»', problems, { menuWidth: menu?.width });
    } catch (err) {
      record(block, 'мобильное меню «Создать»', [`исключение: ${err.message}`]);
    } finally {
      await context.close();
    }
  }

  // D20: mobile bottom-sheet и Escape
  {
    const context = await browser.newContext({ viewport: { width: MOBILE.width, height: MOBILE.height } });
    const page = await context.newPage();
    attachCollectors(page);
    try {
      await login(page, 'founder');
      await openSection(page, 'Заявки');
      const createBtn = page.getByRole('button', { name: /Новая заявка/i }).first();
      await createBtn.click();
      await page.waitForTimeout(450);
      const sheet = await page.evaluate(() => {
        const backdrop = document.querySelector('.modal-backdrop');
        const modal = backdrop?.querySelector('.form-modal');
        if (!backdrop || !modal) return null;
        const rect = modal.getBoundingClientRect();
        const style = getComputedStyle(modal);
        return {
          height: rect.height,
          viewport: window.innerHeight,
          radius: parseFloat(style.borderTopLeftRadius),
          align: getComputedStyle(backdrop).alignItems,
        };
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(450);
      const closed = await page.evaluate(() => !document.querySelector('.modal-backdrop'));
      const { problems } = await inspect(page);
      if (!sheet) problems.push('модалка не открылась');
      if (sheet && sheet.height >= sheet.viewport - 2) problems.push('модалка осталась fullscreen');
      if (sheet && sheet.radius < 10) problems.push('у bottom-sheet нет скругления');
      if (sheet && sheet.align !== 'flex-end') problems.push(`backdrop align-items=${sheet.align}`);
      if (!closed) problems.push('Escape не закрыл модалку');
      record(block, 'mobile bottom-sheet + Escape', problems, { sheet });
    } catch (err) {
      record(block, 'mobile bottom-sheet + Escape', [`исключение: ${err.message}`]);
    } finally {
      await context.close();
    }
  }

  // D21: раздел, закрытый для роли, не должен появляться в меню
  {
    const context = await browser.newContext({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });
    const page = await context.newPage();
    attachCollectors(page);
    try {
      await login(page, 'sales_manager');
      const visible = await page.evaluate(() =>
        [...document.querySelectorAll('#gs-nav .gs-item')].map((el) => el.dataset.target).filter(Boolean)
      );
      const navArchitecture = await page.evaluate(() => ({
        directApi: typeof window.__gsNavigate === 'function',
        reactSidebars: document.querySelectorAll('.sidebar').length,
        teamFabs: document.querySelectorAll('.gs-user-admin-fab').length,
        mobileTabs: [...document.querySelectorAll('.mobile-tabs button')].map((el) =>
          (el.textContent || '').trim()
        ),
      }));
      const leaked = visible.filter((t) => !SECTIONS.sales_manager.includes(t));
      const { problems } = await inspect(page);
      if (leaked.length) problems.push(`менеджеру видны лишние разделы: ${leaked.join(', ')}`);
      if (!navArchitecture.directApi) problems.push('нет прямого API навигации');
      if (navArchitecture.reactSidebars) problems.push('React-sidebar всё ещё присутствует');
      if (navArchitecture.teamFabs) problems.push('дублирующий FAB «Команда» всё ещё присутствует');
      record(block, 'роль sales_manager: нет лишних разделов', problems, {
        visible,
        navArchitecture,
      });
    } catch (err) {
      record(block, 'роль sales_manager: нет лишних разделов', [`исключение: ${err.message}`]);
    } finally {
      await context.close();
    }
  }
}

async function main() {
  const started = Date.now();
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    await runNavigationBlock(browser, 'A-founder', 'founder', [DESKTOP, MOBILE]);
    await runNavigationBlock(browser, 'B-sales', 'sales_manager', [DESKTOP, MOBILE]);
    await runNavigationBlock(browser, 'C-designer', 'designer', [DESKTOP, MOBILE]);
    await runEdgeBlock(browser);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const report = {
    baseUrl: BASE,
    finishedAt: new Date().toISOString(),
    durationSec: Math.round((Date.now() - started) / 1000),
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

  console.log('');
  console.log(`Прогонов: ${report.total} · успешно ${report.passed} · с ошибками ${report.failed} · ${report.durationSec}s`);
  console.log(`Отчёт: ${REPORT}`);
  if (failed.length) {
    console.log('');
    console.log('Найденные проблемы:');
    for (const f of failed) console.log(`  #${f.run} ${f.block} · ${f.name}: ${f.problems.join(' | ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('QA UI прогоны упали:', err);
  process.exitCode = 1;
});
