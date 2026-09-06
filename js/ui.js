'use strict';
/* ============================================================
   UI.JS — All page renderers. Uses ChartEngine exclusively.
   Never calls new Chart() directly — always via ChartEngine.
   ============================================================ */

const DEBUG = (new URLSearchParams(window.location.search)).get('debug') === 'true';
const uilog = (...a) => DEBUG && console.log('[UI]', ...a);

const UI = {

  /* ── SHARED HELPERS ─────────────────────────────────────── */

  _chartWrap(id, title, subtitle, source, height) {
    const h = height || 280;
    return `<div class="chart-container">
      <div class="chart-header">
        <div>
          <div class="chart-title">${Utils.escapeHtml(title)}</div>
          <div class="chart-subtitle">${Utils.escapeHtml(subtitle)}</div>
          <div class="chart-source">SOURCE: ${Utils.escapeHtml(source)}</div>
        </div>
        <div class="chart-toolbar">
          <button class="chart-tool-btn" onclick="ChartEngine.exportPNG('${id}','${id}')" title="Download PNG">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="chart-tool-btn" onclick="UI._openFull('${id}')" title="Fullscreen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>
        </div>
      </div>
      <div class="chart-body" style="height:${h}px;position:relative;padding:0 4px 4px">
        <canvas id="${id}" style="width:100%;height:100%"></canvas>
      </div>
    </div>`;
  },

  _openFull(id) {
    const chart = ChartEngine.registry[id];
    if (!chart) { Utils.toast('No chart to expand', 'error'); return; }
    const cfg = chart.config;
    ChartEngine.openFullscreen(
      document.querySelector(`#${id}`)?.closest('.chart-container')?.querySelector('.chart-title')?.textContent || id,
      '',
      (canvasId) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        canvas.style.height = '100%';
        // Clone the chart onto the fullscreen canvas
        new Chart(canvas, { type: cfg.type, data: cfg.data, options: { ...cfg.options, animation: { duration: 0 } } });
      }
    );
  },

  _kpiCard(icon, value, label, sub, color) {
    color = color || '#00E5FF';
    return `<div class="kpi-card" style="--kpi-color:${color}">
      <div class="kpi-icon-wrap" style="background:${color}18">${icon}</div>
      <div class="kpi-value" style="color:${color}">${Utils.escapeHtml(String(value))}</div>
      <div class="kpi-label">${Utils.escapeHtml(label)}</div>
      ${sub ? `<div class="kpi-sub">${Utils.escapeHtml(sub)}</div>` : ''}
    </div>`;
  },

  _insightBox(text, type) {
    const cls = type === 'warn' ? 'warning' : type === 'crit' ? 'critical' : '';
    return `<div class="chart-insight ${cls}">${Utils.escapeHtml(text)}</div>`;
  },

  _riskBadge(rate) {
    const cls = rate >= 15 ? 'risk-critical' : rate >= 12 ? 'risk-high' : rate >= 9 ? 'risk-medium' : 'risk-strong';
    const lbl = rate >= 15 ? 'CRITICAL' : rate >= 12 ? 'HIGH' : rate >= 9 ? 'MEDIUM' : 'STRONG';
    return `<span class="risk-badge ${cls}">${lbl}</span>`;
  },

  _noData(msg) {
    return `<div class="error-state" style="min-height:200px">
      <div class="error-title">Data Unavailable</div>
      <div class="error-desc">${Utils.escapeHtml(msg || 'No data found for this section.')}</div>
    </div>`;
  },

  /* ── ICON SVG SNIPPETS ───────────────────────────────────── */
  _ico: {
    pkg:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>',
    pay:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    alert:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    sel:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    zap:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    clk:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  },

  /* ═══════════════════════════════════════════════════════════
     COMMAND CENTER
  ══════════════════════════════════════════════════════════ */
  renderCommandCenter(container) {
    const kpis = AnalysisEngine.getExecutiveKPIs();

    let kpiHtml = '';
    if (kpis) {
      kpiHtml = `<div class="kpi-grid" style="margin-bottom:22px">
        ${this._kpiCard(this._ico.pkg,  Utils.fmtNumber(kpis.totalOrders),    'Total Orders',       'Full marketplace dataset',    '#00E5FF')}
        ${this._kpiCard(this._ico.pay,  Utils.fmtBRL(kpis.productValue),      'Product Value',      'Sum of order/item prices',    '#8B5CF6')}
        ${this._kpiCard(this._ico.star, kpis.avgReview ? kpis.avgReview+' ★' : 'N/A', 'Average Review', 'Overall marketplace score', '#2DD4BF')}
        ${this._kpiCard(this._ico.alert,Utils.fmtPct(kpis.lateRate),          'Late Delivery Rate', 'Of analyzed orders',          '#FF4D6D')}
      </div>`;
    } else {
      kpiHtml = this._noData('Olist workbook not loaded. Place Olist_Final_Analytical_Workbook.xlsx in public/data/ and serve over HTTP.');
    }

    container.innerHTML = `
      <div style="margin-bottom:22px">
        <div style="font-family:'Instrument Serif',serif;font-size:10px;color:#00E5FF;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px">Marketplace Intelligence</div>
        <div style="font-family:'Instrument Serif',serif;font-size:34px;font-weight:400;line-height:1.2">See the signal. <em style="color:#00E5FF">Find the risk.</em> Take action.</div>
        <div style="font-size:13px;color:#94A3B8;margin-top:8px">Customer Experience · Operations · Growth</div>
      </div>
      ${kpiHtml}

      <!-- Monthly chart with toggle -->
      <div class="chart-container" style="margin-bottom:20px">
        <div class="chart-header">
          <div>
            <div class="chart-title">Marketplace Scale vs Customer Experience</div>
            <div class="chart-subtitle">Monthly order volume and average review score</div>
            <div class="chart-source">SOURCE: monthly / order_master</div>
          </div>
          <div class="chart-toolbar">
            <div class="chart-type-selector" id="monthly-toggle">
              <button class="chart-type-btn active" data-view="monthly">Monthly</button>
              <button class="chart-type-btn" data-view="quarterly">Quarterly</button>
            </div>
            <button class="chart-tool-btn" onclick="ChartEngine.exportPNG('chart-monthly','marketplace-scale')" title="Download PNG">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        </div>
        <div class="chart-body" style="height:280px;position:relative;padding:0 4px 4px">
          <canvas id="chart-monthly" style="width:100%;height:100%"></canvas>
        </div>
        ${this._insightBox('Growth did not consistently translate into stronger customer experience. Statistical association — not proven causation.')}
      </div>

      <div class="grid-2" style="margin-bottom:20px">
        ${this._chartWrap('chart-pain-mini','Customer Pain Curve','Avg review score by delivery timing','delivery_summary',220)}
        ${this._chartWrap('chart-state-mini','Geographic Risk Leaders','Late delivery rate by state','state_risk',220)}
      </div>

      <div class="insight-panel" style="margin-bottom:20px">
        <div class="insight-panel-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Key Analytical Findings
        </div>
        <div id="cmd-insights">Loading insights…</div>
      </div>`;

    // Animate KPI numbers
    if (kpis) {
      setTimeout(() => {
        container.querySelectorAll('.kpi-value').forEach(el => {
          const txt = el.textContent;
          const num = parseFloat(txt.replace(/[^0-9.]/g,''));
          if (!isNaN(num) && num > 100) {
            const prefix = txt.startsWith('R$') ? 'R$' : '';
            const suffix = txt.endsWith('%') ? '%' : txt.endsWith('★') ? '★' : '';
            el.textContent = txt; // keep as is — already formatted
          }
        });
      }, 50);

      // Draw charts
      setTimeout(() => {
        this._drawMonthlyChart('monthly');
        this._drawPainMiniChart();
        this._drawStateMiniChart();

        // Toggle buttons
        document.getElementById('monthly-toggle')?.querySelectorAll('.chart-type-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            document.getElementById('monthly-toggle').querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._drawMonthlyChart(btn.dataset.view);
          });
        });

        // Insights
        const insights = InsightEngine.generateOlistInsights();
        InsightEngine.renderInsights(document.getElementById('cmd-insights'), insights);
      }, 100);
    } else {
      document.getElementById('cmd-insights').innerHTML = '';
    }
  },

  _drawMonthlyChart(view) {
    let monthly = AnalysisEngine.getMonthlyPerformance();
    if (!monthly || !monthly.length) {
      ChartEngine.showEmpty('chart-monthly', 'Monthly data not found in workbook.'); return;
    }

    let data = monthly;
    if (view === 'quarterly') {
      const qmap = {};
      monthly.forEach(m => {
        const k = m.month || m.label || '';
        const parts = k.split('-');
        if (parts.length < 2) return;
        const y = parts[0];
        const mo = parseInt(parts[1], 10);
        if (isNaN(mo)) return;
        const q = `${y}-Q${Math.ceil(mo / 3)}`;
        if (!qmap[q]) qmap[q] = { label: q, orders: 0, revSum: 0, revCnt: 0, productValue: 0 };
        qmap[q].orders += m.orders || 0;
        qmap[q].productValue += m.productValue || 0;
        const r = Utils.parseNum(m.avgReview || m.avg_review);
        if (r) { qmap[q].revSum += r; qmap[q].revCnt++; }
      });
      data = Object.values(qmap).sort((a, b) => a.label.localeCompare(b.label))
        .map(q => ({ ...q, avgReview: q.revCnt ? Utils.round(q.revSum / q.revCnt, 2) : null }));
    }

    const labels  = data.map(m => m.month || m.label || '');
    const orders  = data.map(m => m.orders || m.order_count || 0);
    const reviews = data.map(m => {
      const v = Utils.parseNum(m.avgReview || m.avg_review || m.review_score);
      return (v !== null && v >= 1 && v <= 5) ? v : null;
    });

    uilog('monthly chart labels:', labels.length, 'orders sample:', orders.slice(0,3));

    ChartEngine.destroy('chart-monthly');
    const canvas = document.getElementById('chart-monthly');
    if (!canvas) return;
    ChartEngine.clearEmpty('chart-monthly');

    const hasReviews = reviews.some(v => v !== null);
    const datasets = [
      {
        type: 'bar', label: 'Orders', data: orders,
        backgroundColor: 'rgba(0,229,255,0.45)', borderColor: '#00E5FF',
        borderWidth: 0, borderRadius: 3, yAxisID: 'y',
      }
    ];
    if (hasReviews) {
      datasets.push({
        type: 'line', label: 'Avg Review', data: reviews,
        borderColor: '#A855F7', backgroundColor: 'transparent',
        pointRadius: 3, pointHoverRadius: 5, tension: 0.4,
        borderWidth: 2.5, fill: false, yAxisID: 'y2',
      });
    }

    const chart = new Chart(canvas, {
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
        plugins: {
          legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 12 }, padding: 14 } },
          tooltip: { backgroundColor: 'rgba(6,14,32,0.96)', borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, titleColor: '#fff', bodyColor: '#94A3B8', padding: 12, cornerRadius: 10 }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10, family: 'Inter' }, maxRotation: 45 }, border: { display: false } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10, family: 'Inter' } }, border: { display: false }, beginAtZero: true },
          ...(hasReviews ? { y2: { position: 'right', min: 1, max: 5, grid: { display: false }, ticks: { color: '#A855F7', font: { size: 10, family: 'Inter' } }, border: { display: false } } } : {})
        }
      }
    });
    ChartEngine.registry['chart-monthly'] = chart;
  },

  _drawPainMiniChart() {
    const pain = AnalysisEngine.getDeliveryPainCurve();
    const valid = (pain || []).filter(p => p.avgReview !== null);
    if (!valid.length) { ChartEngine.showEmpty('chart-pain-mini', 'delivery_summary sheet not found.'); return; }

    const colors = valid.map(p =>
      p.bucket.includes('8+') ? '#FF4D6D' :
      p.bucket.includes('4-7') ? '#FF7832' :
      p.bucket.includes('1-3') ? '#F59E0B' :
      '#2DD4BF'
    );

    ChartEngine.bar('chart-pain-mini',
      valid.map(p => p.bucket.replace('On / Slightly Early','On Time')),
      [{ label: 'Avg Review', data: valid.map(p => p.avgReview), backgroundColor: colors, borderRadius: 4 }],
      { plugins: { legend: { display: false } }, scales: { y: { min: 1, max: 5 } } }
    );
  },

  _drawStateMiniChart() {
    const states = AnalysisEngine.getStateRisk().slice(0, 10);
    if (!states.length) { ChartEngine.showEmpty('chart-state-mini', 'state_risk sheet not found.'); return; }
    ChartEngine.horizontalBar(
      'chart-state-mini',
      states.map(s => s.state || '?'),
      states.map(s => s.late_rate || 0),
      {
        label: 'Late Rate %',
        plugins: { legend: { display: false } },
        scales: { x: { title: { display: true, text: 'Late Rate %', color: '#64748b' } } }
      }
    );
  },

  /* ═══════════════════════════════════════════════════════════
     CUSTOMER EXPERIENCE
  ══════════════════════════════════════════════════════════ */
  renderCustomerPage(container) {
    const corr = AnalysisEngine.getDeliveryReviewCorrelation();
    const corrBadges = corr && corr.r !== null
      ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="badge badge-cyan">r = ${corr.r}</span>
          <span class="badge badge-purple">${StatisticsEngine.fmtPValue(corr.p)}</span>
          <span class="badge badge-green">n = ${Utils.fmtNumber(corr.n)}</span>
         </div>` : '';

    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Customer Experience</div>
        <div class="section-question">How does delivery performance relate to customer satisfaction?</div>
        <div class="section-source">SOURCE: delivery_summary / order_reviews</div>
      </div>

      <div class="chart-container" style="margin-bottom:20px">
        <div class="chart-header">
          <div>
            <div class="chart-title" style="font-size:16px">The Customer Pain Curve</div>
            <div class="chart-subtitle">Average review score by delivery timing bucket</div>
            <div class="chart-source">SOURCE: delivery_summary</div>
          </div>
          ${corrBadges}
        </div>
        <div class="chart-body" style="height:300px;position:relative;padding:0 4px 4px">
          <canvas id="chart-pain-full" style="width:100%;height:100%"></canvas>
        </div>
        ${this._insightBox('Delivery lateness is associated with lower satisfaction scores. This is a statistical association, not a proven causal relationship.')}
      </div>

      <div class="grid-2" style="margin-bottom:20px">
        ${this._chartWrap('chart-review-dist', 'Review Score Distribution', 'Share of orders per review score', 'order_reviews', 220)}
        ${this._chartWrap('chart-delivery-sev', 'Delivery Outcome Composition', 'Orders by delivery severity', 'delivery_summary', 220)}
      </div>

      <div id="pain-table-wrap" style="margin-bottom:20px"></div>`;

    setTimeout(() => {
      // Full pain curve — area chart
      const pain = AnalysisEngine.getDeliveryPainCurve();
      const valid = (pain || []).filter(p => p.avgReview !== null);
      if (valid.length) {
        ChartEngine.area('chart-pain-full',
          valid.map(p => p.bucket),
          [{ label: 'Avg Review', data: valid.map(p => p.avgReview), color: '#00E5FF' }],
          { scales: { y: { min: 1, max: 5, title: { display: true, text: 'Avg Review Score', color: '#64748b' } } } }
        );
      } else {
        ChartEngine.showEmpty('chart-pain-full', 'delivery_summary sheet not found in workbook.');
      }

      // Review distribution from order_reviews
      const reviews = DataLoader.getSheet('order_reviews');
      if (reviews.length) {
        const freq = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach(r => {
          const s = Math.round(Utils.parseNum(r.review_score || r.score));
          if (s >= 1 && s <= 5) freq[s]++;
        });
        ChartEngine.doughnut('chart-review-dist', ['1★','2★','3★','4★','5★'], [freq[1],freq[2],freq[3],freq[4],freq[5]]);
      } else {
        ChartEngine.showEmpty('chart-review-dist', 'order_reviews sheet not found.');
      }

      // Delivery severity from pain curve buckets
      if (valid.length) {
        const colors = valid.map(p => p.bucket.includes('8+') ? '#FF4D6D' : p.bucket.includes('4-7') ? '#FF7832' : p.bucket.includes('1-3') ? '#F59E0B' : p.bucket.includes('Slightly') ? '#00E5FF' : '#2DD4BF');
        ChartEngine.bar('chart-delivery-sev',
          valid.map(p => p.bucket.replace('On / Slightly Early','On Time').replace('7+ Days Early','7+Early').replace('3-6 Days Early','3-6Early')),
          [{ label: 'Orders', data: valid.map(p => p.orders), backgroundColor: colors, borderRadius: 4 }],
          { plugins: { legend: { display: false } } }
        );
      } else {
        ChartEngine.showEmpty('chart-delivery-sev', 'No delivery data.');
      }

      // Pain table
      const tw = document.getElementById('pain-table-wrap');
      if (tw && valid.length) {
        tw.innerHTML = '<div id="pain-tbl"></div>';
        TableEngine.create('pain-tbl', valid, ['bucket', 'avgReview', 'orders'], { pageSize: 10 });
      }
    }, 100);
  },

  /* ═══════════════════════════════════════════════════════════
     DELIVERY INTELLIGENCE
  ══════════════════════════════════════════════════════════ */
  renderDeliveryPage(container) {
    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Delivery Intelligence</div>
        <div class="section-question">Where does delivery performance break down?</div>
        <div class="section-source">SOURCE: delivery_summary / order_master</div>
      </div>
      <div class="grid-2" style="margin-bottom:20px">
        ${this._chartWrap('chart-dev-hist', 'Delivery Deviation Distribution', 'Days from estimated delivery (negative = early, positive = late)', 'delivery_summary', 240)}
        ${this._chartWrap('chart-dev-sev', 'Delivery Outcome Composition', 'Share of orders by outcome', 'delivery_summary', 240)}
      </div>
      ${this._chartWrap('chart-dev-scatter', 'Delivery Deviation vs Review Score', 'Each point is one order — negative association visible', 'delivery_summary', 280)}
      <div id="boxplot-container" style="margin-bottom:20px"></div>
      <div id="delivery-table-wrap" style="margin-bottom:20px"></div>`;

    setTimeout(() => {
      const dist = AnalysisEngine.getDeliveryDistribution();

      // Histogram
      if (dist && dist.values && dist.values.length >= 5) {
        ChartEngine.histogram('chart-dev-hist', dist.values, { xLabel: 'Days Deviation', bins: 20 });
      } else {
        ChartEngine.showEmpty('chart-dev-hist', 'Not enough delivery deviation data for histogram.');
      }

      // Severity doughnut
      const pain = AnalysisEngine.getDeliveryPainCurve();
      const valid = (pain || []).filter(p => p.orders > 0);
      if (valid.length) {
        ChartEngine.doughnut('chart-dev-sev', valid.map(p => p.bucket), valid.map(p => p.orders));
      } else {
        ChartEngine.showEmpty('chart-dev-sev', 'No delivery severity data.');
      }

      // Scatter: deviation vs review
      let delivery = DataLoader.getSheet('delivery_summary');
      if (!delivery.length) delivery = DataLoader.getSheet('order_master');
      const pts = delivery.slice(0, 2000).map(r => {
        const dev = Utils.parseNum(r.delivery_deviation_days || r.deviation || r.deviation_days);
        const rev = Utils.parseNum(r.review_score || r.score);
        return (dev !== null && rev !== null) ? { x: dev, y: rev } : null;
      }).filter(Boolean).slice(0, 800);

      if (pts.length >= 5) {
        ChartEngine.scatter('chart-dev-scatter',
          [{ label: 'Order', data: pts, color: '#00E5FF', radius: 3 }],
          { xLabel: 'Delivery Deviation (days)', yLabel: 'Review Score',
            scales: { x: { title: { display: true, text: 'Delivery Deviation (days)', color: '#64748b' } },
                      y: { min: 1, max: 5, title: { display: true, text: 'Review Score', color: '#64748b' } } } }
        );
      } else {
        ChartEngine.showEmpty('chart-dev-scatter', 'Not enough deviation+review pairs for scatter plot.');
      }

      // Box plot for deviation values grouped by bucket
      const bpContainer = document.getElementById('boxplot-container');
      if (bpContainer && dist && dist.values && dist.values.length >= 5) {
        bpContainer.innerHTML = `<div class="chart-container" style="margin-bottom:20px">
          <div class="chart-header"><div><div class="chart-title">Delivery Deviation — Box Plot</div>
          <div class="chart-subtitle">Distribution statistics for delivery deviation days</div>
          <div class="chart-source">SOURCE: delivery_summary</div></div></div>
          <div style="padding:16px 20px 20px" id="boxplot-svg-wrap"></div>
        </div>`;
        const bpData = StatisticsEngine.boxplot(dist.values);
        if (bpData) {
          ChartEngine.boxplotSVG('boxplot-svg-wrap', [{ label: 'All Orders', stats: bpData }]);
        }
      }

      // Delivery stats table
      if (valid.length) {
        const tw = document.getElementById('delivery-table-wrap');
        if (tw) { tw.innerHTML = '<div id="delivery-tbl"></div>'; TableEngine.create('delivery-tbl', valid, ['bucket','orders','avgReview'], { pageSize: 10 }); }
      }
    }, 100);
  },

  /* ═══════════════════════════════════════════════════════════
     GEOGRAPHIC INTELLIGENCE
  ══════════════════════════════════════════════════════════ */
  renderGeographyPage(container) {
    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Geographic Intelligence</div>
        <div class="section-question">Where is delivery risk concentrated geographically?</div>
        <div class="section-source">SOURCE: state_risk</div>
      </div>
      <div class="grid-2" style="margin-bottom:20px;align-items:start">
        <div>
          ${this._chartWrap('chart-state-bar', 'States by Late Delivery Rate', 'Click a bar to view state detail', 'state_risk', 380)}
        </div>
        <div>
          <div class="detail-panel glass-card" id="state-detail" style="padding:20px;margin-bottom:16px;min-height:160px">
            <div style="color:#64748b;font-size:13px;text-align:center;padding:30px 0">Click a state bar to view details</div>
          </div>
          ${this._chartWrap('chart-geo-bubble', 'Geographic Risk Matrix', 'Late Rate × Avg Review — bubble = late orders', 'state_risk', 240)}
        </div>
      </div>
      <div id="state-treemap-wrap" style="margin-bottom:20px"></div>
      <div id="state-table-wrap" style="margin-bottom:20px"></div>`;

    setTimeout(() => {
      const states = AnalysisEngine.getStateRisk();
      if (!states.length) {
        ChartEngine.showEmpty('chart-state-bar', 'state_risk sheet not found in workbook.');
        ChartEngine.showEmpty('chart-geo-bubble', 'No geographic data.');
        return;
      }

      const top15 = states.slice(0, 15);

      // Horizontal bar — clickable
      const canvas = document.getElementById('chart-state-bar');
      if (canvas) {
        ChartEngine.destroy('chart-state-bar');
        ChartEngine.clearEmpty('chart-state-bar');
        const colors = top15.map(s => Utils.hexToRgba(Utils.riskColor(s.late_rate || 0), 0.78));
        const chart = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: top15.map(s => s.state || '?'),
            datasets: [{ data: top15.map(s => s.late_rate || 0), backgroundColor: colors, borderRadius: 4, label: 'Late Rate %' }]
          },
          options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y', animation: { duration: 500 },
            plugins: { legend: { display: false },
              tooltip: { backgroundColor: 'rgba(6,14,32,0.96)', borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, titleColor: '#fff', bodyColor: '#94A3B8', padding: 12 }
            },
            onClick: (e, els) => { if (els.length) this._showStateDetail(top15[els[0].index]); },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 11 } }, border: { display: false }, title: { display: true, text: 'Late Rate %', color: '#64748b' } },
              y: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } }, border: { display: false } }
            }
          }
        });
        ChartEngine.registry['chart-state-bar'] = chart;
      }

      // Bubble chart
      const bubData = states.slice(0, 20).map(s => ({
        x: s.late_rate || 0,
        y: s.avg_review || 3,
        r: Math.max(5, Math.min(30, (s.late_orders || 0) / 40)),
        label: s.state || '?'
      }));
      ChartEngine.bubble('chart-geo-bubble',
        [{ label: 'States', data: bubData, color: '#00E5FF' }],
        { xLabel: 'Late Rate %', yLabel: 'Avg Review' }
      );

      // Treemap
      const tmWrap = document.getElementById('state-treemap-wrap');
      if (tmWrap) {
        tmWrap.innerHTML = `<div class="chart-container" style="margin-bottom:4px">
          <div class="chart-header"><div><div class="chart-title">State Order Volume Treemap</div><div class="chart-subtitle">Each tile = state, sized by order volume</div><div class="chart-source">SOURCE: state_risk</div></div></div>
          <div style="padding:0 16px 16px" id="state-treemap"></div>
        </div>`;
        ChartEngine.treemap('state-treemap', states.map(s => ({
          label: s.state || '?',
          value: s.orders || 0,
          color: Utils.hexToRgba(Utils.riskColor(s.late_rate || 0), 0.7)
        })), { height: 200 });
      }

      // Table
      const tw = document.getElementById('state-table-wrap');
      if (tw) {
        tw.innerHTML = '<div id="state-tbl"></div>';
        TableEngine.create('state-tbl', states, ['state','orders','late_orders','late_rate','avg_late_days','avg_review'], { pageSize: 15 });
      }
    }, 100);
  },

  _showStateDetail(s) {
    const panel = document.getElementById('state-detail');
    if (!panel || !s) return;
    const state = s.state || '?';
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-family:'Instrument Serif',serif;font-size:22px">${Utils.escapeHtml(state)}</div>
        ${this._riskBadge(s.late_rate || 0)}
      </div>
      ${[['Total Orders', Utils.fmtNumber(s.orders)],
         ['Late Orders',  Utils.fmtNumber(s.late_orders || 0)],
         ['Late Rate',    Utils.fmtPct(s.late_rate || 0)],
         ['Avg Late Days', s.avg_late_days ? s.avg_late_days + ' days' : 'N/A'],
         ['Avg Review',   s.avg_review ? s.avg_review + ' ★' : 'N/A'],
      ].map(([k,v]) => `<div class="stat-row"><span class="stat-label">${Utils.escapeHtml(k)}</span><span class="stat-value">${Utils.escapeHtml(String(v))}</span></div>`).join('')}
      <div style="font-size:10px;color:#64748b;margin-top:10px;font-style:italic">SOURCE: state_risk</div>`;
    FilterEngine.setFilter('state', state);
  },

  /* ═══════════════════════════════════════════════════════════
     CATEGORY INTELLIGENCE
  ══════════════════════════════════════════════════════════ */
  renderCategoryPage(container) {
    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Category Intelligence</div>
        <div class="section-question">Which product categories face the greatest operational risk?</div>
        <div class="section-source">SOURCE: category_risk</div>
      </div>
      <div class="grid-2" style="margin-bottom:20px">
        ${this._chartWrap('chart-cat-bubble','Category Risk Matrix','Late Rate × Late Review — bubble = order volume','category_risk',320)}
        ${this._chartWrap('chart-cat-late','Top Categories by Late Rate','Ranked by late delivery rate','category_risk',320)}
      </div>
      <div class="grid-2" style="margin-bottom:20px">
        ${this._chartWrap('chart-cat-review','Category Avg Review Score','Overall review per category','category_risk',240)}
        ${this._chartWrap('chart-cat-treemap-wrap','Category Volume Treemap','Each tile sized by order volume','category_risk',240)}
      </div>
      <div id="cat-table-wrap" style="margin-bottom:20px"></div>`;

    setTimeout(() => {
      const cats = AnalysisEngine.getCategoryRisk();
      if (!cats.length) {
        ['chart-cat-bubble','chart-cat-late','chart-cat-review'].forEach(id => ChartEngine.showEmpty(id, 'category_risk sheet not found.'));
        return;
      }

      // Bubble
      const bubData = cats.slice(0, 20).map(c => ({
        x: c.late_rate || 0,
        y: c.avg_review || 3,
        r: Math.max(5, Math.min(25, (c.orders || 0) / 600)),
        label: (c.category || '?').substring(0, 22)
      }));
      ChartEngine.bubble('chart-cat-bubble', [{ label: 'Categories', data: bubData, color: '#8B5CF6' }], {
        xLabel: 'Late Rate %', yLabel: 'Avg Review'
      });

      // Horizontal bar — late rate
      const top12 = cats.slice(0, 12);
      ChartEngine.horizontalBar('chart-cat-late',
        top12.map(c => (c.category || '?').substring(0, 22)),
        top12.map(c => c.late_rate || 0),
        { label: 'Late Rate %' }
      );

      // Bar — review by category
      const byRev = [...cats].sort((a, b) => (b.avg_review || 0) - (a.avg_review || 0)).slice(0, 12);
      ChartEngine.bar('chart-cat-review',
        byRev.map(c => (c.category || '?').substring(0, 18)),
        [{ label: 'Avg Review', data: byRev.map(c => c.avg_review || 0), backgroundColor: '#2DD4BF', borderRadius: 4 }],
        { plugins: { legend: { display: false } }, scales: { y: { min: 3, max: 5 } } }
      );

      // Treemap
      const tmEl = document.getElementById('chart-cat-treemap-wrap');
      if (tmEl) {
        const canvas = tmEl.querySelector('canvas');
        if (canvas) { canvas.style.display = 'none'; }
        const wrap = document.createElement('div');
        wrap.id = 'cat-treemap';
        wrap.style.cssText = 'height:240px;padding:4px 16px 16px';
        tmEl.closest('.chart-container').querySelector('.chart-body').appendChild(wrap);
        ChartEngine.treemap('cat-treemap', cats.map((c, i) => ({
          label: c.category || '?',
          value: c.orders || 0,
          color: Utils.paletteColor(i, 0.72)
        })), { height: 220 });
      }

      // Table
      const tw = document.getElementById('cat-table-wrap');
      if (tw) {
        tw.innerHTML = '<div id="cat-tbl"></div>';
        TableEngine.create('cat-tbl', cats, ['category','orders','late_orders','late_rate','avg_late_days','avg_review'], { pageSize: 15 });
      }
    }, 100);
  },

  /* ═══════════════════════════════════════════════════════════
     SELLER INTELLIGENCE
  ══════════════════════════════════════════════════════════ */
  renderSellerPage(container) {
    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Seller Intelligence</div>
        <div class="section-question">Which sellers concentrate the most delivery risk?</div>
        <div class="section-source">SOURCE: seller_summary</div>
      </div>
      <div class="kpi-grid" id="seller-kpis" style="margin-bottom:20px"></div>
      <div class="grid-2" style="margin-bottom:20px">
        ${this._chartWrap('chart-seller-bubble','Seller Performance Matrix','Late Rate × Avg Review — bubble = order volume','seller_summary',320)}
        ${this._chartWrap('chart-seller-conc','Seller Risk Concentration','Late-order share: top 10% vs rest','seller_summary',320)}
      </div>
      <div id="seller-table-wrap" style="margin-bottom:20px"></div>`;

    setTimeout(() => {
      const sellers = AnalysisEngine.getSellerSummary();
      const kpisEl  = document.getElementById('seller-kpis');

      if (!sellers.length) {
        ChartEngine.showEmpty('chart-seller-bubble', 'seller_summary sheet not found.');
        ChartEngine.showEmpty('chart-seller-conc', 'No seller data.');
        if (kpisEl) kpisEl.innerHTML = this._noData('seller_summary sheet not found.');
        return;
      }

      const total  = sellers.length;
      const top10n = Math.max(1, Math.ceil(total * 0.1));
      const topSellers = [...sellers].sort((a,b) => (b.total_orders||0)-(a.total_orders||0)).slice(0,top10n);
      const totalLate  = sellers.reduce((s,x) => s + (x.late_orders||0), 0);
      const topLate    = topSellers.reduce((s,x) => s + (x.late_orders||0), 0);
      const topShare   = totalLate > 0 ? Utils.round(topLate/totalLate*100,1) : 0;

      if (kpisEl) kpisEl.innerHTML = [
        this._kpiCard(this._ico.sel, total,       'Sellers Analyzed',    'Total seller set',              '#00E5FF'),
        this._kpiCard(this._ico.sel, top10n,      'Top 10% Sellers',     'By order volume',               '#8B5CF6'),
        this._kpiCard(this._ico.zap, topShare+'%','Top 10% Late Share',  'Concentration of late orders',  '#F59E0B'),
        this._kpiCard(this._ico.clk, Utils.fmtNumber(totalLate),'Total Late Orders','All sellers combined','#FF4D6D'),
      ].join('');

      // Bubble
      const bubData = sellers.slice(0, 60).map(s => ({
        x: s.late_rate || 0,
        y: s.avg_review || 3,
        r: Math.max(4, Math.min(20, (s.total_orders || 0) / 15)),
        label: s.seller_id || '?'
      }));
      ChartEngine.bubble('chart-seller-bubble', [{ label: 'Sellers', data: bubData, color: '#F59E0B' }], {
        xLabel: 'Late Rate %', yLabel: 'Avg Review'
      });

      // Concentration doughnut
      ChartEngine.doughnut('chart-seller-conc',
        [`Top 10% (${top10n} sellers)`, `Others (${total-top10n} sellers)`],
        [topLate, Math.max(0, totalLate - topLate)]
      );

      // Table
      const tw = document.getElementById('seller-table-wrap');
      if (tw) {
        tw.innerHTML = '<div id="seller-tbl"></div>';
        TableEngine.create('seller-tbl',
          [...sellers].sort((a,b) => (b.late_rate||0)-(a.late_rate||0)),
          ['seller_id','total_orders','late_orders','late_rate','avg_late_days','avg_review'],
          { pageSize: 15 }
        );
      }
    }, 100);
  },

  /* ═══════════════════════════════════════════════════════════
     PAYMENT INTELLIGENCE
  ══════════════════════════════════════════════════════════ */
  renderPaymentPage(container) {
    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Payment Intelligence</div>
        <div class="section-question">How does payment method and installment behavior relate to order value?</div>
        <div class="section-source">SOURCE: order_payments / installment_summary</div>
      </div>
      <div class="grid-2" style="margin-bottom:20px">
        ${this._chartWrap('chart-pay-dist','Payment Type Distribution','Order count by payment method','order_payments',240)}
        ${this._chartWrap('chart-pay-value','Avg Order Value by Payment Type','Product value per transaction','order_payments',240)}
      </div>
      ${this._chartWrap('chart-install','Installments vs Average Order Value','Higher installment counts associated with higher order values (r ≠ causation)','installment_summary',260)}
      <div id="install-corr-wrap" style="margin-bottom:20px"></div>
      <div id="pay-table-wrap" style="margin-bottom:20px"></div>`;

    setTimeout(() => {
      const payData  = AnalysisEngine.getPaymentAnalysis();
      const instData = AnalysisEngine.getInstallmentAnalysis();

      if (payData && payData.length) {
        ChartEngine.doughnut('chart-pay-dist', payData.map(p => p.type), payData.map(p => p.orders));
        ChartEngine.horizontalBar('chart-pay-value', payData.map(p => p.type), payData.map(p => p.avgOrderValue), { label: 'Avg Order Value (R$)' });
        const tw = document.getElementById('pay-table-wrap');
        if (tw) {
          tw.innerHTML = '<div id="pay-tbl"></div>';
          TableEngine.create('pay-tbl', payData, ['type','orders','totalValue','avgOrderValue','avgInstallments','avgReview'], { pageSize: 10 });
        }
      } else {
        ChartEngine.showEmpty('chart-pay-dist', 'order_payments sheet not found.');
        ChartEngine.showEmpty('chart-pay-value', 'No payment data.');
      }

      if (instData && instData.length >= 3) {
        const xArr = instData.map(i => i.n || i.installments || 0);
        const yArr = instData.map(i => i.avgOrderValue || i.avg_order_value || 0);
        ChartEngine.line('chart-install',
          xArr.map(String),
          [{ label: 'Avg Order Value (R$)', data: yArr, color: '#00E5FF', fill: true, points: true }],
          { scales: { y: { title: { display: true, text: 'Avg Order Value (R$)', color: '#64748b' }, beginAtZero: true } } }
        );

        // Correlation
        const corr = StatisticsEngine.pearson(xArr.filter((_,i)=>yArr[i]>0), yArr.filter(v=>v>0));
        const wrap = document.getElementById('install-corr-wrap');
        if (wrap && corr.r !== null) {
          wrap.innerHTML = `<div class="insight-panel">
            <div class="insight-item">
              <div class="insight-what">Installments × Order Value Correlation</div>
              Installment count shows a <strong>${StatisticsEngine.correlationStrength(corr.r)}</strong> linear association with average order value.
              <div class="insight-evidence">Pearson r = ${corr.r} · ${StatisticsEngine.fmtPValue(corr.p)} · n = ${corr.n}
              <br>⚠ Association does not imply causation.</div>
            </div>
          </div>`;
        }
      } else {
        ChartEngine.showEmpty('chart-install', 'installment_summary sheet not found or insufficient data.');
      }
    }, 100);
  },

  /* ═══════════════════════════════════════════════════════════
     RISK INTELLIGENCE
  ══════════════════════════════════════════════════════════ */
  renderRiskPage(container) {
    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Risk Intelligence</div>
        <div class="section-question">Where are the highest-priority state × category hotspots?</div>
        <div class="section-source">SOURCE: state_category_risk / excess_risk</div>
      </div>
      <div class="grid-2" style="margin-bottom:20px">
        ${this._chartWrap('chart-risk-state','State Risk Radar','Late rate across top states','state_risk',280)}
        ${this._chartWrap('chart-risk-cat','Category Risk Radar','Late rate across top categories','category_risk',280)}
      </div>
      <div class="chart-container" style="margin-bottom:20px">
        <div class="chart-header">
          <div><div class="chart-title">State × Category Excess Late Rate Heatmap</div>
          <div class="chart-subtitle">Click a cell to view details. Excess = actual late rate minus category baseline.</div>
          <div class="chart-source">SOURCE: state_category_risk / excess_risk</div></div>
        </div>
        <div style="padding:16px 20px 20px">
          <div id="risk-heatmap-wrap"></div>
          <div id="risk-heatmap-detail" style="margin-top:14px"></div>
        </div>
      </div>
      ${this._chartWrap('chart-hotspot-bar','Top Intervention Opportunities','Ranked by excess late rate above baseline','state_category_risk',300)}
      <div id="hotspot-table-wrap" style="margin-bottom:20px"></div>`;

    setTimeout(() => {
      const states  = AnalysisEngine.getStateRisk();
      const cats    = AnalysisEngine.getCategoryRisk();
      const hotspots = AnalysisEngine.getHotspots();

      // Radar: top 8 states
      if (states.length >= 3) {
        const top8 = states.slice(0, 8);
        ChartEngine.radar('chart-risk-state', top8.map(s => s.state || '?'), [{
          label: 'Late Rate %', data: top8.map(s => s.late_rate || 0), color: '#FF4D6D'
        }]);
      } else {
        ChartEngine.showEmpty('chart-risk-state', 'Not enough state data for radar chart.');
      }

      if (cats.length >= 3) {
        const top8c = cats.slice(0, 8);
        ChartEngine.radar('chart-risk-cat', top8c.map(c => (c.category||'?').substring(0,14)), [{
          label: 'Late Rate %', data: top8c.map(c => c.late_rate || 0), color: '#8B5CF6'
        }]);
      } else {
        ChartEngine.showEmpty('chart-risk-cat', 'Not enough category data for radar chart.');
      }

      // Heatmap
      const hmWrap = document.getElementById('risk-heatmap-wrap');
      const detailEl = document.getElementById('risk-heatmap-detail');
      if (hmWrap && hotspots.length) {
        // Detect field names
        const sample = hotspots[0];
        const stKey  = Object.keys(sample).find(k => k.toLowerCase().includes('state')) || '';
        const catKey = Object.keys(sample).find(k => k.toLowerCase().includes('cat')) || '';
        const lrKey  = Object.keys(sample).find(k => k.toLowerCase().includes('late_rate') || k.toLowerCase().includes('laterate')) || '';
        const exKey  = Object.keys(sample).find(k => k.toLowerCase().includes('excess') || k.toLowerCase().includes('extra')) || lrKey;

        const rowsSet = new Set(), colsSet = new Set();
        hotspots.forEach(h => { rowsSet.add(h[stKey]||'?'); colsSet.add((h[catKey]||'?').substring(0,16)); });
        const rows = [...rowsSet].slice(0, 10);
        const cols = [...colsSet].slice(0, 8);

        const lookup = {};
        hotspots.forEach(h => { lookup[`${h[stKey]||'?'}||${(h[catKey]||'?').substring(0,16)}`] = h; });

        ChartEngine.heatmap('risk-heatmap-wrap', rows, cols,
          (row, col) => {
            const h = lookup[`${row}||${col}`];
            return h ? Utils.parseNum(h[exKey]) : null;
          },
          {
            onClick: (row, col, val) => {
              const h = lookup[`${row}||${col}`];
              if (!h || !detailEl) return;
              detailEl.innerHTML = `<div class="glass-card" style="padding:16px">
                <div style="font-family:'Instrument Serif',serif;font-size:17px;margin-bottom:12px">${Utils.escapeHtml(row)} × ${Utils.escapeHtml(col)}</div>
                ${Object.entries(h).slice(0,8).map(([k,v]) => `<div class="stat-row"><span class="stat-label">${Utils.escapeHtml(k)}</span><span class="stat-value">${Utils.escapeHtml(String(v??'—'))}</span></div>`).join('')}
              </div>`;
            }
          }
        );
      } else if (hmWrap) {
        hmWrap.innerHTML = '<div class="empty-state" style="height:120px"><div class="empty-desc">state_category_risk or excess_risk sheet not found in workbook.</div></div>';
      }

      // Hotspot ranked bar
      if (hotspots.length) {
        const sample = hotspots[0];
        const stKey  = Object.keys(sample).find(k => k.toLowerCase().includes('state')) || '';
        const catKey = Object.keys(sample).find(k => k.toLowerCase().includes('cat')) || '';
        const lrKey  = Object.keys(sample).find(k => k.toLowerCase().includes('late_rate') || k.toLowerCase().includes('laterate')) || '';
        const exKey  = Object.keys(sample).find(k => k.toLowerCase().includes('excess') || k.toLowerCase().includes('extra')) || lrKey;

        const top20 = [...hotspots].sort((a,b) => (Utils.parseNum(b[exKey])||0)-(Utils.parseNum(a[exKey])||0)).slice(0,20);
        ChartEngine.horizontalBar('chart-hotspot-bar',
          top20.map(h => `${h[stKey]||'?'} × ${(h[catKey]||'?').substring(0,14)}`),
          top20.map(h => Utils.parseNum(h[exKey]) || Utils.parseNum(h[lrKey]) || 0),
          { label: 'Excess Late Rate pp' }
        );

        const tw = document.getElementById('hotspot-table-wrap');
        if (tw) {
          tw.innerHTML = '<div id="hotspot-tbl"></div>';
          TableEngine.create('hotspot-tbl', hotspots, Object.keys(hotspots[0]).slice(0, 8), { pageSize: 15 });
        }
      } else {
        ChartEngine.showEmpty('chart-hotspot-bar', 'No hotspot data found in workbook.');
      }
    }, 100);
  },

  /* ═══════════════════════════════════════════════════════════
     DATA EXPLORER
  ══════════════════════════════════════════════════════════ */
  renderExplorerPage(container) {
    const sheets = DataLoader.listSheets().filter(s => s.rows > 0);

    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Data Explorer</div>
        <div class="section-question">Build your own visualization from any available dataset</div>
      </div>
      <div class="explorer-controls" style="margin-bottom:20px">
        <div class="explorer-control-grid">
          <div class="control-group">
            <label class="control-label">Dataset</label>
            <select class="control-select" id="exp-sheet">
              ${sheets.length ? sheets.map(s => `<option value="${Utils.escapeHtml(s.name)}">${Utils.escapeHtml(s.name)} (${Utils.fmtNumber(s.rows)} rows)</option>`).join('') : '<option value="">No sheets loaded</option>'}
            </select>
          </div>
          <div class="control-group">
            <label class="control-label">Chart Type</label>
            <select class="control-select" id="exp-type">
              <option value="bar">Bar</option>
              <option value="horizontalBar">Horizontal Bar</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
              <option value="scatter">Scatter</option>
              <option value="bubble">Bubble</option>
              <option value="doughnut">Doughnut</option>
              <option value="radar">Radar</option>
              <option value="histogram">Histogram</option>
              <option value="heatmap">Correlation Heatmap</option>
            </select>
          </div>
          <div class="control-group"><label class="control-label">X / Label Column</label><select class="control-select" id="exp-x"></select></div>
          <div class="control-group"><label class="control-label">Y / Value Column</label><select class="control-select" id="exp-y"></select></div>
          <div class="control-group">
            <label class="control-label">Aggregation</label>
            <select class="control-select" id="exp-agg">
              <option value="avg">Average</option><option value="sum">Sum</option>
              <option value="count">Count</option><option value="max">Max</option><option value="min">Min</option>
            </select>
          </div>
          <div class="control-group"><label class="control-label">&nbsp;</label>
            <button class="btn-apply" id="exp-run">Generate Chart</button>
          </div>
        </div>
      </div>

      ${this._chartWrap('exp-chart','Explorer Chart','Configure controls above and click Generate','Selected Sheet',340)}
      <div id="exp-corr-wrap" style="margin-bottom:20px"></div>
      <div id="exp-table-wrap" style="margin-bottom:20px"></div>`;

    const updateCols = () => {
      const sheet = document.getElementById('exp-sheet')?.value;
      const data  = DataLoader.getSheet(sheet);
      const cols  = data.length ? Object.keys(data[0]) : [];
      ['exp-x','exp-y'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = cols.map(c => `<option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>`).join('');
      });
    };
    document.getElementById('exp-sheet')?.addEventListener('change', updateCols);
    updateCols();

    ChartEngine.showEmpty('exp-chart', 'Configure the controls above and click Generate Chart.');

    document.getElementById('exp-run')?.addEventListener('click', () => this._runExplorer());
  },

  _runExplorer() {
    const sheet = document.getElementById('exp-sheet')?.value;
    const type  = document.getElementById('exp-type')?.value;
    const xKey  = document.getElementById('exp-x')?.value;
    const yKey  = document.getElementById('exp-y')?.value;
    const agg   = document.getElementById('exp-agg')?.value;

    const data = DataLoader.getSheet(sheet);
    if (!data.length) { Utils.toast('No data in selected sheet', 'error'); return; }
    const sample = data.slice(0, 5000);

    ChartEngine.destroy('exp-chart');
    const titleEl = document.getElementById('exp-chart')?.closest('.chart-container')?.querySelector('.chart-title');
    if (titleEl) titleEl.textContent = `${agg.toUpperCase()}(${yKey}) by ${xKey}`;

    // Correlation heatmap
    if (type === 'heatmap') {
      const corr = CorrelationEngine.buildMatrix(sample.slice(0, 1000));
      if (corr) {
        ChartEngine.showEmpty('exp-chart', '(Correlation matrix rendered below)');
        const cw = document.getElementById('exp-corr-wrap');
        if (cw) { cw.innerHTML = '<div class="chart-container" style="padding:20px"><div class="chart-title" style="margin-bottom:12px">Correlation Matrix</div><div id="exp-corr-table"></div></div>'; ChartEngine.correlationTable('exp-corr-table', corr); }
      } else {
        ChartEngine.showEmpty('exp-chart', 'At least 2 numeric columns required for correlation matrix.');
      }
      return;
    }

    // Histogram
    if (type === 'histogram') {
      const vals = StatisticsEngine.extractNumeric(sample, yKey);
      ChartEngine.histogram('exp-chart', vals, { xLabel: yKey });
    } else if (type === 'scatter') {
      const pts = sample.map(r => ({ x: Utils.parseNum(r[xKey]), y: Utils.parseNum(r[yKey]) }))
        .filter(p => p.x !== null && p.y !== null && isFinite(p.x) && isFinite(p.y)).slice(0, 500);
      ChartEngine.scatter('exp-chart', [{ label: `${xKey} vs ${yKey}`, data: pts, color: '#00E5FF' }], {
        xLabel: xKey, yLabel: yKey
      });
    } else if (type === 'bubble') {
      const pts = sample.map(r => ({
        x: Utils.parseNum(r[xKey]), y: Utils.parseNum(r[yKey]),
        r: 8, label: String(r[xKey] || '')
      })).filter(p => p.x !== null && p.y !== null).slice(0, 200);
      ChartEngine.bubble('exp-chart', [{ label: `${xKey} vs ${yKey}`, data: pts, color: '#8B5CF6' }]);
    } else {
      // Aggregate
      const grouped = Utils.groupBy(sample, xKey);
      const labels  = Object.keys(grouped).slice(0, 30);
      const vals    = labels.map(k => {
        const rows = grouped[k];
        const nums = rows.map(r => Utils.parseNum(r[yKey])).filter(v => v !== null);
        if (!nums.length) return null;
        switch (agg) {
          case 'sum':   return Utils.round(nums.reduce((a,b)=>a+b,0), 2);
          case 'count': return rows.length;
          case 'max':   return Math.max(...nums);
          case 'min':   return Math.min(...nums);
          default:      return Utils.round(nums.reduce((a,b)=>a+b,0)/nums.length, 2);
        }
      });

      if (type === 'doughnut') ChartEngine.doughnut('exp-chart', labels, vals);
      else if (type === 'radar') ChartEngine.radar('exp-chart', labels.slice(0,8), [{ label: yKey, data: vals.slice(0,8) }]);
      else if (type === 'horizontalBar') ChartEngine.horizontalBar('exp-chart', labels, vals, { label: yKey });
      else if (type === 'line') ChartEngine.line('exp-chart', labels, [{ label: yKey, data: vals, color: '#00E5FF' }]);
      else if (type === 'area') ChartEngine.area('exp-chart', labels, [{ label: yKey, data: vals, color: '#00E5FF' }]);
      else ChartEngine.bar('exp-chart', labels, [{ label: yKey, data: vals, borderRadius: 4 }]);
    }

    // Result table
    const tw = document.getElementById('exp-table-wrap');
    if (tw) {
      const tableData = Object.entries(Utils.groupBy(sample, xKey)).slice(0, 200).map(([k, rows]) => {
        const nums = rows.map(r => Utils.parseNum(r[yKey])).filter(v => v !== null);
        let v = null;
        if (nums.length) {
          switch(agg) {
            case 'sum': v=Utils.round(nums.reduce((a,b)=>a+b,0),4); break;
            case 'count': v=rows.length; break;
            case 'max': v=Math.max(...nums); break;
            case 'min': v=Math.min(...nums); break;
            default: v=Utils.round(nums.reduce((a,b)=>a+b,0)/nums.length,4);
          }
        }
        return { [xKey]: k, [`${agg}(${yKey})`]: v };
      });
      tw.innerHTML = '<div id="exp-tbl"></div>';
      TableEngine.create('exp-tbl', tableData, [xKey, `${agg}(${yKey})`], { pageSize: 15 });
    }
  },

  /* ═══════════════════════════════════════════════════════════
     ACTION CENTER
  ══════════════════════════════════════════════════════════ */
  renderActionPage(container) {
    const kpis    = AnalysisEngine.getExecutiveKPIs();
    const states  = AnalysisEngine.getStateRisk().slice(0, 3);
    const cats    = AnalysisEngine.getCategoryRisk().slice(0, 3);
    const sellers = AnalysisEngine.getSellerSummary().filter(s => (s.late_rate||0) > 20).slice(0, 3);
    const corr    = AnalysisEngine.getDeliveryReviewCorrelation();

    const buildCard = (priority, cls, problem, evidence, action, direction) => `
      <div class="action-card ${cls}" style="margin-bottom:14px">
        <div class="action-priority" style="color:${cls==='critical'?'#FF4D6D':cls==='warning'?'#F59E0B':'#2DD4BF'};font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">● ${Utils.escapeHtml(priority)} PRIORITY</div>
        <div class="action-problem" style="font-family:'Instrument Serif',serif;font-size:18px;margin-bottom:10px">${Utils.escapeHtml(problem)}</div>
        <div class="action-evidence" style="font-size:12px;color:#94A3B8;line-height:1.6;margin-bottom:12px">${Utils.escapeHtml(evidence)}</div>
        <div class="action-recommendation" style="font-size:13px;color:#93c5fd;padding:10px 14px;background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.13);border-radius:8px;line-height:1.55">
          <strong>→ Recommended Action:</strong> ${Utils.escapeHtml(action)}
        </div>
        ${direction ? `<div style="margin-top:8px;font-size:11px;color:#64748b">Expected direction: ${Utils.escapeHtml(direction)}</div>` : ''}
      </div>`;

    const cards = [];

    if (kpis && kpis.lateRate > 5)
      cards.push(buildCard(kpis.lateRate>10?'HIGH':'MEDIUM', kpis.lateRate>10?'critical':'warning',
        'Late Delivery Rate Requires Attention',
        `Late rate: ${Utils.fmtPct(kpis.lateRate)} | Late orders: ${Utils.fmtNumber(kpis.lateOrders)} | Analyzed: ${Utils.fmtNumber(kpis.analyzedOrders)}`,
        'Investigate top-contributing states and categories. Prioritize operational improvements in delivery SLA.',
        'Reduce late rate; improve satisfaction scores'));

    if (states.length && states[0].late_rate > 10)
      cards.push(buildCard('HIGH','critical',
        `Geographic Risk: ${states[0].state} Shows Elevated Late Rate`,
        `${states[0].state} late rate: ${Utils.fmtPct(states[0].late_rate)} | Late orders: ${Utils.fmtNumber(states[0].late_orders||0)} | Total: ${Utils.fmtNumber(states[0].orders)}`,
        `Prioritize logistics investigation and carrier performance review for ${states[0].state} and other high-risk states.`,
        'Reduce geographic delivery risk concentration'));

    if (cats.length && cats[0].late_rate > 10)
      cards.push(buildCard('MEDIUM','warning',
        `Category Risk: "${(cats[0].category||'?').substring(0,40)}"`,
        `Late rate: ${Utils.fmtPct(cats[0].late_rate)} | Orders: ${Utils.fmtNumber(cats[0].orders)} | Avg late days: ${cats[0].avg_late_days||'N/A'}`,
        'Apply category-specific SLA targets. Review fulfillment processes for high-risk categories.',
        'Reduce category delivery late rate'));

    if (sellers.length)
      cards.push(buildCard('MEDIUM','warning',
        'High-Risk Sellers Driving Late-Order Concentration',
        `${sellers.length}+ sellers identified with >20% late rate. Top: ${sellers[0].seller_id} — ${Utils.fmtPct(sellers[0].late_rate)} late`,
        'Implement SLA monitoring for high-risk sellers. Consider seller-level intervention program.',
        'Reduce seller late rate; improve marketplace delivery performance'));

    if (corr && corr.r !== null && corr.r < -0.15)
      cards.push(buildCard('MEDIUM','warning',
        'Delivery Deviation Negatively Associated with Review Score',
        `Pearson r = ${corr.r} | ${StatisticsEngine.fmtPValue(corr.p)} | n = ${Utils.fmtNumber(corr.n)} | Association does not prove causation`,
        'Focus on reducing 8+ day late deliveries, which are associated with the lowest review scores.',
        'Improve delivery timeliness to support customer satisfaction'));

    if (!cards.length)
      cards.push(buildCard('INFO','positive','Load Olist Workbook to Generate Recommendations','Place Olist_Final_Analytical_Workbook.xlsx in public/data/ and serve over HTTP.','Then navigate back to this page for evidence-based recommendations.',''));

    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Action Center</div>
        <div class="section-question">Where should Olist act first?</div>
        <div class="section-source">SOURCE: All analytical sheets — evidence-based only</div>
      </div>
      ${cards.join('')}
      <div class="insight-panel" style="margin-top:24px">
        <div class="insight-panel-title">Important Analytical Note</div>
        <div class="insight-item"><div class="insight-what">Evidence-Based Recommendations Only</div>
        All recommendations above are derived from statistical patterns in the Olist workbook. Correlation does not imply causation. Estimated exposures in state × category analysis may involve order overlap. Business decisions should incorporate additional domain knowledge.</div>
      </div>`;
  }
};

window.UI = UI;
