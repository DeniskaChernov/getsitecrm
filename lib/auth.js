const crypto = require('crypto');

const ROLES = {
  founder: {
    id: 'founder',
    label: 'Основатель / учредитель',
    sections: [
      'Главная',
      'Заявки',
      'Клиенты',
      'Сметы',
      'Проекты',
      'Команда и сроки',
      'Оплаты и расходы',
      'Unit Economics',
      'Прайс',
      'Скрипты продаж',
      'История',
      'Готовность',
      'Аналитика',
      'Настройки',
    ],
    actions: '*',
  },
  sales_manager: {
    id: 'sales_manager',
    label: 'Менеджер продаж',
    sections: [
      'Главная',
      'Заявки',
      'Клиенты',
      'Сметы',
      'Проекты',
      'Оплаты и расходы',
      'Прайс',
      'Скрипты продаж',
      'История',
    ],
    // Unit Economics hidden; cost via Сметы
    actions: [
      'lead.create',
      'lead.update',
      'lead.status',
      'lead.qualify',
      'lead.delete',
      'client.create',
      'client.update',
      'estimate.create',
      'estimate.status',
      'estimate.convert',
      'payment.create',
      'payment.update',
      'payment.receive',
      'script.create',
      'script.update',
      'script.delete',
      'project.create',
      'project.update',
      'onboarding.complete',
      'profile.register',
    ],
  },
  designer: {
    id: 'designer',
    label: 'Дизайнер',
    sections: ['Главная', 'Проекты', 'Команда и сроки', 'История'],
    actions: [
      'task.create',
      'task.update',
      'task.delete',
      'project.actual',
      'handoff.save',
      'project.update',
      'onboarding.complete',
      'profile.register',
    ],
  },
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const COOKIE_NAME = 'getsite_session';

function scryptHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(':')) return false;
  const [salt, hash] = String(stored).split(':');
  const next = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
  } catch {
    return false;
  }
}

function sessionSecret() {
  return process.env.SESSION_SECRET || 'getsite-os-dev-secret-change-me';
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function readSession(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > Number(data.exp)) return null;
    return data;
  } catch {
    return null;
  }
}

function createSessionToken(user) {
  return signSession({
    uid: user.id,
    email: user.email,
    role: user.systemRole,
    name: user.displayName,
    exp: Date.now() + SESSION_TTL_MS,
  });
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  return readSession(cookies[COOKIE_NAME]);
}

function isHttpsRequest(req) {
  if (!req) return process.env.NODE_ENV === 'production' && process.env.FORCE_SECURE_COOKIE === 'true';
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https' || req.secure === true;
}

function setSessionCookie(res, token, req = null) {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const expires = new Date(Date.now() + SESSION_TTL_MS).toUTCString();
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  // Session token (HttpOnly) + presence marker for SPA reload UX
  const session = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}; Expires=${expires}${secure}`;
  const marker = `getsite_auth=1; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}; Expires=${expires}${secure}`;
  const prev = res.getHeader('Set-Cookie');
  const list = [];
  if (Array.isArray(prev)) list.push(...prev);
  else if (prev) list.push(String(prev));
  list.push(session, marker);
  res.setHeader('Set-Cookie', list);
}

function clearSessionCookie(res) {
  const expired = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; ${expired}`,
    `getsite_auth=; Path=/; SameSite=Lax; ${expired}`,
  ]);
}

function roleConfig(role) {
  return ROLES[role] || ROLES.designer;
}

function canAccessSection(role, sectionLabel) {
  const cfg = roleConfig(role);
  return cfg.sections.includes(sectionLabel);
}

function canAction(role, action) {
  const cfg = roleConfig(role);
  if (cfg.actions === '*') return true;
  if (!action) return false;
  if (cfg.actions.includes(action)) return true;
  // dynamic kind.update / kind.delete
  if (action.endsWith('.update') || action.endsWith('.delete')) {
    const base = action.replace(/\.(update|delete)$/, '');
    return cfg.actions.some((a) => a.startsWith(base + '.'));
  }
  return false;
}

function isResponsibleForProject(user, project, tasks = []) {
  if (!project || !user) return false;
  const name = (user.displayName || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  if ((project.owner || '').toLowerCase() === name) return true;
  if ((project.owner || '').toLowerCase() === email) return true;
  return tasks.some(
    (t) =>
      t.projectId === project.id &&
      ((t.assignee || '').toLowerCase() === name || (t.assignee || '').toLowerCase() === email)
  );
}

function filterStateForUser(data, user) {
  if (!user) return null;

  const withSession = (next) => ({
    ...next,
    account: {
      ...next.account,
      identity: {
        email: user.email,
        displayName: user.displayName,
      },
      profile: {
        ...(next.account?.profile || {}),
        fullName: user.displayName,
        systemRole: user.systemRole === 'founder' ? 'administrator' : user.systemRole,
        position: user.position || roleConfig(user.systemRole).label,
      },
      onboardingCompleted: true,
      registered: true,
    },
    sessionUser: publicUser(user),
    access: {
      role: user.systemRole,
      sections: roleConfig(user.systemRole).sections,
    },
  });

  if (user.systemRole === 'founder') {
    return withSession(data);
  }

  let next = { ...data };

  if (user.systemRole === 'sales_manager') {
    next = {
      ...next,
      calculations: [],
      settings: {
        companyName: data.settings.companyName,
        currency: data.settings.currency,
      },
      users: (data.users || []).map(publicUser),
    };
  }

  if (user.systemRole === 'designer') {
    const allowedProjects = (data.projects || []).filter((p) =>
      isResponsibleForProject(user, p, data.projectTasks || [])
    );
    const ids = new Set(allowedProjects.map((p) => p.id));
    next = {
      ...next,
      leads: [],
      qualifications: [],
      clients: [],
      services: [],
      estimates: [],
      calculations: [],
      scripts: [],
      payments: [],
      expenses: [],
      settings: {
        companyName: data.settings.companyName,
        currency: data.settings.currency,
      },
      users: [],
      projects: allowedProjects,
      projectActuals: (data.projectActuals || []).filter((a) => ids.has(a.projectId)),
      projectTasks: (data.projectTasks || []).filter((t) => ids.has(t.projectId)),
      projectHandoffs: (data.projectHandoffs || []).filter((h) => ids.has(h.projectId)),
      auditLogs: (data.auditLogs || []).filter(
        (l) => l.actor === user.email || (l.entity === 'Project' && ids.has(l.entityId))
      ),
    };
  }

  return withSession(next);
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    systemRole: user.systemRole,
    position: user.position || roleConfig(user.systemRole).label,
    weeklyCapacity: user.weeklyCapacity || 0,
    active: user.active !== false,
  };
}

function defaultUsers() {
  return [
    {
      id: 'u-denis',
      email: 'denis@getsite.uz',
      displayName: 'Денис',
      passwordHash: scryptHash('denis123'),
      systemRole: 'founder',
      position: 'Основатель',
      weeklyCapacity: 40,
      active: true,
    },
    {
      id: 'u-nikita',
      email: 'nikita@getsite.uz',
      displayName: 'Никита',
      passwordHash: scryptHash('nikita123'),
      systemRole: 'founder',
      position: 'Учредитель',
      weeklyCapacity: 40,
      active: true,
    },
    {
      id: 'u-manager',
      email: 'manager@getsite.uz',
      displayName: 'Менеджер продаж',
      passwordHash: scryptHash('manager123'),
      systemRole: 'sales_manager',
      position: 'Менеджер продаж',
      weeklyCapacity: 40,
      active: true,
    },
    {
      id: 'u-designer',
      email: 'designer@getsite.uz',
      displayName: 'Дизайнер',
      passwordHash: scryptHash('designer123'),
      systemRole: 'designer',
      position: 'Дизайнер',
      weeklyCapacity: 40,
      active: true,
    },
  ];
}

module.exports = {
  ROLES,
  COOKIE_NAME,
  scryptHash,
  verifyPassword,
  createSessionToken,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie,
  canAccessSection,
  canAction,
  filterStateForUser,
  publicUser,
  defaultUsers,
  roleConfig,
  isResponsibleForProject,
};
