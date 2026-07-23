const {
  readDb,
  writeDb,
  id,
  todayRu,
  nowRu,
  isoNow,
  audit,
  str,
  num,
  bool,
} = require('./store');
const { normalizeRole, publicUser, scryptHash, ROLES } = require('./auth');
const { enrichServices } = require('./pricing');

function publicState(data) {
  const projectCount = (data.projects || []).length;
  return {
    leads: data.leads,
    qualifications: data.qualifications,
    activities: data.activities,
    clients: data.clients,
    services: enrichServices(data.services, data.settings, projectCount),
    estimates: data.estimates,
    projects: data.projects,
    projectActuals: data.projectActuals,
    projectTasks: data.projectTasks,
    projectHandoffs: data.projectHandoffs,
    payments: data.payments,
    expenses: data.expenses,
    calculations: data.calculations,
    scripts: data.scripts,
    auditLogs: data.auditLogs.slice(0, 250),
    pagination: data.pagination,
    users: (data.users || []).map((u) => publicUser(u)),
    settings: data.settings,
    account: data.account,
  };
}

async function getState(query = {}) {
  const data = await readDb();
  if (query.resource === 'auditLogs') {
    const offset = Math.max(0, num(query.offset, 0));
    const limit = Math.min(500, Math.max(1, num(query.limit, 250)));
    const slice = data.auditLogs.slice(offset, offset + limit);
    return {
      auditLogs: slice,
      pagination: {
        auditLogs: {
          total: data.auditLogs.length,
          loaded: Math.min(data.auditLogs.length, offset + slice.length),
          hasMore: offset + slice.length < data.auditLogs.length,
        },
      },
    };
  }
  return publicState(data);
}

async function handleAction(body, actor = null) {
  const data = await readDb();
  const action = str(body.action);
  const actorEmail = actor?.email || 'admin@getsite.uz';
  const actorName = actor?.displayName || data.account?.identity?.displayName || '';
  const auditLog = (actionName, entity, entityId) => audit(data, actionName, entity, entityId, actorEmail);
  let result = {};

  switch (action) {
    case 'onboarding.complete': {
      data.account = { ...data.account, onboardingCompleted: true };
      auditLog('Онбординг завершён', 'Account', data.account.identity?.email || '');
      result = { ok: true, account: data.account };
      break;
    }
    case 'profile.register': {
      const fullName = str(body.fullName, data.account.identity?.displayName || 'Пользователь');
      data.account = {
        ...data.account,
        registered: true,
        identity: {
          email: data.account.identity?.email || 'admin@getsite.uz',
          displayName: fullName,
        },
        profile: {
          fullName,
          phone: str(body.phone),
          companyName: str(body.companyName, data.settings.companyName),
          position: str(body.position),
        },
      };
      if (body.companyName) data.settings.companyName = str(body.companyName);
      auditLog('Профиль зарегистрирован', 'User', data.account.identity.email);
      result = { ok: true, account: data.account, settings: data.settings };
      break;
    }
    case 'settings.save': {
      data.settings = { ...data.settings, ...(body.settings || {}) };
      auditLog('Изменены настройки', 'CompanySettings', 'settings');
      result = { ok: true, settings: data.settings };
      break;
    }
    case 'client.create': {
      const client = {
        id: id(),
        name: str(body.name),
        contact: str(body.contact),
        phone: str(body.phone),
        industry: str(body.industry, 'Другое'),
        city: str(body.city),
        revenue: 0,
        profit: 0,
        projectsCount: 0,
        manager: str(body.manager, data.account.identity?.displayName || ''),
        createdAt: todayRu(),
      };
      data.clients = [client, ...data.clients];
      auditLog('Создан клиент', 'Client', client.id);
      result = { ok: true, client };
      break;
    }
    case 'client.update': {
      const client = data.clients.find((c) => c.id === body.id);
      if (!client) throw Object.assign(new Error('Клиент не найден'), { status: 404 });
      Object.assign(client, {
        name: str(body.name, client.name),
        contact: str(body.contact, client.contact),
        phone: str(body.phone, client.phone),
        industry: str(body.industry, client.industry),
        city: str(body.city, client.city),
        manager: str(body.manager, client.manager),
      });
      auditLog('Изменён клиент', 'Client', client.id);
      result = { ok: true, client };
      break;
    }
    case 'client.delete': {
      data.clients = data.clients.filter((c) => c.id !== body.id);
      auditLog('Удалён клиент', 'Client', body.id);
      result = { ok: true };
      break;
    }
    case 'lead.create': {
      const lead = {
        id: id(),
        number: `GS-${242 + data.leads.length}`,
        clientName: str(body.clientName),
        companyName: str(body.companyName),
        phone: str(body.phone),
        source: str(body.source, 'Другое'),
        service: str(body.service),
        budget: num(body.budget),
        status: 'новая',
        temperature: 'тёплый',
        nextAction: 'Связаться с клиентом',
        nextContact: 'Сегодня',
        manager: str(body.manager, data.account.identity?.displayName || ''),
        createdAt: nowRu(),
      };
      data.leads = [lead, ...data.leads];
      auditLog('Создана заявка', 'Lead', lead.id);
      result = { ok: true, lead };
      break;
    }
    case 'lead.update': {
      const lead = data.leads.find((l) => l.id === body.id);
      if (!lead) throw Object.assign(new Error('Заявка не найдена'), { status: 404 });
      Object.assign(lead, {
        clientName: str(body.clientName, lead.clientName),
        companyName: str(body.companyName, lead.companyName),
        phone: str(body.phone, lead.phone),
        source: str(body.source, lead.source),
        service: str(body.service, lead.service),
        budget: num(body.budget, lead.budget),
        status: str(body.status, lead.status),
        temperature: str(body.temperature, lead.temperature),
        nextAction: str(body.nextAction, lead.nextAction),
        nextContact: str(body.nextContact, lead.nextContact),
        manager: str(body.manager, lead.manager),
      });
      auditLog('Изменена заявка', 'Lead', lead.id);
      result = { ok: true, lead };
      break;
    }
    case 'lead.status': {
      const lead = data.leads.find((l) => l.id === body.id);
      if (!lead) throw Object.assign(new Error('Заявка не найдена'), { status: 404 });
      lead.status = str(body.status, lead.status);
      auditLog('Изменён статус заявки', 'Lead', lead.id);
      result = { ok: true, lead };
      break;
    }
    case 'lead.delete': {
      data.leads = data.leads.filter((l) => l.id !== body.id);
      auditLog('Удалена заявка', 'Lead', body.id);
      result = { ok: true };
      break;
    }
    case 'lead.qualify': {
      const leadId = str(body.leadId || body.id);
      const lead = data.leads.find((l) => l.id === leadId);
      if (!lead) throw Object.assign(new Error('Заявка не найдена'), { status: 404 });
      const score = num(body.score);
      const temperature = score >= 75 ? 'горячий' : score >= 45 ? 'тёплый' : 'холодный';
      const qualification = {
        leadId,
        ...body,
        score,
        updatedAt: nowRu(),
      };
      delete qualification.action;
      data.qualifications = [
        ...data.qualifications.filter((q) => q.leadId !== leadId),
        qualification,
      ];
      const activity = {
        id: id(),
        leadId,
        type: 'квалификация',
        text: `Квалификация сохранена. Оценка лида: ${score}/100`,
        actor: lead.manager,
        createdAt: nowRu(),
      };
      data.activities = [activity, ...data.activities];
      lead.status = 'квалификация';
      lead.temperature = temperature;
      auditLog('Квалификация заявки', 'Lead', leadId);
      result = { ok: true, qualification, activity, temperature, lead };
      break;
    }
    case 'service.create': {
      if (actor && actor.systemRole === 'sales_manager') {
        throw Object.assign(
          new Error(
            'Новые услуги и часы себестоимости задаёт основатель. В прайсе меняйте только цены и описание.'
          ),
          { status: 403 }
        );
      }
      const founderHours = num(body.founderHours);
      const contractorHours = num(body.contractorHours);
      const service = {
        id: id(),
        category: str(body.category, 'Сайты'),
        serviceType: str(body.serviceType, 'основная'),
        name: str(body.name),
        description: str(body.description),
        priceFrom: num(body.priceFrom),
        workingPrice: num(body.workingPrice),
        premiumPrice: num(body.premiumPrice),
        plannedHours: founderHours + contractorHours,
        founderHours,
        contractorHours,
        unit: str(body.unit, 'проект'),
        active: body.active === undefined ? true : bool(body.active),
      };
      data.services = [service, ...data.services];
      auditLog('Создана услуга', 'Service', service.id);
      result = {
        ok: true,
        service: enrichServices([service], data.settings, (data.projects || []).length)[0],
      };
      break;
    }
    case 'service.update': {
      const service = data.services.find((s) => s.id === body.id);
      if (!service) throw Object.assign(new Error('Услуга не найдена'), { status: 404 });

      const isSales = actor?.systemRole === 'sales_manager';
      if (isSales) {
        Object.assign(service, {
          name: str(body.name, service.name),
          category: str(body.category, service.category),
          serviceType: str(body.serviceType, service.serviceType),
          description: str(body.description, service.description),
          priceFrom: num(body.priceFrom, service.priceFrom),
          workingPrice: num(body.workingPrice, service.workingPrice),
          premiumPrice: num(body.premiumPrice, service.premiumPrice),
          unit: str(body.unit, service.unit),
          active: body.active === undefined ? service.active : bool(body.active),
        });
        auditLog('Обновлены цены услуги (продажи)', 'Service', service.id);
      } else {
        const founderHours = num(body.founderHours, service.founderHours);
        const contractorHours = num(body.contractorHours, service.contractorHours);
        Object.assign(service, {
          name: str(body.name, service.name),
          category: str(body.category, service.category),
          serviceType: str(body.serviceType, service.serviceType),
          description: str(body.description, service.description),
          priceFrom: num(body.priceFrom, service.priceFrom),
          workingPrice: num(body.workingPrice, service.workingPrice),
          premiumPrice: num(body.premiumPrice, service.premiumPrice),
          founderHours,
          contractorHours,
          plannedHours: founderHours + contractorHours,
          unit: str(body.unit, service.unit),
          active: body.active === undefined ? service.active : bool(body.active),
        });
        auditLog('Изменена услуга', 'Service', service.id);
      }
      result = {
        ok: true,
        service: enrichServices([service], data.settings, (data.projects || []).length)[0],
      };
      break;
    }
    case 'service.delete': {
      if (actor && actor.systemRole !== 'founder') {
        throw Object.assign(new Error('Удалять услуги может только основатель'), { status: 403 });
      }
      data.services = data.services.filter((s) => s.id !== body.id);
      auditLog('Удалена услуга', 'Service', body.id);
      result = { ok: true };
      break;
    }
    case 'estimate.create': {
      const lines = Array.isArray(body.lines) ? body.lines : [];
      const amount = lines.reduce((sum, line) => sum + num(line.qty || line.quantity, 1) * num(line.price), 0);
      const discount = num(body.discount);
      const discounted = Math.max(0, amount - discount);
      const plannedHours = lines.reduce(
        (sum, line) => sum + num(line.qty || line.quantity, 1) * num(line.hours || line.hoursPerUnit),
        0
      );
      const estimatedCost = lines.reduce(
        (sum, line) => sum + num(line.qty || line.quantity, 1) * num(line.cost || 0),
        0
      );
      const margin = discounted > 0 ? ((discounted - estimatedCost) / discounted) * 100 : 0;
      const estimate = {
        id: id(),
        number: `СМ-${191 + data.estimates.length}`,
        clientName: str(body.clientName),
        projectName: str(body.projectName),
        amount: Math.round(discounted || amount),
        margin: Number(margin.toFixed(1)),
        status: 'черновик',
        version: 1,
        linesSnapshot: lines,
        discount,
        plannedHours,
        estimatedCost: Math.round(estimatedCost),
        createdAt: todayRu(),
      };
      data.estimates = [estimate, ...data.estimates];
      auditLog('Создана смета', 'Estimate', estimate.id);
      result = { ok: true, estimate };
      break;
    }
    case 'estimate.status': {
      const estimate = data.estimates.find((e) => e.id === body.id);
      if (!estimate) throw Object.assign(new Error('Смета не найдена'), { status: 404 });
      estimate.status = str(body.status, estimate.status);
      auditLog('Изменён статус сметы', 'Estimate', estimate.id);
      result = { ok: true, estimate };
      break;
    }
    case 'estimate.convert': {
      const estimate = data.estimates.find((e) => e.id === body.id);
      if (!estimate) throw Object.assign(new Error('Смета не найдена'), { status: 404 });
      const deadline = str(body.deadline) || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 56);
        return d.toISOString().slice(0, 10);
      })();
      const plannedHours = num(body.plannedHours, estimate.plannedHours);
      const plannedCost = num(estimate.estimatedCost);
      const project = {
        id: id(),
        name: estimate.projectName || estimate.number,
        clientName: estimate.clientName,
        status: 'планирование',
        progress: 5,
        deadline,
        price: estimate.amount,
        paid: 0,
        plannedProfit: Math.max(0, estimate.amount - plannedCost),
        actualProfit: 0,
        owner: data.account.identity?.displayName || '',
        sourceEstimateId: estimate.id,
      };
      estimate.status = 'согласовано';
      data.projects = [project, ...data.projects];
      data.projectActuals = [
        {
          projectId: project.id,
          plannedHours,
          actualHours: 0,
          plannedCost,
          actualCost: 0,
          actualRevenue: 0,
          varianceReason: '',
          updatedAt: nowRu(),
        },
        ...data.projectActuals.filter((a) => a.projectId !== project.id),
      ];
      const client = data.clients.find((c) => c.name === project.clientName);
      if (client) client.projectsCount = (client.projectsCount || 0) + 1;
      auditLog('Смета конвертирована в проект', 'Project', project.id);
      result = { ok: true, project, estimate, projects: data.projects };
      break;
    }
    case 'project.create': {
      const price = num(body.price);
      const plannedCost = num(body.plannedCost);
      const plannedHours = num(body.plannedHours);
      const project = {
        id: id(),
        name: str(body.name),
        clientName: str(body.clientName),
        status: 'планирование',
        progress: 5,
        deadline: str(body.deadline),
        price,
        paid: 0,
        plannedProfit: Math.max(0, price - plannedCost),
        actualProfit: 0,
        owner: str(body.owner, data.account.identity?.displayName || ''),
        sourceEstimateId: '',
      };
      data.projects = [project, ...data.projects];
      data.projectActuals = [
        {
          projectId: project.id,
          plannedHours,
          actualHours: 0,
          plannedCost,
          actualCost: 0,
          actualRevenue: 0,
          varianceReason: '',
          updatedAt: nowRu(),
        },
        ...data.projectActuals,
      ];
      const client = data.clients.find((c) => c.name === project.clientName);
      if (client) client.projectsCount = (client.projectsCount || 0) + 1;
      auditLog('Создан проект', 'Project', project.id);
      result = { ok: true, project };
      break;
    }
    case 'project.update': {
      const project = data.projects.find((p) => p.id === body.id);
      if (!project) throw Object.assign(new Error('Проект не найден'), { status: 404 });
      Object.assign(project, {
        name: str(body.name, project.name),
        clientName: str(body.clientName, project.clientName),
        status: str(body.status, project.status),
        progress: num(body.progress, project.progress),
        deadline: str(body.deadline, project.deadline),
        price: num(body.price, project.price),
        owner: str(body.owner, project.owner),
        plannedCost: body.plannedCost !== undefined ? num(body.plannedCost) : undefined,
        plannedHours: body.plannedHours !== undefined ? num(body.plannedHours) : undefined,
      });
      if (body.plannedCost !== undefined || body.plannedHours !== undefined) {
        let actual = data.projectActuals.find((a) => a.projectId === project.id);
        if (!actual) {
          actual = { projectId: project.id };
          data.projectActuals.unshift(actual);
        }
        if (body.plannedCost !== undefined) actual.plannedCost = num(body.plannedCost);
        if (body.plannedHours !== undefined) actual.plannedHours = num(body.plannedHours);
        actual.updatedAt = nowRu();
        project.plannedProfit = Math.max(0, project.price - num(actual.plannedCost));
      }
      auditLog('Изменён проект', 'Project', project.id);
      result = {
        ok: true,
        project,
        plannedCost: data.projectActuals.find((a) => a.projectId === project.id)?.plannedCost,
        plannedHours: data.projectActuals.find((a) => a.projectId === project.id)?.plannedHours,
      };
      break;
    }
    case 'project.delete': {
      data.projects = data.projects.filter((p) => p.id !== body.id);
      data.projectActuals = data.projectActuals.filter((a) => a.projectId !== body.id);
      data.projectTasks = data.projectTasks.filter((t) => t.projectId !== body.id);
      data.projectHandoffs = data.projectHandoffs.filter((h) => h.projectId !== body.id);
      auditLog('Удалён проект', 'Project', body.id);
      result = { ok: true };
      break;
    }
    case 'project.actual': {
      const projectId = str(body.projectId);
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) throw Object.assign(new Error('Проект не найден'), { status: 404 });
      const actual = {
        projectId,
        plannedHours: num(body.plannedHours),
        actualHours: num(body.actualHours),
        plannedCost: num(body.plannedCost),
        actualCost: num(body.actualCost),
        actualRevenue: num(body.actualRevenue),
        varianceReason: str(body.varianceReason),
        updatedAt: nowRu(),
      };
      data.projectActuals = [
        actual,
        ...data.projectActuals.filter((a) => a.projectId !== projectId),
      ];
      if (body.progress !== undefined) project.progress = num(body.progress);
      if (body.status) project.status = str(body.status);
      project.actualProfit = actual.actualRevenue - actual.actualCost;
      project.paid = Math.min(project.price, actual.actualRevenue);
      auditLog('Обновлён план/факт проекта', 'Project', projectId);
      result = { ok: true, actual, project };
      break;
    }
    case 'task.create': {
      const task = {
        id: id(),
        projectId: str(body.projectId),
        title: str(body.title),
        stage: str(body.stage, 'планирование'),
        assignee: str(body.assignee),
        status: 'к выполнению',
        priority: str(body.priority, 'средняя'),
        estimateHours: num(body.estimateHours),
        actualHours: 0,
        dueDate: str(body.dueDate),
        createdAt: nowRu(),
      };
      data.projectTasks = [task, ...data.projectTasks];
      auditLog('Создана задача', 'Task', task.id);
      result = { ok: true, task };
      break;
    }
    case 'task.update': {
      const task = data.projectTasks.find((t) => t.id === body.id);
      if (!task) throw Object.assign(new Error('Задача не найдена'), { status: 404 });
      Object.assign(task, {
        title: body.title !== undefined ? str(body.title) : task.title,
        stage: body.stage !== undefined ? str(body.stage) : task.stage,
        assignee: body.assignee !== undefined ? str(body.assignee) : task.assignee,
        status: body.status !== undefined ? str(body.status) : task.status,
        priority: body.priority !== undefined ? str(body.priority) : task.priority,
        estimateHours: body.estimateHours !== undefined ? num(body.estimateHours) : task.estimateHours,
        actualHours: body.actualHours !== undefined ? num(body.actualHours) : task.actualHours,
        dueDate: body.dueDate !== undefined ? str(body.dueDate) : task.dueDate,
      });
      auditLog('Изменена задача', 'Task', task.id);
      result = { ok: true, task };
      break;
    }
    case 'task.delete': {
      data.projectTasks = data.projectTasks.filter((t) => t.id !== body.id);
      auditLog('Удалена задача', 'Task', body.id);
      result = { ok: true };
      break;
    }
    case 'handoff.save': {
      const projectId = str(body.projectId);
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) throw Object.assign(new Error('Проект не найден'), { status: 404 });
      const checks = [
        'qaDesign',
        'qaResponsive',
        'qaForms',
        'qaPerformance',
        'qaSeo',
        'qaAnalytics',
        'clientApproved',
        'materialsTransferred',
        'accessesTransferred',
        'backupCreated',
      ];
      const handoff = {
        projectId,
        supportPlan: str(body.supportPlan, 'Не выбран'),
        launchUrl: str(body.launchUrl),
        notes: str(body.notes),
        updatedAt: nowRu(),
      };
      for (const key of checks) handoff[key] = bool(body[key]);
      data.projectHandoffs = [
        handoff,
        ...data.projectHandoffs.filter((h) => h.projectId !== projectId),
      ];
      const allDone = checks.every((key) => handoff[key]);
      const projectPatch = allDone
        ? { status: 'завершён', progress: 100 }
        : {};
      Object.assign(project, projectPatch);
      auditLog('Сохранён чек-лист сдачи', 'Project', projectId);
      result = { ok: true, handoff, projectPatch, project };
      break;
    }
    case 'payment.create': {
      const project = data.projects.find((p) => p.id === body.projectId) || data.projects[0];
      if (!project) throw Object.assign(new Error('Сначала создайте проект'), { status: 400 });
      const payment = {
        id: id(),
        projectId: project.id,
        projectName: project.name,
        clientName: project.clientName,
        amount: num(body.amount),
        type: str(body.type, 'предоплата'),
        status: str(body.status, 'ожидается'),
        date: str(body.date, todayRu()),
        method: str(body.method, 'перевод'),
      };
      data.payments = [payment, ...data.payments];
      if (payment.status === 'получено') {
        project.paid = Math.min(project.price, num(project.paid) + payment.amount);
      }
      auditLog('Создан платёж', 'Payment', payment.id);
      result = { ok: true, payment, project };
      break;
    }
    case 'payment.update': {
      const payment = data.payments.find((p) => p.id === body.id);
      if (!payment) throw Object.assign(new Error('Платёж не найден'), { status: 404 });
      Object.assign(payment, {
        projectId: str(body.projectId, payment.projectId),
        amount: num(body.amount, payment.amount),
        type: str(body.type, payment.type),
        method: str(body.method, payment.method),
        status: str(body.status, payment.status),
        date: str(body.date, payment.date),
      });
      const project = data.projects.find((p) => p.id === payment.projectId);
      if (project) {
        payment.projectName = project.name;
        payment.clientName = project.clientName;
        project.paid = data.payments
          .filter((p) => p.projectId === project.id && p.status === 'получено')
          .reduce((sum, p) => sum + p.amount, 0);
        project.paid = Math.min(project.price, project.paid);
      }
      auditLog('Изменён платёж', 'Payment', payment.id);
      result = { ok: true, payment };
      break;
    }
    case 'payment.receive': {
      const payment = data.payments.find((p) => p.id === body.id);
      if (!payment) throw Object.assign(new Error('Платёж не найден'), { status: 404 });
      payment.status = 'получено';
      const project = data.projects.find((p) => p.id === payment.projectId);
      if (project) {
        project.paid = Math.min(
          project.price,
          data.payments
            .filter((p) => p.projectId === project.id && p.status === 'получено')
            .reduce((sum, p) => sum + p.amount, 0)
        );
      }
      auditLog('Платёж получен', 'Payment', payment.id);
      result = { ok: true, payment, project };
      break;
    }
    case 'payment.delete': {
      data.payments = data.payments.filter((p) => p.id !== body.id);
      auditLog('Удалён платёж', 'Payment', body.id);
      result = { ok: true };
      break;
    }
    case 'expense.create': {
      const project = data.projects.find((p) => p.id === body.projectId) || data.projects[0];
      if (!project) throw Object.assign(new Error('Сначала создайте проект'), { status: 400 });
      const expense = {
        id: id(),
        projectId: project.id,
        projectName: project.name,
        category: str(body.category, 'Прочее'),
        recipient: str(body.recipient),
        amount: num(body.amount),
        status: str(body.status, 'оплачено'),
        date: str(body.date, todayRu()),
      };
      data.expenses = [expense, ...data.expenses];
      auditLog('Создан расход', 'Expense', expense.id);
      result = { ok: true, expense };
      break;
    }
    case 'expense.update': {
      const expense = data.expenses.find((e) => e.id === body.id);
      if (!expense) throw Object.assign(new Error('Расход не найден'), { status: 404 });
      Object.assign(expense, {
        projectId: str(body.projectId, expense.projectId),
        category: str(body.category, expense.category),
        recipient: str(body.recipient, expense.recipient),
        amount: num(body.amount, expense.amount),
        status: str(body.status, expense.status),
        date: str(body.date, expense.date),
      });
      const project = data.projects.find((p) => p.id === expense.projectId);
      if (project) expense.projectName = project.name;
      auditLog('Изменён расход', 'Expense', expense.id);
      result = { ok: true, expense };
      break;
    }
    case 'expense.delete': {
      data.expenses = data.expenses.filter((e) => e.id !== body.id);
      auditLog('Удалён расход', 'Expense', body.id);
      result = { ok: true };
      break;
    }
    case 'calculation.save': {
      const calculation = {
        id: id(),
        projectName: str(body.projectName),
        input: body.input || {},
        createdAt: isoNow(),
      };
      data.calculations = [calculation, ...data.calculations];
      auditLog('Сохранён расчёт', 'Calculation', calculation.id);
      result = { ok: true, calculation, calculations: data.calculations };
      break;
    }
    case 'script.create':
    case 'script.update': {
      const existing = action === 'script.update' ? data.scripts.find((s) => s.id === body.id) : null;
      const script = {
        id: existing?.id || id(),
        title: str(body.title),
        stage: str(body.stage),
        duration: str(body.duration),
        goal: str(body.goal),
        content: str(body.content),
        active: body.active === undefined ? true : bool(body.active),
        updatedAt: nowRu(),
      };
      if (existing) {
        data.scripts = data.scripts.map((s) => (s.id === script.id ? script : s));
        auditLog('Изменён скрипт', 'Script', script.id);
      } else {
        data.scripts = [script, ...data.scripts];
        auditLog('Создан скрипт', 'Script', script.id);
      }
      result = { ok: true, script };
      break;
    }
    case 'script.delete': {
      data.scripts = data.scripts.filter((s) => s.id !== body.id);
      auditLog('Удалён скрипт', 'Script', body.id);
      result = { ok: true };
      break;
    }
    case 'user.capacity': {
      let user = data.users.find((u) => u.email === body.email);
      if (!user) {
        user = {
          email: str(body.email),
          displayName: str(body.email),
          systemRole: 'участник',
          weeklyCapacity: 0,
        };
        data.users.push(user);
      }
      user.weeklyCapacity = num(body.weeklyCapacity);
      auditLog('Обновлена ёмкость пользователя', 'User', user.email);
      result = { ok: true, user, users: data.users };
      break;
    }
    case 'user.role': {
      if (!actor || actor.systemRole !== 'founder') {
        throw Object.assign(new Error('Только основатель может менять роли'), { status: 403 });
      }
      const nextRole = normalizeRole(body.systemRole);
      if (!nextRole || !ROLES[nextRole]) {
        throw Object.assign(new Error('Неизвестная роль'), { status: 400 });
      }
      let user = data.users.find((u) => u.email === body.email);
      if (!user) {
        user = {
          id: id(),
          email: str(body.email),
          displayName: str(body.displayName || body.fullName || body.email),
          systemRole: nextRole,
          position: ROLES[nextRole].label,
          weeklyCapacity: 0,
          active: true,
        };
        data.users.push(user);
      } else {
        user.systemRole = nextRole;
        user.position = ROLES[nextRole].label;
      }
      auditLog('Изменена роль пользователя', 'User', user.email);
      result = { ok: true, user: publicUser(user) };
      break;
    }
    case 'user.create': {
      if (!actor || actor.systemRole !== 'founder') {
        throw Object.assign(new Error('Только основатель может создавать пользователей'), { status: 403 });
      }
      const email = str(body.email).trim().toLowerCase();
      const password = str(body.password);
      const displayName = str(body.displayName || body.fullName).trim();
      const systemRole = normalizeRole(body.systemRole || 'sales_manager') || 'sales_manager';
      if (!email || !password || !displayName) {
        throw Object.assign(new Error('Нужны имя, email и пароль'), { status: 400 });
      }
      if (password.length < 6) {
        throw Object.assign(new Error('Пароль не короче 6 символов'), { status: 400 });
      }
      if (!ROLES[systemRole]) {
        throw Object.assign(new Error('Неизвестная роль'), { status: 400 });
      }
      if ((data.users || []).some((u) => u.email.toLowerCase() === email)) {
        throw Object.assign(new Error('Пользователь с таким email уже есть'), { status: 409 });
      }
      const user = {
        id: id(),
        email,
        displayName,
        passwordHash: scryptHash(password),
        systemRole,
        position: ROLES[systemRole].label,
        weeklyCapacity: num(body.weeklyCapacity, 40),
        active: true,
        createdAt: isoNow(),
      };
      data.users = [user, ...(data.users || [])];
      auditLog('Создан пользователь', 'User', user.email);
      result = { ok: true, user: publicUser(user), users: data.users.map(publicUser) };
      break;
    }
    case 'user.deactivate': {
      if (!actor || actor.systemRole !== 'founder') {
        throw Object.assign(new Error('Только основатель может отключать пользователей'), { status: 403 });
      }
      const email = str(body.email).trim().toLowerCase();
      if (!email) throw Object.assign(new Error('Укажите email'), { status: 400 });
      if (actor.email.toLowerCase() === email) {
        throw Object.assign(new Error('Нельзя отключить самого себя'), { status: 400 });
      }
      const user = (data.users || []).find((u) => u.email.toLowerCase() === email);
      if (!user) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });
      user.active = false;
      auditLog('Отключён пользователь', 'User', user.email);
      result = { ok: true, user: publicUser(user), users: data.users.map(publicUser) };
      break;
    }
    case 'user.password': {
      if (!actor) throw Object.assign(new Error('Требуется вход'), { status: 401 });
      const targetEmail = str(body.email || actor.email).trim().toLowerCase();
      const newPassword = str(body.password || body.newPassword);
      if (!newPassword || newPassword.length < 6) {
        throw Object.assign(new Error('Пароль не короче 6 символов'), { status: 400 });
      }
      const isSelf = targetEmail === actor.email.toLowerCase();
      if (!isSelf && actor.systemRole !== 'founder') {
        throw Object.assign(new Error('Сброс чужого пароля доступен только основателю'), { status: 403 });
      }
      const user = (data.users || []).find((u) => u.email.toLowerCase() === targetEmail);
      if (!user) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });
      user.passwordHash = scryptHash(newPassword);
      auditLog('Изменён пароль пользователя', 'User', user.email);
      result = { ok: true };
      break;
    }
    default:
      throw Object.assign(new Error(`Неизвестное действие: ${action || 'пусто'}`), { status: 400 });
  }

  await writeDb(data);
  return result;
}

module.exports = { getState, handleAction, publicState };
