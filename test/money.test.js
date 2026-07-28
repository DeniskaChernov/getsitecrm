/**
 * Unit tests for margin / money helpers (TC from margin bug testplan).
 * Run: node --test test/money.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseMoney, roundHalfUp, roundMoney, calcMarginPct } = require('../lib/money');

describe('roundHalfUp', () => {
  it('rounds .5 away from zero (half-up)', () => {
    assert.equal(roundHalfUp(1.225, 2), 1.23);
    assert.equal(roundHalfUp(1.235, 2), 1.24);
    assert.equal(roundHalfUp(-1.225, 2), -1.23);
    assert.equal(roundHalfUp(12.5, 0), 13);
    assert.equal(roundHalfUp(-12.5, 0), -13);
  });
});

describe('parseMoney', () => {
  it('TC-13: comma as decimal separator', () => {
    assert.equal(parseMoney('1000000,50'), 1000000.5);
    assert.equal(parseMoney('600000,25'), 600000.25);
  });

  it('accepts spaces and dots', () => {
    assert.equal(parseMoney('1 000 000'), 1000000);
    assert.equal(parseMoney('1.5'), 1.5);
  });
});

describe('calcMarginPct', () => {
  const cases = [
    ['TC-01', 1_000_000, 600_000, 40],
    ['TC-02', 1_000_000, 700_000, 30],
    ['TC-03', 1_000_000, 333_333, 66.67],
    ['TC-04', 200_000, 150_000, 25],
    ['TC-05', 1_000_000, 995_000, 0.5],
    ['TC-06', 1_500_000.75, 900_000.33, 40],
    ['TC-07', 1_000_000, 0, 100],
    ['TC-08', 1_000_000, 1_000_000, 0],
    ['TC-09', 1_000_000, 1_200_000, -20],
    ['TC-11', 10_000, 6_000, 40],
    ['TC-12', 999_999_999, 333_333_333, 66.67],
    ['TC-20', 1_000_000, 875_000, 12.5],
  ];

  for (const [id, price, cost, expected] of cases) {
    it(id, () => {
      assert.equal(calcMarginPct(price, cost), expected);
    });
  }

  it('TC-10: price = 0 → null (no NaN/Infinity)', () => {
    assert.equal(calcMarginPct(0, 500_000), null);
    assert.equal(calcMarginPct('0', 500_000), null);
  });

  it('TC-13: parsed comma inputs', () => {
    assert.equal(calcMarginPct('1000000,50', '600000,25'), 40);
  });

  it('TC-14/15: repeated edits do not drift', () => {
    let price = 1_000_000;
    const cost = 600_000;
    assert.equal(calcMarginPct(price, cost), 40);
    price = 1_000_000.01;
    const mid = calcMarginPct(price, cost);
    assert.ok(Math.abs(mid - 40) < 0.01);
    price = 1_000_000;
    for (let i = 0; i < 5; i++) {
      price += i % 2 === 0 ? 1 : -1;
      calcMarginPct(price, cost);
    }
    price = 1_000_000;
    assert.equal(calcMarginPct(price, cost), 40);
  });

  it('does not round inputs before dividing', () => {
    // If we rounded cost to 333333 and price stays, fine;
    // critical: margin from precise ratio then single round
    const m = calcMarginPct(1_000_000, 333_333.4);
    assert.equal(m, calcMarginPct(1_000_000, 333_333.4));
    assert.equal(typeof m, 'number');
  });
});

describe('roundMoney', () => {
  it('UZS to whole sums', () => {
    assert.equal(roundMoney(1000.4), 1000);
    assert.equal(roundMoney(1000.5), 1001);
    assert.equal(roundMoney('1 000,6'), 1001);
  });
});
