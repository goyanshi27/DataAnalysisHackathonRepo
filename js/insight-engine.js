/* ============================================================
   INSIGHT-ENGINE.JS — Rule-based analytical insight generator
   All insights generated from actual data calculations
   ============================================================ */
'use strict';

const InsightEngine = {

  // Generate all Olist dashboard insights
  generateOlistInsights() {
    const insights = [];
    try {
      const kpis   = AnalysisEngine.getExecutiveKPIs();
      const states = AnalysisEngine.getStateRisk();
      const cats   = AnalysisEngine.getCategoryRisk();
      const corr   = AnalysisEngine.getDeliveryReviewCorrelation();
      const pain   = AnalysisEngine.getDeliveryPainCurve();

      if (kpis) {
        if (kpis.lateRate > 10) {
          insights.push({ type: 'critical', what: 'Elevated Late Delivery Rate', why: 'Late delivery rate exceeds 10% of analyzed orders.', evidence: `Late rate: ${Utils.fmtPct(kpis.lateRate)} | Late orders: ${Utils.fmtNumber(kpis.lateOrders)}` });
        } else if (kpis.lateRate > 5) {
          insights.push({ type: 'warning', what: 'Moderate Late Delivery Rate', why: 'Late delivery rate is between 5–10%.', evidence: `Late rate: ${Utils.fmtPct(kpis.lateRate)} | Late orders: ${Utils.fmtNumber(kpis.lateOrders)}` });
        }
        if (kpis.avgReview && kpis.avgReview < 3.5) {
          insights.push({ type: 'critical', what: 'Low Average Review Score', why: 'Overall average review score is below 3.5 — below acceptable threshold.', evidence: `Avg review: ${kpis.avgReview}/5` });
        }
      }

      if (corr && corr.r !== null) {
        const strength = StatisticsEngine.correlationStrength(corr.r);
        insights.push({
          type: corr.r < -0.2 ? 'warning' : 'info',
          what: 'Delivery–Satisfaction Association',
          why: `Delivery deviation has a ${strength} ${corr.r < 0 ? 'negative' : 'positive'} linear association with review score. Later deliveries are associated with lower satisfaction scores.`,
          evidence: `Pearson r = ${corr.r} | ${StatisticsEngine.fmtPValue(corr.p)} | n = ${Utils.fmtNumber(corr.n)}\n⚠ Association does not imply causation.`
        });
      }

      if (pain && pain.length) {
        const early = pain.find(p => p.bucket === '7+ Days Early');
        const late  = pain.find(p => p.bucket === '8+ Days Late');
        if (early && late && early.avgReview && late.avgReview) {
          const gap = Utils.round(early.avgReview - late.avgReview, 2);
          insights.push({
            type: 'warning', what: `${gap}-Point Customer Satisfaction Gap`,
            why: 'Customers receiving orders 7+ days early rate significantly higher than those receiving orders 8+ days late.',
            evidence: `7+ days early avg: ${early.avgReview}★ | 8+ days late avg: ${late.avgReview}★ | Gap: ${gap} points`
          });
        }
      }

      if (states && states.length) {
        const topRisk = states[0];
        insights.push({
          type: topRisk.late_rate > 15 ? 'critical' : 'warning',
          what: `${topRisk.state} is the Highest-Risk State`,
          why: `${topRisk.state} has the highest late delivery rate across all states.`,
          evidence: `Late rate: ${Utils.fmtPct(topRisk.late_rate)} | Late orders: ${Utils.fmtNumber(topRisk.late_orders)} | Orders: ${Utils.fmtNumber(topRisk.orders)}`
        });
      }

      if (cats && cats.length) {
        const topCat = cats[0];
        insights.push({
          type: 'warning', what: `"${topCat.category}" Has Highest Category Late Rate`,
          why: `This category shows the highest delivery late rate among all product categories.`,
          evidence: `Late rate: ${Utils.fmtPct(topCat.late_rate)} | Orders: ${Utils.fmtNumber(topCat.orders)}`
        });
      }

    } catch (err) {
      console.warn('[InsightEngine] Error generating insights:', err);
    }
    return insights;
  },

  // Generate insights for uploaded dataset
  generateUploadInsights(data, profile, corr) {
    const insights = [];
    if (!data || !profile) return insights;

    // Missing values
    profile.columns.filter(c => c.missingPct > 15).forEach(col => {
      insights.push({
        type: 'warning', what: `High Missing Rate: "${col.name}"`,
        why: `Column "${col.name}" is missing ${col.missingPct}% of values which may affect analysis accuracy.`,
        evidence: `${Utils.fmtNumber(col.missingCount)} missing of ${Utils.fmtNumber(data.length)} rows`
      });
    });

    // Duplicate rows
    if (profile.duplicatePct > 5) {
      insights.push({
        type: 'warning', what: 'Significant Duplicate Rows',
        why: `${profile.duplicatePct}% of rows appear to be duplicates, which may distort aggregations.`,
        evidence: `${Utils.fmtNumber(profile.duplicates)} potential duplicate rows detected`
      });
    }

    // Strong correlations
    if (corr) {
      const top = CorrelationEngine.topCorrelations(corr, 3);
      top.filter(c => Math.abs(c.r) >= 0.5).forEach(c => {
        insights.push({
          type: 'info', what: `Strong Relationship: "${c.col1}" and "${c.col2}"`,
          why: `${CorrelationEngine.describeCorrelation(c.r)}.`,
          evidence: `Pearson r = ${c.r} | n = ${Utils.fmtNumber(c.n)}\n⚠ Correlation does not imply causation.`
        });
      });
    }

    // Numeric distributions
    profile.columns.filter(c => c.type === 'numeric' && c.stats).forEach(col => {
      const s = col.stats;
      if (s.cv > 100) {
        insights.push({
          type: 'info', what: `High Variability: "${col.name}"`,
          why: `This column shows extreme spread — some values may be outliers.`,
          evidence: `CV = ${s.cv}% | Min: ${s.min} | Max: ${s.max} | Mean: ${s.mean}`
        });
      }
    });

    // Skewed categories
    profile.columns.filter(c => c.type === 'categorical' && c.topValues.length > 0).forEach(col => {
      const top = col.topValues[0];
      if (top.pct > 50) {
        insights.push({
          type: 'info', what: `Dominant Category: "${top.value}" in "${col.name}"`,
          why: `One category accounts for over half of all values, indicating concentration.`,
          evidence: `"${top.value}" = ${top.pct}% of all records (${Utils.fmtNumber(top.count)} rows)`
        });
      }
    });

    return insights;
  },

  // Render insights to a container element
  renderInsights(container, insights) {
    if (!container) return;
    if (!insights || !insights.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-desc">No significant insights detected from this dataset.</div></div>';
      return;
    }
    container.innerHTML = insights.map(ins => `
      <div class="insight-item ${ins.type === 'critical' ? 'critical' : ins.type === 'warning' ? 'warning' : ins.type === 'positive' ? 'positive' : ''}">
        <div class="insight-what">${Utils.escapeHtml(ins.what)}</div>
        <div>${Utils.escapeHtml(ins.why)}</div>
        ${ins.evidence ? `<div class="insight-evidence">${Utils.escapeHtml(ins.evidence)}</div>` : ''}
      </div>
    `).join('');
  }
};

window.InsightEngine = InsightEngine;
