/* ==========================================================================
   Upland Dashboard -- Guide Page Logic
   Consolidated action items from all sections.
   Depends on: js/store.js, js/api.js, js/auth.js, js/nav.js, js/guide-engine.js
   ========================================================================== */

'use strict';

var CATEGORY_META = {
  mission:     { label: 'Missions',    link: '/dashboard#section-missions' },
  yield:       { label: 'Yield',       link: '/dashboard#section-yield' },
  sparklet:    { label: 'Sparklet',    link: '/dashboard#section-sparklet' },
  property:    { label: 'Properties',  link: '/dashboard#section-portfolio' },
  liquidation: { label: 'Liquidation', link: '/dashboard#section-liquidation' }
};

var CATEGORY_ORDER = ['mission', 'yield', 'sparklet', 'property', 'liquidation'];

function renderGuide() {
  var body = document.getElementById('guide-content');
  if (!body) return;

  var recs = GuideEngine.generateRecommendations();

  if (recs.length === 0) {
    body.innerHTML = '<div class="empty-state"><p>No recommendations available. Enter your portfolio data on the Dashboard to get started.</p><a href="/dashboard" class="btn-connect">Go to Dashboard</a></div>';
    return;
  }

  // Summary stats
  var highCount = recs.filter(function (r) { return r.priority === 1; }).length;
  var lastSync = Store.get('last_sync', null);
  var syncText = lastSync ? new Date(lastSync).toLocaleString() : 'Never';

  var html = '';

  // Stat bar
  html += '<div class="guide-stats">';
  html += '  <div class="guide-stat">';
  html += '    <div class="guide-stat-value">' + recs.length + '</div>';
  html += '    <div class="guide-stat-label">Total Actions</div>';
  html += '  </div>';
  html += '  <div class="guide-stat">';
  html += '    <div class="guide-stat-value" style="color:var(--color-signal-red)">' + highCount + '</div>';
  html += '    <div class="guide-stat-label">High Priority</div>';
  html += '  </div>';
  html += '  <div class="guide-stat">';
  html += '    <div class="guide-stat-value" style="font-size:var(--text-sm)">' + syncText + '</div>';
  html += '    <div class="guide-stat-label">Last Sync</div>';
  html += '  </div>';
  html += '</div>';

  // Group by category
  html += '<div class="guide-grid">';

  CATEGORY_ORDER.forEach(function (cat) {
    var catRecs = GuideEngine.filterByCategory(recs, cat);
    if (catRecs.length === 0) return;

    var meta = CATEGORY_META[cat];

    html += '<div class="guide-category">';
    html += '  <div class="guide-category-title">' + escapeHtml(meta.label) + '</div>';

    catRecs.forEach(function (rec) {
      var signalClass = '';
      if (rec.signal === 'green') signalClass = ' recommendation--green';
      else if (rec.signal === 'yellow') signalClass = ' recommendation--yellow';
      else if (rec.signal === 'red') signalClass = ' recommendation--red';

      var priorityLabel = rec.priority === 1 ? 'HIGH' : rec.priority === 2 ? 'MED' : 'LOW';
      var priorityColor = rec.priority === 1 ? 'var(--color-signal-red)' : rec.priority === 2 ? 'var(--color-signal-yellow)' : 'var(--color-text-muted)';

      html += '<div class="recommendation' + signalClass + '">';
      html += '  <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-1)">';
      html += '    <span style="font-size:var(--text-xs);font-weight:var(--font-weight-bold);color:' + priorityColor + ';text-transform:uppercase;letter-spacing:0.05em">' + priorityLabel + '</span>';
      html += '    <span class="recommendation-action" style="margin-bottom:0">' + rec.action.toUpperCase() + ': ' + escapeHtml(rec.title) + '</span>';
      html += '  </div>';
      html += '  <div class="recommendation-body">' + escapeHtml(rec.detail) + '</div>';
      html += '  <a href="' + meta.link + '" style="font-size:var(--text-xs);color:var(--color-accent);text-decoration:none;margin-top:var(--space-2);display:inline-block">Go to ' + escapeHtml(meta.label) + ' &rarr;</a>';
      html += '</div>';
    });

    html += '</div>';
  });

  html += '</div>';

  body.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async function () {
  Nav.init();

  // Sync from API if connected, then render
  if (Api.isConnected()) {
    try {
      await Api.syncFromApi();
    } catch (err) {
      showToast('Sync failed: ' + err.message, 'error');
    }
  }

  renderGuide();

  // Re-render when store keys change
  var debouncedGuideRender = debouncedRender(renderGuide);
  Store.on('task_count', debouncedGuideRender);
  Store.on('portfolio_value', debouncedGuideRender);
  Store.on('upx_balance', debouncedGuideRender);
  Store.on('sparklet_balance', debouncedGuideRender);
  Store.on('last_sync', debouncedGuideRender);
  Store.on('liq_declining_3_seasons', debouncedGuideRender);
  Store.on('liq_increasing_engagement', debouncedGuideRender);
  Store.on('monthly_hours', debouncedGuideRender);
  Store.on('liq_discount', debouncedGuideRender);
  Store.on('sparklet_price', debouncedGuideRender);
});
