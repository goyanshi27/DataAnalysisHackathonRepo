/* ============================================================
   OUTLIER-ENGINE.JS — IQR-based outlier detection
   ============================================================ */
'use strict';

const OutlierEngine = {

  detect(data, key) {
    const values = StatisticsEngine.extractNumeric(data, key);
    if (values.length < 4) return null;
    const bp = StatisticsEngine.boxplot(values);
    const outlierRows = data.filter(row => {
      const v = Utils.parseNum(row[key]);
      return v !== null && (v < bp.lower || v > bp.upper);
    });
    return {
      key, total: data.length, outlierCount: outlierRows.length,
      outlierPct: Utils.round(outlierRows.length / data.length * 100, 2),
      lowerBound: Utils.round(bp.lower, 4),
      upperBound: Utils.round(bp.upper, 4),
      q1: bp.q1, q3: bp.q3, iqr: bp.iqr,
      outlierRows: outlierRows.slice(0, 100)
    };
  },

  detectAll(data) {
    if (!data || !data.length) return [];
    const cols = Object.keys(data[0]);
    const results = [];
    for (const col of cols) {
      const vals = data.slice(0, 200).map(r => r[col]).filter(v => v !== null && v !== '');
      const numRatio = vals.filter(v => Utils.isNumeric(v)).length / Math.max(vals.length, 1);
      if (numRatio > 0.7) {
        const result = this.detect(data, col);
        if (result && result.outlierCount > 0) results.push(result);
      }
    }
    return results.sort((a, b) => b.outlierPct - a.outlierPct);
  },

  severity(pct) {
    if (pct > 10) return 'high';
    if (pct > 5)  return 'medium';
    return 'low';
  }
};

window.OutlierEngine = OutlierEngine;
