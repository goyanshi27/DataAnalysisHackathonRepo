/* ============================================================
   UTILS.JS — Shared utility functions
   ============================================================ */
'use strict';

const Utils = {

  fmtNumber(n) {
    if (n === null || n === undefined || n === '' || (typeof n === 'number' && isNaN(n))) return 'N/A';
    return Number(n).toLocaleString('en-US');
  },

  fmtPct(n, decimals) {
    decimals = decimals !== undefined ? decimals : 2;
    if (n === null || n === undefined || (typeof n === 'number' && isNaN(n))) return 'N/A';
    return Number(n).toFixed(decimals) + '%';
  },

  fmtBRL(n) {
    if (n === null || n === undefined || (typeof n === 'number' && isNaN(n))) return 'N/A';
    const num = Number(n);
    if (num >= 1e9) return 'R$' + (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return 'R$' + (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return 'R$' + (num / 1e3).toFixed(1) + 'K';
    return 'R$' + num.toFixed(2);
  },

  fmtCompact(n) {
    if (n === null || n === undefined || isNaN(n)) return 'N/A';
    const num = Number(n);
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
  },

  round(n, dec) {
    dec = dec !== undefined ? dec : 2;
    if (n === null || n === undefined || isNaN(n)) return null;
    const factor = Math.pow(10, dec);
    return Math.round(Number(n) * factor) / factor;
  },

  // Safe numeric parser — handles currencies, commas, percent, spaces
  parseNum(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isNaN(v) || !isFinite(v) ? null : v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    // Remove currency symbols, commas, spaces, percent, BRL prefix
    let s = String(v).trim();
    s = s.replace(/^R\$\s*/i, '');
    s = s.replace(/[,\s]/g, '');
    s = s.replace(/%$/, '');
    s = s.replace(/[^\d.\-]/g, '');
    if (s === '' || s === '-' || s === '.') return null;
    const n = parseFloat(s);
    return isNaN(n) || !isFinite(n) ? null : n;
  },

  clamp(val, min, max) { return Math.min(Math.max(val, min), max); },

  debounce(fn, delay) {
    let t;
    return function() {
      const args = arguments;
      const ctx  = this;
      clearTimeout(t);
      t = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  },

  clone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch(e) { return obj; }
  },

  groupBy(arr, key) {
    if (!arr || !arr.length) return {};
    return arr.reduce(function(acc, item) {
      const k = item[key] !== null && item[key] !== undefined ? String(item[key]) : '__null__';
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  },

  sumBy(arr, key) {
    if (!arr) return 0;
    return arr.reduce(function(s, item) { return s + (Utils.parseNum(item[key]) || 0); }, 0);
  },

  avgBy(arr, key) {
    if (!arr || !arr.length) return null;
    const vals = arr.map(function(i) { return Utils.parseNum(i[key]); }).filter(function(v) { return v !== null; });
    return vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : null;
  },

  sortBy(arr, key, dir) {
    dir = dir || 'desc';
    return [...arr].sort(function(a, b) {
      const av = Utils.parseNum(a[key]);
      const bv = Utils.parseNum(b[key]);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return dir === 'desc' ? bv - av : av - bv;
    });
  },

  unique(arr) { return [...new Set(arr)]; },

  isNumeric(v) {
    if (v === null || v === undefined || v === '') return false;
    return !isNaN(parseFloat(String(v).replace(/[,\s%R$]/g, ''))) && isFinite(parseFloat(String(v).replace(/[,\s%R$]/g, '')));
  },

  riskColor(rate) {
    rate = Number(rate) || 0;
    if (rate >= 15) return '#FF4D6D';
    if (rate >= 12) return '#FF7832';
    if (rate >= 9)  return '#F59E0B';
    return '#2DD4BF';
  },

  hexToRgba(hex, alpha) {
    alpha = alpha !== undefined ? alpha : 1;
    if (!hex || hex.length < 7) return 'rgba(0,0,0,' + alpha + ')';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  },

  // Palette
  palette: ['#00E5FF','#8B5CF6','#2DD4BF','#F59E0B','#FF4D6D','#94A3B8','#A78BFA','#34D399','#FB923C','#60A5FA','#E879F9','#4ADE80'],

  paletteColor(i, alpha) {
    alpha = alpha !== undefined ? alpha : 1;
    const hex = Utils.palette[Math.abs(i) % Utils.palette.length];
    return alpha < 1 ? Utils.hexToRgba(hex, alpha) : hex;
  },

  paginate(arr, page, pageSize) {
    const start = (page - 1) * pageSize;
    return arr.slice(start, start + pageSize);
  },

  safeDivide(a, b) { return (!b || b === 0) ? 0 : a / b; },

  // Excel serial → JS Date
  excelDateToJS(serial) {
    if (!serial || isNaN(serial)) return null;
    const utc_days = Math.floor(serial - 25569);
    return new Date(utc_days * 86400 * 1000);
  },

  fmtDate(d) {
    if (!d) return '';
    if (typeof d === 'number') d = Utils.excelDateToJS(d);
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },

  detectType(values) {
    if (!values || !values.length) return 'empty';
    const nonNull = values.filter(function(v) { return v !== null && v !== undefined && v !== ''; });
    if (!nonNull.length) return 'empty';
    const numCount = nonNull.filter(function(v) { return Utils.isNumeric(v); }).length;
    if (numCount / nonNull.length > 0.8) return 'numeric';
    const dateCount = nonNull.filter(function(v) {
      if (typeof v === 'number' && v > 40000 && v < 65000) return true;
      const s = String(v);
      return /^\d{4}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s);
    }).length;
    if (dateCount / nonNull.length > 0.7) return 'date';
    const uniqueRatio = new Set(nonNull.map(function(v) { return String(v); })).size / nonNull.length;
    if (uniqueRatio < 0.05 && nonNull.length > 20) return 'categorical';
    if (uniqueRatio > 0.95 && nonNull.length > 10) return 'identifier';
    return 'text';
  },

  animateCounter(el, target, duration, format) {
    if (!el) return;
    duration = duration || 1200;
    format = format || 'number';
    const end = parseFloat(String(target).replace(/[^0-9.\-]/g, ''));
    if (isNaN(end)) { el.textContent = String(target); return; }
    const startTime = performance.now();
    function step(ts) {
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = end * ease;
      if (format === 'pct')       el.textContent = current.toFixed(2) + '%';
      else if (format === 'brl')  el.textContent = Utils.fmtBRL(current);
      else                        el.textContent = Utils.fmtNumber(Math.round(current));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  },

  toast(msg, type, duration) {
    type     = type     || 'info';
    duration = duration || 3500;
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = String(msg);
    container.appendChild(el);
    setTimeout(function() {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(function() { el.remove(); }, 350);
    }, duration);
  },

  escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

window.Utils = Utils;
