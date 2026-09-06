/* ============================================================
   CHART-ENGINE.JS — Chart.js wrapper — fixed data pipeline
   Every chart validates data before rendering.
   Uses chartRegistry to prevent duplicate instances.
   ============================================================ */
'use strict';

const DEBUG = (new URLSearchParams(window.location.search)).get('debug') === 'true';
const log = (...a) => DEBUG && console.log('[CHART]', ...a);

const ChartEngine = {

  registry: {},   // canvasId -> Chart instance

  // ── GLOBAL CHART DEFAULTS ─────────────────────────────────────
  baseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: {
          labels: { color: '#94A3B8', font: { family: 'Inter', size: 12 }, padding: 14 }
        },
        tooltip: {
          backgroundColor: 'rgba(6,14,32,0.96)',
          borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1,
          titleColor: '#fff', bodyColor: '#94A3B8',
          padding: 12, cornerRadius: 10,
          titleFont: { family: 'Inter', size: 13, weight: '600' },
          bodyFont:  { family: 'Inter', size: 12 }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
          border: { display: false }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
          border: { display: false }
        }
      }
    };
  },

  // ── CANVAS HELPERS ────────────────────────────────────────────
  getCanvas(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el) { log(`canvas #${canvasId} not found`); return null; }
    return el;
  },

  destroy(canvasId) {
    if (this.registry[canvasId]) {
      try { this.registry[canvasId].destroy(); } catch(e) {}
      delete this.registry[canvasId];
    }
    // Also check Chart.js internal registry
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      const existing = Chart.getChart(canvas);
      if (existing) { try { existing.destroy(); } catch(e) {} }
    }
  },

  register(canvasId, chart) {
    this.registry[canvasId] = chart;
    log(`registered chart on #${canvasId}, type=${chart.config.type}`);
    return chart;
  },

  // ── SHOW EMPTY STATE ──────────────────────────────────────────
  showEmpty(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const wrap = canvas.parentElement;
    canvas.style.display = 'none';
    const existing = wrap.querySelector('.chart-empty-state');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'chart-empty-state';
    div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:200px;color:#64748b;font-size:13px;text-align:center;padding:20px;';
    div.textContent = message || 'Not enough data for this visualization.';
    wrap.appendChild(div);
  },

  clearEmpty(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const wrap = canvas.parentElement;
    canvas.style.display = '';
    wrap.querySelector('.chart-empty-state')?.remove();
  },

  // ── VALIDATE DATA ─────────────────────────────────────────────
  validate(labels, values, chartType) {
    if (!labels || !labels.length) return 'No labels provided for chart.';
    if (!values || !values.length) return 'No values provided for chart.';
    const cleaned = values.filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));
    if (!cleaned.length) return 'All values are null, NaN or undefined.';
    return null; // OK
  },

  cleanValues(values) {
    return values.map(v => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
      return isNaN(n) || !isFinite(n) ? null : n;
    });
  },

  // ── BAR CHART ─────────────────────────────────────────────────
  bar(canvasId, labels, datasets, opts = {}) {
    this.destroy(canvasId);
    const canvas = this.getCanvas(canvasId);
    if (!canvas) return null;
    this.clearEmpty(canvasId);

    // Validate
    if (!labels || !labels.length) { this.showEmpty(canvasId, 'No category data available.'); return null; }

    const cleanDatasets = datasets.map((d, i) => {
      const cleanData = this.cleanValues(d.data || []);
      return {
        label:           d.label || `Series ${i+1}`,
        data:            cleanData,
        backgroundColor: d.backgroundColor || Utils.paletteColor(i, 0.72),
        borderColor:     d.borderColor || Utils.paletteColor(i, 1),
        borderWidth:     d.borderWidth ?? 0,
        borderRadius:    d.borderRadius ?? 4,
        borderSkipped:   false,
      };
    });

    const err = this.validate(labels, cleanDatasets[0]?.data || [], 'bar');
    if (err) { this.showEmpty(canvasId, err); return null; }

    log(`bar chart: ${labels.length} labels, ${cleanDatasets.length} datasets`);

    const options = this.baseOptions();
    options.plugins.legend.display = cleanDatasets.length > 1;
    options.scales.x.stacked = opts.stacked || false;
    options.scales.y.stacked = opts.stacked || false;
    options.scales.y.beginAtZero = true;
    if (opts.scales) this._mergeScales(options.scales, opts.scales);
    if (opts.plugins) this._mergePlugins(options.plugins, opts.plugins);
    if (opts.indexAxis) options.indexAxis = opts.indexAxis;

    const chart = new Chart(canvas, { type: 'bar', data: { labels, datasets: cleanDatasets }, options });
    return this.register(canvasId, chart);
  },

  // ── HORIZONTAL BAR ────────────────────────────────────────────
  horizontalBar(canvasId, labels, values, opts = {}) {
    this.destroy(canvasId);
    const canvas = this.getCanvas(canvasId);
    if (!canvas) return null;
    this.clearEmpty(canvasId);

    if (!labels || !labels.length || !values || !values.length) {
      this.showEmpty(canvasId, 'No data available for this chart.'); return null;
    }

    const cleanData = this.cleanValues(values);
    const colors = labels.map((_, i) => Utils.paletteColor(i, 0.72));

    const options = this.baseOptions();
    options.indexAxis = 'y';
    options.plugins.legend.display = false;
    options.scales.x.beginAtZero = true;
    options.scales.y.grid = { display: false };
    if (opts.scales) this._mergeScales(options.scales, opts.scales);
    if (opts.plugins) this._mergePlugins(options.plugins, opts.plugins);

    log(`horizontalBar: ${labels.length} items`);
    const chart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: opts.label || 'Value', data: cleanData, backgroundColor: colors, borderRadius: 4 }] },
      options
    });
    return this.register(canvasId, chart);
  },

  // ── LINE CHART ────────────────────────────────────────────────
  line(canvasId, labels, datasets, opts = {}) {
    this.destroy(canvasId);
    const canvas = this.getCanvas(canvasId);
    if (!canvas) return null;
    this.clearEmpty(canvasId);

    if (!labels || !labels.length) { this.showEmpty(canvasId, 'No time data available.'); return null; }

    const cleanDatasets = datasets.map((d, i) => ({
      label:           d.label || `Series ${i+1}`,
      data:            this.cleanValues(d.data || []),
      borderColor:     d.color || Utils.paletteColor(i),
      backgroundColor: d.fill ? Utils.hexToRgba(d.color || Utils.paletteColor(i), 0.15) : 'transparent',
      pointRadius:     d.pointRadius ?? 4,
      pointHoverRadius: 6,
      tension:         d.tension ?? 0.4,
      borderWidth:     d.borderWidth ?? 2.5,
      fill:            d.fill || false,
      yAxisID:         d.yAxisID || undefined,
    }));

    const err = this.validate(labels, cleanDatasets[0]?.data || [], 'line');
    if (err) { this.showEmpty(canvasId, err); return null; }

    const options = this.baseOptions();
    options.plugins.legend.display = cleanDatasets.length > 1;
    options.scales.y.beginAtZero = opts.beginAtZero ?? false;
    if (opts.scales) this._mergeScales(options.scales, opts.scales);
    if (opts.plugins) this._mergePlugins(options.plugins, opts.plugins);

    log(`line chart: ${labels.length} labels`);
    const chart = new Chart(canvas, { type: 'line', data: { labels, datasets: cleanDatasets }, options });
    return this.register(canvasId, chart);
  },

  // ── AREA CHART ────────────────────────────────────────────────
  area(canvasId, labels, datasets, opts = {}) {
    return this.line(canvasId, labels, datasets.map(d => ({ ...d, fill: true })), opts);
  },

  // ── DOUGHNUT / PIE ────────────────────────────────────────────
  doughnut(canvasId, labels, values, opts = {}) {
    this.destroy(canvasId);
    const canvas = this.getCanvas(canvasId);
    if (!canvas) return null;
    this.clearEmpty(canvasId);

    if (!labels || !labels.length || !values || !values.length) {
      this.showEmpty(canvasId, 'No composition data available.'); return null;
    }
    const cleanValues = this.cleanValues(values);
    const validPairs = labels.map((l, i) => ({ l, v: cleanValues[i] })).filter(p => p.v !== null && p.v > 0);
    if (!validPairs.length) { this.showEmpty(canvasId, 'No positive values found.'); return null; }

    const colors = validPairs.map((_, i) => Utils.paletteColor(i, 0.82));
    const options = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      cutout: opts.pie ? '0%' : '62%',
      plugins: {
        legend: { position: opts.legendPosition || 'right', labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 }, padding: 12 } },
        tooltip: { backgroundColor: 'rgba(6,14,32,0.96)', borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, titleColor: '#fff', bodyColor: '#94A3B8', padding: 12 }
      }
    };
    if (opts.plugins) this._mergePlugins(options.plugins, opts.plugins);

    log(`doughnut: ${validPairs.length} slices`);
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels: validPairs.map(p => p.l), datasets: [{ data: validPairs.map(p => p.v), backgroundColor: colors, borderColor: 'rgba(0,0,0,0.2)', borderWidth: 1 }] },
      options
    });
    return this.register(canvasId, chart);
  },

  pie(canvasId, labels, values, opts = {}) {
    return this.doughnut(canvasId, labels, values, { ...opts, pie: true });
  },

  // ── SCATTER ──────────────────────────────────────────────────
  scatter(canvasId, datasets, opts = {}) {
    this.destroy(canvasId);
    const canvas = this.getCanvas(canvasId);
    if (!canvas) return null;
    this.clearEmpty(canvasId);

    const cleanDatasets = datasets.map((d, i) => {
      const pts = (d.data || []).filter(p => p && p.x !== null && p.y !== null && !isNaN(p.x) && !isNaN(p.y) && isFinite(p.x) && isFinite(p.y));
      return {
        label: d.label || `Series ${i+1}`,
        data: pts,
        backgroundColor: d.color ? Utils.hexToRgba(d.color, 0.6) : Utils.paletteColor(i, 0.6),
        borderColor:     d.color || Utils.paletteColor(i),
        pointRadius:     d.radius || 5,
        pointHoverRadius: 7,
      };
    });
    const totalPts = cleanDatasets.reduce((s, d) => s + d.data.length, 0);
    if (!totalPts) { this.showEmpty(canvasId, 'Not enough valid x,y pairs for scatter plot.'); return null; }

    const options = this.baseOptions();
    options.plugins.legend.display = cleanDatasets.length > 1;
    options.scales.x.title = { display: true, text: opts.xLabel || 'X', color: '#64748b' };
    options.scales.y.title = { display: true, text: opts.yLabel || 'Y', color: '#64748b' };
    if (opts.scales) this._mergeScales(options.scales, opts.scales);
    if (opts.plugins) this._mergePlugins(options.plugins, opts.plugins);

    log(`scatter: ${totalPts} points across ${cleanDatasets.length} datasets`);
    const chart = new Chart(canvas, { type: 'scatter', data: { datasets: cleanDatasets }, options });
    return this.register(canvasId, chart);
  },

  // ── BUBBLE ────────────────────────────────────────────────────
  bubble(canvasId, datasets, opts = {}) {
    this.destroy(canvasId);
    const canvas = this.getCanvas(canvasId);
    if (!canvas) return null;
    this.clearEmpty(canvasId);

    const cleanDatasets = datasets.map((d, i) => {
      const pts = (d.data || []).filter(p => p && !isNaN(p.x) && !isNaN(p.y) && isFinite(p.x) && isFinite(p.y))
        .map(p => ({ x: p.x, y: p.y, r: Math.max(4, Math.min(40, p.r || 8)), label: p.label || '' }));
      return {
        label: d.label || `Series ${i+1}`,
        data:  pts,
        backgroundColor: d.color ? Utils.hexToRgba(d.color, 0.65) : Utils.paletteColor(i, 0.65),
        borderColor:     d.color || Utils.paletteColor(i),
        borderWidth: 1,
      };
    });
    const totalPts = cleanDatasets.reduce((s, d) => s + d.data.length, 0);
    if (!totalPts) { this.showEmpty(canvasId, 'Not enough valid data for bubble chart.'); return null; }

    const options = this.baseOptions();
    options.plugins.legend.display = cleanDatasets.length > 1;
    if (opts.tooltipLabel) {
      options.plugins.tooltip.callbacks = { label: opts.tooltipLabel };
    } else {
      options.plugins.tooltip.callbacks = {
        label: ctx => `${ctx.raw.label || ctx.dataset.label}: (${ctx.raw.x.toFixed(1)}, ${ctx.raw.y.toFixed(2)})`
      };
    }
    options.scales.x.title = { display: true, text: opts.xLabel || 'X', color: '#64748b' };
    options.scales.y.title = { display: true, text: opts.yLabel || 'Y', color: '#64748b' };
    if (opts.scales) this._mergeScales(options.scales, opts.scales);

    log(`bubble: ${totalPts} bubbles`);
    const chart = new Chart(canvas, { type: 'bubble', data: { datasets: cleanDatasets }, options });
    return this.register(canvasId, chart);
  },

  // ── RADAR ─────────────────────────────────────────────────────
  radar(canvasId, labels, datasets, opts = {}) {
    this.destroy(canvasId);
    const canvas = this.getCanvas(canvasId);
    if (!canvas) return null;
    this.clearEmpty(canvasId);

    if (!labels || labels.length < 3) { this.showEmpty(canvasId, 'Radar chart needs at least 3 data points.'); return null; }

    const cleanDatasets = datasets.map((d, i) => ({
      label: d.label || `Series ${i+1}`,
      data:  this.cleanValues(d.data || []),
      borderColor:     d.color || Utils.paletteColor(i),
      backgroundColor: Utils.hexToRgba(d.color || Utils.paletteColor(i), 0.15),
      pointBackgroundColor: d.color || Utils.paletteColor(i),
      borderWidth: 2,
    }));

    const options = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: {
        legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 12 } } },
        tooltip: { backgroundColor: 'rgba(6,14,32,0.96)', borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, titleColor: '#fff', bodyColor: '#94A3B8', padding: 12 }
      },
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,0.08)' },
          ticks: { color: '#64748b', backdropColor: 'transparent', font: { size: 10 } },
          pointLabels: { color: '#94A3B8', font: { size: 11, family: 'Inter' } }
        }
      }
    };

    log(`radar: ${labels.length} dimensions`);
    const chart = new Chart(canvas, { type: 'radar', data: { labels, datasets: cleanDatasets }, options });
    return this.register(canvasId, chart);
  },

  // ── HISTOGRAM (built with bar chart) ─────────────────────────
  histogram(canvasId, values, opts = {}) {
    this.destroy(canvasId);
    const canvas = this.getCanvas(canvasId);
    if (!canvas) return null;
    this.clearEmpty(canvasId);

    const cleaned = values.filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (cleaned.length < 5) { this.showEmpty(canvasId, `Not enough numeric values for histogram (found ${cleaned.length}, need 5+).`); return null; }

    const bins = opts.bins || Math.min(20, Math.max(5, Math.ceil(Math.sqrt(cleaned.length))));
    const hist = StatisticsEngine.histogram(cleaned, bins);
    const mean = hist.min + hist.width * (cleaned.reduce((a, b) => a + b, 0) / cleaned.length - hist.min) / hist.width;

    log(`histogram: ${cleaned.length} values → ${bins} bins`);

    const options = this.baseOptions();
    options.plugins.legend.display = false;
    options.scales.x.title = { display: true, text: opts.xLabel || 'Value', color: '#64748b' };
    options.scales.y.title = { display: true, text: 'Frequency', color: '#64748b' };
    options.scales.y.beginAtZero = true;
    options.scales.x.grid = { display: false };

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: hist.bins.map(b => b.toFixed(1)),
        datasets: [{
          label: 'Frequency',
          data:  hist.counts,
          backgroundColor: 'rgba(0,229,255,0.58)',
          borderColor:     '#00E5FF',
          borderWidth:     1,
          borderRadius:    2,
          categoryPercentage: 1.0,
          barPercentage:   0.95,
        }]
      },
      options
    });
    return this.register(canvasId, chart);
  },

  // ── BOXPLOT (custom SVG renderer — no plugin needed) ──────────
  boxplotSVG(containerId, groups) {
    // groups: [{label, stats: {min,q1,q2,q3,max,outliers:[]}}]
    const container = document.getElementById(containerId);
    if (!container || !groups || !groups.length) return;

    const W = container.offsetWidth || 600;
    const H = 280;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const allVals = groups.flatMap(g => [g.stats.min, g.stats.max, ...(g.stats.outliers||[])]);
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;

    const yScale = v => innerH - ((v - minV) / range) * innerH;
    const boxW = Math.min(40, innerW / groups.length * 0.6);
    const xStep = innerW / (groups.length + 1);

    const ticks = [];
    for (let i = 0; i <= 5; i++) ticks.push(minV + (range * i / 5));

    let svg = `<svg width="${W}" height="${H}" style="overflow:visible">
      <g transform="translate(${margin.left},${margin.top})">`;

    // Grid lines
    ticks.forEach(t => {
      const y = yScale(t);
      svg += `<line x1="0" y1="${y}" x2="${innerW}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3,3"/>`;
      svg += `<text x="-6" y="${y+4}" fill="#64748b" font-size="10" text-anchor="end">${t.toFixed(1)}</text>`;
    });

    // Each box
    groups.forEach((g, i) => {
      const x = xStep * (i + 1);
      const s = g.stats;
      const q1y = yScale(s.q1), q3y = yScale(s.q3);
      const medy = yScale(s.q2);
      const miny = yScale(s.whiskerLow ?? s.min);
      const maxy = yScale(s.whiskerHigh ?? s.max);
      const left = x - boxW / 2, right = x + boxW / 2;

      svg += `<!-- ${g.label} box -->`;
      svg += `<rect x="${left}" y="${q3y}" width="${boxW}" height="${Math.max(1,q1y-q3y)}" fill="rgba(0,229,255,0.2)" stroke="#00E5FF" stroke-width="1.5" rx="2"/>`;
      svg += `<line x1="${left}" y1="${medy}" x2="${right}" y2="${medy}" stroke="#00E5FF" stroke-width="2"/>`;
      svg += `<line x1="${x}" y1="${maxy}" x2="${x}" y2="${q3y}" stroke="#94A3B8" stroke-width="1.5"/>`;
      svg += `<line x1="${x}" y1="${q1y}" x2="${x}" y2="${miny}" stroke="#94A3B8" stroke-width="1.5"/>`;
      svg += `<line x1="${left}" y1="${maxy}" x2="${right}" y2="${maxy}" stroke="#94A3B8" stroke-width="1.5"/>`;
      svg += `<line x1="${left}" y1="${miny}" x2="${right}" y2="${miny}" stroke="#94A3B8" stroke-width="1.5"/>`;
      (s.outliers || []).forEach(ov => {
        svg += `<circle cx="${x}" cy="${yScale(ov)}" r="3" fill="rgba(255,77,109,0.7)" stroke="#FF4D6D" stroke-width="1"/>`;
      });
      svg += `<text x="${x}" y="${innerH+20}" fill="#94A3B8" font-size="11" text-anchor="middle" font-family="Inter">${Utils.escapeHtml(String(g.label).substring(0,12))}</text>`;
    });

    svg += `</g></svg>`;
    container.innerHTML = svg;
  },

  // ── HEATMAP (custom canvas renderer) ─────────────────────────
  heatmap(containerId, rows, cols, getVal, opts = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cellW = opts.cellW || 64;
    const cellH = opts.cellH || 36;
    const labelW = opts.labelW || 60;
    const headerH = 30;
    const totalW = labelW + cols.length * cellW;
    const totalH = headerH + rows.length * cellH;

    const onCellClick = opts.onClick;
    const getColor = opts.getColor || (v => {
      if (v === null || v === undefined) return 'rgba(255,255,255,0.04)';
      if (v > 7) return 'rgba(255,77,109,0.75)';
      if (v > 4) return 'rgba(255,120,50,0.65)';
      if (v > 2) return 'rgba(245,158,11,0.55)';
      if (v > 0) return 'rgba(245,158,11,0.28)';
      return 'rgba(45,212,191,0.35)';
    });
    const fmtCell = opts.fmtCell || (v => v !== null ? (typeof v === 'number' ? v.toFixed(1) : v) : '—');

    let html = `<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:11px;min-width:${totalW}px">
      <thead><tr><th style="width:${labelW}px;padding:5px 8px;color:#64748b;text-align:left;font-weight:500"></th>
        ${cols.map(c => `<th style="width:${cellW}px;padding:5px 4px;color:#64748b;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:${cellW}px" title="${Utils.escapeHtml(String(c))}">${Utils.escapeHtml(String(c).substring(0, 10))}</th>`).join('')}
      </tr></thead><tbody>`;

    rows.forEach((row, ri) => {
      html += `<tr><td style="padding:4px 8px;font-weight:700;font-size:12px;color:#94A3B8;white-space:nowrap">${Utils.escapeHtml(String(row))}</td>`;
      cols.forEach((col, ci) => {
        const val = getVal(row, col, ri, ci);
        const bg = getColor(val);
        const txt = fmtCell(val);
        const cursor = onCellClick ? 'cursor:pointer' : '';
        html += `<td style="width:${cellW}px;height:${cellH}px;background:${bg};text-align:center;font-weight:600;color:#fff;border:1px solid rgba(255,255,255,0.04);${cursor}" data-row="${ri}" data-col="${ci}" title="${Utils.escapeHtml(String(row))} × ${Utils.escapeHtml(String(col))}: ${txt}">${txt}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    if (opts.legend !== false) {
      html += `<div style="display:flex;gap:12px;margin-top:10px;font-size:11px;color:#64748b;flex-wrap:wrap">
        ${[['Below 0 (below baseline)','rgba(45,212,191,0.35)'],['0–2 pp','rgba(245,158,11,0.28)'],['2–4 pp','rgba(245,158,11,0.55)'],['4–7 pp','rgba(255,120,50,0.65)'],['7+ pp (severe)','rgba(255,77,109,0.75)']].map(([l,c]) =>
          `<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border-radius:2px;background:${c};display:inline-block"></span>${l}</span>`).join('')}
      </div>`;
    }

    container.innerHTML = html;

    if (onCellClick) {
      container.querySelectorAll('td[data-row]').forEach(td => {
        td.addEventListener('click', () => {
          const ri = +td.dataset.row, ci = +td.dataset.col;
          onCellClick(rows[ri], cols[ci], getVal(rows[ri], cols[ci], ri, ci));
        });
        td.addEventListener('mouseenter', () => td.style.filter = 'brightness(1.3)');
        td.addEventListener('mouseleave', () => td.style.filter = '');
      });
    }
  },

  // ── TREEMAP (custom HTML/CSS renderer) ───────────────────────
  treemap(containerId, items, opts = {}) {
    // items: [{label, value, color?}]
    const container = document.getElementById(containerId);
    if (!container || !items || !items.length) return;

    const validItems = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value).slice(0, 30);
    if (!validItems.length) { container.innerHTML = '<div class="empty-state" style="height:200px"><div class="empty-desc">No data for treemap.</div></div>'; return; }

    const total = validItems.reduce((s, i) => s + i.value, 0);
    const W = container.offsetWidth || 600;
    const H = opts.height || 300;

    // Squarified treemap algorithm
    const rects = this._squarify(validItems, 0, 0, W, H, total);

    let html = `<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;border-radius:8px">`;
    rects.forEach((r, i) => {
      const item = validItems[i];
      const color = item.color || Utils.paletteColor(i, 0.75);
      const pct = ((item.value / total) * 100).toFixed(1);
      html += `<div style="position:absolute;left:${r.x}px;top:${r.y}px;width:${Math.max(1,r.w-2)}px;height:${Math.max(1,r.h-2)}px;background:${color};border-radius:4px;overflow:hidden;padding:6px;box-sizing:border-box;cursor:default;transition:filter .15s" title="${Utils.escapeHtml(item.label)}: ${Utils.fmtNumber(item.value)} (${pct}%)" onmouseenter="this.style.filter='brightness(1.2)'" onmouseleave="this.style.filter=''">
        ${r.w > 60 && r.h > 30 ? `<div style="font-size:${Math.min(13, Math.max(9, r.w/10))}px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.escapeHtml(String(item.label).substring(0,20))}</div>` : ''}
        ${r.w > 60 && r.h > 48 ? `<div style="font-size:10px;color:rgba(255,255,255,0.7);margin-top:2px">${Utils.fmtCompact(item.value)}</div>` : ''}
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  },

  _squarify(items, x, y, w, h, total) {
    if (!items.length) return [];
    if (items.length === 1) return [{ x, y, w, h }];
    const half = Math.floor(items.length / 2);
    const sum1 = items.slice(0, half).reduce((s, i) => s + i.value, 0);
    const sum2 = items.slice(half).reduce((s, i) => s + i.value, 0);
    const ratio = sum1 / total;
    let rects1, rects2;
    if (w >= h) {
      const w1 = Math.round(w * ratio);
      rects1 = this._squarify(items.slice(0, half), x, y, w1, h, sum1);
      rects2 = this._squarify(items.slice(half), x + w1, y, w - w1, h, sum2);
    } else {
      const h1 = Math.round(h * ratio);
      rects1 = this._squarify(items.slice(0, half), x, y, w, h1, sum1);
      rects2 = this._squarify(items.slice(half), x, y + h1, w, h - h1, sum2);
    }
    return [...rects1, ...rects2];
  },

  // ── CORRELATION MATRIX (HTML table) ──────────────────────────
  correlationTable(containerId, corrMatrix, onCellClick) {
    const container = document.getElementById(containerId);
    if (!container || !corrMatrix) { if (container) container.innerHTML = '<div class="empty-state" style="height:160px"><div class="empty-desc">At least 2 numeric columns required.</div></div>'; return; }

    const cols = corrMatrix.columns;
    let html = `<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:11px">
      <thead><tr><th style="padding:6px 10px;color:#64748b;text-align:left"></th>
        ${cols.map(c => `<th style="padding:5px 8px;color:#64748b;font-weight:500;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c.substring(0,10))}</th>`).join('')}
      </tr></thead><tbody>`;

    cols.forEach(row => {
      html += `<tr><th style="padding:5px 10px;color:#94A3B8;text-align:right;font-weight:500;white-space:nowrap;font-size:11px">${Utils.escapeHtml(row.substring(0,12))}</th>`;
      cols.forEach(col => {
        const r = CorrelationEngine.getCorrelation(corrMatrix, row, col);
        const bg = CorrelationEngine.correlationColor(r);
        const txt = r !== null ? r.toFixed(2) : '—';
        const cursor = onCellClick ? 'cursor:pointer' : '';
        html += `<td style="width:52px;height:34px;text-align:center;background:${bg};font-weight:600;color:#fff;border:1px solid rgba(255,255,255,0.04);${cursor}" title="${Utils.escapeHtml(row)} × ${Utils.escapeHtml(col)}: ${txt}" data-r1="${Utils.escapeHtml(row)}" data-r2="${Utils.escapeHtml(col)}">${txt}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div style="margin-top:8px;font-size:11px;color:#64748b;font-style:italic">⚠ Correlation does not imply causation.</div>';
    container.innerHTML = html;

    if (onCellClick) {
      container.querySelectorAll('td[data-r1]').forEach(td => {
        td.addEventListener('click', () => {
          const r = CorrelationEngine.getCorrelation(corrMatrix, td.dataset.r1, td.dataset.r2);
          onCellClick(td.dataset.r1, td.dataset.r2, r);
        });
        td.addEventListener('mouseenter', () => td.style.filter = 'brightness(1.35)');
        td.addEventListener('mouseleave', () => td.style.filter = '');
      });
    }
  },

  // ── EXPORT PNG ────────────────────────────────────────────────
  exportPNG(canvasId, filename) {
    const chart = this.registry[canvasId];
    if (!chart) { Utils.toast('No chart to export', 'error'); return; }
    const link = document.createElement('a');
    link.download = (filename || canvasId) + '.png';
    link.href = chart.canvas.toDataURL('image/png');
    link.click();
    Utils.toast('Chart exported', 'success');
  },

  // ── FULLSCREEN ────────────────────────────────────────────────
  openFullscreen(title, desc, chartFn) {
    const overlay = document.getElementById('fullscreen-overlay');
    if (!overlay) return;
    document.getElementById('fullscreen-title').textContent = title || '';
    document.getElementById('fullscreen-desc').textContent  = desc  || '';
    overlay.style.display = 'flex';
    this.destroy('fullscreen-canvas');
    setTimeout(() => chartFn('fullscreen-canvas'), 80);
    document.getElementById('fullscreen-close').onclick = () => {
      overlay.style.display = 'none';
      this.destroy('fullscreen-canvas');
    };
  },

  // ── SCALE / PLUGIN MERGE ─────────────────────────────────────
  _mergeScales(target, source) {
    Object.entries(source || {}).forEach(([k, v]) => {
      if (!target[k]) target[k] = {};
      Object.assign(target[k], v);
    });
  },

  _mergePlugins(target, source) {
    Object.entries(source || {}).forEach(([k, v]) => {
      if (!target[k]) target[k] = {};
      if (typeof v === 'object' && !Array.isArray(v)) Object.assign(target[k], v);
      else target[k] = v;
    });
  },

  // Expose hexToRgba for external use
  hexToRgba: (hex, alpha) => Utils.hexToRgba(hex, alpha)
};

window.ChartEngine = ChartEngine;
