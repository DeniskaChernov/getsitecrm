/**
 * Unit economics helpers for catalog services.
 * Cost lives here; commercial prices (priceFrom / workingPrice) live in Прайс.
 */

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fixedShareFor(settings, projectCount = 0) {
  const planned = num(settings?.plannedProjects);
  const projects = num(projectCount);
  const denom = Math.max(planned, projects, 1);
  return num(settings?.fixedMonthly) / denom;
}

/**
 * Direct cost + floor/recommended sell prices for one service.
 * Aligns with calculator: labor + fixed share, then tax/risk (/+ target margin).
 */
function serviceEconomics(service, settings = {}, projectCount = 0) {
  const hourlyRate = num(settings.hourlyRate);
  const taxRate = num(settings.taxRate) / 100;
  const riskRate = num(settings.riskRate) / 100;
  const targetMargin = num(settings.targetMargin) / 100;
  const founderHours = num(service?.founderHours);
  const contractorHours = num(service?.contractorHours);
  const plannedHours = num(service?.plannedHours, founderHours + contractorHours);
  const laborCost = founderHours * hourlyRate + contractorHours * hourlyRate;
  const fixedShare = fixedShareFor(settings, projectCount);
  const directCost = laborCost + fixedShare;
  const load = taxRate + riskRate;
  const costFloor = load < 1 ? directCost / (1 - load) : directCost;
  const recommendedPrice =
    load + targetMargin < 1 ? directCost / (1 - load - targetMargin) : costFloor;

  const workingPrice = num(service?.workingPrice);
  const priceFrom = num(service?.priceFrom);
  const marginAtWorking =
    workingPrice > 0 ? ((workingPrice - costFloor) / workingPrice) * 100 : null;
  const marginAtFrom = priceFrom > 0 ? ((priceFrom - costFloor) / priceFrom) * 100 : null;

  return {
    plannedHours,
    laborCost: Math.round(laborCost),
    fixedShare: Math.round(fixedShare),
    directCost: Math.round(directCost),
    costFloor: Math.round(costFloor),
    recommendedPrice: Math.round(recommendedPrice),
    marginAtWorking: marginAtWorking == null ? null : Math.round(marginAtWorking * 10) / 10,
    marginAtFrom: marginAtFrom == null ? null : Math.round(marginAtFrom * 10) / 10,
    belowFloor:
      (workingPrice > 0 && workingPrice < costFloor) || (priceFrom > 0 && priceFrom < costFloor),
  };
}

function enrichService(service, settings, projectCount = 0) {
  const economics = serviceEconomics(service, settings, projectCount);
  return {
    ...service,
    ...economics,
  };
}

function enrichServices(services, settings, projectCount = 0) {
  return (services || []).map((s) => enrichService(s, settings, projectCount));
}

module.exports = {
  fixedShareFor,
  serviceEconomics,
  enrichService,
  enrichServices,
};
