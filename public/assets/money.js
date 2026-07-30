/**
 * Browser money helpers (IIFE) — used by patched calculator / margin displays.
 */
(function (global) {
  function parseMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (value == null) return NaN;
    let s = String(value).trim().replace(/\u00a0/g, ' ').replace(/\s+/g, '');
    if (!s) return NaN;
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function roundHalfUp(value, decimals) {
    if (!Number.isFinite(value)) return NaN;
    const factor = Math.pow(10, decimals);
    const sign = value < 0 ? -1 : 1;
    const scaled = Math.abs(value) * factor;
    const whole = Math.floor(scaled + 1e-12);
    const frac = scaled - whole;
    const bumped = frac >= 0.5 - 1e-12 ? whole + 1 : whole;
    return (sign * bumped) / factor;
  }

  function calcMarginPct(price, cost, decimals) {
    const d = decimals == null ? 2 : decimals;
    const p = typeof price === 'number' ? price : parseMoney(price);
    const c = typeof cost === 'number' ? cost : parseMoney(cost);
    if (!Number.isFinite(p) || p === 0) return null;
    if (!Number.isFinite(c)) return null;
    return roundHalfUp(((p - c) / p) * 100, d);
  }

  /**
   * Процент для показа в UI: «—» когда значение не определено (цена 0 и т.п.).
   * Возвращает строку вместе со знаком %, поэтому в разметке отдельный «%» не нужен.
   */
  function fmtPct(value, decimals) {
    const d = decimals == null ? 1 : decimals;
    if (value == null || typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return roundHalfUp(value, d).toFixed(d) + '%';
  }

  global.__gsMoney = { parseMoney, roundHalfUp, calcMarginPct, fmtPct };
})(typeof window !== 'undefined' ? window : globalThis);
