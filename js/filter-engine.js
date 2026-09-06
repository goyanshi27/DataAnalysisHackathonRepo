/* ============================================================
   FILTER-ENGINE.JS — Global cross-filtering state
   ============================================================ */
'use strict';

const FilterEngine = {

  state: { state: '', category: '', payment: '', dateFrom: '', dateTo: '', custom: {} },
  listeners: [],

  setFilter(key, value) {
    this.state[key] = value;
    this._updateChips();
    this._notify();
  },

  getFilter(key) { return this.state[key] || ''; },

  clearAll() {
    this.state = { state: '', category: '', payment: '', dateFrom: '', dateTo: '', custom: {} };
    this._updateChips();
    this._notify();
    // Reset DOM selects
    ['filter-state','filter-category','filter-payment'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  },

  hasFilters() {
    return this.state.state || this.state.category || this.state.payment ||
           this.state.dateFrom || this.state.dateTo;
  },

  subscribe(fn) { this.listeners.push(fn); },

  _notify() { this.listeners.forEach(fn => fn(this.state)); },

  _updateChips() {
    const container = document.getElementById('filter-chips');
    if (!container) return;
    const chips = [];
    if (this.state.state) chips.push({ key: 'state', label: `State: ${this.state.state}` });
    if (this.state.category) chips.push({ key: 'category', label: `Category: ${this.state.category}` });
    if (this.state.payment) chips.push({ key: 'payment', label: `Payment: ${this.state.payment}` });
    container.innerHTML = chips.map(c => `
      <span class="filter-chip">
        ${Utils.escapeHtml(c.label)}
        <button class="filter-chip-remove" data-filter-key="${c.key}" aria-label="Remove filter">×</button>
      </span>
    `).join('');
    container.querySelectorAll('.filter-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => { this.setFilter(btn.dataset.filterKey, ''); });
    });
  },

  // Apply active filters to a dataset
  applyToData(data, opts = {}) {
    if (!data) return [];
    let filtered = data;
    if (this.state.state && opts.stateKey) {
      filtered = filtered.filter(r => r[opts.stateKey] === this.state.state);
    }
    if (this.state.category && opts.categoryKey) {
      filtered = filtered.filter(r => r[opts.categoryKey] === this.state.category);
    }
    if (this.state.payment && opts.paymentKey) {
      filtered = filtered.filter(r => r[opts.paymentKey] === this.state.payment);
    }
    return filtered;
  },

  // Populate filter dropdowns from data
  populateDropdowns(stateRisk, catRisk, paymentData) {
    const stateEl = document.getElementById('filter-state');
    const catEl   = document.getElementById('filter-category');
    const payEl   = document.getElementById('filter-payment');

    if (stateEl && stateRisk) {
      const states = Utils.sortBy(stateRisk, 'orders', 'desc').map(s => s.state || s.customer_state).filter(Boolean);
      stateEl.innerHTML = '<option value="">All States</option>' +
        Utils.unique(states).map(s => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`).join('');
    }
    if (catEl && catRisk) {
      const cats = catRisk.map(c => c.category || c.product_category_name_english || c.product_category_name).filter(Boolean);
      catEl.innerHTML = '<option value="">All Categories</option>' +
        Utils.unique(cats).sort().slice(0, 50).map(c => `<option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>`).join('');
    }
    if (payEl && paymentData) {
      const types = paymentData.map(p => p.type || p.payment_type).filter(Boolean);
      payEl.innerHTML = '<option value="">All Payments</option>' +
        Utils.unique(types).map(t => `<option value="${Utils.escapeHtml(t)}">${Utils.escapeHtml(t)}</option>`).join('');
    }

    // Attach change listeners
    if (stateEl) stateEl.addEventListener('change', e => this.setFilter('state', e.target.value));
    if (catEl)   catEl.addEventListener('change', e => this.setFilter('category', e.target.value));
    if (payEl)   payEl.addEventListener('change', e => this.setFilter('payment', e.target.value));
    const resetBtn = document.getElementById('filter-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => this.clearAll());
  }
};

window.FilterEngine = FilterEngine;
