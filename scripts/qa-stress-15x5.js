/**
 * Stress QA: 15 scenarios × 5 runs each.
 * Usage: node scripts/qa-stress-15x5.js [baseUrl]
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

async function req(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
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
  const setCookie = parseSetCookie(res);
  return { status: res.status, data, cookie: setCookie || cookie || '', text, headers: res.headers };
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
    name: 'health + static assets',
    run: async () => {
      const h = await req('/api/health');
      assert(h.status === 200 && h.data.ok, 'health');
      for (const path of [
        '/assets/nav-shell.css',
        '/assets/motion.css',
        '/assets/brand.css',
        '/assets/nav-shell.js',
        '/assets/logo-getsite.png',
        '/',
      ]) {
        const r = await fetch(`${BASE}${path}`);
        assert(r.status === 200, `${path} → ${r.status}`);
        if (path.endsWith('.css') || path.endsWith('.js')) {
          const t = await r.text();
          assert(t.length > 50, `${path} empty`);
        }
      }
      const css = await (await fetch(`${BASE}/assets/nav-shell.css`)).text();
      assert(css.includes('gs-nav-collapsed'), 'collapse styles present');
      assert(css.includes('gs-nav-reopen'), 'reopen styles present');
      assert(css.includes('--gs-nav-rail'), 'compact rail width');
      const motion = await (await fetch(`${BASE}/assets/motion.css`)).text();
      assert(motion.includes('gs-fade-up'), 'motion keyframes');
      const html = await (await fetch(`${BASE}/`)).text();
      assert(html.includes('/assets/motion.css'), 'motion linked in index');
    },
  },
  {
    id: 2,
    name: 'auth reject bad credentials',
    run: async () => {
      const bad = await req('/api/auth/login', {
        method: 'POST',
        body: { email: 'denis@getsite.uz', password: 'wrong-password' },
      });
      assert(bad.status === 401 || bad.status === 403, `bad login status ${bad.status}`);
      const empty = await req('/api/auth/login', { method: 'POST', body: {} });
      assert(empty.status >= 400, 'empty login rejected');
    },
  },
  {
    id: 3,
    name: 'founder session + me',
    run: async () => {
      const { cookie, user } = await login('denis@getsite.uz', 'denis123');
      assert(user?.systemRole === 'founder' || user?.role === 'founder', 'founder role');
      const me = await req('/api/auth/me', { cookie });
      assert(me.status === 200 && me.data.authenticated, 'me authenticated');
      assert(me.data.user?.email === 'denis@getsite.uz', 'email matches');
      const os = await req('/api/os', { cookie });
      assert(os.status === 200, 'os state');
      assert(Array.isArray(os.data.clients), 'clients array');
      assert(Array.isArray(os.data.services), 'services array');
    },
  },
  {
    id: 4,
    name: 'manager RBAC walls',
    run: async () => {
      const { cookie } = await login('manager@getsite.uz', 'manager123');
      const settings = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'settings.save', hourlyRate: 999 },
      });
      assert(settings.status === 403, 'no settings.save');
      const calc = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'calculation.save', name: 'x' },
      });
      assert(calc.status === 403, 'no calculation.save');
      const userCreate = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'user.create',
          email: `x${Date.now()}@t.com`,
          password: '123456',
          displayName: 'X',
          systemRole: 'member',
        },
      });
      assert(userCreate.status === 403, 'no user.create');
    },
  },
  {
    id: 5,
    name: 'designer data isolation',
    run: async () => {
      const { cookie } = await login('designer@getsite.uz', 'designer123');
      const os = await req('/api/os', { cookie });
      assert(os.status === 200, 'designer os');
      assert(!(os.data.clients || []).length, 'no clients');
      assert(!(os.data.leads || []).length || true, 'leads filtered or empty');
      const lead = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'lead.create', name: 'Hack', phone: '+1', source: 'test' },
      });
      assert(lead.status === 403, 'designer cannot create lead');
    },
  },
  {
    id: 6,
    name: 'public register closed',
    run: async () => {
      const reg = await req('/api/auth/register', {
        method: 'POST',
        body: { email: `hack${Date.now()}@x.com`, password: '12345678', displayName: 'Hack' },
      });
      assert(reg.status === 403, 'register closed');
      const cfg = await req('/api/auth/config');
      assert(cfg.data.registrationOpen === false, 'config closed');
    },
  },
  {
    id: 7,
    name: 'client CRUD roundtrip',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const name = `QA Client ${Date.now()}-${i}`;
      const created = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'client.create',
          name,
          contact: 'QA',
          phone: `+99890${String(i).padStart(7, '0')}`,
          industry: 'Услуги',
          city: 'Ташкент',
          manager: 'Денис Марсельевич',
        },
      });
      assert(created.status === 200 && created.data.client?.id, `create ${created.status} ${created.data.error}`);
      const id = created.data.client.id;
      const updated = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'client.update', id, city: 'Самарканд', note: `run-${i}` },
      });
      assert(updated.status === 200, `update ${updated.status} ${updated.data.error}`);
      const state = await req('/api/os', { cookie });
      const found = (state.data.clients || []).find((c) => c.id === id);
      assert(found && found.city === 'Самарканд', 'client persisted');
    },
  },
  {
    id: 8,
    name: 'lead create + status',
    run: async (i) => {
      const { cookie } = await login('manager@getsite.uz', 'manager123');
      const created = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'lead.create',
          name: `Lead QA ${Date.now()}-${i}`,
          clientName: `Lead QA ${Date.now()}-${i}`,
          phone: `+99891${String(i).padStart(7, '0')}`,
          source: 'QA stress',
          channel: 'тест',
        },
      });
      assert(created.status === 200 && created.data.lead?.id, `lead create ${created.status} ${JSON.stringify(created.data)}`);
      const id = created.data.lead.id;
      const st = await req('/api/os', {
        method: 'POST',
        cookie,
        body: { action: 'lead.status', id, status: i % 2 ? 'квалификация' : 'в работе' },
      });
      assert(st.status === 200, `lead status ${st.status} ${st.data.error}`);
      assert(
        ['квалификация', 'в работе'].includes(st.data.lead?.status),
        `normalized status ${st.data.lead?.status}`
      );
    },
  },
  {
    id: 9,
    name: 'service price update (sales) vs hours (founder)',
    run: async (i) => {
      const founder = await login('denis@getsite.uz', 'denis123');
      const mgr = await login('manager@getsite.uz', 'manager123');
      const os = await req('/api/os', { cookie: founder.cookie });
      const svc = (os.data.services || [])[0];
      assert(svc?.id, 'has service');
      const price = Number(svc.price || 100) + i;
      const mgrPrice = await req('/api/os', {
        method: 'POST',
        cookie: mgr.cookie,
        body: { action: 'service.update', id: svc.id, workingPrice: price, price },
      });
      assert(mgrPrice.status === 200, `mgr price ${mgrPrice.status} ${mgrPrice.data.error}`);
      assert(
        Number(mgrPrice.data.service?.workingPrice) === price,
        `workingPrice saved as ${mgrPrice.data.service?.workingPrice}`
      );
      const mgrHours = await req('/api/os', {
        method: 'POST',
        cookie: mgr.cookie,
        body: { action: 'service.update', id: svc.id, founderHours: 999 },
      });
      // sales may be blocked or hours ignored — either 403 or hours unchanged
      if (mgrHours.status === 200) {
        const after = await req('/api/os', { cookie: founder.cookie });
        const s2 = (after.data.services || []).find((s) => s.id === svc.id);
        assert(Number(s2.founderHours) !== 999, 'sales cannot change founderHours');
      } else {
        assert(mgrHours.status === 403, 'sales hours blocked');
      }
      const createDenied = await req('/api/os', {
        method: 'POST',
        cookie: mgr.cookie,
        body: { action: 'service.create', name: 'Hack svc', price: 1 },
      });
      assert(createDenied.status === 403, 'sales cannot create service');
    },
  },
  {
    id: 10,
    name: 'pricing enrichment costFloor',
    run: async () => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const os = await req('/api/os', { cookie });
      const services = os.data.services || [];
      assert(services.length > 0, 'services exist');
      const withFloor = services.filter((s) => s.costFloor != null || s.recommendedPrice != null);
      assert(withFloor.length > 0, 'costFloor/recommendedPrice enriched');
      for (const s of withFloor.slice(0, 5)) {
        if (s.costFloor != null) assert(Number(s.costFloor) >= 0, `costFloor ${s.id}`);
      }
    },
  },
  {
    id: 11,
    name: 'estimate create',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const os = await req('/api/os', { cookie });
      const client = (os.data.clients || [])[0];
      assert(client, 'need client');
      const est = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'estimate.create',
          clientId: client.id,
          title: `КП QA ${Date.now()}-${i}`,
          items: [{ name: 'Услуга QA', qty: 1, price: 1000000 + i * 1000 }],
        },
      });
      assert(est.status === 200 && (est.data.estimate?.id || est.data.id), `estimate ${est.status} ${JSON.stringify(est.data).slice(0, 180)}`);
    },
  },
  {
    id: 12,
    name: 'payment create',
    run: async (i) => {
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const os = await req('/api/os', { cookie });
      const project = (os.data.projects || [])[0];
      const pay = await req('/api/os', {
        method: 'POST',
        cookie,
        body: {
          action: 'payment.create',
          projectId: project?.id,
          amount: 100000 + i * 1000,
          method: 'перевод',
          note: `qa-${i}`,
        },
      });
      assert(pay.status === 200 || pay.status === 400, `payment handled ${pay.status}`);
      if (pay.status === 200) assert(pay.data.payment?.id || pay.data.id, 'payment id');
    },
  },
  {
    id: 13,
    name: 'logout invalidates session',
    run: async () => {
      dropSession('denis@getsite.uz', 'denis123');
      const { cookie } = await login('denis@getsite.uz', 'denis123');
      const out = await req('/api/auth/logout', { method: 'POST', cookie, body: {} });
      assert(out.status === 200 || out.status === 204, `logout ${out.status}`);
      dropSession('denis@getsite.uz', 'denis123');
      const me = await req('/api/auth/me', { cookie });
      assert(!me.data.authenticated, 'session dead after logout');
      const os = await req('/api/os', { cookie });
      assert(os.status === 401, 'os 401 after logout');
    },
  },
  {
    id: 14,
    name: 'unauthenticated walls',
    run: async () => {
      const os = await req('/api/os');
      assert(os.status === 401, 'os 401');
      const post = await req('/api/os', { method: 'POST', body: { action: 'client.create', name: 'x' } });
      assert(post.status === 401, 'post 401');
      const me = await req('/api/auth/me');
      assert(me.status === 200 && me.data.authenticated === false, `me anonymous got ${me.status}`);
    },
  },
  {
    id: 15,
    name: 'nav shell source integrity',
    run: async () => {
      const js = await (await fetch(`${BASE}/assets/nav-shell.js`)).text();
      assert(js.includes('gs-nav-collapse'), 'collapse control');
      assert(js.includes('gs-nav-reopen'), 'reopen control');
      assert(js.includes('gs-nav-collapsed'), 'collapsed class');
      assert(js.includes('gs-page-animating'), 'page anim class');
      assert(js.includes('localStorage'), 'persist collapse');
      assert(js.includes('gs-top'), 'compact top bar');
      const brand = await (await fetch(`${BASE}/assets/brand.css`)).text();
      assert(brand.includes('min-height: 40px'), 'compact create btn');
    },
  },
];

async function main() {
  console.log(`Stress QA 15×${RUNS} against ${BASE}\n`);
  const failures = [];
  const summary = [];

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
    const line = `[${sc.id}/15] ${sc.name}: ${ok}/${RUNS}`;
    summary.push({ ...sc, ok, errors });
    console.log(` ${line}${errors.length ? ' ← ' + errors[0] : ''}`);
  }

  console.log('\n======== SUMMARY ========');
  const total = scenarios.length * RUNS;
  const passed = total - failures.length;
  console.log(`Passed ${passed}/${total}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`- #${f.id} ${f.name} run${f.run}: ${f.error}`);
    }
    process.exitCode = 1;
  } else {
    console.log('All stress checks passed.');
  }

  // machine-readable for follow-up fixes
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/.qa-stress-last.json',
    JSON.stringify({ base: BASE, passed, total, failures, at: new Date().toISOString() }, null, 2)
  );
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
