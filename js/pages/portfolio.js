/* ==========================================================================
   Upland Dashboard -- Portfolio Page Logic
   Property detail + manual valuations + NFT grid.
   Depends on: js/store.js, js/api.js, js/auth.js, js/nav.js, js/guide-engine.js
   ========================================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', async function () {
  Nav.init();

  var body = document.getElementById('portfolio-content');
  if (!body) return;

  if (!Api.isConnected()) {
    body.innerHTML = '<div class="empty-state"><p>Connect your Upland account to view property details.</p><a href="/" class="btn-connect">Connect Account</a></div>';
    return;
  }

  // Show loading state while syncing
  body.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto var(--space-4)"></div><p>Loading portfolio data...</p></div>';

  try {
    await Api.syncFromApi();
  } catch (err) {
    showToast('Sync failed: ' + err.message, 'error');
  }

  renderPortfolio();

  // Re-render on relevant store changes
  var debouncedRenderPortfolio = debouncedRender(renderPortfolio);
  Store.on('properties', debouncedRenderPortfolio);
  Store.on('nfts', debouncedRenderPortfolio);
  Store.on('portfolio_value', debouncedRenderPortfolio);
  Store.on('task_count', debouncedRenderPortfolio);
  Store.on('liq_discount', debouncedRenderPortfolio);
});


function renderPortfolio() {
  var body = document.getElementById('portfolio-content');
  if (!body) return;

  var properties = Store.get('properties', []);
  var nfts = Store.get('nfts', []);
  var portfolioValue = Store.get('portfolio_value', 0);
  var taskCount = Store.get('task_count', 5);
  var discount = Store.get('liq_discount', 30);
  var valuations = Store.get('property_valuations', {});

  var multiplier = YIELD_MULTIPLIERS[taskCount] || 1.0;
  var effectiveRate = BASE_YIELD_RATE * multiplier;

  // Calculate total assessed value from properties if available
  var totalAssessed = 0;
  properties.forEach(function (p) {
    totalAssessed += (p.mintPrice || p.assessed || 0);
  });
  if (totalAssessed === 0) totalAssessed = portfolioValue;

  var html = '';

  // --- Summary Stats ---
  html += '<div class="stat-grid mb-4">';
  html += '  <div class="stat-block">';
  html += '    <span class="stat-label">Properties <span class="badge-synced">Synced</span></span>';
  html += '    <span class="stat-value accent">' + properties.length + '</span>';
  html += '  </div>';
  html += '  <div class="stat-block">';
  html += '    <span class="stat-label">Net Worth (UPX) <span class="badge-synced">Synced</span></span>';
  html += '    <span class="stat-value">' + formatNumber(portfolioValue) + '</span>';
  html += '  </div>';
  html += '  <div class="stat-block">';
  html += '    <span class="stat-label">Total NFTs <span class="badge-synced">Synced</span></span>';
  html += '    <span class="stat-value accent">' + nfts.length + '</span>';
  html += '  </div>';
  html += '</div>';

  // --- Property Table ---
  if (properties.length > 0) {
    html += '<div class="card mb-4">';
    html += '  <div class="card-header">';
    html += '    <h2>Properties</h2>';
    html += '    <span class="badge">' + properties.length + ' total</span>';
    html += '  </div>';
    html += '  <div class="card-body" style="padding:0">';
    html += '    <div class="property-table-wrapper">';
    html += '      <table class="property-table">';
    html += '        <thead>';
    html += '          <tr>';
    html += '            <th>Address</th>';
    html += '            <th>City</th>';
    html += '            <th>Neighborhood</th>';
    html += '            <th>Mint Price</th>';
    html += '            <th>Valuation (UPX)</th>';
    html += '            <th>Est. Yield/yr</th>';
    html += '            <th>Liq. Value</th>';
    html += '          </tr>';
    html += '        </thead>';
    html += '        <tbody>';

    properties.forEach(function (prop, idx) {
      var propId = prop.id || prop.propertyId || ('prop-' + idx);
      var address = prop.address || prop.fullAddress || 'Unknown';
      var city = prop.city || prop.cityName || '--';
      var neighborhood = prop.neighborhood || prop.neighborhoodName || '--';
      var mintPrice = prop.mintPrice || prop.assessed || 0;

      var userVal = valuations[propId];
      var hasVal = typeof userVal === 'number' && userVal > 0;
      var valForCalc = hasVal ? userVal : mintPrice;

      // Calculated columns
      var estYield = valForCalc > 0 ? (valForCalc * effectiveRate / 1000) : 0;
      var liqValue = valForCalc > 0 ? (valForCalc * (1 - discount / 100) * 0.95 / 1000) : 0;

      html += '      <tr>';
      html += '        <td style="font-family:var(--font-primary);white-space:nowrap">' + escapeHtml(address) + '</td>';
      html += '        <td style="font-family:var(--font-primary)">' + escapeHtml(city) + '</td>';
      html += '        <td style="font-family:var(--font-primary)">' + escapeHtml(neighborhood) + '</td>';
      html += '        <td>' + formatNumber(mintPrice) + '</td>';
      html += '        <td>';
      html += '          <input type="number" class="form-input property-valuation" data-prop-id="' + escapeHtml(String(propId)) + '" value="' + (hasVal ? userVal : '') + '" placeholder="' + formatNumber(mintPrice) + '" min="0" step="1000" style="width:120px;padding:var(--space-1) var(--space-2);font-size:var(--text-sm)">';
      html += '        </td>';
      html += '        <td class="' + (estYield > 0 ? 'green' : '') + '">$' + formatNumber(estYield, 2) + '</td>';
      html += '        <td>$' + formatNumber(liqValue, 2) + '</td>';
      html += '      </tr>';
    });

    html += '        </tbody>';
    html += '      </table>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
  } else {
    html += '<div class="info-note mb-4">No property data available. Sync from the Dashboard to load your properties.</div>';
  }

  // --- NFT Section ---
  if (nfts.length > 0) {
    html += '<div class="card">';
    html += '  <div class="card-header">';
    html += '    <h2>NFTs</h2>';
    html += '    <span class="badge">' + nfts.length + ' total</span>';
    html += '  </div>';
    html += '  <div class="card-body">';
    html += '    <div class="nft-grid">';

    nfts.forEach(function (nft) {
      var name = nft.name || nft.title || 'Unnamed NFT';
      var rarity = nft.rarity || nft.rarityLevel || '';
      var thumbnail = nft.thumbnail || nft.imageUrl || nft.image || '';

      var rarityClass = '';
      var rarityLower = rarity.toLowerCase();
      if (rarityLower === 'legendary' || rarityLower === 'mythic') rarityClass = 'nft-rarity--legendary';
      else if (rarityLower === 'epic') rarityClass = 'nft-rarity--epic';
      else if (rarityLower === 'rare') rarityClass = 'nft-rarity--rare';
      else if (rarityLower === 'uncommon') rarityClass = 'nft-rarity--uncommon';

      html += '    <div class="nft-card">';
      if (thumbnail) {
        html += '      <div class="nft-thumbnail"><img src="' + escapeHtml(thumbnail) + '" alt="' + escapeHtml(name) + '" loading="lazy"></div>';
      } else {
        html += '      <div class="nft-thumbnail nft-thumbnail--empty"></div>';
      }
      html += '      <div class="nft-info">';
      html += '        <div class="nft-name">' + escapeHtml(name) + '</div>';
      if (rarity) {
        html += '        <span class="nft-rarity ' + rarityClass + '">' + escapeHtml(rarity) + '</span>';
      }
      html += '      </div>';
      html += '    </div>';
    });

    html += '    </div>';
    html += '  </div>';
    html += '</div>';
  }

  // Inline property recommendations
  var allRecs = GuideEngine.generateRecommendations();
  var propRecs = GuideEngine.filterByCategory(allRecs, 'property');
  html += GuideEngine.renderRecommendationList(propRecs, 2, 'recs-portfolio-prop');

  body.innerHTML = html;

  GuideEngine.bindCollapsible('recs-portfolio-prop');

  // --- Event: valuation inputs ---
  document.querySelectorAll('.property-valuation').forEach(function (input) {
    input.addEventListener('change', function () {
      var propId = this.dataset.propId;
      var val = parseFloat(this.value);
      var current = Store.get('property_valuations', {});

      if (isNaN(val) || val <= 0) {
        delete current[propId];
      } else {
        current[propId] = val;
      }
      Store.set('property_valuations', current);
      renderPortfolio();
    });
  });
}
