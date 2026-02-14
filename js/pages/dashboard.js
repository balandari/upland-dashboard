/* ==========================================================================
   Upland Dashboard -- Dashboard Page Logic
   Evolved from app.js. All section init functions for the 6-panel dashboard.
   Depends on: js/store.js (Store, constants, utilities), js/api.js (Api, showToast)
   ========================================================================== */

'use strict';


/* --------------------------------------------------------------------------
   SECTION 1: MISSION CHECKLIST
   -------------------------------------------------------------------------- */

function initMissions() {
  const body = document.getElementById('missions-body');
  const badge = document.getElementById('season-badge');

  const now = new Date();
  const overrideStart = Store.get('season_start_override', null);
  const overrideEnd = Store.get('season_end_override', null);

  let seasonInfo = getSeasonForDate(now);
  let seasonName = seasonInfo ? seasonInfo.season.name : 'Intermission';
  let seasonStart, seasonEnd, weekNum;

  if (seasonInfo) {
    seasonStart = overrideStart ? new Date(overrideStart) : getSeasonStart(seasonInfo.season, now);
    seasonEnd = overrideEnd ? new Date(overrideEnd) : getSeasonEnd(seasonInfo.season, now);
    weekNum = getWeekNumber(seasonStart, now);
  } else {
    seasonStart = null;
    seasonEnd = null;
    weekNum = null;
  }

  badge.textContent = seasonName;

  const totalWeeks = 6;
  const missionsPerWeek = 2;
  const totalMissions = totalWeeks * missionsPerWeek;

  const storeKey = 'missions_' + seasonName.toLowerCase() + '_' + now.getFullYear();
  const checked = Store.get(storeKey, {});

  let html = '';

  // Next mission date
  const nextTues = getNextTuesday(now);
  const tuesdayStr = nextTues.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  html += '<div class="next-mission">';
  html += '  <span class="next-mission-label">Next missions:</span>';
  html += '  <span class="next-mission-date">' + tuesdayStr + ', 9 AM PT</span>';
  html += '</div>';

  // Week indicator
  if (weekNum !== null) {
    html += '<div class="week-indicator">Week <strong>' + weekNum + '</strong> of ~' + totalWeeks + '</div>';
  }

  // Completed count
  const completedCount = Object.values(checked).filter(Boolean).length;
  html += '<div class="completed-count"><span class="count-num">' + completedCount + '</span> / ' + totalMissions + ' missions completed</div>';

  // Checkboxes
  for (let w = 1; w <= totalWeeks; w++) {
    for (let m = 1; m <= missionsPerWeek; m++) {
      const id = 'mission_w' + w + '_m' + m;
      const isChecked = !!checked[id];
      const label = 'Week ' + w + ' - Mission ' + m;
      html += '<div class="checkbox-row' + (isChecked ? ' checked' : '') + '">';
      html += '  <input type="checkbox" id="' + id + '" ' + (isChecked ? 'checked' : '') + '>';
      html += '  <label for="' + id + '">' + label + '</label>';
      html += '</div>';
    }
  }

  // Season date overrides
  html += '<hr class="section-divider">';
  html += '<button class="collapsible-header" id="season-override-toggle" aria-expanded="false">';
  html += '  <span>Season Date Overrides</span>';
  html += '  <span class="collapsible-arrow">&#9654;</span>';
  html += '</button>';
  html += '<div class="collapsible-content" id="season-override-content">';
  html += '  <div class="date-overrides">';
  html += '    <div class="form-group">';
  html += '      <label class="form-label" for="season-start">Season Start</label>';
  html += '      <input type="date" class="form-input" id="season-start" value="' + (overrideStart || (seasonStart ? formatDateForInput(seasonStart) : '')) + '">';
  html += '    </div>';
  html += '    <div class="form-group">';
  html += '      <label class="form-label" for="season-end">Season End</label>';
  html += '      <input type="date" class="form-input" id="season-end" value="' + (overrideEnd || (seasonEnd ? formatDateForInput(seasonEnd) : '')) + '">';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  // Inline recommendations
  var allRecs = GuideEngine.generateRecommendations();
  var missionRecs = GuideEngine.filterByCategory(allRecs, 'mission');
  html += GuideEngine.renderRecommendationList(missionRecs, 2, 'recs-mission');

  body.innerHTML = html;

  GuideEngine.bindCollapsible('recs-mission');

  // Event: checkbox changes
  for (let w = 1; w <= totalWeeks; w++) {
    for (let m = 1; m <= missionsPerWeek; m++) {
      const id = 'mission_w' + w + '_m' + m;
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function () {
          const current = Store.get(storeKey, {});
          current[id] = this.checked;
          Store.set(storeKey, current);
          this.closest('.checkbox-row').classList.toggle('checked', this.checked);
          const count = Object.values(current).filter(Boolean).length;
          document.querySelector('.completed-count .count-num').textContent = count;
        });
      }
    }
  }

  // Event: collapsible toggle
  const toggle = document.getElementById('season-override-toggle');
  const content = document.getElementById('season-override-content');
  toggle.addEventListener('click', function () {
    const isOpen = content.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
  });

  // Event: date overrides
  const startInput = document.getElementById('season-start');
  const endInput = document.getElementById('season-end');
  startInput.addEventListener('change', function () {
    Store.set('season_start_override', this.value || null);
  });
  endInput.addEventListener('change', function () {
    Store.set('season_end_override', this.value || null);
  });
}


/* --------------------------------------------------------------------------
   SECTION 2: SPARKLET CAPACITY MONITOR
   -------------------------------------------------------------------------- */

function initSparklet() {
  const body = document.getElementById('sparklet-body');

  function render() {
    const synced = Api.isConnected();
    const bal = Store.get('sparklet_balance', 7521);
    const structs = Store.get('structures', DEFAULT_STRUCTURES);

    let html = '';

    // Balance -- synced display or manual input
    html += '<div class="form-group">';
    html += '  <label class="form-label">Sparklet Balance';
    if (synced) html += ' <span class="badge-synced">Synced</span>';
    html += '</label>';
    if (synced) {
      html += '  <div class="form-value">' + formatNumber(bal) + '</div>';
    } else {
      html += '  <input type="number" class="form-input" id="sparklet-balance" value="' + bal + '" min="0" step="1">';
    }
    html += '</div>';

    // Estimated build times
    html += '<ul class="structure-list">';
    structs.forEach(function (s, i) {
      const estDays = (s.sparkHours * 1000 / bal / 24).toFixed(1);
      html += '<li class="structure-item">';
      html += '  <span class="structure-name">' + escapeHtml(s.name) + '</span>';
      html += '  <span class="structure-detail">' + s.sparkHours.toLocaleString() + ' Spark-hrs &middot; ' + estDays + ' days</span>';
      html += '  <button class="btn-remove" data-idx="' + i + '" title="Remove" aria-label="Remove ' + escapeHtml(s.name) + '">&times;</button>';
      html += '</li>';
    });
    html += '</ul>';

    // Add structure
    html += '<div class="add-structure">';
    html += '  <input type="text" class="form-input" id="new-struct-name" placeholder="Structure name">';
    html += '  <input type="number" class="form-input" id="new-struct-hours" placeholder="Spark-hours" min="1" style="max-width:120px">';
    html += '  <button class="btn-add" id="btn-add-struct">Add</button>';
    html += '</div>';

    // Note
    html += '<div class="info-note">Sparklet is staked during construction and returned upon completion. It is not consumed.</div>';

    // Inline recommendations
    var allRecs = GuideEngine.generateRecommendations();
    var sparkletRecs = GuideEngine.filterByCategory(allRecs, 'sparklet');
    html += GuideEngine.renderRecommendationList(sparkletRecs, 2, 'recs-sparklet');

    body.innerHTML = html;

    // Events
    var sparkInput = document.getElementById('sparklet-balance');
    if (sparkInput) {
      sparkInput.addEventListener('change', function () {
        const v = Math.max(0, parseInt(this.value) || 0);
        Store.set('sparklet_balance', v);
        render();
      });
    }

    document.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(this.dataset.idx);
        const current = Store.get('structures', DEFAULT_STRUCTURES);
        current.splice(idx, 1);
        Store.set('structures', current);
        render();
      });
    });

    document.getElementById('btn-add-struct').addEventListener('click', function () {
      const name = document.getElementById('new-struct-name').value.trim();
      const hours = parseInt(document.getElementById('new-struct-hours').value);
      if (name && hours > 0) {
        const current = Store.get('structures', DEFAULT_STRUCTURES);
        current.push({ name: name, sparkHours: hours });
        Store.set('structures', current);
        render();
      }
    });

    GuideEngine.bindCollapsible('recs-sparklet');
  }

  render();

  var debouncedSparkletRender = debouncedRender(render);
  Store.on('sparklet_balance', debouncedSparkletRender);
}


/* --------------------------------------------------------------------------
   SECTION 3: YIELD DASHBOARD
   -------------------------------------------------------------------------- */

function initYield() {
  const body = document.getElementById('yield-body');

  function render() {
    const synced = Api.isConnected();
    const taskCount = Store.get('task_count', 5);
    const portfolioValue = Store.get('portfolio_value', 24000000);

    const multiplier = YIELD_MULTIPLIERS[taskCount];
    const effectiveRate = BASE_YIELD_RATE * multiplier;
    const annualYieldUPX = portfolioValue * effectiveRate;
    const annualYieldUSD = annualYieldUPX / 1000;

    let html = '';

    // Task count slider
    html += '<div class="form-group">';
    html += '  <div class="task-count-display">';
    html += '    <label class="form-label" for="task-slider" style="margin-bottom:0">Tasks Completed</label>';
    html += '    <span class="task-count-value">' + taskCount + '</span>';
    html += '  </div>';
    html += '  <input type="range" class="range-input" id="task-slider" min="0" max="10" value="' + taskCount + '">';
    html += '</div>';

    // Bar chart for multiplier visualization
    html += '<div class="bar-chart">';
    for (let i = 0; i <= 10; i++) {
      const m = YIELD_MULTIPLIERS[i];
      const pct = (m / 3.1) * 100;
      let barClass = 'bar';
      if (i === taskCount) {
        barClass += ' bar-highlight';
      } else if (i > 5) {
        barClass += ' bar-dim';
      }
      html += '<div class="bar-col">';
      html += '  <span class="bar-value">' + m.toFixed(2) + 'x</span>';
      html += '  <div class="' + barClass + '" style="height:' + pct + '%"></div>';
      html += '  <span class="bar-label">' + i + '</span>';
      html += '</div>';
    }
    html += '</div>';

    // Sweet spot marker
    html += '<div class="sweet-spot-marker">';
    html += '  <span class="spot-icon">*</span>';
    html += '  <div>';
    html += '    <div class="spot-text">5-Task Sweet Spot: 3.0x multiplier (14.7% yield)</div>';
    html += '    <div class="spot-detail">96.7% of max yield for 50% of missions. Tasks 6-10 add only 0.1x total.</div>';
    html += '  </div>';
    html += '</div>';

    // Yield results
    html += '<div class="yield-display">';
    html += '  <div>';

    // Portfolio Value -- synced display or manual input
    html += '    <div class="form-group">';
    html += '      <label class="form-label">Portfolio Value (UPX mint price)';
    if (synced) html += ' <span class="badge-synced">Synced</span>';
    html += '</label>';
    if (synced) {
      html += '      <div class="form-value">' + formatNumber(portfolioValue) + '</div>';
    } else {
      html += '      <input type="number" class="form-input" id="portfolio-value" value="' + portfolioValue + '" min="0" step="1000">';
    }
    html += '    </div>';

    html += '  </div>';
    html += '  <div>';
    html += '    <div class="stat-grid">';
    html += '      <div class="stat-block">';
    html += '        <span class="stat-label">Multiplier</span>';
    html += '        <span class="stat-value accent">' + multiplier.toFixed(2) + 'x</span>';
    html += '      </div>';
    html += '      <div class="stat-block">';
    html += '        <span class="stat-label">Effective Rate</span>';
    html += '        <span class="stat-value accent">' + (effectiveRate * 100).toFixed(2) + '%</span>';
    html += '      </div>';
    html += '      <div class="stat-block">';
    html += '        <span class="stat-label">Annual Yield (UPX)</span>';
    html += '        <span class="stat-value">' + formatNumber(annualYieldUPX) + '</span>';
    html += '      </div>';
    html += '      <div class="stat-block">';
    html += '        <span class="stat-label">Annual Yield (USD)</span>';
    html += '        <span class="stat-value green">$' + formatNumber(annualYieldUSD, 2) + '</span>';
    html += '      </div>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // Inline recommendations
    var allRecs = GuideEngine.generateRecommendations();
    var yieldRecs = GuideEngine.filterByCategory(allRecs, 'yield');
    html += GuideEngine.renderRecommendationList(yieldRecs, 2, 'recs-yield');

    body.innerHTML = html;

    GuideEngine.bindCollapsible('recs-yield');

    // Events
    document.getElementById('task-slider').addEventListener('input', function () {
      const val = parseInt(this.value);
      Store.set('task_count', val);
      render();
    });

    var pvInput = document.getElementById('portfolio-value');
    if (pvInput) {
      pvInput.addEventListener('change', function () {
        const val = Math.max(0, parseInt(this.value) || 0);
        Store.set('portfolio_value', val);
        render();
      });
    }
  }

  render();

  const debouncedYieldRender = debouncedRender(render);
  Store.on('portfolio_value', debouncedYieldRender);
}


/* --------------------------------------------------------------------------
   SECTION 4: OPTIMIZATION PRIORITIES
   -------------------------------------------------------------------------- */

function initPriorities() {
  const body = document.getElementById('priorities-body');

  function render() {
    var taskCount = Store.get('task_count', 5);
    var upxBalance = Store.get('upx_balance', 2077060.5);
    var portfolioValue = Store.get('portfolio_value', 24000000);
    var sparkletBalance = Store.get('sparklet_balance', 7521);
    var declining3Seasons = Store.get('liq_declining_3_seasons', false);
    var monthlyHours = Store.get('monthly_hours', 2);
    var discount = Store.get('liq_discount', 30);
    var sparkletPrice = Store.get('sparklet_price', 0.021);
    var structures = Store.get('structures', DEFAULT_STRUCTURES);
    var thresholds = Store.get('liq_thresholds', {
      hourlyGreenMin: 5, hourlyYellowMin: 1,
      liquidationLow: 500, liquidationMid: 2000,
      annualYieldGreenMin: 200
    });

    var multiplier = YIELD_MULTIPLIERS[taskCount] || 1.0;
    var effectiveRate = BASE_YIELD_RATE * multiplier;
    var annualYieldUSD = portfolioValue * effectiveRate / 1000;
    var propertyLiqValue = portfolioValue * (1 - discount / 100) * 0.95 / 1000;
    var totalLiquidation = propertyLiqValue + upxBalance / 1000 + sparkletBalance * sparkletPrice;
    var hourlyReturn = monthlyHours > 0 ? annualYieldUSD / (monthlyHours * 12) : 0;

    // Determine if liquidation signal is RED
    var liqRed = (hourlyReturn < thresholds.hourlyYellowMin && totalLiquidation > thresholds.liquidationMid) || declining3Seasons;

    // Build dynamic priority list
    var priorities = [];

    // Liquidation RED overrides everything
    if (liqRed) {
      priorities.push({
        title: 'Evaluate exit strategy',
        desc: 'Liquidation signal is RED. Est. total value: $' + formatNumber(totalLiquidation, 2) + '. Review the Liquidation Gate for details.'
      });
    }

    // Hit 5 tasks
    if (taskCount < 5) {
      var yieldGain = portfolioValue * BASE_YIELD_RATE * (3.0 - multiplier) / 1000;
      priorities.push({
        title: 'Hit 5 tasks this season',
        desc: 'Currently at ' + multiplier.toFixed(1) + 'x. Reaching 5 tasks delivers 3.0x (14.7% yield). Impact: +$' + formatNumber(yieldGain, 2) + '/year.'
      });
    }

    // Deploy idle UPX
    if (upxBalance > 0) {
      var deployYield = upxBalance * effectiveRate / 1000;
      priorities.push({
        title: 'Deploy idle UPX into properties',
        desc: formatNumber(upxBalance, 0) + ' UPX sitting idle. Deploying would add ~$' + formatNumber(deployYield, 2) + '/year to yield.'
      });
    }

    // Sparklet deployment
    if (sparkletBalance > 0 && structures.length > 0) {
      var cheapest = structures.reduce(function (min, s) {
        return s.sparkHours < min.sparkHours ? s : min;
      }, structures[0]);
      var estDays = (cheapest.sparkHours * 1000 / sparkletBalance / 24).toFixed(0);
      priorities.push({
        title: 'Deploy Sparklet to ' + cheapest.name,
        desc: formatNumber(sparkletBalance) + ' Spark available. Est. ' + estDays + ' days to complete. Building earns missions and may boost scores.'
      });
    }

    // Maximize yield (if already at 5 tasks)
    if (taskCount >= 5) {
      priorities.push({
        title: 'Maximize yield collection',
        desc: 'At ' + multiplier.toFixed(2) + 'x multiplier. Collect every 3 hours when active. Current rate: $' + formatNumber(annualYieldUSD, 2) + '/year.'
      });
    }

    // Always include liquidation review if not already RED
    if (!liqRed) {
      priorities.push({
        title: 'Assess liquidation periodically',
        desc: 'Est. liquidation: $' + formatNumber(totalLiquidation, 2) + '. Hourly return: $' + formatNumber(hourlyReturn, 2) + '/hr. Review the Liquidation Gate below.'
      });
    }

    var html = '<ol class="priority-list">';
    priorities.forEach(function (p) {
      html += '<li class="priority-item">';
      html += '  <div>';
      html += '    <div class="priority-title">' + escapeHtml(p.title) + '</div>';
      html += '    <div class="priority-desc">' + escapeHtml(p.desc) + '</div>';
      html += '  </div>';
      html += '</li>';
    });
    html += '</ol>';

    body.innerHTML = html;
  }

  render();

  var debouncedPriorityRender = debouncedRender(render);
  Store.on('task_count', debouncedPriorityRender);
  Store.on('upx_balance', debouncedPriorityRender);
  Store.on('portfolio_value', debouncedPriorityRender);
  Store.on('sparklet_balance', debouncedPriorityRender);
  Store.on('liq_declining_3_seasons', debouncedPriorityRender);
  Store.on('monthly_hours', debouncedPriorityRender);
  Store.on('liq_discount', debouncedPriorityRender);
  Store.on('sparklet_price', debouncedPriorityRender);
}


/* --------------------------------------------------------------------------
   SECTION 5: LIQUIDATION DECISION GATE
   -------------------------------------------------------------------------- */

function initLiquidation() {
  const body = document.getElementById('liquidation-body');
  const signalBadge = document.getElementById('liquidation-signal');

  function render() {
    const synced = Api.isConnected();
    const portfolioAssessed = Store.get('portfolio_value', 24000000);
    const discount = Store.get('liq_discount', 30);
    const taskCount = Store.get('task_count', 5);
    const effectiveRate = BASE_YIELD_RATE * YIELD_MULTIPLIERS[taskCount];
    const availableUPX = Store.get('upx_balance', 2077060.5);
    const sparkletBalance = Store.get('sparklet_balance', 7521);
    const sparkletPrice = Store.get('sparklet_price', 0.021);
    const monthlyHours = Store.get('monthly_hours', 2);

    const increasingEngagement = Store.get('liq_increasing_engagement', false);
    const baseRate2Seasons = Store.get('liq_base_rate_2_seasons', false);
    const declining3Seasons = Store.get('liq_declining_3_seasons', false);

    const thresholds = Store.get('liq_thresholds', {
      hourlyGreenMin: 5,
      hourlyYellowMin: 1,
      liquidationLow: 500,
      liquidationMid: 2000,
      annualYieldGreenMin: 200
    });

    // Calculations
    const propertyValue = portfolioAssessed * (1 - discount / 100) * 0.95 / 1000;
    const upxValue = availableUPX / 1000;
    const sparkletValue = sparkletBalance * sparkletPrice;
    const totalLiquidation = propertyValue + upxValue + sparkletValue;

    const annualYieldUPX = portfolioAssessed * effectiveRate;
    const annualYieldUSD = annualYieldUPX / 1000;

    const hourlyReturn = monthlyHours > 0 ? annualYieldUSD / (monthlyHours * 12) : 0;

    // Signal logic
    let signal = 'YELLOW';
    let signalClass = 'signal-yellow';
    let signalReason = '';

    if (hourlyReturn < thresholds.hourlyYellowMin && totalLiquidation > thresholds.liquidationMid) {
      signal = 'RED';
      signalClass = 'signal-red';
      signalReason = 'Hourly return below $' + thresholds.hourlyYellowMin + '/hr with liquidation value above $' + formatNumber(thresholds.liquidationMid, 0);
    } else if (declining3Seasons) {
      signal = 'RED';
      signalClass = 'signal-red';
      signalReason = 'Portfolio value declining for 3+ seasons. Exit window may be closing.';
    } else if (hourlyReturn >= thresholds.hourlyGreenMin && totalLiquidation < thresholds.liquidationLow) {
      signal = 'GREEN';
      signalClass = 'signal-green';
      signalReason = 'Strong hourly return ($' + formatNumber(hourlyReturn, 2) + '/hr). Liquidation value too low to justify selling.';
    } else if (annualYieldUSD >= thresholds.annualYieldGreenMin && increasingEngagement) {
      signal = 'GREEN';
      signalClass = 'signal-green';
      signalReason = 'Meaningful annual yield ($' + formatNumber(annualYieldUSD, 2) + ') with increasing engagement.';
    } else if (hourlyReturn >= thresholds.hourlyYellowMin && hourlyReturn < thresholds.hourlyGreenMin) {
      signal = 'YELLOW';
      signalClass = 'signal-yellow';
      signalReason = 'Marginal hourly return ($' + formatNumber(hourlyReturn, 2) + '/hr). Consider optimizing before deciding.';
    } else if (baseRate2Seasons) {
      signal = 'YELLOW';
      signalClass = 'signal-yellow';
      signalReason = 'At base rate (4.9%) for 2+ seasons. Not engaging enough to justify holding without optimization.';
    } else {
      signal = 'YELLOW';
      signalClass = 'signal-yellow';
      signalReason = 'Moderate position. Review inputs and adjust thresholds for your situation.';
    }

    signalBadge.textContent = signal;
    signalBadge.className = 'signal-indicator ' + signalClass;

    let html = '';

    // Large signal gate
    html += '<div class="signal-gate ' + signalClass + '">';
    html += '  <div>';
    html += '    <div class="signal-gate-label">' + signal + '</div>';
    html += '    <div class="signal-gate-reason">' + signalReason + '</div>';
    html += '  </div>';
    html += '</div>';

    // Inputs
    html += '<div class="liquidation-inputs">';

    // Portfolio Assessed -- synced display or manual input
    html += '<div class="form-group">';
    html += '  <label class="form-label">Portfolio Assessed (UPX)';
    if (synced) html += ' <span class="badge-synced">Synced</span>';
    html += '</label>';
    if (synced) {
      html += '  <div class="form-value">' + formatNumber(portfolioAssessed) + '</div>';
    } else {
      html += '  <input type="number" class="form-input" id="liq-portfolio" value="' + portfolioAssessed + '" min="0" step="100000">';
    }
    html += '</div>';

    html += '<div class="form-group">';
    html += '  <label class="form-label" for="liq-discount">Marketplace Discount (%)</label>';
    html += '  <input type="number" class="form-input" id="liq-discount" value="' + discount + '" min="0" max="100" step="1">';
    html += '</div>';

    // Available UPX -- synced display or manual input
    html += '<div class="form-group">';
    html += '  <label class="form-label">Available UPX';
    if (synced) html += ' <span class="badge-synced">Synced</span>';
    html += '</label>';
    if (synced) {
      html += '  <div class="form-value">' + formatNumber(availableUPX) + '</div>';
    } else {
      html += '  <input type="number" class="form-input" id="liq-upx" value="' + availableUPX + '" min="0" step="1000">';
    }
    html += '</div>';

    html += '<div class="form-group">';
    html += '  <label class="form-label" for="liq-sparklet-price">Sparklet Price (USD)</label>';
    html += '  <input type="number" class="form-input" id="liq-sparklet-price" value="' + sparkletPrice + '" min="0" step="0.001">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '  <label class="form-label" for="liq-hours">Monthly Hours Invested</label>';
    html += '  <input type="number" class="form-input" id="liq-hours" value="' + monthlyHours + '" min="0" step="0.5">';
    html += '</div>';

    html += '</div>';

    // Auto-populated values
    html += '<div class="stat-grid mt-4">';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">Annual Yield Rate (auto)</span>';
    html += '    <span class="stat-value accent">' + (effectiveRate * 100).toFixed(2) + '%</span>';
    html += '  </div>';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">Sparklet Balance';
    if (synced) html += ' <span class="badge-synced">Synced</span>';
    html += '</span>';
    html += '    <span class="stat-value">' + formatNumber(sparkletBalance) + '</span>';
    html += '  </div>';
    html += '</div>';

    // Calculated values
    html += '<div class="liquidation-results">';
    html += '  <div class="stat-row"><span class="stat-label">Est. Liquidation (Property)</span><span class="stat-value">$' + formatNumber(propertyValue, 2) + '</span></div>';
    html += '  <div class="stat-row"><span class="stat-label">Est. Liquidation (UPX)</span><span class="stat-value">$' + formatNumber(upxValue, 2) + '</span></div>';
    html += '  <div class="stat-row"><span class="stat-label">Est. Liquidation (Sparklet)</span><span class="stat-value">$' + formatNumber(sparkletValue, 2) + '</span></div>';
    html += '  <div class="stat-row"><span class="stat-label">Total Estimated Liquidation</span><span class="stat-value accent">$' + formatNumber(totalLiquidation, 2) + '</span></div>';
    html += '  <div class="stat-row"><span class="stat-label">Annual Yield (USD)</span><span class="stat-value green">$' + formatNumber(annualYieldUSD, 2) + '</span></div>';
    html += '  <div class="stat-row"><span class="stat-label">Hourly Return</span><span class="stat-value ' + (hourlyReturn >= thresholds.hourlyGreenMin ? 'green' : hourlyReturn >= thresholds.hourlyYellowMin ? 'yellow' : 'red') + '">$' + formatNumber(hourlyReturn, 2) + '/hr</span></div>';
    html += '</div>';

    // Subjective toggles
    html += '<hr class="section-divider">';
    html += '<div class="mb-3" style="font-size:var(--text-sm);color:var(--color-text-secondary);font-weight:var(--font-weight-medium)">Subjective Inputs</div>';

    html += '<div class="toggle-row">';
    html += '  <label for="toggle-engagement">Increasing engagement?</label>';
    html += '  <div class="toggle-switch">';
    html += '    <input type="checkbox" id="toggle-engagement" ' + (increasingEngagement ? 'checked' : '') + '>';
    html += '    <span class="toggle-slider"></span>';
    html += '  </div>';
    html += '</div>';

    html += '<div class="toggle-row">';
    html += '  <label for="toggle-base-rate">At base rate 2+ seasons?</label>';
    html += '  <div class="toggle-switch">';
    html += '    <input type="checkbox" id="toggle-base-rate" ' + (baseRate2Seasons ? 'checked' : '') + '>';
    html += '    <span class="toggle-slider"></span>';
    html += '  </div>';
    html += '</div>';

    html += '<div class="toggle-row">';
    html += '  <label for="toggle-declining">Declining 3+ seasons?</label>';
    html += '  <div class="toggle-switch">';
    html += '    <input type="checkbox" id="toggle-declining" ' + (declining3Seasons ? 'checked' : '') + '>';
    html += '    <span class="toggle-slider"></span>';
    html += '  </div>';
    html += '</div>';

    // Configurable thresholds (collapsible)
    html += '<hr class="section-divider">';
    html += '<button class="collapsible-header" id="threshold-toggle" aria-expanded="false">';
    html += '  <span>Signal Thresholds</span>';
    html += '  <span class="collapsible-arrow">&#9654;</span>';
    html += '</button>';
    html += '<div class="collapsible-content" id="threshold-content">';
    html += '  <div class="liquidation-inputs">';

    html += '    <div class="form-group">';
    html += '      <label class="form-label" for="thr-hourly-green">Green: Min $/hr</label>';
    html += '      <input type="number" class="form-input threshold-input" id="thr-hourly-green" data-key="hourlyGreenMin" value="' + thresholds.hourlyGreenMin + '" min="0" step="1">';
    html += '    </div>';

    html += '    <div class="form-group">';
    html += '      <label class="form-label" for="thr-hourly-yellow">Yellow: Min $/hr</label>';
    html += '      <input type="number" class="form-input threshold-input" id="thr-hourly-yellow" data-key="hourlyYellowMin" value="' + thresholds.hourlyYellowMin + '" min="0" step="0.5">';
    html += '    </div>';

    html += '    <div class="form-group">';
    html += '      <label class="form-label" for="thr-liq-low">Liquidation Low ($)</label>';
    html += '      <input type="number" class="form-input threshold-input" id="thr-liq-low" data-key="liquidationLow" value="' + thresholds.liquidationLow + '" min="0" step="100">';
    html += '    </div>';

    html += '    <div class="form-group">';
    html += '      <label class="form-label" for="thr-liq-mid">Liquidation Mid ($)</label>';
    html += '      <input type="number" class="form-input threshold-input" id="thr-liq-mid" data-key="liquidationMid" value="' + thresholds.liquidationMid + '" min="0" step="100">';
    html += '    </div>';

    html += '    <div class="form-group">';
    html += '      <label class="form-label" for="thr-annual-green">Green: Min Annual Yield ($)</label>';
    html += '      <input type="number" class="form-input threshold-input" id="thr-annual-green" data-key="annualYieldGreenMin" value="' + thresholds.annualYieldGreenMin + '" min="0" step="50">';
    html += '    </div>';

    html += '  </div>';
    html += '</div>';

    // Inline recommendations
    var allRecs = GuideEngine.generateRecommendations();
    var liqRecs = GuideEngine.filterByCategory(allRecs, 'liquidation');
    html += GuideEngine.renderRecommendationList(liqRecs, 2, 'recs-liquidation');

    body.innerHTML = html;

    GuideEngine.bindCollapsible('recs-liquidation');

    // Events -- synced fields guarded
    var lpInput = document.getElementById('liq-portfolio');
    if (lpInput) {
      lpInput.addEventListener('change', function () {
        const val = Math.max(0, parseFloat(this.value) || 0);
        Store.set('portfolio_value', val);
        render();
      });
    }

    document.getElementById('liq-discount').addEventListener('change', function () {
      const val = Math.max(0, Math.min(100, parseFloat(this.value) || 0));
      Store.set('liq_discount', val);
      render();
    });

    var luInput = document.getElementById('liq-upx');
    if (luInput) {
      luInput.addEventListener('change', function () {
        const val = Math.max(0, parseFloat(this.value) || 0);
        Store.set('upx_balance', val);
        render();
      });
    }

    document.getElementById('liq-sparklet-price').addEventListener('change', function () {
      const val = Math.max(0, parseFloat(this.value) || 0);
      Store.set('sparklet_price', val);
      render();
    });

    document.getElementById('liq-hours').addEventListener('change', function () {
      const val = Math.max(0, parseFloat(this.value) || 0);
      Store.set('monthly_hours', val);
      render();
    });

    // Subjective toggles
    document.getElementById('toggle-engagement').addEventListener('change', function () {
      Store.set('liq_increasing_engagement', this.checked);
      render();
    });

    document.getElementById('toggle-base-rate').addEventListener('change', function () {
      Store.set('liq_base_rate_2_seasons', this.checked);
      render();
    });

    document.getElementById('toggle-declining').addEventListener('change', function () {
      Store.set('liq_declining_3_seasons', this.checked);
      render();
    });

    // Threshold collapsible
    const thrToggle = document.getElementById('threshold-toggle');
    const thrContent = document.getElementById('threshold-content');
    thrToggle.addEventListener('click', function () {
      const isOpen = thrContent.classList.toggle('open');
      thrToggle.classList.toggle('open', isOpen);
      thrToggle.setAttribute('aria-expanded', isOpen);
    });

    // Threshold inputs
    document.querySelectorAll('.threshold-input').forEach(function (input) {
      input.addEventListener('change', function () {
        const key = this.dataset.key;
        const val = parseFloat(this.value) || 0;
        const current = Store.get('liq_thresholds', {
          hourlyGreenMin: 5,
          hourlyYellowMin: 1,
          liquidationLow: 500,
          liquidationMid: 2000,
          annualYieldGreenMin: 200
        });
        current[key] = val;
        Store.set('liq_thresholds', current);
        render();
      });
    });
  }

  render();

  const debouncedLiqRender = debouncedRender(render);
  Store.on('sparklet_balance', debouncedLiqRender);
  Store.on('task_count', debouncedLiqRender);
  Store.on('portfolio_value', debouncedLiqRender);
  Store.on('upx_balance', debouncedLiqRender);
}


/* --------------------------------------------------------------------------
   SECTION 6: PORTFOLIO DATA
   -------------------------------------------------------------------------- */

function initPortfolio() {
  const body = document.getElementById('portfolio-body');

  function render() {
    const synced = Api.isConnected();
    const upxBalance = Store.get('upx_balance', 2077060.5);
    const sparkletBalance = Store.get('sparklet_balance', 7521);
    const sparkletPrice = Store.get('sparklet_price', 0.021);
    const taskCount = Store.get('task_count', 5);
    const portfolioValue = Store.get('portfolio_value', 24000000);
    const properties = Store.get('properties', []);
    const effectiveRate = BASE_YIELD_RATE * YIELD_MULTIPLIERS[taskCount];

    const sparkletMarketValue = sparkletBalance * sparkletPrice;
    const deployedYield = upxBalance * effectiveRate / 1000;

    let html = '';

    // UPX balance -- synced display or manual input
    html += '<div class="form-group">';
    html += '  <label class="form-label">Available UPX Balance';
    if (synced) html += ' <span class="badge-synced">Synced</span>';
    html += '</label>';
    if (synced) {
      html += '  <div class="form-value">' + formatNumber(upxBalance) + '</div>';
    } else {
      html += '  <input type="number" class="form-input" id="upx-balance" value="' + upxBalance + '" min="0" step="1000">';
    }
    html += '</div>';

    html += '<div class="stat-grid">';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">UPX Value (USD)</span>';
    html += '    <span class="stat-value">$' + formatNumber(upxBalance / 1000, 2) + '</span>';
    html += '  </div>';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">Sparklet Balance';
    if (synced) html += ' <span class="badge-synced">Synced</span>';
    html += '</span>';
    html += '    <span class="stat-value">' + formatNumber(sparkletBalance) + '</span>';
    html += '  </div>';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">Sparklet Market Value</span>';
    html += '    <span class="stat-value">$' + formatNumber(sparkletMarketValue, 2) + '</span>';
    html += '  </div>';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">If UPX Deployed (Annual)</span>';
    html += '    <span class="stat-value accent">$' + formatNumber(deployedYield, 2) + '</span>';
    html += '  </div>';

    // Property count -- shown when synced and properties available
    if (synced && properties.length > 0) {
      html += '  <div class="stat-block">';
      html += '    <span class="stat-label">Properties <span class="badge-synced">Synced</span></span>';
      html += '    <span class="stat-value accent">' + properties.length + '</span>';
      html += '  </div>';
    }

    html += '</div>';

    // Link to portfolio detail page
    html += '<div class="info-note mt-4">View detailed property data on the <a href="/portfolio" style="color:var(--color-accent)">Portfolio</a> page.</div>';

    // Export instructions
    html += '<hr class="section-divider">';
    html += '<button class="collapsible-header" id="export-toggle" aria-expanded="false">';
    html += '  <span>Export Data</span>';
    html += '  <span class="collapsible-arrow">&#9654;</span>';
    html += '</button>';
    html += '<div class="collapsible-content" id="export-content">';
    html += '  <p class="text-secondary mb-3" style="font-size:var(--text-sm)">To export your dashboard data, open the browser console (F12) and run:</p>';
    html += '  <code class="font-mono" style="display:block;padding:var(--space-3);background:var(--color-surface-raised);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-accent);word-break:break-all">';
    html += 'JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith("upland_"))))';
    html += '  </code>';
    html += '</div>';

    // Inline recommendations
    var allRecs = GuideEngine.generateRecommendations();
    var propRecs = GuideEngine.filterByCategory(allRecs, 'property');
    html += GuideEngine.renderRecommendationList(propRecs, 2, 'recs-property');

    body.innerHTML = html;

    GuideEngine.bindCollapsible('recs-property');

    // Events -- UPX balance guarded when synced
    var upxInput = document.getElementById('upx-balance');
    if (upxInput) {
      upxInput.addEventListener('change', function () {
        const val = Math.max(0, parseFloat(this.value) || 0);
        Store.set('upx_balance', val);
        render();
      });
    }

    // Export collapsible
    const expToggle = document.getElementById('export-toggle');
    const expContent = document.getElementById('export-content');
    expToggle.addEventListener('click', function () {
      const isOpen = expContent.classList.toggle('open');
      expToggle.classList.toggle('open', isOpen);
      expToggle.setAttribute('aria-expanded', isOpen);
    });
  }

  render();

  const debouncedPortfolioRender = debouncedRender(render);
  Store.on('sparklet_balance', debouncedPortfolioRender);
  Store.on('sparklet_price', debouncedPortfolioRender);
  Store.on('task_count', debouncedPortfolioRender);
  Store.on('portfolio_value', debouncedPortfolioRender);
  Store.on('upx_balance', debouncedPortfolioRender);
  Store.on('properties', debouncedPortfolioRender);
}


/* --------------------------------------------------------------------------
   INITIALIZATION
   -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', async function () {
  Nav.init();
  initMissions();
  initSparklet();
  initYield();
  initPriorities();
  initLiquidation();
  initPortfolio();

  // Sync from API if connected
  if (Api.isConnected()) {
    try {
      await Api.syncFromApi();
    } catch (err) {
      showToast('Sync failed: ' + err.message, 'error');
    }
  }
});
