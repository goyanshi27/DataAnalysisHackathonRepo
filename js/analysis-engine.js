/* ============================================================
   ANALYSIS-ENGINE.JS — Olist analytical calculations
   Reads from loaded workbook sheets — no hardcoded values.
   Robust field-name normalization handles varying column names.
   ============================================================ */
'use strict';

const DEBUG = (new URLSearchParams(window.location.search)).get('debug') === 'true';
const dlog = (...a) => DEBUG && console.log('[ANALYSIS]', ...a);

const AnalysisEngine = {
  cache: {},

  // ── FIELD NAME RESOLVER ──────────────────────────────────────
  // Tries multiple known column name variants
  _field(row, ...candidates) {
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== null && row[c] !== '') return row[c];
    }
    return null;
  },

  _num(row, ...candidates) {
    const v = this._field(row, ...candidates);
    return Utils.parseNum(v);
  },

  _deliveryBucket(dev) {
    if (dev <= -7) return '7+ Days Early';
    if (dev <= -3) return '3-6 Days Early';
    if (dev <=  0) return 'On / Slightly Early';
    if (dev <=  3) return '1-3 Days Late';
    if (dev <=  7) return '4-7 Days Late';
    return '8+ Days Late';
  },

  // ── EXECUTIVE KPIs ───────────────────────────────────────────
  getExecutiveKPIs() {
    const key = 'exec_kpis';
    if (this.cache[key]) return this.cache[key];

    const orderMaster = DataLoader.getSheet('order_master');
    const monthly     = DataLoader.getSheet('monthly');
    const items       = DataLoader.getSheet('order_items');
    const reviews     = DataLoader.getSheet('order_reviews');
    const delivery    = DataLoader.getSheet('delivery_summary');

    dlog('order_master rows:', orderMaster.length);
    dlog('monthly rows:', monthly.length);
    dlog('delivery_summary rows:', delivery.length);

    // Use whatever source has data
    const primarySrc = orderMaster.length ? orderMaster : [];

    const totalOrders = primarySrc.length || monthly.reduce((s,m) => s + (Utils.parseNum(this._field(m,'orders','order_count','total_orders')) || 0), 0);

    // Product value
    let productValue = 0;
    if (items.length) {
      items.forEach(r => {
        productValue += Utils.parseNum(this._field(r,'price','item_price','product_price')) || 0;
        productValue += Utils.parseNum(this._field(r,'freight_value','freight')) || 0;
      });
    } else if (primarySrc.length) {
      primarySrc.forEach(r => { productValue += Utils.parseNum(this._field(r,'payment_value','order_value','total_value')) || 0; });
    } else if (monthly.length) {
      monthly.forEach(m => { productValue += Utils.parseNum(this._field(m,'product_value','revenue','total_value','product_revenue')) || 0; });
    }

    // Average review
    let avgReview = null;
    if (reviews.length) {
      const scores = reviews.map(r => Utils.parseNum(this._field(r,'review_score','score','rating'))).filter(v => v !== null);
      avgReview = scores.length ? Utils.round(scores.reduce((a,b) => a+b, 0) / scores.length, 2) : null;
    } else if (primarySrc.length) {
      const scores = primarySrc.map(r => Utils.parseNum(this._field(r,'review_score','score'))).filter(v => v !== null);
      avgReview = scores.length ? Utils.round(scores.reduce((a,b) => a+b, 0) / scores.length, 2) : null;
    } else if (monthly.length) {
      const vals = monthly.map(m => Utils.parseNum(this._field(m,'avg_review','average_review','review_score'))).filter(v => v !== null);
      avgReview = vals.length ? Utils.round(vals.reduce((a,b) => a+b, 0) / vals.length, 2) : null;
    }

    // Late delivery
    let lateOrders = 0, analyzedOrders = 0;
    if (delivery.length) {
      delivery.forEach(r => {
        const dev = Utils.parseNum(this._field(r,'delivery_deviation_days','deviation','deviation_days','delivery_deviation'));
        if (dev !== null) { analyzedOrders++; if (dev > 0) lateOrders++; }
        // Some sheets have explicit late flag
        const isLate = this._field(r,'is_late','late_flag');
        if (isLate === 1 || isLate === '1' || isLate === 'true' || isLate === true) lateOrders++;
      });
    } else if (primarySrc.length) {
      primarySrc.forEach(r => {
        if (r.order_delivered_customer_date && r.order_estimated_delivery_date) {
          const del = new Date(r.order_delivered_customer_date);
          const est = new Date(r.order_estimated_delivery_date);
          if (!isNaN(del) && !isNaN(est)) { analyzedOrders++; if (del > est) lateOrders++; }
        }
        const dev = Utils.parseNum(this._field(r,'delivery_deviation_days','deviation'));
        if (dev !== null && analyzedOrders === 0) { analyzedOrders++; if (dev > 0) lateOrders++; }
      });
    }
    if (analyzedOrders === 0 && delivery.length) analyzedOrders = delivery.length;
    if (analyzedOrders === 0 && primarySrc.length) analyzedOrders = primarySrc.length;

    const lateRate = analyzedOrders > 0 ? Utils.round(lateOrders / analyzedOrders * 100, 2) : 0;

    const result = { totalOrders, productValue: Utils.round(productValue, 2), avgReview, lateOrders, analyzedOrders, lateRate };
    dlog('KPIs:', result);
    this.cache[key] = result;
    return result;
  },

  // ── MONTHLY PERFORMANCE ──────────────────────────────────────
  getMonthlyPerformance() {
    const key = 'monthly_perf';
    if (this.cache[key]) return this.cache[key];

    let monthly = DataLoader.getSheet('monthly');
    dlog('monthly sheet rows:', monthly.length, monthly[0] ? Object.keys(monthly[0]) : []);

    if (monthly.length) {
      // Normalize field names
      const result = monthly.map(m => ({
        month:      this._field(m,'month','order_month','year_month','Month') || '',
        label:      this._field(m,'month','order_month','year_month','label') || '',
        orders:     this._num(m,'orders','order_count','total_orders','Orders') || 0,
        productValue: this._num(m,'product_value','revenue','total_value','product_revenue','Revenue') || 0,
        avgReview:  this._num(m,'avg_review','average_review','review_score','avg_review_score') || null,
      })).filter(m => m.month || m.label);
      // Chronological sort
      result.sort((a,b) => (a.month||a.label).localeCompare(b.month||b.label));
      dlog('monthly perf rows:', result.length);
      this.cache[key] = result;
      return result;
    }

    // Compute from order_master
    const orders = DataLoader.getSheet('order_master');
    if (!orders.length) { this.cache[key] = []; return []; }

    const grouped = {};
    orders.forEach(r => {
      const ts = this._field(r,'order_purchase_timestamp','purchase_timestamp','order_date','purchase_date') || '';
      const month = ts ? String(ts).slice(0,7) : null;
      if (!month || month.length < 7) return;
      if (!grouped[month]) grouped[month] = { month, label:month, orders:0, productValue:0, reviews:[] };
      grouped[month].orders++;
      const pv = Utils.parseNum(this._field(r,'payment_value','order_value'));
      if (pv) grouped[month].productValue += pv;
      const rev = Utils.parseNum(this._field(r,'review_score'));
      if (rev) grouped[month].reviews.push(rev);
    });

    const result = Object.values(grouped)
      .sort((a,b) => a.month.localeCompare(b.month))
      .map(m => ({ ...m, avgReview: m.reviews.length ? Utils.round(m.reviews.reduce((a,b)=>a+b,0)/m.reviews.length,2) : null }));
    dlog('computed monthly rows:', result.length);
    this.cache[key] = result;
    return result;
  },

  // ── DELIVERY PAIN CURVE ──────────────────────────────────────
  getDeliveryPainCurve() {
    const key = 'pain_curve';
    if (this.cache[key]) return this.cache[key];

    let delivery = DataLoader.getSheet('delivery_summary');
    dlog('delivery_summary rows:', delivery.length, delivery[0] ? Object.keys(delivery[0]) : []);

    if (!delivery.length) delivery = this._computeDeliveryRows();

    const BUCKET_ORDER = ['7+ Days Early','3-6 Days Early','On / Slightly Early','1-3 Days Late','4-7 Days Late','8+ Days Late'];
    const buckets = {};
    BUCKET_ORDER.forEach(b => { buckets[b] = { bucket:b, reviews:[], orders:0 }; });

    delivery.forEach(r => {
      // Try explicit bucket field first
      const bucketField = this._field(r,'delivery_bucket','bucket','delivery_status');
      const dev = Utils.parseNum(this._field(r,'delivery_deviation_days','deviation','deviation_days','delivery_deviation'));
      const rev = Utils.parseNum(this._field(r,'review_score','avg_review','score'));

      let bucket = null;
      if (bucketField && BUCKET_ORDER.includes(bucketField)) {
        bucket = bucketField;
      } else if (dev !== null) {
        bucket = this._deliveryBucket(dev);
      }
      if (!bucket || rev === null) return;
      if (!buckets[bucket]) buckets[bucket] = { bucket, reviews:[], orders:0 };
      buckets[bucket].reviews.push(rev);
      buckets[bucket].orders++;
    });

    const result = BUCKET_ORDER.map(b => {
      const d = buckets[b];
      if (!d || !d.reviews.length) return { bucket:b, avgReview:null, orders:0 };
      return { bucket:b, avgReview: Utils.round(d.reviews.reduce((a,c)=>a+c,0)/d.reviews.length,2), orders:d.orders };
    });

    dlog('pain curve:', result);
    this.cache[key] = result;
    return result;
  },

  _computeDeliveryRows() {
    const orders = DataLoader.getSheet('order_master');
    return orders.filter(r =>
      r.order_delivered_customer_date && r.order_estimated_delivery_date
    ).map(r => {
      const del = new Date(r.order_delivered_customer_date);
      const est = new Date(r.order_estimated_delivery_date);
      const dev = (!isNaN(del) && !isNaN(est)) ? (del - est) / 86400000 : null;
      return { ...r, delivery_deviation_days: dev !== null ? Utils.round(dev,1) : null };
    }).filter(r => r.delivery_deviation_days !== null);
  },

  // ── DELIVERY–REVIEW CORRELATION ──────────────────────────────
  getDeliveryReviewCorrelation() {
    const key = 'delivery_corr';
    if (this.cache[key]) return this.cache[key];
    let delivery = DataLoader.getSheet('delivery_summary');
    if (!delivery.length) delivery = this._computeDeliveryRows();
    const pairs = delivery.map(r => ({
      dev: Utils.parseNum(this._field(r,'delivery_deviation_days','deviation','deviation_days')),
      rev: Utils.parseNum(this._field(r,'review_score','score'))
    })).filter(p => p.dev !== null && p.rev !== null);
    const n = Math.min(pairs.length, 5000);
    const result = StatisticsEngine.pearson(pairs.slice(0,n).map(p=>p.dev), pairs.slice(0,n).map(p=>p.rev));
    dlog('delivery-review corr:', result);
    this.cache[key] = result;
    return result;
  },

  // ── STATE RISK ───────────────────────────────────────────────
  getStateRisk() {
    const key = 'state_risk';
    if (this.cache[key]) return this.cache[key];
    let data = DataLoader.getSheet('state_risk');
    dlog('state_risk rows:', data.length, data[0] ? Object.keys(data[0]) : []);

    if (data.length) {
      const normalized = data.map(r => ({
        state:      this._field(r,'state','customer_state','State','region') || '?',
        orders:     this._num(r,'orders','total_orders','order_count') || 0,
        late_orders:this._num(r,'late_orders','lateOrders','total_late_orders','late_order_count') || 0,
        late_rate:  this._num(r,'late_rate','lateRate','pct_late','late_pct','delivery_late_rate') || 0,
        avg_late_days: this._num(r,'avg_late_days','average_late_days','mean_late_days') || 0,
        avg_review: this._num(r,'avg_review','average_review','avg_review_score','review_score') || null,
        late_review:this._num(r,'late_review','avg_late_review','late_avg_review') || null,
      })).filter(r => r.state !== '?');
      const sorted = normalized.sort((a,b) => b.late_rate - a.late_rate);
      this.cache[key] = sorted;
      return sorted;
    }

    // Compute from order_master + customers
    const orders    = DataLoader.getSheet('order_master');
    const customers = DataLoader.getSheet('customers');
    if (!orders.length) { this.cache[key] = []; return []; }

    const custMap = {};
    customers.forEach(c => {
      const id = this._field(c,'customer_id','customerId');
      const st = this._field(c,'customer_state','state');
      if (id && st) custMap[id] = st;
    });

    const grouped = {};
    orders.forEach(r => {
      const cid = this._field(r,'customer_id','customerId');
      const state = custMap[cid] || this._field(r,'customer_state','state') || null;
      if (!state) return;
      if (!grouped[state]) grouped[state] = { state, orders:0, lateOrders:0, reviews:[], lateDays:[] };
      grouped[state].orders++;
      const dev = Utils.parseNum(this._field(r,'delivery_deviation_days','deviation'));
      if (dev !== null && dev > 0) { grouped[state].lateOrders++; grouped[state].lateDays.push(dev); }
      const rev = Utils.parseNum(this._field(r,'review_score'));
      if (rev) grouped[state].reviews.push(rev);
    });

    const result = Object.values(grouped).map(g => ({
      state: g.state, orders: g.orders, late_orders: g.lateOrders,
      late_rate: g.orders > 0 ? Utils.round(g.lateOrders/g.orders*100,2) : 0,
      avg_late_days: g.lateDays.length ? Utils.round(g.lateDays.reduce((a,b)=>a+b,0)/g.lateDays.length,2) : 0,
      avg_review: g.reviews.length ? Utils.round(g.reviews.reduce((a,b)=>a+b,0)/g.reviews.length,2) : null,
    })).sort((a,b) => b.late_rate - a.late_rate);
    this.cache[key] = result;
    return result;
  },

  // ── CATEGORY RISK ────────────────────────────────────────────
  getCategoryRisk() {
    const key = 'cat_risk';
    if (this.cache[key]) return this.cache[key];
    let data = DataLoader.getSheet('category_risk');
    dlog('category_risk rows:', data.length, data[0] ? Object.keys(data[0]) : []);

    if (data.length) {
      const normalized = data.map(r => ({
        category:    this._field(r,'category','product_category_name_english','product_category_name','Category','category_name') || '?',
        orders:      this._num(r,'orders','total_orders','order_count') || 0,
        late_orders: this._num(r,'late_orders','lateOrders','late_order_count') || 0,
        late_rate:   this._num(r,'late_rate','lateRate','pct_late','late_pct','delivery_late_rate') || 0,
        avg_late_days: this._num(r,'avg_late_days','average_late_days','mean_late_days') || 0,
        avg_review:  this._num(r,'avg_review','average_review','avg_review_score') || null,
        late_review: this._num(r,'late_review','avg_late_review') || null,
      })).filter(r => r.category !== '?');
      const sorted = normalized.sort((a,b) => b.late_rate - a.late_rate);
      this.cache[key] = sorted;
      return sorted;
    }

    // Compute from items + orders + products
    const orders  = DataLoader.getSheet('order_master');
    const items   = DataLoader.getSheet('order_items');
    const prods   = DataLoader.getSheet('products');
    const catTrans = DataLoader.getSheet('category_translation');
    if (!items.length) { this.cache[key] = []; return []; }

    const orderMap = {};
    orders.forEach(r => { const id = this._field(r,'order_id'); if (id) orderMap[id] = r; });
    const prodMap = {};
    prods.forEach(p => { const id = this._field(p,'product_id'); if (id) prodMap[id] = p; });
    const catMap = {};
    catTrans.forEach(c => {
      const pt = this._field(c,'product_category_name');
      const en = this._field(c,'product_category_name_english') || pt;
      if (pt) catMap[pt] = en;
    });

    const grouped = {};
    items.forEach(item => {
      const order = orderMap[this._field(item,'order_id')];
      if (!order) return;
      const prod = prodMap[this._field(item,'product_id')];
      const rawCat = prod ? this._field(prod,'product_category_name') : null;
      const cat = rawCat ? (catMap[rawCat] || rawCat) : 'Unknown';
      if (cat === 'Unknown') return;
      if (!grouped[cat]) grouped[cat] = { category:cat, orders:0, lateOrders:0, reviews:[], lateDays:[] };
      grouped[cat].orders++;
      const dev = Utils.parseNum(this._field(order,'delivery_deviation_days','deviation'));
      if (dev !== null && dev > 0) { grouped[cat].lateOrders++; grouped[cat].lateDays.push(dev); }
      const rev = Utils.parseNum(this._field(order,'review_score'));
      if (rev) grouped[cat].reviews.push(rev);
    });

    const result = Object.values(grouped).filter(g => g.orders >= 10).map(g => ({
      category: g.category, orders: g.orders, late_orders: g.lateOrders,
      late_rate: g.orders > 0 ? Utils.round(g.lateOrders/g.orders*100,2) : 0,
      avg_late_days: g.lateDays.length ? Utils.round(g.lateDays.reduce((a,b)=>a+b,0)/g.lateDays.length,2) : 0,
      avg_review: g.reviews.length ? Utils.round(g.reviews.reduce((a,b)=>a+b,0)/g.reviews.length,2) : null,
    })).sort((a,b) => b.late_rate - a.late_rate);
    this.cache[key] = result;
    return result;
  },

  // ── SELLER SUMMARY ───────────────────────────────────────────
  getSellerSummary() {
    const key = 'sellers';
    if (this.cache[key]) return this.cache[key];
    let data = DataLoader.getSheet('seller_summary');
    dlog('seller_summary rows:', data.length);

    if (data.length) {
      const normalized = data.map(r => ({
        seller_id:   this._field(r,'seller_id','sellerId','Seller ID') || '?',
        total_orders:this._num(r,'total_orders','orders','order_count') || 0,
        late_orders: this._num(r,'late_orders','lateOrders','late_order_count') || 0,
        late_rate:   this._num(r,'late_rate','lateRate','pct_late','late_pct') || 0,
        avg_late_days: this._num(r,'avg_late_days','average_late_days') || 0,
        avg_review:  this._num(r,'avg_review','average_review','avg_review_score') || null,
        late_review: this._num(r,'late_review','avg_late_review') || null,
        late_order_impact: this._num(r,'late_order_impact','impact','late_impact') || null,
      }));
      this.cache[key] = normalized.sort((a,b) => b.late_rate - a.late_rate);
      return this.cache[key];
    }

    // Compute from items + orders
    const orders = DataLoader.getSheet('order_master');
    const items  = DataLoader.getSheet('order_items');
    if (!items.length) { this.cache[key] = []; return []; }
    const orderMap = {};
    orders.forEach(r => { const id = this._field(r,'order_id'); if (id) orderMap[id] = r; });
    const grouped = {};
    items.forEach(item => {
      const order = orderMap[this._field(item,'order_id')];
      if (!order) return;
      const sid = this._field(item,'seller_id') || 'unknown';
      if (!grouped[sid]) grouped[sid] = { seller_id:sid, orders:0, lateOrders:0, reviews:[], lateDays:[] };
      grouped[sid].orders++;
      const dev = Utils.parseNum(this._field(order,'delivery_deviation_days','deviation'));
      if (dev !== null && dev > 0) { grouped[sid].lateOrders++; grouped[sid].lateDays.push(dev); }
      const rev = Utils.parseNum(this._field(order,'review_score'));
      if (rev) grouped[sid].reviews.push(rev);
    });
    const result = Object.values(grouped).filter(g => g.orders >= 5).map(g => ({
      seller_id: g.seller_id, total_orders: g.orders, late_orders: g.lateOrders,
      late_rate: g.orders > 0 ? Utils.round(g.lateOrders/g.orders*100,2) : 0,
      avg_late_days: g.lateDays.length ? Utils.round(g.lateDays.reduce((a,b)=>a+b,0)/g.lateDays.length,2) : 0,
      avg_review: g.reviews.length ? Utils.round(g.reviews.reduce((a,b)=>a+b,0)/g.reviews.length,2) : null,
    })).sort((a,b) => b.late_rate - a.late_rate);
    this.cache[key] = result;
    return result;
  },

  // ── PAYMENT ANALYSIS ─────────────────────────────────────────
  getPaymentAnalysis() {
    const key = 'payments';
    if (this.cache[key]) return this.cache[key];
    const payments = DataLoader.getSheet('order_payments');
    const orders   = DataLoader.getSheet('order_master');
    dlog('order_payments rows:', payments.length);
    if (!payments.length) { this.cache[key] = null; return null; }

    const orderMap = {};
    orders.forEach(r => { const id = this._field(r,'order_id'); if (id) orderMap[id] = r; });

    const grouped = {};
    payments.forEach(p => {
      const type = this._field(p,'payment_type','type','payment_method') || 'Unknown';
      if (!grouped[type]) grouped[type] = { type, orders:0, totalValue:0, installments:[], reviews:[] };
      grouped[type].orders++;
      grouped[type].totalValue += Utils.parseNum(this._field(p,'payment_value','value','amount')) || 0;
      const inst = Utils.parseNum(this._field(p,'payment_installments','installments','installment_count'));
      if (inst !== null && inst > 0) grouped[type].installments.push(inst);
      const order = orderMap[this._field(p,'order_id')];
      if (order) { const rev = Utils.parseNum(this._field(order,'review_score')); if (rev) grouped[type].reviews.push(rev); }
    });

    const result = Object.values(grouped).map(g => ({
      type: g.type, orders: g.orders,
      totalValue: Utils.round(g.totalValue, 2),
      avgOrderValue: g.orders > 0 ? Utils.round(g.totalValue/g.orders, 2) : 0,
      avgInstallments: g.installments.length ? Utils.round(g.installments.reduce((a,b)=>a+b,0)/g.installments.length,2) : 0,
      avgReview: g.reviews.length ? Utils.round(g.reviews.reduce((a,b)=>a+b,0)/g.reviews.length,2) : null,
    })).sort((a,b) => b.orders - a.orders);
    this.cache[key] = result;
    return result;
  },

  // ── INSTALLMENT ANALYSIS ─────────────────────────────────────
  getInstallmentAnalysis() {
    const key = 'installments';
    if (this.cache[key]) return this.cache[key];
    let data = DataLoader.getSheet('installment_summary');
    dlog('installment_summary rows:', data.length);

    if (data.length) {
      const normalized = data.map(r => ({
        n: this._num(r,'installments','n','installment_count','payment_installments') || 0,
        installments: this._num(r,'installments','n','installment_count','payment_installments') || 0,
        avgOrderValue: this._num(r,'avg_order_value','avgOrderValue','average_order_value','avg_value','mean_value') || 0,
        orders: this._num(r,'orders','order_count','total_orders','count') || 0,
      })).filter(r => r.n > 0).sort((a,b) => a.n - b.n);
      this.cache[key] = normalized;
      return normalized;
    }

    const payments = DataLoader.getSheet('order_payments');
    if (!payments.length) { this.cache[key] = []; return []; }
    const grouped = {};
    payments.forEach(p => {
      const inst = Utils.parseNum(this._field(p,'payment_installments','installments'));
      if (!inst || inst <= 0) return;
      const n = Math.min(Math.round(inst), 24);
      if (!grouped[n]) grouped[n] = { n, installments:n, orders:0, totalValue:0 };
      grouped[n].orders++;
      grouped[n].totalValue += Utils.parseNum(this._field(p,'payment_value','value')) || 0;
    });
    const result = Object.values(grouped).sort((a,b) => a.n-b.n).map(g => ({
      ...g, avgOrderValue: g.orders > 0 ? Utils.round(g.totalValue/g.orders,2) : 0
    }));
    this.cache[key] = result;
    return result;
  },

  // ── STATE × CATEGORY HOTSPOTS ────────────────────────────────
  getHotspots() {
    const key = 'hotspots';
    if (this.cache[key]) return this.cache[key];
    let data = DataLoader.getSheet('state_category_risk');
    if (!data.length) data = DataLoader.getSheet('excess_risk');
    dlog('hotspots rows:', data.length, data[0] ? Object.keys(data[0]) : []);
    this.cache[key] = data;
    return data;
  },

  // ── DELIVERY DISTRIBUTION ────────────────────────────────────
  getDeliveryDistribution() {
    const key = 'delivery_dist';
    if (this.cache[key]) return this.cache[key];
    let delivery = DataLoader.getSheet('delivery_summary');
    if (!delivery.length) delivery = this._computeDeliveryRows();
    const devValues = delivery.map(r => Utils.parseNum(this._field(r,'delivery_deviation_days','deviation','deviation_days'))).filter(v => v !== null && !isNaN(v) && isFinite(v));
    dlog('delivery distribution values:', devValues.length);
    const hist = devValues.length >= 5 ? StatisticsEngine.histogram(devValues, 20) : null;
    const result = { hist, values: devValues };
    this.cache[key] = result;
    return result;
  },

  getRiskSummary() {
    return {
      states:  this.getStateRisk().slice(0,5),
      cats:    this.getCategoryRisk().slice(0,5),
      sellers: this.getSellerSummary().filter(s => s.late_rate > 20).slice(0,10)
    };
  },

  clearCache() { this.cache = {}; }
};

window.AnalysisEngine = AnalysisEngine;
