const { parseMoney, roundHalfUp, roundMoney, calcMarginPct } = require('./money');

/**
 * Unit economics helpers for catalog services.
 * Cost lives here; commercial prices (priceFrom / workingPrice) live in Прайс.
 */

function num(v, fallback = 0) {
  const n = parseMoney(v);
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
 * Margin is computed from precise costFloor, then rounded once (half-up, 2 dp).
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
  // Precise floor for margin / belowFloor — round money only for storage/display
  const marginAtWorking = calcMarginPct(workingPrice, costFloor, 2);
  const marginAtFrom = calcMarginPct(priceFrom, costFloor, 2);

  return {
    plannedHours,
    laborCost: roundMoney(laborCost),
    fixedShare: roundMoney(fixedShare),
    directCost: roundMoney(directCost),
    costFloor: roundMoney(costFloor),
    recommendedPrice: roundMoney(recommendedPrice),
    marginAtWorking,
    marginAtFrom,
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
  // re-export for callers / tests
  parseMoney,
  roundHalfUp,
  roundMoney,
  calcMarginPct,
};
