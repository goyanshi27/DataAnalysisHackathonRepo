/* ============================================================
   CORRELATION-ENGINE.JS — Correlation matrix & heatmap data
   ============================================================ */

'use strict';

const CorrelationEngine = {

  // Build correlation matrix for all numeric columns
  buildMatrix(data, maxCols = 12) {
    if (!data || !data.length) return null;
    const columns = Object.keys(data[0]);

    // Detect numeric columns
    const numericCols = columns.filter(col => {
      const vals = data.slice(0, 100).map(r => r[col]).filter(v => v !== null && v !== '');
      const numCount = vals.filter(v => Utils.isNumeric(v)).length;
      return numCount / Math.max(vals.length, 1) > 0.7;
    }).slice(0, maxCols);

    if (numericCols.length < 2) return null;

    // Extract numeric arrays
    const arrays = {};
    numericCols.forEach(col => {
      arrays[col] = StatisticsEngine.extractNumeric(data, col);
    });

    // Build matrix
    const matrix = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = 0; j < numericCols.length; j++) {
        const xi = arrays[numericCols[i]];
        const yj = arrays[numericCols[j]];
        const n = Math.min(xi.length, yj.length);
        if (i === j) {
          matrix.push({ col1: numericCols[i], col2: numericCols[j], r: 1.0, p: 0, n });
        } else if (j > i) {
          const aligned = this._align(xi, yj);
          const result = StatisticsEngine.pearson(aligned.x, aligned.y);
          matrix.push({ col1: numericCols[i], col2: numericCols[j], r: result.r, p: result.p, n: result.n });
          matrix.push({ col1: numericCols[j], col2: numericCols[i], r: result.r, p: result.p, n: result.n });
        }
      }
    }

    return { columns: numericCols, matrix };
  },

  // Align two arrays by min length
  _align(x, y) {
    const n = Math.min(x.length, y.length);
    return { x: x.slice(0, n), y: y.slice(0, n) };
  },

  // Get correlation value for two columns
  getCorrelation(matrix, col1, col2) {
    if (!matrix) return null;
    const entry = matrix.matrix.find(e => e.col1 === col1 && e.col2 === col2);
    return entry ? entry.r : null;
  },

  // Find strongest correlations
  topCorrelations(matrix, n = 5) {
    if (!matrix) return [];
    const unique = [];
    const seen = new Set();
    for (const entry of matrix.matrix) {
      if (entry.col1 === entry.col2) continue;
      const key = [entry.col1, entry.col2].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(entry);
      }
    }
    return unique
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, n);
  },

  // Color for correlation value
  correlationColor(r) {
    if (r === null) return 'rgba(255,255,255,0.05)';
    const abs = Math.abs(r);
    if (r > 0) {
      const alpha = 0.1 + abs * 0.8;
      return `rgba(0,229,255,${alpha.toFixed(2)})`;
    } else {
      const alpha = 0.1 + abs * 0.8;
      return `rgba(255,77,109,${alpha.toFixed(2)})`;
    }
  },

  // Describe correlation
  describeCorrelation(r) {
    if (r === null) return 'No data';
    const strength = StatisticsEngine.correlationStrength(r);
    const direction = r > 0 ? 'positive' : r < 0 ? 'negative' : 'none';
    if (strength === 'negligible') return 'Little to no linear relationship';
    return `${strength.charAt(0).toUpperCase() + strength.slice(1)} ${direction} linear relationship`;
  }
};

window.CorrelationEngine = CorrelationEngine;
