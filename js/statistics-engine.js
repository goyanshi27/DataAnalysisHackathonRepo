/* ============================================================
   STATISTICS-ENGINE.JS — Descriptive & inferential statistics
   ============================================================ */

'use strict';

const StatisticsEngine = {

  // Extract numeric values from array of objects for a given key
  extractNumeric(data, key) {
    return data
      .map(row => Utils.parseNum(row[key]))
      .filter(v => v !== null && !isNaN(v));
  },

  // Full descriptive statistics for a numeric array
  describe(values) {
    if (!values || !values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const min = sorted[0];
    const max = sorted[n - 1];
    const range = max - min;
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const std = Math.sqrt(variance);
    const cv = mean !== 0 ? (std / mean) * 100 : 0;

    return {
      count: n, sum: Utils.round(sum), mean: Utils.round(mean, 4),
      median: Utils.round(median, 4), min: Utils.round(min, 4), max: Utils.round(max, 4),
      range: Utils.round(range, 4), std: Utils.round(std, 4),
      variance: Utils.round(variance, 4), q1: Utils.round(q1, 4),
      q3: Utils.round(q3, 4), iqr: Utils.round(iqr, 4), cv: Utils.round(cv, 2)
    };
  },

  // Pearson correlation between two numeric arrays (same length)
  pearson(x, y) {
    if (!x || !y || x.length !== y.length || x.length < 3) return { r: null, n: 0 };
    const n = x.length;
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const my = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx, dy = y[i] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    const denom = Math.sqrt(dx2 * dy2);
    const r = denom === 0 ? 0 : num / denom;
    // t-statistic for p-value approximation
    const t = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
    const p = this._approxPValue(t, n - 2);
    return { r: Utils.round(r, 4), t: Utils.round(t, 4), p, n, significant: p < 0.05 };
  },

  // Approximate two-tailed p-value from t-statistic
  _approxPValue(t, df) {
    if (!isFinite(t) || df <= 0) return 1;
    const x = df / (df + t * t);
    // Regularized incomplete beta function approximation
    const betaI = this._incompleteBeta(df / 2, 0.5, x);
    return Math.min(betaI, 1);
  },

  _incompleteBeta(a, b, x) {
    // Simple approximation using continued fraction
    let p = 0;
    try {
      const lbeta = this._logBeta(a, b);
      let f = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;
      for (let m = 1; m <= 100; m++) {
        const d = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
        const d2 = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
        f *= (1 + d) * (1 + d2);
      }
      p = f;
    } catch {}
    return isNaN(p) ? 1 : Math.min(Math.max(p, 0), 1);
  },

  _logBeta(a, b) {
    return this._logGamma(a) + this._logGamma(b) - this._logGamma(a + b);
  },

  _logGamma(x) {
    const c = [76.18009172947146,-86.50532032941677,24.01409824083091,
               -1.231739572450155,0.001208650973866179,-0.000005395239384953];
    let y = x, tmp = x + 5.5, ser = 1.000000000190015;
    tmp -= (x + 0.5) * Math.log(tmp);
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  },

  // Format p-value string
  fmtPValue(p) {
    if (p === null || p === undefined) return 'N/A';
    if (p < 0.001) return 'p < 0.001';
    if (p < 0.01)  return 'p < 0.01';
    if (p < 0.05)  return 'p < 0.05';
    return `p = ${p.toFixed(3)}`;
  },

  // Correlation strength label
  correlationStrength(r) {
    const abs = Math.abs(r);
    if (abs >= 0.7) return 'strong';
    if (abs >= 0.4) return 'moderate';
    if (abs >= 0.2) return 'weak';
    return 'negligible';
  },

  // Histogram bins
  histogram(values, bins = 10) {
    if (!values || !values.length) return { bins: [], counts: [] };
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return { bins: [min], counts: [values.length] };
    const width = (max - min) / bins;
    const counts = new Array(bins).fill(0);
    const labels = [];
    for (let i = 0; i < bins; i++) {
      labels.push(Utils.round(min + i * width, 2));
    }
    values.forEach(v => {
      let idx = Math.floor((v - min) / width);
      if (idx >= bins) idx = bins - 1;
      counts[idx]++;
    });
    return { bins: labels, counts, width: Utils.round(width, 4), min, max };
  },

  // Percentile
  percentile(sortedArr, p) {
    const idx = (p / 100) * (sortedArr.length - 1);
    const lower = Math.floor(idx), upper = Math.ceil(idx);
    if (lower === upper) return sortedArr[lower];
    return sortedArr[lower] + (idx - lower) * (sortedArr[upper] - sortedArr[lower]);
  },

  // Box plot stats
  boxplot(values) {
    if (!values || !values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q2 = this.percentile(sorted, 50);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const whiskerLow = sorted.find(v => v >= lower) ?? sorted[0];
    const whiskerHigh = [...sorted].reverse().find(v => v <= upper) ?? sorted[sorted.length - 1];
    const outliers = sorted.filter(v => v < lower || v > upper);
    return { q1, q2, q3, iqr, lower, upper, whiskerLow, whiskerHigh, outliers, min: sorted[0], max: sorted[sorted.length - 1] };
  },

  // Spearman rank correlation
  spearman(x, y) {
    if (x.length !== y.length || x.length < 3) return null;
    const rank = arr => {
      const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      const ranks = new Array(arr.length);
      sorted.forEach((item, rank) => ranks[item.i] = rank + 1);
      return ranks;
    };
    const rx = rank(x), ry = rank(y);
    const d2 = rx.map((r, i) => Math.pow(r - ry[i], 2)).reduce((a, b) => a + b, 0);
    const n = x.length;
    const rs = 1 - (6 * d2) / (n * (n * n - 1));
    return Utils.round(rs, 4);
  }
};

window.StatisticsEngine = StatisticsEngine;
