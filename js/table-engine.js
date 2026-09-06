'use strict';
const TableEngine = {
  PAGE_SIZE: 25,
  instances: {},

  create(containerId, data, columns, opts = {}) {
    const container = document.getElementById(containerId);
    if (!container || !data) return null;
    const inst = { data, filtered: [...data], columns: columns || (data.length ? Object.keys(data[0]) : []), page: 1, sortCol: null, sortDir: 'asc', search: '', opts };
    this.instances[containerId] = inst;
    container.innerHTML = this._buildHTML(containerId, inst);
    this._attach(containerId);
    this._render(containerId);
    return inst;
  },

  _buildHTML(id, inst) {
    const ps = inst.opts.pageSize || this.PAGE_SIZE;
    return `<div class="data-table-container">
      <div class="table-toolbar">
        <input class="table-search" id="${id}-search" placeholder="Search…" aria-label="Search table"/>
        <div class="flex gap-8 items-center">
          <span class="table-info" id="${id}-info"></span>
          <div class="table-actions">
            <button class="btn-sm" id="${id}-export-csv" title="Export CSV">⬇ CSV</button>
          </div>
        </div>
      </div>
      <div class="table-wrap"><table class="data-table" id="${id}-table"><thead><tr id="${id}-thead"></tr></thead><tbody id="${id}-tbody"></tbody></table></div>
      <div class="table-pagination" id="${id}-pagination"></div>
    </div>`;
  },

  _attach(id) {
    const inst = this.instances[id];
    const searchEl = document.getElementById(`${id}-search`);
    if (searchEl) searchEl.addEventListener('input', Utils.debounce(e => { inst.search = e.target.value; inst.page = 1; this._filter(id); this._render(id); }, 200));
    const csvBtn = document.getElementById(`${id}-export-csv`);
    if (csvBtn) csvBtn.addEventListener('click', () => this._exportCSV(id));
  },

  _filter(id) {
    const inst = this.instances[id];
    const q = inst.search.toLowerCase();
    inst.filtered = q ? inst.data.filter(row => inst.columns.some(col => String(row[col] ?? '').toLowerCase().includes(q))) : [...inst.data];
    if (inst.sortCol) this._sort(id, inst.sortCol, false);
  },

  _sort(id, col, toggle = true) {
    const inst = this.instances[id];
    if (toggle) { inst.sortDir = inst.sortCol === col && inst.sortDir === 'asc' ? 'desc' : 'asc'; }
    inst.sortCol = col;
    inst.filtered.sort((a, b) => {
      const av = Utils.parseNum(a[col]) ?? a[col];
      const bv = Utils.parseNum(b[col]) ?? b[col];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av - bv);
      return inst.sortDir === 'asc' ? cmp : -cmp;
    });
  },

  _render(id) {
    const inst = this.instances[id];
    if (!inst) return;
    const ps = inst.opts.pageSize || this.PAGE_SIZE;
    const total = inst.filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / ps));
    inst.page = Utils.clamp(inst.page, 1, totalPages);
    const pageData = Utils.paginate(inst.filtered, inst.page, ps);

    // Header
    const thead = document.getElementById(`${id}-thead`);
    if (thead) thead.innerHTML = inst.columns.map(col => `<th class="${inst.sortCol === col ? 'sort-' + inst.sortDir : ''}" data-col="${Utils.escapeHtml(col)}">${Utils.escapeHtml(col)}</th>`).join('');
    thead && thead.querySelectorAll('th').forEach(th => th.addEventListener('click', () => { this._sort(id, th.dataset.col); this._render(id); }));

    // Body
    const tbody = document.getElementById(`${id}-tbody`);
    if (tbody) {
      if (!pageData.length) { tbody.innerHTML = `<tr><td colspan="${inst.columns.length}" style="text-align:center;padding:24px;color:#64748b">No results found</td></tr>`; }
      else tbody.innerHTML = pageData.map(row => `<tr>${inst.columns.map(col => {
        const v = row[col];
        const fmted = v === null || v === undefined ? '<span style="color:#475569">—</span>' : Utils.escapeHtml(String(v));
        return `<td>${fmted}</td>`;
      }).join('')}</tr>`).join('');
    }

    // Info
    const info = document.getElementById(`${id}-info`);
    if (info) info.textContent = `${Utils.fmtNumber(total)} rows${inst.search ? ' (filtered)' : ''}`;

    // Pagination
    const pg = document.getElementById(`${id}-pagination`);
    if (pg) {
      const start = (inst.page - 1) * ps + 1;
      const end = Math.min(inst.page * ps, total);
      let btns = '';
      btns += `<button class="page-btn" id="${id}-prev" ${inst.page<=1?'disabled':''}>‹</button>`;
      const range = this._pageRange(inst.page, totalPages);
      range.forEach(p => { if (p === '…') btns += `<span style="color:#475569;padding:0 4px">…</span>`; else btns += `<button class="page-btn${p===inst.page?' active':''}" data-p="${p}">${p}</button>`; });
      btns += `<button class="page-btn" id="${id}-next" ${inst.page>=totalPages?'disabled':''}>›</button>`;
      pg.innerHTML = `<span>${start}–${end} of ${Utils.fmtNumber(total)}</span><div class="pagination-btns">${btns}</div>`;
      pg.querySelector(`#${id}-prev`)?.addEventListener('click', () => { inst.page--; this._render(id); });
      pg.querySelector(`#${id}-next`)?.addEventListener('click', () => { inst.page++; this._render(id); });
      pg.querySelectorAll('.page-btn[data-p]').forEach(btn => btn.addEventListener('click', () => { inst.page = +btn.dataset.p; this._render(id); }));
    }
  },

  _pageRange(current, total) {
    if (total <= 7) return Array.from({length: total}, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current-1); i <= Math.min(total-1, current+1); i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  },

  _exportCSV(id) {
    const inst = this.instances[id];
    if (!inst) return;
    const rows = [inst.columns, ...inst.filtered.map(row => inst.columns.map(c => `"${String(row[c] ?? '').replace(/"/g,'""')}"`))];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${id}-export.csv`; a.click();
    URL.revokeObjectURL(url);
  },

  update(id, newData) {
    const inst = this.instances[id];
    if (!inst) return;
    inst.data = newData; inst.filtered = [...newData]; inst.page = 1;
    if (inst.search) this._filter(id);
    this._render(id);
  }
};
window.TableEngine = TableEngine;
