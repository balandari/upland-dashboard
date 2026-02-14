/* ==========================================================================
   Upland Dashboard -- Recommendation Engine
   Generates actionable recommendations from current portfolio state.
   Returns array of {id, category, priority, action, title, detail, signal}.
   Depends on: js/store.js (Store, constants)
   ========================================================================== */

'use strict';

var GuideEngine = {

  /**
   * Generate all recommendations from current Store data.
   * @returns {Array<{id:string, category:string, priority:number, action:string, title:string, detail:string, signal:string}>}
   */
  generateRecommendations: function () {
    var recs = [];

    var taskCount = Store.get('task_count', 5);
    var portfolioValue = Store.get('portfolio_value', 24000000);
    var upxBalance = Store.get('upx_balance', 2077060.5);
    var sparkletBalance = Store.get('sparklet_balance', 7521);
    var stakedSpark = Store.get('staked_spark', 0);
    var sparkletPrice = Store.get('sparklet_price', 0.021);
    var monthlyHours = Store.get('monthly_hours', 2);
    var structures = Store.get('structures', DEFAULT_STRUCTURES);
    var properties = Store.get('properties', []);

    var increasingEngagement = Store.get('liq_increasing_engagement', false);
    var declining3Seasons = Store.get('liq_declining_3_seasons', false);
    var baseRate2Seasons = Store.get('liq_base_rate_2_seasons', false);

    var thresholds = Store.get('liq_thresholds', {
      hourlyGreenMin: 5,
      hourlyYellowMin: 1,
      liquidationLow: 500,
      liquidationMid: 2000,
      annualYieldGreenMin: 200
    });

    var multiplier = YIELD_MULTIPLIERS[taskCount] || 1.0;
    var effectiveRate = BASE_YIELD_RATE * multiplier;
    var annualYieldUPX = portfolioValue * effectiveRate;
    var annualYieldUSD = annualYieldUPX / 1000;

    var discount = Store.get('liq_discount', 30);
    var propertyLiqValue = portfolioValue * (1 - discount / 100) * 0.95 / 1000;
    var upxLiqValue = upxBalance / 1000;
    var sparkletLiqValue = sparkletBalance * sparkletPrice;
    var totalLiquidation = propertyLiqValue + upxLiqValue + sparkletLiqValue;
    var hourlyReturn = monthlyHours > 0 ? annualYieldUSD / (monthlyHours * 12) : 0;

    var seasonInfo = getSeasonForDate(new Date());

    // ---- MISSION RECOMMENDATIONS ----

    if (seasonInfo) {
      if (taskCount < 5) {
        var remaining = 5 - taskCount;
        recs.push({
          id: 'mission-hit-5',
          category: 'mission',
          priority: 1,
          action: 'do',
          title: 'Complete ' + remaining + ' more mission' + (remaining > 1 ? 's' : '') + ' to reach 5-task sweet spot',
          detail: 'The 5-task threshold delivers 3.0x multiplier (14.7% yield) -- 96.7% of max. Currently at ' + multiplier.toFixed(2) + 'x.',
          signal: 'green'
        });
      } else {
        recs.push({
          id: 'mission-threshold-met',
          category: 'mission',
          priority: 3,
          action: 'skip',
          title: '5-task threshold met',
          detail: 'Additional missions add <0.1x multiplier. Tasks 6-10 yield diminishing returns (3.02x-3.1x total).',
          signal: 'accent'
        });
      }
    } else {
      // Intermission
      recs.push({
        id: 'mission-intermission',
        category: 'mission',
        priority: 3,
        action: 'hold',
        title: 'No active season -- intermission',
        detail: 'Missions reset next season. Use this time to optimize property portfolio and collect yield.',
        signal: 'accent'
      });
    }

    // ---- YIELD RECOMMENDATIONS ----

    if (portfolioValue > 0 && taskCount >= 5) {
      var dailyYieldUSD = annualYieldUSD / 365;
      recs.push({
        id: 'yield-collect',
        category: 'yield',
        priority: 2,
        action: 'do',
        title: 'Collect yield every 3 hours',
        detail: 'Current rate: $' + formatNumber(dailyYieldUSD, 2) + '/day ($' + formatNumber(annualYieldUSD, 2) + '/year) at ' + (effectiveRate * 100).toFixed(1) + '% effective rate.',
        signal: 'green'
      });
    }

    if (taskCount < 5 && portfolioValue > 0) {
      var currentYield = portfolioValue * BASE_YIELD_RATE * multiplier / 1000;
      var targetYield = portfolioValue * BASE_YIELD_RATE * 3.0 / 1000;
      var yieldGain = targetYield - currentYield;
      recs.push({
        id: 'yield-boost',
        category: 'yield',
        priority: 1,
        action: 'do',
        title: 'Increase tasks to boost multiplier from ' + multiplier.toFixed(1) + 'x to 3.0x',
        detail: 'Would add $' + formatNumber(yieldGain, 2) + '/year to yield. Complete ' + (5 - taskCount) + ' more mission' + (5 - taskCount > 1 ? 's' : '') + ' this season.',
        signal: 'green'
      });
    }

    // ---- SPARKLET RECOMMENDATIONS ----

    var cheapestStruct = null;
    if (structures.length > 0) {
      cheapestStruct = structures.reduce(function (min, s) {
        return s.sparkHours < min.sparkHours ? s : min;
      }, structures[0]);
    }

    if (sparkletBalance > 0 && cheapestStruct) {
      var estDays = (cheapestStruct.sparkHours * 1000 / sparkletBalance / 24).toFixed(0);
      recs.push({
        id: 'sparklet-deploy',
        category: 'sparklet',
        priority: 2,
        action: 'consider',
        title: 'Deploy Sparklet to ' + cheapestStruct.name,
        detail: 'Balance: ' + formatNumber(sparkletBalance) + ' Spark. Estimated ' + estDays + ' days to complete ' + cheapestStruct.name + ' (' + formatNumber(cheapestStruct.sparkHours) + ' Spark-hrs).',
        signal: 'yellow'
      });
    }

    if (stakedSpark > 0) {
      recs.push({
        id: 'sparklet-staked',
        category: 'sparklet',
        priority: 3,
        action: 'hold',
        title: formatNumber(stakedSpark) + ' Spark staked in active builds',
        detail: 'Spark is returned on build completion. It is not consumed during construction.',
        signal: 'accent'
      });
    }

    // ---- PROPERTY RECOMMENDATIONS ----

    if (upxBalance > 0) {
      var potentialYield = upxBalance * effectiveRate / 1000;
      recs.push({
        id: 'property-deploy-upx',
        category: 'property',
        priority: 1,
        action: 'do',
        title: 'Deploy ' + formatNumber(upxBalance, 0) + ' idle UPX into properties',
        detail: 'Liquid UPX earns no yield. Deploying would add ~$' + formatNumber(potentialYield, 2) + '/year at current ' + (effectiveRate * 100).toFixed(1) + '% rate.',
        signal: 'green'
      });
    }

    if (properties.length > 0) {
      recs.push({
        id: 'property-review',
        category: 'property',
        priority: 3,
        action: 'consider',
        title: 'Review ' + properties.length + ' properties on Portfolio page',
        detail: 'Check property valuations and identify collection completion opportunities.',
        signal: 'accent'
      });
    }

    // ---- LIQUIDATION RECOMMENDATIONS ----

    if (hourlyReturn < thresholds.hourlyYellowMin && totalLiquidation > thresholds.liquidationMid) {
      recs.push({
        id: 'liq-red-hourly',
        category: 'liquidation',
        priority: 1,
        action: 'do',
        title: 'Consider liquidating',
        detail: 'Total est. value: $' + formatNumber(totalLiquidation, 2) + '. Hourly return ($' + formatNumber(hourlyReturn, 2) + '/hr) below $' + thresholds.hourlyYellowMin + '/hr threshold.',
        signal: 'red'
      });
    } else if (declining3Seasons) {
      recs.push({
        id: 'liq-red-declining',
        category: 'liquidation',
        priority: 1,
        action: 'do',
        title: 'Portfolio declining -- evaluate exit',
        detail: 'Value declining for 3+ seasons. Exit window may be closing. Est. liquidation: $' + formatNumber(totalLiquidation, 2) + '.',
        signal: 'red'
      });
    } else if (hourlyReturn >= thresholds.hourlyGreenMin && totalLiquidation < thresholds.liquidationLow) {
      recs.push({
        id: 'liq-green-hold',
        category: 'liquidation',
        priority: 3,
        action: 'hold',
        title: 'Hold position -- returns strong',
        detail: 'Hourly return $' + formatNumber(hourlyReturn, 2) + '/hr. Liquidation value ($' + formatNumber(totalLiquidation, 2) + ') too low to justify selling.',
        signal: 'green'
      });
    } else if (annualYieldUSD >= thresholds.annualYieldGreenMin && increasingEngagement) {
      recs.push({
        id: 'liq-green-engaged',
        category: 'liquidation',
        priority: 3,
        action: 'hold',
        title: 'Hold position -- yield and engagement rising',
        detail: 'Annual yield $' + formatNumber(annualYieldUSD, 2) + ' with increasing engagement. Continue optimizing.',
        signal: 'green'
      });
    } else if (hourlyReturn >= thresholds.hourlyYellowMin && hourlyReturn < thresholds.hourlyGreenMin) {
      recs.push({
        id: 'liq-yellow-marginal',
        category: 'liquidation',
        priority: 2,
        action: 'consider',
        title: 'Review position -- marginal returns',
        detail: 'Hourly return $' + formatNumber(hourlyReturn, 2) + '/hr is marginal. Consider optimizing task count or reducing hours before deciding.',
        signal: 'yellow'
      });
    } else if (baseRate2Seasons) {
      recs.push({
        id: 'liq-yellow-stale',
        category: 'liquidation',
        priority: 2,
        action: 'consider',
        title: 'At base rate for 2+ seasons',
        detail: 'Running at base 4.9% yield without multiplier. Engagement may not justify holding without optimization.',
        signal: 'yellow'
      });
    } else {
      recs.push({
        id: 'liq-yellow-moderate',
        category: 'liquidation',
        priority: 2,
        action: 'consider',
        title: 'Moderate position -- review periodically',
        detail: 'Est. liquidation: $' + formatNumber(totalLiquidation, 2) + '. Hourly return: $' + formatNumber(hourlyReturn, 2) + '/hr. Adjust thresholds for your situation.',
        signal: 'yellow'
      });
    }

    // Sort by priority (1=high first), then by category
    recs.sort(function (a, b) {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.category.localeCompare(b.category);
    });

    return recs;
  },

  /**
   * Filter recommendations by category.
   * @param {Array} recs - Full recommendations array
   * @param {string} category - Category to filter by
   * @returns {Array}
   */
  filterByCategory: function (recs, category) {
    return recs.filter(function (r) { return r.category === category; });
  },

  /**
   * Render a single recommendation as HTML string.
   * @param {Object} rec - Recommendation object
   * @returns {string}
   */
  renderRecommendation: function (rec) {
    var signalClass = '';
    if (rec.signal === 'green') signalClass = ' recommendation--green';
    else if (rec.signal === 'yellow') signalClass = ' recommendation--yellow';
    else if (rec.signal === 'red') signalClass = ' recommendation--red';

    var actionLabel = rec.action.toUpperCase() + ':';

    var html = '<div class="recommendation' + signalClass + '">';
    html += '  <div class="recommendation-action">' + actionLabel + ' ' + escapeHtml(rec.title) + '</div>';
    html += '  <div class="recommendation-body">' + escapeHtml(rec.detail) + '</div>';
    html += '</div>';
    return html;
  },

  /**
   * Render a list of recommendations with optional collapsing.
   * If more than maxVisible, extras are wrapped in a collapsible.
   * @param {Array} recs - Recommendations to render
   * @param {number} maxVisible - Max shown before collapsing (default 2)
   * @param {string} collapseId - Unique ID for the collapsible toggle
   * @returns {string}
   */
  renderRecommendationList: function (recs, maxVisible, collapseId) {
    if (recs.length === 0) return '';
    maxVisible = maxVisible || 2;

    var html = '<div class="recommendations-section mt-4">';
    html += '<div class="mb-3" style="font-size:var(--text-sm);color:var(--color-text-secondary);font-weight:var(--font-weight-medium)">Recommendations</div>';

    var visible = recs.slice(0, maxVisible);
    var overflow = recs.slice(maxVisible);

    for (var i = 0; i < visible.length; i++) {
      html += this.renderRecommendation(visible[i]);
    }

    if (overflow.length > 0 && collapseId) {
      html += '<button class="collapsible-header" id="' + collapseId + '-toggle" aria-expanded="false">';
      html += '  <span>' + overflow.length + ' more recommendation' + (overflow.length > 1 ? 's' : '') + '</span>';
      html += '  <span class="collapsible-arrow">&#9654;</span>';
      html += '</button>';
      html += '<div class="collapsible-content" id="' + collapseId + '-content">';
      for (var j = 0; j < overflow.length; j++) {
        html += this.renderRecommendation(overflow[j]);
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  /**
   * Bind collapsible toggle events for recommendation overflow sections.
   * Call after inserting renderRecommendationList HTML into the DOM.
   * @param {string} collapseId - The collapseId used in renderRecommendationList
   */
  bindCollapsible: function (collapseId) {
    var toggle = document.getElementById(collapseId + '-toggle');
    var content = document.getElementById(collapseId + '-content');
    if (toggle && content) {
      toggle.addEventListener('click', function () {
        var isOpen = content.classList.toggle('open');
        toggle.classList.toggle('open', isOpen);
        toggle.setAttribute('aria-expanded', isOpen);
      });
    }
  }
};
