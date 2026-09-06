'use strict';
const ChartRecommendation = {
  recommend(profile) {
    if (!profile) return [];
    const recs = [];
    const numCols = profile.columns.filter(c => c.type === 'numeric');
    const catCols = profile.columns.filter(c => c.type === 'categorical');
    const dateCols = profile.columns.filter(c => c.type === 'date');
    if (dateCols.length && numCols.length) {
      recs.push({ type:'line', title:'Time Trend', reason:'Date + numeric columns detected → line chart shows change over time', xKey: dateCols[0].name, yKey: numCols[0].name, priority:1 });
      if (numCols.length > 1) recs.push({ type:'area', title:'Cumulative Trend', reason:'Multiple numeric columns with date → stacked area shows composition', xKey: dateCols[0].name, yKey: numCols[1].name, priority:2 });
    }
    if (catCols.length && numCols.length) {
      recs.push({ type:'horizontalBar', title:'Category Comparison', reason:'Categorical + numeric → ranked horizontal bar for easy reading', xKey: catCols[0].name, yKey: numCols[0].name, priority:1 });
      if (catCols.length > 1) recs.push({ type:'doughnut', title:'Composition', reason:'Categorical breakdown → donut shows proportions', xKey: catCols[0].name, priority:3 });
    }
    if (numCols.length >= 2) {
      recs.push({ type:'scatter', title:'Correlation Analysis', reason:'Two numeric variables → scatter plot reveals relationships', xKey: numCols[0].name, yKey: numCols[1].name, priority:2 });
      recs.push({ type:'histogram', title:'Distribution', reason:'Numeric variable → histogram shows data distribution', xKey: numCols[0].name, priority:2 });
    }
    if (numCols.length >= 3) {
      recs.push({ type:'bubble', title:'Multi-Variable View', reason:'3 numeric variables → bubble chart shows 3D relationships', xKey: numCols[0].name, yKey: numCols[1].name, rKey: numCols[2].name, priority:3 });
      recs.push({ type:'correlation', title:'Correlation Matrix', reason:'Multiple numeric columns → heatmap shows all pairwise correlations', priority:4 });
    }
    if (numCols.length >= 4) {
      recs.push({ type:'radar', title:'Multi-Metric Radar', reason:'Multiple metrics → radar chart shows relative performance', priority:4 });
    }
    return recs.sort((a,b) => a.priority - b.priority);
  }
};
window.ChartRecommendation = ChartRecommendation;
