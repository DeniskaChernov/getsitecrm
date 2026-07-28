/**
 * Money / margin helpers — avoid JS float drift and double-rounding.
 * UZS: amounts are whole sums. Margin %: half-up to 2 decimal places.
 */

function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value == null) return NaN;
  let s = String(value).trim().replace(/\u00a0/g, ' ').replace(/\s+/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Half-up rounding (away from zero at .5), not banker's / IEEE ties-to-even.
 */
function roundHalfUp(value, decimals = 2) {
  if (!Number.isFinite(value)) return NaN;
  const factor = 10 ** decimals;
  const sign = value < 0 ? -1 : 1;
  const scaled = Math.abs(value) * factor;
  // Nudge tiny float noise below the .5 boundary without flipping true .5
  const whole = Math.floor(scaled + 1e-12);
  const frac = scaled - whole;
  const bumped = frac >= 0.5 - 1e-12 ? whole + 1 : whole;
  return (sign * bumped) / factor;
}

/** Round UZS amount to whole sum (no tiyin). */
function roundMoney(value) {
  const n = typeof value === 'number' ? value : parseMoney(value);
  if (!Number.isFinite(n)) return NaN;
  return roundHalfUp(n, 0);
}

/**
 * Margin % = (price − cost) / price × 100
 * @returns {number|null} null when price is 0 / invalid (no NaN/Infinity leak)
 */
function calcMarginPct(price, cost, decimals = 2) {
  const p = typeof price === 'number' ? price : parseMoney(price);
  const c = typeof cost === 'number' ? cost : parseMoney(cost);
  if (!Number.isFinite(p) || p === 0) return null;
  if (!Number.isFinite(c)) return null;
  return roundHalfUp(((p - c) / p) * 100, decimals);
}

function formatMarginPct(margin, decimals = 2) {
  if (margin == null || !Number.isFinite(margin)) return '—';
  const rounded = roundHalfUp(margin, decimals);
  const fixed = rounded.toFixed(decimals);
  return `${rounded < 0 ? '' : ''}${fixed}%`;
}

module.exports = {
  parseMoney,
  roundHalfUp,
  roundMoney,
  calcMarginPct,
  formatMarginPct,
};
