/* ============================================================
   CLEANING-ENGINE.JS — Data cleaning detection & operations
   ============================================================ */
'use strict';

const CleaningEngine = {

  // Detect all issues — returns array of issue objects
  detectIssues(data, profile) {
    const issues = [];
    if (!data || !data.length || !profile) return issues;

    // Duplicate rows
    if (profile.duplicates > 0) {
      issues.push({
        type: 'duplicates', severity: profile.duplicates > data.length * 0.05 ? 'high' : 'medium',
        title: `${Utils.fmtNumber(profile.duplicates)} potential duplicate rows detected`,
        description: `${profile.duplicatePct}% of rows appear to be duplicates based on key columns.`,
        action: 'REMOVE_DUPLICATES', actionLabel: 'Remove Duplicates',
        count: profile.duplicates
      });
    }

    // Missing values per column
    profile.columns.forEach(col => {
      if (col.missingPct > 5) {
        issues.push({
          type: 'missing', severity: col.missingPct > 30 ? 'high' : 'medium',
          title: `Column "${col.name}" has ${col.missingPct}% missing values`,
          description: `${Utils.fmtNumber(col.missingCount)} of ${Utils.fmtNumber(data.length)} rows are missing this field.`,
          action: 'HANDLE_MISSING', actionLabel: 'Handle Missing', column: col.name,
          count: col.missingCount
        });
      }
    });

    // Whitespace in text columns
    const textCols = profile.columns.filter(c => c.type === 'text' || c.type === 'categorical');
    textCols.forEach(col => {
      const withWS = data.slice(0, 500).filter(r => {
        const v = r[col.name];
        return typeof v === 'string' && (v !== v.trim() || v.includes('  '));
      }).length;
      if (withWS > 5) {
        issues.push({
          type: 'whitespace', severity: 'low',
          title: `Column "${col.name}" may have whitespace issues`,
          description: `Detected ${withWS}+ values with leading/trailing or extra spaces.`,
          action: 'TRIM_TEXT', actionLabel: 'Trim Whitespace', column: col.name,
          count: withWS
        });
      }
    });

    // Numeric stored as text
    const textLikeCols = profile.columns.filter(c => c.type === 'text' || c.type === 'identifier');
    textLikeCols.forEach(col => {
      const sample = data.slice(0, 200).map(r => r[col.name]).filter(v => v !== null && v !== '');
      const numLike = sample.filter(v => Utils.isNumeric(String(v).replace(/,/g, ''))).length;
      if (numLike / sample.length > 0.7 && col.type !== 'numeric') {
        issues.push({
          type: 'numeric_text', severity: 'low',
          title: `Column "${col.name}" appears numeric but stored as text`,
          description: `${Math.round(numLike / sample.length * 100)}% of values look like numbers.`,
          action: 'CONVERT_NUMERIC', actionLabel: 'Convert to Numeric', column: col.name,
          count: numLike
        });
      }
    });

    return issues;
  },

  // Apply a cleaning operation — returns { data, changeLog }
  applyOperation(data, operation, options = {}) {
    let cleaned = [...data];
    let changeLog = '';

    switch (operation) {
      case 'REMOVE_DUPLICATES': {
        const cols = options.keyColumns || Object.keys(data[0] || {}).slice(0, 5);
        const seen = new Set();
        const before = cleaned.length;
        cleaned = cleaned.filter(row => {
          const key = cols.map(c => String(row[c] ?? '')).join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const removed = before - cleaned.length;
        changeLog = `Removed ${Utils.fmtNumber(removed)} duplicate rows. ${Utils.fmtNumber(cleaned.length)} rows remain.`;
        break;
      }
      case 'TRIM_TEXT': {
        const col = options.column;
        let trimmed = 0;
        if (col) {
          cleaned = cleaned.map(row => {
            if (typeof row[col] === 'string' && row[col] !== row[col].trim()) {
              trimmed++;
              return { ...row, [col]: row[col].trim().replace(/\s+/g, ' ') };
            }
            return row;
          });
          changeLog = `Trimmed whitespace in "${col}" for ${Utils.fmtNumber(trimmed)} rows.`;
        }
        break;
      }
      case 'CONVERT_NUMERIC': {
        const col = options.column;
        let converted = 0;
        if (col) {
          cleaned = cleaned.map(row => {
            const v = row[col];
            if (v !== null && v !== '') {
              const n = parseFloat(String(v).replace(/,/g, ''));
              if (!isNaN(n)) { converted++; return { ...row, [col]: n }; }
            }
            return row;
          });
          changeLog = `Converted ${Utils.fmtNumber(converted)} values in "${col}" to numeric.`;
        }
        break;
      }
      case 'HANDLE_MISSING': {
        const col = options.column;
        const strategy = options.strategy || 'remove';
        let affected = 0;
        if (col) {
          if (strategy === 'remove') {
            const before = cleaned.length;
            cleaned = cleaned.filter(r => r[col] !== null && r[col] !== undefined && r[col] !== '');
            affected = before - cleaned.length;
            changeLog = `Removed ${Utils.fmtNumber(affected)} rows with missing "${col}".`;
          } else if (strategy === 'mean') {
            const nums = StatisticsEngine.extractNumeric(cleaned, col);
            const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
            cleaned = cleaned.map(row => {
              if (row[col] === null || row[col] === '') { affected++; return { ...row, [col]: mean }; }
              return row;
            });
            changeLog = `Filled ${Utils.fmtNumber(affected)} missing values in "${col}" with mean (${Utils.round(mean, 4)}).`;
          }
        }
        break;
      }
      default:
        changeLog = `Unknown operation: ${operation}`;
    }

    return { data: cleaned, changeLog, rowsBefore: data.length, rowsAfter: cleaned.length };
  }
};

window.CleaningEngine = CleaningEngine;
