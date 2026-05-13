/**
 * tcg_invest_utils.cjs — Shared utilities for all TCG INVEST scrapers
 * 
 * 確保資料寫入 Firestore 前的冪等性（Idempotency）：
 * 無論輸入什麼怪格式，輸出永遠是標準化字串。
 * 
 * 用法：
 *   const { sanitizePct, sanitizePrice, parsePriceJpy } = require('./tcg_invest_utils.cjs');
 */

// ── Percent sanitizer ─────────────────────────────────────────────────────────
/**
 * Normalize a percentage value to a clean 'N.N%' or 'N%' string.
 * 
 * Handles all known dirty formats:
 *   '85.3%'   → '85.3%'   (already has %, strip then re-add)
 *   '85.3%%'  → '85.3%'   (double %)
 *   'undefined%' → '0%'   (JS undefined String coercion bug)
 *   null      → '0%'
 *   undefined → '0%'
 *   ''        → '0%'
 *   'NaN'     → '0%'
 *   '85.3'    → '85.3%'   (no % suffix, add one)
 * 
 * @param {any} val - Raw value from API/scraper
 * @returns {string} - Sanitized percentage string ending in exactly one '%'
 */
function sanitizePct(val) {
  if (val === undefined || val === null) return '0%';
  const s = String(val);
  if (s === 'undefined' || s === 'null' || s === '') return '0%';
  // Strip ALL existing % characters then re-add exactly one
  const clean = s.replace(/%+/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? '0%' : `${num}%`;
}

// ── Price sanitizer ───────────────────────────────────────────────────────────
/**
 * Normalize a price value to a finite number.
 * 
 * Handles: '¥12,800', '$1,200', '12000', null, undefined, 'N/A'
 * 
 * @param {any} val - Raw price string or number
 * @param {number} fallback - Default if parsing fails (default: 0)
 * @returns {number} - Finite numeric price
 */
function sanitizePrice(val, fallback = 0) {
  if (val === undefined || val === null) return fallback;
  const s = String(val).replace(/[¥$,\s]/g, '').trim();
  const n = parseFloat(s);
  return isFinite(n) ? n : fallback;
}

// ── JPY price parser ─────────────────────────────────────────────────────────
/**
 * Parse Japanese Yen price from strings like '¥12,800' or '12,800円'.
 * 
 * @param {string|number} raw - Raw price value
 * @returns {number} - Integer JPY price
 */
function parsePriceJpy(raw) {
  if (!raw) return 0;
  const s = String(raw).replace(/[¥円,\s]/g, '').trim();
  const n = parseFloat(s);
  return isFinite(n) ? Math.round(n) : 0;
}

// ── JPY → HKD converter ──────────────────────────────────────────────────────
const JPY_TO_HKD = 0.049815;  // Updated 2026-05-10

function jpyToHkd(jpy) {
  return Math.round(jpy * JPY_TO_HKD);
}

module.exports = {
  sanitizePct,
  sanitizePrice,
  parsePriceJpy,
  jpyToHkd,
  JPY_TO_HKD,
};