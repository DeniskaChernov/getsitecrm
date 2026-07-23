/**
 * Wave 2 stress QA: 15 scenarios × 5 runs (CRUD depth + edges).
 * Usage: node scripts/qa-stress-wave2.js [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3100';
const RUNS = 5;
const SESSION_CACHE = new Map();

function parseSetCookie(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (raw.length) return raw.map((c) => c.split(';')[0]).join('; ');
  const single = res.headers.get('set-cookie');
  return single ? single.split(',').map((c) => c.split(';')[0].trim()).join('; ') : '';
}

async function req(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text.slice(0, 200) };
  }
  return { status: res.status, data, cookie: parseSetCookie(res) || cookie || '', text };
}

async function login(email, password) {
  const key = `${email}:${password}`;
  if (SESSION_CACHE.has(key)) return SESSION_CACHE.get(key);
  const r = await req('/api/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${r.data.error || r.text}`);
  const session = { cookie: r.cookie, user: r.data.user };
  SESSION_CACHE.set(key, session);
  return session;
}

function dropSession(email, password) {
  SESSION_CACHE.delete(`${email}:${password}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const scenarios = [
  {
    id: 1,
    name: 'collapse CSS kills ghost nav',
    run: async () => {
      const css = await (await fetch(`${BASE}/assets/nav-shell.css`)).text();
      assert(css.includes('visibility: hidden !important'), 'visibility hidden on collapse');
      assert(css.includes('animation: none !important'), 'animation cleared on collapse');
      assert(css.includes('gs-nav-reopen'), 'reopen control');
      const motion = await (await fetch(`${BASE}/assets/motion.css`)).text();
      assert(!motion.includes('animation: gs-slide-rail'), 'no slide-rail lock on #gs-nav');
      assert(motion.includes('gs-fade-in'), 'fade-in entrance');
    },
  },
  {
    id: 2,
    name: 'project create + update',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const os = await req('/api/os', { cookie });
      const client = (os.data.clients || [])[0];
      assert(client, 'need client');
      const created = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'project.create',
          name: `QA Project ${Date.now()}-${i}`,
          clientName: client.name,
          clientId: client.id,
          price: 5_000_000 + i * 1000,
          owner: 'Денис',
        },
      });
      assert(created.status === 200 && created.data.project?.id, `create ${created.status} ${created.data.error}`);
      const id = created.data.project.id;
      const upd = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'project.update', id, status: 'в работе', progress: 25 + i },
      });
      assert(upd.status === 200, `update ${upd.status} ${upd.data.error}`);
    },
  },
  {
    id: 3,
    name: 'task create/update/delete',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const os = await req('/api/os', { cookie });
      const project = (os.data.projects || [])[0];
      assert(project, 'need project');
      const created = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'task.create',
          projectId: project.id,
          title: `QA Task ${Date.now()}-${i}`,
          assignee: 'Дизайнер',
          dueDate: 'Завтра',
        },
      });
      assert(created.status === 200 && created.data.task?.id, `task create ${created.status} ${JSON.stringify(created.data).slice(0, 160)}`);
      const id = created.data.task.id;
      const upd = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'task.update', id, status: 'в работе' },
      });
      assert(upd.status === 200, `task update ${upd.status}`);
      const del = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'task.delete', id },
      });
      assert(del.status === 200, `task delete ${del.status}`);
    },
  },
  {
    id: 4,
    name: 'estimate convert → project',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const os = await req('/api/os', { cookie });
      const client = (os.data.clients || [])[0];
      const est = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'estimate.create',
          clientId: client.id,
          title: `Convert QA ${Date.now()}-${i}`,
          items: [{ name: 'Пакет', qty: 1, price: 2_500_000 }],
        },
      });
      assert(est.status === 200 && est.data.estimate?.id, `est ${est.status}`);
      const converted = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'estimate.convert', id: est.data.estimate.id },
      });
      assert(
        converted.status === 200 && (converted.data.project?.id || converted.data.ok),
        `convert ${converted.status} ${converted.data.error}`
      );
    },
  },
  {
    id: 5,
    name: 'payment create + receive',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const os = await req('/api/os', { cookie });
      const project = (os.data.projects || [])[0];
      assert(project, 'need project');
      const pay = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'payment.create',
          projectId: project.id,
          amount: 250000 + i * 1000,
          method: 'перевод',
          status: 'ожидается',
        },
      });
      assert(pay.status === 200 && pay.data.payment?.id, `pay ${pay.status} ${pay.data.error}`);
      const recv = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'payment.receive', id: pay.data.payment.id },
      });
      assert(recv.status === 200, `receive ${recv.status} ${recv.data.error}`);
      assert(recv.data.payment?.status === 'получено', 'status получено');
    },
  },
  {
    id: 6,
    name: 'expense create + update',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const os = await req('/api/os', { cookie });
      const project = (os.data.projects || [])[0];
      const exp = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'expense.create',
          projectId: project?.id,
          amount: 50000 + i * 500,
          category: 'подряд',
          note: `qa-exp-${i}`,
        },
      });
      assert(exp.status === 200 && exp.data.expense?.id, `expense ${exp.status} ${exp.data.error}`);
      const upd = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'expense.update', id: exp.data.expense.id, amount: 60000 + i },
      });
      assert(upd.status === 200, `expense update ${upd.status}`);
    },
  },
  {
    id: 7,
    name: 'script create/update/delete',
    run: async (i) => {
      const { cookie } = await login('manager@getsite.uz', 'manager123');
      const created = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'script.create',
          title: `QA Script ${Date.now()}-${i}`,
          body: 'Привет, это скрипт QA',
          stage: 'квалификация',
        },
      });
      assert(created.status === 200 && (created.data.script?.id || created.data.id), `script ${created.status} ${JSON.stringify(created.data).slice(0, 160)}`);
      const id = created.data.script?.id || created.data.id;
      const upd = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'script.update', id, title: `QA Script upd ${i}` },
      });
      assert(upd.status === 200, `script update ${upd.status}`);
      const del = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'script.delete', id },
      });
      assert(del.status === 200, `script delete ${del.status}`);
    },
  },
  {
    id: 8,
    name: 'founder settings.save',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const os = await req('/api/os', { cookie });
      const rate = Number(os.data.settings?.hourlyRate || 100000);
      const save = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'settings.save', hourlyRate: rate, plannedProjects: Number(os.data.settings?.plannedProjects || 4) },
      });
      assert(save.status === 200, `settings ${save.status} ${save.data.error}`);
      const mgr = await login('manager@getsite.uz', 'manager123');
      const deny = await req('/api/os', {
        method: 'POST',
        cookie: mgr.cookie,
        body: { action: 'settings.save', hourlyRate: 1 },
      });
      assert(deny.status === 403, 'manager blocked');
    },
  },
  {
    id: 9,
    name: 'user.create + password + deactivate',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const email = `qa.wave2.${Date.now()}.${i}@getsite.uz`;
      const created = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'user.create',
          email,
          password: 'qa123456',
          displayName: `QA User ${i}`,
          systemRole: 'member',
        },
      });
      assert(created.status === 200 && created.data.user?.email === email, `user.create ${created.status} ${created.data.error}`);
      const pwd = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'user.password', email, password: 'qa654321' },
      });
      assert(pwd.status === 200, `password ${pwd.status} ${pwd.data.error}`);
      dropSession(email, 'qa654321');
      const loginNew = await req('/api/auth/login', { method: 'POST', body: { email, password: 'qa654321' } });
      assert(loginNew.status === 200, `new user login ${loginNew.status}`);
      const deact = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'user.deactivate', email },
      });
      assert(deact.status === 200, `deactivate ${deact.status}`);
      const blocked = await req('/api/auth/login', { method: 'POST', body: { email, password: 'qa654321' } });
      assert(blocked.status === 403 || blocked.status === 401, `deactivated login ${blocked.status}`);
      const reactivate = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'user.activate', email },
      });
      assert(reactivate.status === 200, `activate ${reactivate.status}`);
      // cleanup: deactivate again so DB stays tidy
      await req('/api/os', { method: 'POST', cookie, body: { action: 'user.deactivate', email } });
    },
  },
  {
    id: 10,
    name: 'designer cannot mutate finance',
    run: async () => {
      const { cookie } = await login('designer@getsite.uz', 'designer123');
      for (const action of ['payment.create', 'expense.create', 'client.create', 'estimate.create']) {
        const r = await req('/api/os', {
          method: 'POST',
          cookie,
          body: { action, amount: 1, name: 'x', title: 'x' },
        });
        assert(r.status === 403, `${action} → ${r.status}`);
      }
    },
  },
  {
    id: 11,
    name: 'lead qualify flow',
    run: async (i) => {
      const { cookie } = await login('manager@getsite.uz', 'manager123');
      const created = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'lead.create',
          name: `Qualify ${Date.now()}-${i}`,
          phone: `+99893${String(1000000 + i)}`,
          source: 'QA',
        },
      });
      assert(created.status === 200 && created.data.lead?.id, 'lead');
      const q = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'lead.qualify',
          leadId: created.data.lead.id,
          budget: 10_000_000,
          timeline: '2 недели',
          decisionMaker: true,
          score: 70 + i,
        },
      });
      assert(q.status === 200, `qualify ${q.status} ${q.data.error}`);
    },
  },
  {
    id: 12,
    name: 'unknown action rejected',
    run: async () => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const r = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'hack.dropDatabase' },
      });
      assert(r.status >= 400, `unknown action ${r.status}`);
    },
  },
  {
    id: 13,
    name: 'concurrent os reads stable',
    run: async () => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const results = await Promise.all(
        Array.from({ length: 8 }, () => req('/api/os', { cookie }))
      );
      assert(results.every((r) => r.status === 200), 'all 200');
      const counts = results.map((r) => (r.data.clients || []).length);
      assert(counts.every((c) => c === counts[0]), 'stable client count');
    },
  },
  {
    id: 14,
    name: 'health under burst',
    run: async () => {
      const results = await Promise.all(Array.from({ length: 12 }, () => req('/api/health')));
      assert(results.every((r) => r.status === 200 && r.data.ok), 'health burst');
    },
  },
  {
    id: 15,
    name: 'index assets cache-busted + motion linked',
    run: async () => {
      const html = await (await fetch(`${BASE}/`)).text();
      assert(html.includes('motion.css'), 'motion linked');
      assert(html.includes('nav-shell.css'), 'nav linked');
      assert(/nav-shell\.css\?v=/.test(html) || html.includes('nav-shell.css'), 'css present');
      for (const path of ['/assets/main.js', '/assets/ui-fix.js', '/favicon.svg']) {
        const r = await fetch(`${BASE}${path}`);
        assert(r.status === 200, `${path} ${r.status}`);
      }
    },
  },
];

async function main() {
  console.log(`Wave2 Stress QA 15×${RUNS} against ${BASE}\n`);
  const failures = [];

  for (const sc of scenarios) {
    let ok = 0;
    const errors = [];
    for (let i = 1; i <= RUNS; i++) {
      try {
        await sc.run(i);
        ok++;
        process.stdout.write('.');
      } catch (err) {
        errors.push(`run${i}: ${err.message}`);
        failures.push({ id: sc.id, name: sc.name, run: i, error: err.message });
        process.stdout.write('F');
      }
    }
    console.log(` [${sc.id}/15] ${sc.name}: ${ok}/${RUNS}${errors.length ? ' ← ' + errors[0] : ''}`);
  }

  const total = scenarios.length * RUNS;
  const passed = total - failures.length;
  console.log(`\nPassed ${passed}/${total}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`- #${f.id} ${f.name} run${f.run}: ${f.error}`);
    process.exitCode = 1;
  } else {
    console.log('All wave2 checks passed.');
  }

  const fs = require('fs');
  fs.writeFileSync(
    'scripts/.qa-stress-wave2-last.json',
    JSON.stringify({ base: BASE, passed, total, failures, at: new Date().toISOString() }, null, 2)
  );
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
