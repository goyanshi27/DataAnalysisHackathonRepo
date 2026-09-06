'use strict';
/* ============================================================
   APP.JS — Main application entry point & router
   ============================================================ */

const DEBUG = (new URLSearchParams(window.location.search)).get('debug') === 'true';

const App = {

  currentPage: 'command-center',
  dataReady: false,

  async init() {
    // Verify libraries loaded
    if (typeof XLSX === 'undefined') {
      this._showFatalError('SheetJS (XLSX) library failed to load. Check CDN or network connection.');
      return;
    }
    if (typeof Chart === 'undefined') {
      this._showFatalError('Chart.js library failed to load. Check CDN or network connection.');
      return;
    }
    if (typeof Papa === 'undefined') {
      console.warn('[App] PapaParse not loaded — CSV parsing will be limited.');
    }

    this._attachNavigation();
    this._attachSidebar();
    this._attachExport();
    this._attachPresentation();
    this._attachFullscreenClose();
    if (DEBUG) this._showDebugPanel();
    await this._loadData();
  },

  _showFatalError(msg) {
    const c = document.getElementById('page-content') || document.body;
    c.innerHTML = `<div class="error-state" style="padding:60px 40px">
      <div class="error-title">Library Error</div>
      <div class="error-desc">${Utils.escapeHtml(msg)}</div>
    </div>`;
    const loading = document.getElementById('loading-state');
    if (loading) loading.style.display = 'none';
  },

  async _loadData() {
    const statusDot  = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const setStatus  = (cls, txt) => {
      if (statusDot)  statusDot.className = 'status-dot ' + cls;
      if (statusText) statusText.textContent = txt;
    };

    setStatus('loading', 'Loading workbook…');

    // Try all likely paths — works both locally (file://) via http-server and deployed
    const paths = [
      'public/data/Olist_Final_Analytical_Workbook.xlsx',
      './public/data/Olist_Final_Analytical_Workbook.xlsx',
      'data/Olist_Final_Analytical_Workbook.xlsx',
      './data/Olist_Final_Analytical_Workbook.xlsx',
      '/data/Olist_Final_Analytical_Workbook.xlsx',
      '/public/data/Olist_Final_Analytical_Workbook.xlsx',
    ];

    let loaded = false;
    let lastError = '';
    for (const path of paths) {
      if (DEBUG) console.log('[App] Trying path:', path);
      const result = await DataLoader.loadWorkbook(path);
      if (result.ok) {
        loaded = true;
        if (DEBUG) console.log('[App] Loaded from:', path);
        break;
      }
      lastError = result.error || '';
    }

    if (!loaded) {
      setStatus('error', 'Workbook not found');
      Utils.toast(
        'Workbook not found. Serve the project with a local HTTP server (e.g. python -m http.server 8080) and place the Excel file at: public/data/Olist_Final_Analytical_Workbook.xlsx',
        'error', 10000
      );
      if (DEBUG) console.error('[App] All paths failed. Last error:', lastError);
      this.dataReady = false;
      this._hideSkeleton();
      this._navigate('command-center');
      return;
    }

    this.dataReady = true;
    const sheetCheck = DataLoader.checkSheets();

    if (DEBUG) {
      console.log('[App] Sheet names:', sheetCheck.available);
      console.log('[App] Missing sheets:', sheetCheck.missing);
      DataLoader.listSheets().forEach(s => {
        console.log(`[SHEET] ${s.name}: ${s.rows} rows, ${s.cols} cols`, s.columns ? s.columns.slice(0,5) : []);
      });
    }

    if (sheetCheck.missing.length) {
      console.warn('[App] Missing analytical sheets:', sheetCheck.missing.join(', '));
    }

    setStatus('ready', sheetCheck.available.length + ' sheets loaded');

    this._populateFilters();
    this._hideSkeleton();
    this._navigate('command-center');
    FilterEngine.subscribe(() => { this._navigate(this.currentPage); });
  },

  _hideSkeleton() {
    const loading = document.getElementById('loading-state');
    if (loading) loading.style.display = 'none';
  },

  _populateFilters() {
    try {
      const stateRisk = AnalysisEngine.getStateRisk();
      const catRisk   = AnalysisEngine.getCategoryRisk();
      const payData   = AnalysisEngine.getPaymentAnalysis();
      FilterEngine.populateDropdowns(stateRisk, catRisk, payData);
    } catch(e) {
      console.warn('[App] Filter population error:', e);
    }
  },

  _navigate(page) {
    this.currentPage = page;
    const content = document.getElementById('page-content');
    if (!content) return;

    // Nav active state
    document.querySelectorAll('.nav-item[data-page]').forEach(function(item) {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Topbar title
    const navItem = document.querySelector('.nav-item[data-page="' + page + '"]');
    const titleEl = document.getElementById('topbar-title');
    if (titleEl && navItem) {
      const spanEl = navItem.querySelector('span');
      titleEl.textContent = spanEl ? spanEl.textContent : page;
    }

    // Destroy all charts
    try {
      Object.keys(ChartEngine.registry).forEach(function(id) { ChartEngine.destroy(id); });
    } catch(e) {}

    // Skeleton
    content.innerHTML = [
      '<div style="padding:0">',
      '<div class="skeleton skeleton-kpi" style="margin-bottom:10px;border-radius:12px;height:80px"></div>',
      '<div class="skeleton" style="height:280px;border-radius:12px;margin-bottom:14px"></div>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">',
      '<div class="skeleton" style="height:220px;border-radius:12px"></div>',
      '<div class="skeleton" style="height:220px;border-radius:12px"></div>',
      '</div></div>'
    ].join('');

    // Render after skeleton frame
    setTimeout(function() {
      content.innerHTML = '';
      try {
        switch(page) {
          case 'command-center': UI.renderCommandCenter(content); break;
          case 'customer':       UI.renderCustomerPage(content); break;
          case 'delivery':       UI.renderDeliveryPage(content); break;
          case 'geography':      UI.renderGeographyPage(content); break;
          case 'category':       UI.renderCategoryPage(content); break;
          case 'seller':         UI.renderSellerPage(content); break;
          case 'payment':        UI.renderPaymentPage(content); break;
          case 'risk':           UI.renderRiskPage(content); break;
          case 'explorer':       UI.renderExplorerPage(content); break;
          case 'upload':         UploadEngine.renderPage(content); break;
          case 'action':         UI.renderActionPage(content); break;
          default:               UI.renderCommandCenter(content);
        }
      } catch(err) {
        console.error('[App] Page render error:', err);
        content.innerHTML = '<div class="error-state"><div class="error-title">Render Error</div><div class="error-desc">' + Utils.escapeHtml(err.message) + '</div></div>';
      }
      content.scrollTop = 0;
    }, 60);

    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      const ov = document.querySelector('.sidebar-overlay');
      if (ov) ov.classList.remove('active');
    }
  },

  _attachNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        App._navigate(item.dataset.page);
      });
    });
  },

  _attachSidebar() {
    const hamburger = document.getElementById('hamburger');
    const sidebar   = document.getElementById('sidebar');
    const closeBtn  = document.getElementById('sidebar-close');

    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    const open  = function() { if (sidebar) sidebar.classList.add('open'); overlay.classList.add('active'); };
    const close = function() { if (sidebar) sidebar.classList.remove('open'); overlay.classList.remove('active'); };

    if (hamburger) hamburger.addEventListener('click', open);
    if (closeBtn)  closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        close();
        const fo = document.getElementById('fullscreen-overlay');
        if (fo) fo.style.display = 'none';
        const po = document.getElementById('presentation-overlay');
        if (po) po.style.display = 'none';
      }
    });
  },

  _attachExport() {
    const btn = document.getElementById('export-btn');
    if (btn) btn.addEventListener('click', function() { ExportEngine.exportReport(); });
  },

  _attachPresentation() {
    const btn  = document.getElementById('presentation-btn');
    const exit = document.getElementById('presentation-exit');
    if (btn)  btn.addEventListener('click', function() { App._showPresentationMode(); });
    if (exit) exit.addEventListener('click', function() {
      const o = document.getElementById('presentation-overlay');
      if (o) o.style.display = 'none';
    });
  },

  _showPresentationMode() {
    const overlay = document.getElementById('presentation-overlay');
    const content = document.getElementById('presentation-content');
    if (!overlay || !content) return;

    const kpis    = AnalysisEngine.getExecutiveKPIs();
    const states  = AnalysisEngine.getStateRisk().slice(0, 3);
    const cats    = AnalysisEngine.getCategoryRisk().slice(0, 3);
    const corr    = AnalysisEngine.getDeliveryReviewCorrelation();
    const insights = InsightEngine.generateOlistInsights();

    content.innerHTML = '<div style="max-width:900px;margin:0 auto">' +
      '<div style="text-align:center;margin-bottom:40px">' +
      '<div style="font-family:\'Instrument Serif\',serif;font-size:40px;margin-bottom:10px">OLIST MARKETPLACE INTELLIGENCE</div>' +
      '<div style="font-size:16px;color:#94A3B8">From Raw Data to Business Decisions</div>' +
      '</div>' +

      (kpis ? '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:40px">' +
        [
          ['Total Orders',   Utils.fmtNumber(kpis.totalOrders),  '#00E5FF'],
          ['Late Rate',      Utils.fmtPct(kpis.lateRate),        '#FF4D6D'],
          ['Avg Review',     (kpis.avgReview || 'N/A') + '★',   '#2DD4BF'],
          ['Product Value',  Utils.fmtBRL(kpis.productValue),    '#8B5CF6'],
        ].map(function(m) {
          return '<div style="text-align:center;padding:20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:12px">' +
            '<div style="font-size:26px;font-weight:700;color:' + m[2] + '">' + Utils.escapeHtml(m[1]) + '</div>' +
            '<div style="font-size:11px;color:#64748b;margin-top:6px;text-transform:uppercase;letter-spacing:1px">' + Utils.escapeHtml(m[0]) + '</div>' +
            '</div>';
        }).join('') + '</div>' : '') +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">' +
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:20px">' +
          '<div style="font-family:\'Instrument Serif\',serif;font-size:18px;margin-bottom:14px;color:#00E5FF">Top Risk States</div>' +
          states.map(function(s, i) {
            return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">' +
              '<span>' + (i+1) + '. ' + Utils.escapeHtml(s.state || '?') + '</span>' +
              '<span style="color:' + Utils.riskColor(s.late_rate||0) + ';font-weight:700">' + Utils.fmtPct(s.late_rate||0) + '</span>' +
              '</div>';
          }).join('') +
        '</div>' +
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:20px">' +
          '<div style="font-family:\'Instrument Serif\',serif;font-size:18px;margin-bottom:14px;color:#8B5CF6">Top Risk Categories</div>' +
          cats.map(function(c, i) {
            return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">' +
              '<span style="font-size:12px">' + (i+1) + '. ' + Utils.escapeHtml((c.category||'?').substring(0,26)) + '</span>' +
              '<span style="color:' + Utils.riskColor(c.late_rate||0) + ';font-weight:700">' + Utils.fmtPct(c.late_rate||0) + '</span>' +
              '</div>';
          }).join('') +
        '</div>' +
      '</div>' +

      (corr && corr.r !== null ?
        '<div style="background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.2);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center">' +
        '<div style="font-size:14px;color:#94A3B8;margin-bottom:8px">Delivery–Satisfaction Correlation</div>' +
        '<div style="font-size:32px;font-weight:700;color:#00E5FF">r = ' + corr.r + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin-top:6px">' + StatisticsEngine.fmtPValue(corr.p) + ' · n = ' + Utils.fmtNumber(corr.n) + ' · Association ≠ causation</div>' +
        '</div>' : '') +

      '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:20px">' +
        '<div style="font-family:\'Instrument Serif\',serif;font-size:18px;margin-bottom:14px">Key Findings</div>' +
        insights.slice(0, 3).map(function(ins) {
          return '<div style="padding:10px 14px;border-left:3px solid #00E5FF;background:rgba(0,229,255,0.04);border-radius:0 8px 8px 0;margin-bottom:10px">' +
            '<div style="font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">' + Utils.escapeHtml(ins.what) + '</div>' +
            '<div style="font-size:12px;color:#94A3B8">' + Utils.escapeHtml(ins.why) + '</div>' +
            '</div>';
        }).join('') +
      '</div>' +

      '<div style="text-align:center;margin-top:40px;font-size:13px;color:#64748b;font-style:italic">' +
        'All values calculated from the OLIST workbook — no hardcoded data</div>' +
      '</div>';

    overlay.style.display = 'flex';
  },

  _attachFullscreenClose() {
    const btn = document.getElementById('fullscreen-close');
    if (btn) btn.addEventListener('click', function() {
      const o = document.getElementById('fullscreen-overlay');
      if (o) o.style.display = 'none';
      ChartEngine.destroy('fullscreen-canvas');
    });
  },

  _showDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9000;background:rgba(0,0,0,0.9);border:1px solid #00E5FF;border-radius:10px;padding:14px 18px;font-size:11px;font-family:monospace;color:#00E5FF;max-width:320px;max-height:400px;overflow-y:auto;line-height:1.6';
    panel.innerHTML = '<div style="font-weight:700;margin-bottom:8px;font-size:13px">🛠 DEBUG MODE</div><div id="debug-content">Initializing…</div>';
    document.body.appendChild(panel);

    // Update after data loads
    setTimeout(function() {
      const dc = document.getElementById('debug-content');
      if (!dc) return;
      const sheets = DataLoader.listSheets();
      const kpis = AnalysisEngine.getExecutiveKPIs();
      dc.innerHTML = [
        '<b>Libraries:</b>',
        'XLSX: ' + (typeof XLSX !== 'undefined' ? '✓' : '✗'),
        'Chart: ' + (typeof Chart !== 'undefined' ? '✓ v' + Chart.version : '✗'),
        'Papa: ' + (typeof Papa !== 'undefined' ? '✓' : '✗'),
        '',
        '<b>Sheets loaded (' + sheets.length + '):</b>',
        ...sheets.slice(0, 12).map(function(s) { return '• ' + s.name + ': ' + s.rows + 'r × ' + s.cols + 'c'; }),
        '',
        '<b>KPIs:</b>',
        kpis ? [
          'Orders: ' + Utils.fmtNumber(kpis.totalOrders),
          'Analyzed: ' + Utils.fmtNumber(kpis.analyzedOrders),
          'Late: ' + Utils.fmtNumber(kpis.lateOrders),
          'Late rate: ' + Utils.fmtPct(kpis.lateRate),
          'Avg review: ' + kpis.avgReview,
        ].join('<br>') : 'KPIs: null (no data)',
      ].join('<br>');
    }, 2000);
  }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
