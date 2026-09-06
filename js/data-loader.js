/* ============================================================
   DATA-LOADER.JS — Reads Olist Excel workbook via SheetJS
   SOURCE: public/data/Olist_Final_Analytical_Workbook.xlsx
   ============================================================ */

'use strict';

const DataLoader = {

  workbook: null,
  sheets: {},        // raw SheetJS worksheets
  data: {},          // parsed JS arrays
  meta: {},          // sheet metadata

  // Required analytical sheets
  REQUIRED_SHEETS: [
    'order_master', 'monthly', 'delivery_summary',
    'category_risk', 'state_risk', 'seller_summary',
    'installment_summary', 'state_category_risk', 'excess_risk'
  ],

  // Optional source sheets
  SOURCE_SHEETS: [
    'orders', 'order_items', 'order_payments',
    'order_reviews', 'customers', 'products', 'sellers',
    'category_translation'
  ],

  async loadWorkbook(path) {
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} — Cannot fetch workbook at ${path}`);
      const ab = await resp.arrayBuffer();
      this.workbook = XLSX.read(ab, { type: 'array', cellDates: true });
      await this._parseAllSheets();
      return { ok: true };
    } catch (err) {
      console.error('[DataLoader] loadWorkbook error:', err);
      return { ok: false, error: err.message };
    }
  },

  async _parseAllSheets() {
    const sheetNames = this.workbook.SheetNames;
    console.log('[DataLoader] Available sheets:', sheetNames);

    for (const name of sheetNames) {
      const ws = this.workbook.Sheets[name];
      // Parse with header row
      const raw = XLSX.utils.sheet_to_json(ws, {
        defval: null,
        raw: false,      // Convert dates to strings
        dateNF: 'yyyy-mm-dd'
      });
      this.sheets[name] = ws;
      this.data[name] = raw;
      this.meta[name] = {
        rows: raw.length,
        cols: raw.length > 0 ? Object.keys(raw[0]).length : 0,
        columns: raw.length > 0 ? Object.keys(raw[0]) : []
      };
    }
  },

  // Get sheet data (returns empty array if missing)
  getSheet(name) {
    return this.data[name] || [];
  },

  // Check sheet availability
  checkSheets() {
    const available = Object.keys(this.data);
    const missing = this.REQUIRED_SHEETS.filter(s => !available.includes(s));
    const found = this.REQUIRED_SHEETS.filter(s => available.includes(s));
    return { available, missing, found };
  },

  // List all sheets with row counts
  listSheets() {
    return Object.entries(this.meta).map(([name, m]) => ({
      name,
      rows: m.rows,
      cols: m.cols,
      columns: m.columns
    }));
  },

  // Parse a specific sheet from an uploaded workbook
  parseUploadedWorkbook(arrayBuffer) {
    try {
      const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const result = { workbook: wb, sheets: {} };
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false, dateNF: 'yyyy-mm-dd' });
        result.sheets[name] = {
          data: raw,
          rows: raw.length,
          cols: raw.length > 0 ? Object.keys(raw[0]).length : 0,
          columns: raw.length > 0 ? Object.keys(raw[0]) : []
        };
      }
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // Parse CSV string
  parseCSV(text) {
    try {
      const result = Papa.parse(text, {
        header: true, skipEmptyLines: true, dynamicTyping: false
      });
      if (result.errors.length > 0) {
        console.warn('[DataLoader] CSV parse warnings:', result.errors);
      }
      return { ok: true, data: result.data, columns: result.meta.fields || [], rows: result.data.length };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
};

window.DataLoader = DataLoader;
