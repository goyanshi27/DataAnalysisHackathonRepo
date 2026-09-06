'use strict';
/* ============================================================
   UPLOAD-ENGINE.JS — Drag/drop Excel & CSV analysis engine
   All analysis performed client-side from uploaded file.
   ============================================================ */

const UploadEngine = {

  currentData:    null,
  currentProfile: null,
  currentWorkbook: null,
  selectedSheet:  null,
  cleanLog:       [],

  renderPage(container) {
    container.innerHTML = `
      <div class="section-header">
        <div class="section-title">Upload &amp; Analyze</div>
        <div class="section-question">Drop your data. Discover the story.</div>
        <div class="section-source" style="font-size:12px;color:#2DD4BF">🔒 Your data is processed locally in your browser — nothing is transmitted anywhere.</div>
      </div>

      <div class="upload-zone" id="upload-zone" role="button" tabindex="0" aria-label="Upload Excel or CSV file">
        <div class="upload-icon">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="upload-title">Drop your file here</div>
        <div class="upload-sub">or click to browse from your computer</div>
        <div class="upload-formats" style="margin-top:14px;display:flex;gap:8px;justify-content:center">
          <span class="badge badge-cyan">.xlsx</span>
          <span class="badge badge-purple">.xls</span>
          <span class="badge badge-green">.csv</span>
        </div>
        <input type="file" id="upload-input" accept=".xlsx,.xls,.csv" style="display:none" aria-label="File input"/>
      </div>

      <div id="upload-results" style="margin-top:24px"></div>`;

    this._attachEvents();
  },

  _attachEvents() {
    const zone  = document.getElementById('upload-zone');
    const input = document.getElementById('upload-input');
    if (!zone || !input) return;

    zone.addEventListener('click',    function() { input.click(); });
    zone.addEventListener('keydown',  function(e) { if (e.key === 'Enter' || e.key === ' ') input.click(); });
    zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave',function() { zone.classList.remove('drag-over'); });
    zone.addEventListener('drop',     function(e) {
      e.preventDefault(); zone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) UploadEngine._processFile(f);
    });
    input.addEventListener('change',  function(e) {
      const f = e.target.files[0];
      if (f) UploadEngine._processFile(f);
    });
  },

  _processFile(file) {
    const results = document.getElementById('upload-results');
    if (!results) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(ext)) {
      Utils.toast('Unsupported file type. Please use .xlsx, .xls, or .csv', 'error');
      return;
    }

    const sizeKB = Math.round(file.size / 1024);
    results.innerHTML = `
      <div class="glass-card" style="padding:20px">
        <div style="display:flex;align-items:center;gap:14px">
          <div class="loading-spinner" style="width:28px;height:28px;border-width:2px"></div>
          <div>
            <div style="font-weight:600">${Utils.escapeHtml(file.name)}</div>
            <div style="font-size:12px;color:#64748b">${sizeKB} KB · Reading file…</div>
          </div>
        </div>
      </div>`;

    const reader = new FileReader();

    if (ext === 'csv') {
      reader.onload = function(e) {
        try {
          const parsed = DataLoader.parseCSV(e.target.result);
          if (!parsed.ok) {
            results.innerHTML = `<div class="error-state"><div class="error-title">CSV Parse Error</div><div class="error-desc">${Utils.escapeHtml(parsed.error)}</div></div>`;
            return;
          }
          UploadEngine.currentData = parsed.data;
          UploadEngine.selectedSheet = file.name;
          UploadEngine._showAnalysis(results, parsed.data, file.name, sizeKB);
        } catch(err) {
          results.innerHTML = `<div class="error-state"><div class="error-title">Read Error</div><div class="error-desc">${Utils.escapeHtml(err.message)}</div></div>`;
        }
      };
      reader.onerror = function() { results.innerHTML = '<div class="error-state"><div class="error-title">File Read Error</div></div>'; };
      reader.readAsText(file);
    } else {
      reader.onload = function(e) {
        try {
          const parsed = DataLoader.parseUploadedWorkbook(e.target.result);
          if (!parsed.ok) {
            results.innerHTML = `<div class="error-state"><div class="error-title">Excel Parse Error</div><div class="error-desc">${Utils.escapeHtml(parsed.error)}</div></div>`;
            return;
          }
          UploadEngine.currentWorkbook = parsed;
          UploadEngine._showSheetSelector(results, parsed, file.name, sizeKB);
        } catch(err) {
          results.innerHTML = `<div class="error-state"><div class="error-title">Excel Read Error</div><div class="error-desc">${Utils.escapeHtml(err.message)}</div></div>`;
        }
      };
      reader.onerror = function() { results.innerHTML = '<div class="error-state"><div class="error-title">File Read Error</div></div>'; };
      reader.readAsArrayBuffer(file);
    }
  },

  _showSheetSelector(container, parsed, filename, sizeKB) {
    const sheets = Object.entries(parsed.sheets);
    container.innerHTML = `
      <div class="glass-card" style="padding:20px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div>
            <div style="font-weight:600">${Utils.escapeHtml(filename)}</div>
            <div style="font-size:12px;color:#64748b">${sizeKB} KB · ${sheets.length} worksheet${sheets.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style="font-size:13px;color:#94A3B8;margin-bottom:12px">Select a worksheet to analyze:</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
          ${sheets.map(function(entry) {
            const name = entry[0], s = entry[1];
            return `<button class="sheet-select-btn" data-sheet="${Utils.escapeHtml(name)}"
              style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;
                     padding:14px;text-align:left;cursor:pointer;color:#fff;font-family:Inter,sans-serif;
                     transition:all .2s;width:100%">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${Utils.escapeHtml(name)}</div>
              <div style="font-size:11px;color:#64748b">${Utils.fmtNumber(s.rows)} rows · ${s.cols} columns</div>
              ${s.rows === 0 ? '<div style="font-size:10px;color:#F59E0B;margin-top:3px">Empty sheet</div>' : ''}
            </button>`;
          }).join('')}
        </div>
      </div>
      <div id="sheet-analysis-area"></div>`;

    container.querySelectorAll('.sheet-select-btn').forEach(function(btn) {
      btn.addEventListener('mouseenter', function() { btn.style.borderColor = 'rgba(0,229,255,0.4)'; btn.style.background = 'rgba(0,229,255,0.06)'; });
      btn.addEventListener('mouseleave', function() { btn.style.borderColor = 'rgba(255,255,255,0.1)'; btn.style.background = 'rgba(255,255,255,0.04)'; });
      btn.addEventListener('click', function() {
        const name  = btn.dataset.sheet;
        const sheet = parsed.sheets[name];
        if (!sheet || !sheet.data || !sheet.data.length) {
          Utils.toast('This worksheet is empty.', 'error'); return;
        }
        UploadEngine.currentData    = sheet.data;
        UploadEngine.selectedSheet  = name;
        const area = document.getElementById('sheet-analysis-area');
        if (area) UploadEngine._showAnalysis(area, sheet.data, name, 0);
      });
    });
  },

  _showAnalysis(container, data, sheetName, sizeKB) {
    if (!data || !data.length) {
      container.innerHTML = '<div class="error-state"><div class="error-title">Empty Sheet</div><div class="error-desc">This worksheet contains no analyzable records.</div></div>';
      return;
    }

    const profile  = DataProfiler.profile(data);
    this.currentProfile = profile;
    const issues   = CleaningEngine.detectIssues(data, profile);
    const outliers = OutlierEngine.detectAll(data.slice(0, 2000));
    const numCols  = profile.columns.filter(function(c) { return c.type === 'numeric'; });
    const corr     = numCols.length >= 2 ? CorrelationEngine.buildMatrix(data.slice(0, 1000)) : null;
    const insights = InsightEngine.generateUploadInsights(data, profile, corr);
    const recs     = ChartRecommendation.recommend(profile);
    const score    = DataProfiler.qualityScore(profile);
    const ql       = DataProfiler.qualityLabel(score);

    container.innerHTML = `
      <!-- FILE SUMMARY -->
      <div class="glass-card" style="padding:20px;margin-bottom:18px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
          <div>
            <div style="font-size:17px;font-weight:600">${Utils.escapeHtml(sheetName)}</div>
            <div style="font-size:12px;color:#64748b">SOURCE: Uploaded Dataset${sizeKB ? ' · ' + sizeKB + ' KB' : ''}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:28px;font-weight:700;color:${ql.color}">${score}</div>
            <div style="font-size:11px;color:#64748b">Quality Score · ${ql.label}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px">
          ${[
            ['Rows',        Utils.fmtNumber(profile.rows),     '#00E5FF'],
            ['Columns',     profile.cols,                      '#8B5CF6'],
            ['Duplicates',  Utils.fmtNumber(profile.duplicates),'#F59E0B'],
            ['Missing %',   profile.totalMissingPct + '%',     '#FF4D6D'],
            ['Numeric',     profile.numericCols,               '#2DD4BF'],
            ['Categorical', profile.categoricalCols,           '#94A3B8'],
          ].map(function(m) {
            return `<div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.07)">
              <div style="font-size:20px;font-weight:700;color:${m[2]}">${Utils.escapeHtml(String(m[1]))}</div>
              <div style="font-size:10px;color:#64748b;margin-top:3px;text-transform:uppercase;letter-spacing:.5px">${m[0]}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- TABS -->
      <div class="tabs" style="margin-bottom:16px;flex-wrap:wrap" id="upload-tabs">
        ${['Profile','Statistics','Cleaning','Charts','Correlation','Outliers','Insights','Table'].map(function(t, i) {
          return `<button class="tab${i===0?' on':''}" data-tab="${t}">${t}</button>`;
        }).join('')}
      </div>
      <div id="upload-tab-content"></div>`;

    // Tab switching
    container.querySelectorAll('#upload-tabs .tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        container.querySelectorAll('#upload-tabs .tab').forEach(function(b) { b.classList.remove('on'); });
        btn.classList.add('on');
        UploadEngine._renderTab(btn.dataset.tab, document.getElementById('upload-tab-content'), data, profile, issues, outliers, corr, insights, recs);
      });
    });
    this._renderTab('Profile', document.getElementById('upload-tab-content'), data, profile, issues, outliers, corr, insights, recs);
  },

  _renderTab(tab, container, data, profile, issues, outliers, corr, insights, recs) {
    if (!container) return;
    // Destroy any existing charts in the tab area
    container.querySelectorAll('canvas[id]').forEach(function(c) { ChartEngine.destroy(c.id); });

    switch(tab) {
      case 'Profile':     this._tabProfile(container, profile);                   break;
      case 'Statistics':  this._tabStats(container, profile);                     break;
      case 'Cleaning':    this._tabCleaning(container, issues, data);             break;
      case 'Charts':      this._tabCharts(container, data, profile, recs);        break;
      case 'Correlation': this._tabCorrelation(container, corr);                  break;
      case 'Outliers':    this._tabOutliers(container, outliers);                 break;
      case 'Insights':    this._tabInsights(container, insights);                 break;
      case 'Table':       this._tabTable(container, data, profile);               break;
      default: container.innerHTML = '';
    }
  },

  _tabProfile(container, profile) {
    container.innerHTML = `
      <div class="data-table-container">
        <div class="table-toolbar">
          <span style="font-size:13px;font-weight:600">Column Profiles</span>
          <span class="table-info">${profile.cols} columns detected</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Missing %</th><th>Unique</th><th>Top Value</th></tr></thead>
            <tbody>
              ${profile.columns.map(function(col) {
                const typeBadge = {
                  numeric: 'badge-cyan', date: 'badge-green', categorical: 'badge-purple',
                  identifier: 'badge-amber', text: 'badge-amber', empty: 'badge-red'
                }[col.type] || 'badge-amber';
                return `<tr>
                  <td style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(col.name)}</td>
                  <td><span class="badge ${typeBadge}">${col.type}</span></td>
                  <td>${Utils.fmtNumber(col.missingCount)}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="width:50px;height:5px;background:rgba(255,255,255,0.08);border-radius:3px">
                        <div style="width:${Math.min(col.missingPct,100)}%;height:100%;background:${col.missingPct>30?'#FF4D6D':col.missingPct>10?'#F59E0B':'#2DD4BF'};border-radius:3px"></div>
                      </div>
                      <span>${col.missingPct}%</span>
                    </div>
                  </td>
                  <td>${Utils.fmtNumber(col.uniqueCount)}</td>
                  <td style="color:#94a3b8;max-width:150px;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(col.topValues[0]?.value || '—')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  _tabStats(container, profile) {
    const numCols = profile.columns.filter(function(c) { return c.type === 'numeric' && c.stats; });
    if (!numCols.length) {
      container.innerHTML = '<div class="empty-state" style="height:200px"><div class="empty-title">No Numeric Columns</div><div class="empty-desc">No numeric variables were detected in this dataset.</div></div>';
      return;
    }
    container.innerHTML = `
      <div class="data-table-container">
        <div class="table-toolbar"><span style="font-size:13px;font-weight:600">Descriptive Statistics</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Column</th><th>Count</th><th>Mean</th><th>Median</th><th>Std Dev</th><th>Min</th><th>Max</th><th>Q1</th><th>Q3</th><th>IQR</th></tr></thead>
            <tbody>
              ${numCols.map(function(col) {
                const s = col.stats;
                return `<tr>
                  <td style="font-weight:600">${Utils.escapeHtml(col.name)}</td>
                  <td>${Utils.fmtNumber(s.count)}</td>
                  <td>${s.mean}</td><td>${s.median}</td><td>${s.std}</td>
                  <td>${s.min}</td><td>${s.max}</td><td>${s.q1}</td><td>${s.q3}</td><td>${s.iqr}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  _tabCleaning(container, issues, data) {
    if (!issues.length) {
      container.innerHTML = '<div class="insight-panel"><div class="insight-item positive"><div class="insight-what">✓ No Major Issues Detected</div>Dataset appears clean based on automated analysis.</div></div>';
      return;
    }
    container.innerHTML = '<div id="clean-log" style="margin-bottom:12px"></div>' +
      issues.map(function(iss, i) {
        const color = iss.severity === 'high' ? '#FF4D6D' : '#F59E0B';
        return `<div class="cleaning-issue" id="issue-${i}">
          <div class="cleaning-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="cleaning-desc">
            <div style="font-weight:600;margin-bottom:4px">${Utils.escapeHtml(iss.title)}</div>
            ${Utils.escapeHtml(iss.description)}
          </div>
          <div class="cleaning-action">
            <button class="btn-sm primary" data-idx="${i}" data-action="${iss.action}" data-col="${iss.column || ''}">${Utils.escapeHtml(iss.actionLabel)}</button>
          </div>
        </div>`;
      }).join('');

    container.querySelectorAll('.cleaning-action .btn-sm').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const result = CleaningEngine.applyOperation(UploadEngine.currentData, btn.dataset.action, { column: btn.dataset.col });
        UploadEngine.currentData = result.data;
        UploadEngine.cleanLog.push(result.changeLog);
        const log = document.getElementById('clean-log');
        if (log) log.innerHTML = `<div class="insight-item positive"><div class="insight-what">✓ Applied</div>${Utils.escapeHtml(result.changeLog)}</div>` + log.innerHTML;
        const issEl = document.getElementById('issue-' + btn.dataset.idx);
        if (issEl) issEl.remove();
        Utils.toast(result.changeLog, 'success');
      });
    });
  },

  _tabCharts(container, data, profile, recs) {
    if (!recs || !recs.length) {
      container.innerHTML = '<div class="empty-state" style="height:200px"><div class="empty-title">No Chart Recommendations</div><div class="empty-desc">Not enough compatible data for automatic chart recommendations. Try the Data Explorer page for manual chart building.</div></div>';
      return;
    }

    const show = recs.slice(0, 4);
    container.innerHTML = show.map(function(rec, i) {
      return `<div class="chart-container" style="margin-bottom:18px">
        <div class="chart-header">
          <div>
            <div class="chart-title">${Utils.escapeHtml(rec.title)}</div>
            <div class="chart-subtitle">${Utils.escapeHtml(rec.reason)}</div>
            <div class="chart-source">SOURCE: Uploaded Dataset</div>
          </div>
          <div class="chart-toolbar">
            <button class="chart-tool-btn" onclick="ChartEngine.exportPNG('up-chart-${i}','chart-export')" title="Export PNG">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        </div>
        <div class="chart-body" style="height:260px;position:relative;padding:0 4px 4px">
          <canvas id="up-chart-${i}" style="width:100%;height:100%"></canvas>
        </div>
      </div>`;
    }).join('');

    setTimeout(function() {
      show.forEach(function(rec, i) {
        UploadEngine._drawAutoChart('up-chart-' + i, rec, data, profile);
      });
    }, 80);
  },

  _drawAutoChart(canvasId, rec, data, profile) {
    const sample  = data.slice(0, 500);
    const numCols = profile.columns.filter(function(c) { return c.type === 'numeric'; }).map(function(c) { return c.name; });
    const catCols = profile.columns.filter(function(c) { return c.type === 'categorical'; }).map(function(c) { return c.name; });

    try {
      if (rec.type === 'histogram' && numCols.length) {
        const key = rec.xKey || numCols[0];
        const vals = StatisticsEngine.extractNumeric(sample, key);
        ChartEngine.histogram(canvasId, vals, { xLabel: key });

      } else if (rec.type === 'scatter' && numCols.length >= 2) {
        const xK = rec.xKey || numCols[0];
        const yK = rec.yKey || numCols[1];
        const pts = sample.map(function(r) {
          return { x: Utils.parseNum(r[xK]), y: Utils.parseNum(r[yK]) };
        }).filter(function(p) { return p.x !== null && p.y !== null && isFinite(p.x) && isFinite(p.y) }).slice(0, 300);
        ChartEngine.scatter(canvasId, [{ label: xK + ' vs ' + yK, data: pts, color: '#00E5FF', radius: 3 }], { xLabel: xK, yLabel: yK });

      } else if (rec.type === 'bubble' && numCols.length >= 3) {
        const xK = numCols[0], yK = numCols[1], rK = numCols[2];
        const rVals = sample.map(function(r) { return Utils.parseNum(r[rK]); }).filter(function(v) { return v !== null; });
        const rMin = Math.min.apply(null, rVals), rMax = Math.max.apply(null, rVals), rRange = rMax - rMin || 1;
        const pts = sample.map(function(r) {
          const x = Utils.parseNum(r[xK]), y = Utils.parseNum(r[yK]), rv = Utils.parseNum(r[rK]);
          if (x === null || y === null) return null;
          return { x: x, y: y, r: rv !== null ? 4 + ((rv - rMin) / rRange) * 20 : 8 };
        }).filter(Boolean).slice(0, 100);
        ChartEngine.bubble(canvasId, [{ label: xK + ' vs ' + yK, data: pts, color: '#8B5CF6' }]);

      } else if (rec.type === 'doughnut' && catCols.length) {
        const key = rec.xKey || catCols[0];
        const freq = {};
        sample.forEach(function(r) { const k = String(r[key] || ''); freq[k] = (freq[k] || 0) + 1; });
        const sorted = Object.entries(freq).sort(function(a,b){return b[1]-a[1];}).slice(0, 10);
        ChartEngine.doughnut(canvasId, sorted.map(function(e){return e[0];}), sorted.map(function(e){return e[1];}));

      } else if (rec.type === 'line' && numCols.length) {
        const key = rec.yKey || numCols[0];
        const vals = StatisticsEngine.extractNumeric(sample, key).slice(0, 100);
        ChartEngine.line(canvasId, vals.map(function(_,i){return String(i+1);}), [{ label: key, data: vals, color: '#00E5FF', fill: true }]);

      } else if (rec.type === 'horizontalBar' && catCols.length && numCols.length) {
        const xK = rec.xKey || catCols[0];
        const yK = rec.yKey || numCols[0];
        const grouped = Utils.groupBy(sample, xK);
        const labels = Object.keys(grouped).slice(0, 20);
        const vals = labels.map(function(k) { return Utils.round(Utils.avgBy(grouped[k], yK), 2); });
        ChartEngine.horizontalBar(canvasId, labels, vals, { label: 'Avg ' + yK });

      } else if (rec.type === 'correlation' && numCols.length >= 2) {
        // Render correlation table in place of canvas
        const corr = CorrelationEngine.buildMatrix(sample.slice(0, 500));
        ChartEngine.showEmpty(canvasId, '(Correlation matrix rendered below)');
        const wrap = document.getElementById(canvasId)?.closest('.chart-body');
        if (wrap) {
          const div = document.createElement('div');
          div.id = canvasId + '-corr';
          div.style.cssText = 'padding:10px;overflow-x:auto';
          wrap.appendChild(div);
          ChartEngine.correlationTable(canvasId + '-corr', corr);
        }

      } else {
        // Fallback: bar chart of first cat × first num
        if (catCols.length && numCols.length) {
          const xK = catCols[0], yK = numCols[0];
          const grouped = Utils.groupBy(sample, xK);
          const labels = Object.keys(grouped).slice(0, 20);
          const vals = labels.map(function(k) { return Utils.round(Utils.avgBy(grouped[k], yK), 2); });
          ChartEngine.bar(canvasId, labels, [{ label: 'Avg ' + yK, data: vals, borderRadius: 4 }], { plugins: { legend: { display: false } } });
        } else if (numCols.length) {
          const key = numCols[0];
          const vals = StatisticsEngine.extractNumeric(sample, key).slice(0, 30);
          ChartEngine.bar(canvasId, vals.map(function(_,i){return String(i+1);}), [{ label: key, data: vals, color: '#00E5FF', borderRadius: 4 }], { plugins: { legend: { display: false } } });
        } else {
          ChartEngine.showEmpty(canvasId, 'No compatible columns for this chart type.');
        }
      }
    } catch(err) {
      console.warn('[UploadEngine] Chart draw error for', canvasId, ':', err);
      ChartEngine.showEmpty(canvasId, 'Chart render error: ' + err.message);
    }
  },

  _tabCorrelation(container, corr) {
    if (!corr) {
      container.innerHTML = '<div class="empty-state" style="height:200px"><div class="empty-title">Correlation Not Available</div><div class="empty-desc">At least 2 numeric columns are required to build a correlation matrix.</div></div>';
      return;
    }
    const top = CorrelationEngine.topCorrelations(corr, 5);
    container.innerHTML = `
      <div class="glass-card" style="padding:20px;margin-bottom:18px">
        <div class="chart-title" style="margin-bottom:14px">Pearson Correlation Matrix</div>
        <div id="upload-corr-matrix"></div>
        <div style="margin-top:10px;font-size:11px;color:#64748b;font-style:italic">⚠ Correlation does not imply causation.</div>
      </div>
      <div class="glass-card" style="padding:20px">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px">Strongest Correlations</div>
        ${top.map(function(c) {
          return `<div class="stat-row">
            <span class="stat-label">${Utils.escapeHtml(c.col1)} × ${Utils.escapeHtml(c.col2)}</span>
            <span class="stat-value" style="color:${c.r>0?'#00E5FF':'#FF4D6D'}">${c.r} — ${CorrelationEngine.describeCorrelation(c.r)}</span>
          </div>`;
        }).join('')}
        <div style="margin-top:10px;font-size:11px;color:#64748b;font-style:italic">⚠ Association does not imply causation.</div>
      </div>`;
    ChartEngine.correlationTable('upload-corr-matrix', corr);
  },

  _tabOutliers(container, outliers) {
    if (!outliers.length) {
      container.innerHTML = '<div class="insight-panel"><div class="insight-item positive"><div class="insight-what">✓ No Significant Outliers</div>IQR-based analysis found no extreme values above threshold.</div></div>';
      return;
    }
    container.innerHTML = `
      <div class="data-table-container">
        <div class="table-toolbar"><span style="font-size:13px;font-weight:600">Outlier Detection (IQR Method)</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Column</th><th>Total Rows</th><th>Outliers</th><th>Outlier %</th><th>Lower Bound</th><th>Upper Bound</th><th>Severity</th></tr></thead>
            <tbody>
              ${outliers.map(function(o) {
                return `<tr>
                  <td style="font-weight:600">${Utils.escapeHtml(o.key)}</td>
                  <td>${Utils.fmtNumber(o.total)}</td>
                  <td>${Utils.fmtNumber(o.outlierCount)}</td>
                  <td>${o.outlierPct}%</td>
                  <td>${o.lowerBound}</td>
                  <td>${o.upperBound}</td>
                  <td><span class="risk-badge ${o.outlierPct>10?'risk-critical':o.outlierPct>5?'risk-high':'risk-medium'}">${OutlierEngine.severity(o.outlierPct).toUpperCase()}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  _tabInsights(container, insights) {
    if (!insights.length) {
      container.innerHTML = '<div class="empty-state" style="height:200px"><div class="empty-title">No Significant Insights</div><div class="empty-desc">No significant patterns were automatically detected in this dataset.</div></div>';
      return;
    }
    container.innerHTML = '<div class="insight-panel"><div class="insight-panel-title">Analytical Insights</div><div id="upload-insights-content"></div></div>';
    InsightEngine.renderInsights(document.getElementById('upload-insights-content'), insights);
  },

  _tabTable(container, data, profile) {
    container.innerHTML = '<div id="upload-data-table"></div>';
    const cols = profile.columns.slice(0, 15).map(function(c) { return c.name; });
    TableEngine.create('upload-data-table', data, cols, { pageSize: 20 });
  }
};

window.UploadEngine = UploadEngine;
