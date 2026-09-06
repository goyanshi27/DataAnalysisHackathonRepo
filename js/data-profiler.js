/* ============================================================
   DATA-PROFILER.JS — Automatic dataset profiling
   ============================================================ */
'use strict';

const DataProfiler = {

  profile(data, columns) {
    if (!data || !data.length) return null;
    const cols = columns || Object.keys(data[0]);
    const n = data.length;

    // Duplicate detection (hash first 5 columns as key)
    const keySet = new Set();
    let dupCount = 0;
    data.forEach(row => {
      const key = cols.slice(0, 5).map(c => String(row[c] ?? '')).join('|');
      if (keySet.has(key)) dupCount++;
      else keySet.add(key);
    });

    const profiles = cols.map(col => this._profileColumn(data, col, n));
    const numericCols = profiles.filter(p => p.type === 'numeric');
    const categoricalCols = profiles.filter(p => p.type === 'categorical' || p.type === 'text');
    const dateCols = profiles.filter(p => p.type === 'date');
    const idCols = profiles.filter(p => p.type === 'identifier');
    const totalMissing = profiles.reduce((s, p) => s + p.missingCount, 0);

    return {
      rows: n, cols: cols.length,
      duplicates: dupCount, duplicatePct: Utils.round(dupCount / n * 100, 2),
      totalMissing, totalMissingPct: Utils.round(totalMissing / (n * cols.length) * 100, 2),
      numericCols: numericCols.length, categoricalCols: categoricalCols.length,
      dateCols: dateCols.length, idCols: idCols.length,
      columns: profiles
    };
  },

  _profileColumn(data, col, n) {
    const values = data.map(r => r[col]);
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    const missing = n - nonNull.length;
    const unique = new Set(nonNull.map(v => String(v))).size;
    const type = Utils.detectType(nonNull.slice(0, 200));

    let stats = null;
    if (type === 'numeric') {
      const nums = nonNull.map(v => Utils.parseNum(v)).filter(v => v !== null);
      stats = StatisticsEngine.describe(nums);
    }

    let topValues = [];
    if (type === 'categorical' || type === 'text') {
      const freq = {};
      nonNull.forEach(v => { const k = String(v); freq[k] = (freq[k] || 0) + 1; });
      topValues = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([v, c]) => ({ value: v, count: c, pct: Utils.round(c / n * 100, 2) }));
    }

    return {
      name: col, type, missingCount: missing,
      missingPct: Utils.round(missing / n * 100, 2),
      uniqueCount: unique, uniquePct: Utils.round(unique / n * 100, 2),
      stats, topValues
    };
  },

  qualityScore(profile) {
    if (!profile) return 0;
    let score = 100;
    score -= Math.min(profile.duplicatePct * 2, 30);
    score -= Math.min(profile.totalMissingPct * 3, 40);
    return Math.max(0, Math.round(score));
  },

  qualityLabel(score) {
    if (score >= 85) return { label: 'Excellent', color: '#2DD4BF' };
    if (score >= 70) return { label: 'Good', color: '#00E5FF' };
    if (score >= 50) return { label: 'Fair', color: '#F59E0B' };
    return { label: 'Poor', color: '#FF4D6D' };
  }
};

window.DataProfiler = DataProfiler;
