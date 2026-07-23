/**
 * Acceptance checks for GetSite OS (stages 1–6).
 * Usage: node scripts/qa-acceptance.js [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3100';

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
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  const setCookie = parseSetCookie(res);
  return { status: res.status, data, cookie: setCookie || cookie || '' };
}

async function login(email, password) {
  const r = await req('/api/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${r.data.error}`);
  return r.cookie;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
}

async function main() {
  console.log('QA against', BASE);

  const health = await req('/api/health');
  assert(health.status === 200 && health.data.ok, 'health ok');

  const unauth = await req('/api/os');
  assert(unauth.status === 401, 'GET /api/os without cookie → 401');

  const mgr = await login('manager@getsite.uz', 'manager123');
  const denySettings = await req('/api/os', {
    method: 'POST',
    cookie: mgr,
    body: { action: 'settings.save', hourlyRate: 1 },
  });
  assert(denySettings.status === 403, 'manager cannot settings.save');

  const denyCalc = await req('/api/os', {
    method: 'POST',
    cookie: mgr,
    body: { action: 'calculation.save', name: 'x' },
  });
  assert(denyCalc.status === 403, 'manager cannot calculation.save');

  const designer = await login('designer@getsite.uz', 'designer123');
  const dState = await req('/api/os', { cookie: designer });
  assert(dState.status === 200, 'designer can read /api/os');
  assert(
    (dState.data.projects || []).every((p) => (p.owner || '').toLowerCase().includes('дизайн') || p.id === 'proj-designer-demo'),
    'designer sees only own projects (or empty filtered set)'
  );
  assert(!(dState.data.clients || []).length, 'designer does not see clients');

  const founder = await login('denis@getsite.uz', 'denis123');
  const me = await req('/api/auth/me', { cookie: founder });
  assert(me.status === 200 && me.data.authenticated, 'session persists via cookie');
  assert(me.data.user.fullName || me.data.user.displayName, 'publicUser has fullName/displayName');
  assert(me.data.roles?.founder?.sections?.length, 'roles from /api/auth/me');

  const roleOk = await req('/api/os', {
    method: 'POST',
    cookie: founder,
    body: { action: 'user.role', email: 'manager@getsite.uz', systemRole: 'member' },
  });
  assert(roleOk.status === 200 && roleOk.data.user?.systemRole === 'sales_manager', 'administrator/member mapped; role saves');

  // restore manager role
  await req('/api/os', {
    method: 'POST',
    cookie: founder,
    body: { action: 'user.role', email: 'manager@getsite.uz', systemRole: 'sales_manager' },
  });

  const regClosed = await req('/api/auth/register', {
    method: 'POST',
    body: { email: 'hacker@x.com', password: '123456', displayName: 'X' },
  });
  assert(regClosed.status === 403, 'public register closed');

  const cfg = await req('/api/auth/config');
  assert(cfg.status === 200 && cfg.data.registrationOpen === false, 'auth config');

  // fixed share sanity via settings numbers
  const state = await req('/api/os', { cookie: founder });
  const fixed = Number(state.data.settings.fixedMonthly);
  const planned = Number(state.data.settings.plannedProjects);
  const projects = (state.data.projects || []).length;
  const share = fixed / Math.max(planned, projects, 1);
  assert(share > 0 && Number.isFinite(share), `fixed share divisor works (${share})`);

  console.log('\nAll acceptance checks passed.');
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
