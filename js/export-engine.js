'use strict';
const ExportEngine = {

  exportReport() {
    const kpis    = AnalysisEngine.getExecutiveKPIs();
    const states  = AnalysisEngine.getStateRisk().slice(0, 10);
    const cats    = AnalysisEngine.getCategoryRisk().slice(0, 10);
    const corr    = AnalysisEngine.getDeliveryReviewCorrelation();
    const filters = FilterEngine.state;
    const now     = new Date().toLocaleString();
    const lines   = [
      '═══════════════════════════════════════════════════════',
      '  OLIST MARKETPLACE INTELLIGENCE — ANALYTICAL REPORT',
      `  Generated: ${now}`,
      '═══════════════════════════════════════════════════════',
      '',
      `Active Filters: State=${filters.state||'All'} | Category=${filters.category||'All'} | Payment=${filters.payment||'All'}`,
      '',
      '── EXECUTIVE KPIs ─────────────────────────────────────',
      kpis ? [
        `Total Orders:       ${Utils.fmtNumber(kpis.totalOrders)}`,
        `Orders Analyzed:    ${Utils.fmtNumber(kpis.analyzedOrders)}`,
        `Late Orders:        ${Utils.fmtNumber(kpis.lateOrders)}`,
        `Late Delivery Rate: ${Utils.fmtPct(kpis.lateRate)}`,
        `Average Review:     ${kpis.avgReview ?? 'N/A'} / 5`,
        `Product Value:      ${Utils.fmtBRL(kpis.productValue)}`,
      ].join('\n') : 'KPI data not available',
      '',
      '── DELIVERY–REVIEW CORRELATION ─────────────────────────',
      corr ? `Pearson r = ${corr.r}  |  ${StatisticsEngine.fmtPValue(corr.p)}  |  n = ${Utils.fmtNumber(corr.n)}\nNote: Association does not imply causation.` : 'N/A',
      '',
      '── TOP 10 HIGH-RISK STATES ──────────────────────────────',
      states.map((s,i) => `${i+1}. ${s.state||s.customer_state}  Late: ${Utils.fmtPct(s.late_rate)}  Orders: ${Utils.fmtNumber(s.orders)}`).join('\n') || 'No data',
      '',
      '── TOP 10 HIGH-RISK CATEGORIES ──────────────────────────',
      cats.map((c,i) => `${i+1}. ${c.category||c.product_category_name_english}  Late: ${Utils.fmtPct(c.late_rate)}  Orders: ${Utils.fmtNumber(c.orders)}`).join('\n') || 'No data',
      '',
      '── KEY ANALYTICAL NOTES ─────────────────────────────────',
      '• All values calculated from the OLIST workbook — no hardcoded data.',
      '• Correlation does not imply causation.',
      '• State × Category estimates may involve order overlap.',
      '',
      '═══════════════════════════════════════════════════════',
      'SOURCE: OLIST Marketplace Intelligence Platform',
      '═══════════════════════════════════════════════════════',
    ];
    this._download(lines.join('\n'), `olist-report-${Date.now()}.txt`, 'text/plain');
    Utils.toast('Report downloaded successfully', 'success');
  },

  exportCSV(data, filename, columns) {
    if (!data || !data.length) { Utils.toast('No data to export', 'error'); return; }
    const cols = columns || Object.keys(data[0]);
    const header = cols.join(',');
    const rows = data.map(row => cols.map(c => {
      const v = row[c] ?? '';
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(','));
    this._download([header, ...rows].join('\n'), filename || `export-${Date.now()}.csv`, 'text/csv');
    Utils.toast(`${Utils.fmtNumber(data.length)} rows exported`, 'success');
  },

  _download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
};
window.ExportEngine = ExportEngine;
