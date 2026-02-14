/* ==========================================================================
   Upland Dashboard -- Application Logic
   Zero external API calls. All data in localStorage.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   SHARED DATA LAYER
   Centralized localStorage access with event-based cross-section sync.
   All keys are prefixed with 'upland_' for namespacing.
   -------------------------------------------------------------------------- */

const Store = {
  _prefix: 'upland_',
  _listeners: {},

  get(key, fallback) {
    try {
      const raw = localStorage.getItem(this._prefix + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(this._prefix + key, JSON.stringify(value));
    this._notify(key, value);
  },

  on(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(fn);
  },

  _notify(key, value) {
    const fns = this._listeners[key] || [];
    fns.forEach(fn => fn(value));
  }
};


/* --------------------------------------------------------------------------
   SEASON CALENDAR
   -------------------------------------------------------------------------- */

const SEASONS = [
  { name: 'Frost',      startMonth: 1,  startDay: 1,  endMonth: 2,  endDay: 15 },
  { name: 'Blossom',    startMonth: 3,  startDay: 1,  endMonth: 4,  endDay: 15 },
  { name: 'Genesis',    startMonth: 5,  startDay: 1,  endMonth: 6,  endDay: 15 },
  { name: 'Sizzle',     startMonth: 7,  startDay: 1,  endMonth: 8,  endDay: 15 },
  { name: 'Harvest',    startMonth: 9,  startDay: 1,  endMonth: 10, endDay: 15 },
  { name: 'Wonderland', startMonth: 11, startDay: 1,  endMonth: 0,  endDay: 15 }
];

// Nominal dates mapped to JS months (0-indexed):
// Frost: Feb 1 - Mar 15 => month 1 - month 2
// Blossom: Apr 1 - May 15 => month 3 - month 4
// Genesis: Jun 1 - Jul 15 => month 5 - month 6
// Sizzle: Aug 1 - Sep 15 => month 7 - month 8
// Harvest: Oct 1 - Nov 15 => month 9 - month 10
// Wonderland: Dec 1 - Jan 15 => month 11 - month 0 (next year)

function getSeasonForDate(date) {
  const m = date.getMonth();
  const d = date.getDate();

  // Check Wonderland spanning Dec-Jan
  if (m === 11 && d >= 1) return { season: SEASONS[5], index: 5 };
  if (m === 0 && d <= 15) return { season: SEASONS[5], index: 5 };

  for (let i = 0; i < 5; i++) {
    const s = SEASONS[i];
    if ((m === s.startMonth && d >= s.startDay) ||
        (m === s.endMonth && d <= s.endDay)) {
      return { season: s, index: i };
    }
  }

  // Intermission (between seasons)
  return null;
}

function getSeasonStart(season, referenceDate) {
  const year = referenceDate.getFullYear();
  // For Wonderland, if we're in January, start was in previous December
  if (season.name === 'Wonderland' && referenceDate.getMonth() === 0) {
    return new Date(year - 1, 11, 1);
  }
  return new Date(year, season.startMonth, season.startDay);
}

function getSeasonEnd(season, referenceDate) {
  const year = referenceDate.getFullYear();
  if (season.name === 'Wonderland') {
    // End is Jan 15 of next year (or same year if we're already in Jan)
    if (referenceDate.getMonth() === 0) {
      return new Date(year, 0, 15);
    }
    return new Date(year + 1, 0, 15);
  }
  return new Date(year, season.endMonth, season.endDay);
}

function getWeekNumber(seasonStart, currentDate) {
  const diff = currentDate - seasonStart;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.floor(days / 7) + 1;
}

function getNextTuesday(fromDate) {
  const d = new Date(fromDate);
  const day = d.getDay();
  const daysUntilTuesday = (2 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilTuesday);
  d.setHours(9, 0, 0, 0); // 9 AM PT
  return d;
}


/* --------------------------------------------------------------------------
   YIELD MULTIPLIER TABLE
   -------------------------------------------------------------------------- */

const YIELD_MULTIPLIERS = [
  1.0,   // 0 tasks
  1.3,   // 1 task
  1.6,   // 2 tasks
  1.9,   // 3 tasks
  2.4,   // 4 tasks
  3.0,   // 5 tasks
  3.02,  // 6 tasks
  3.04,  // 7 tasks
  3.06,  // 8 tasks
  3.08,  // 9 tasks
  3.1    // 10 tasks
];

const BASE_YIELD_RATE = 0.049; // 4.9%


/* --------------------------------------------------------------------------
   STRUCTURE TYPES (for Sparklet capacity)
   -------------------------------------------------------------------------- */

const DEFAULT_STRUCTURES = [
  { name: 'Micro House', sparkHours: 1500 },
  { name: 'Townhouse', sparkHours: 2600 }
];


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

  // Default missions (generic per-week tasks; user can mentally map to actual missions)
  const totalWeeks = 6;
  const missionsPerWeek = 2;
  const totalMissions = totalWeeks * missionsPerWeek;

  // Build checklist key by season + year
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

  body.innerHTML = html;

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
          // Update visual
          this.closest('.checkbox-row').classList.toggle('checked', this.checked);
          // Update count
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

function formatDateForInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}


/* --------------------------------------------------------------------------
   SECTION 2: SPARKLET CAPACITY MONITOR
   -------------------------------------------------------------------------- */

function initSparklet() {
  const body = document.getElementById('sparklet-body');

  const balance = Store.get('sparklet_balance', 7521);
  const structures = Store.get('structures', DEFAULT_STRUCTURES);

  function render() {
    const bal = Store.get('sparklet_balance', 7521);
    const structs = Store.get('structures', DEFAULT_STRUCTURES);

    let html = '';

    // Balance input
    html += '<div class="form-group">';
    html += '  <label class="form-label" for="sparklet-balance">Sparklet Balance</label>';
    html += '  <input type="number" class="form-input" id="sparklet-balance" value="' + bal + '" min="0" step="1">';
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

    body.innerHTML = html;

    // Events
    document.getElementById('sparklet-balance').addEventListener('change', function () {
      const v = Math.max(0, parseInt(this.value) || 0);
      Store.set('sparklet_balance', v);
      render();
    });

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
  }

  render();
}


/* --------------------------------------------------------------------------
   SECTION 3: YIELD DASHBOARD
   -------------------------------------------------------------------------- */

function initYield() {
  const body = document.getElementById('yield-body');

  function render() {
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
    html += '    <div class="form-group">';
    html += '      <label class="form-label" for="portfolio-value">Portfolio Value (UPX mint price)</label>';
    html += '      <input type="number" class="form-input" id="portfolio-value" value="' + portfolioValue + '" min="0" step="1000">';
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

    body.innerHTML = html;

    // Events
    document.getElementById('task-slider').addEventListener('input', function () {
      const val = parseInt(this.value);
      Store.set('task_count', val);
      render();
    });

    document.getElementById('portfolio-value').addEventListener('change', function () {
      const val = Math.max(0, parseInt(this.value) || 0);
      Store.set('portfolio_value', val);
      render();
    });
  }

  render();

  // Listen for external changes to portfolio value
  Store.on('portfolio_value', function () { render(); });
  Store.on('task_count', function () { /* re-render handled by slider event */ });
}


/* --------------------------------------------------------------------------
   SECTION 4: OPTIMIZATION PRIORITIES
   -------------------------------------------------------------------------- */

function initPriorities() {
  const body = document.getElementById('priorities-body');

  const priorities = [
    {
      title: 'Hit 5 tasks per season',
      desc: 'The 5-task threshold delivers 3.0x multiplier (14.7% yield) -- 96.7% of max. This is the single highest-leverage action.'
    },
    {
      title: 'Maximize yield collection',
      desc: 'Collect yield every 3 hours when active. Yield is calculated on mint price, not market price. Base rate: 4.9% annually.'
    },
    {
      title: 'Consider Sparklet deployment',
      desc: 'With 7,521 Sparklet, you can run ~2-3 concurrent builds. Building completes missions and may increase Influence/Resident scores.'
    },
    {
      title: 'Assess liquidation periodically',
      desc: 'Use the Liquidation Gate below to evaluate whether holding, optimizing, or liquidating makes sense given current market conditions.'
    },
    {
      title: 'Deploy idle UPX into properties',
      desc: 'Liquid UPX does not generate yield. Deploying into properties increases your yield base. Consider location and collection bonuses.'
    }
  ];

  let html = '<ol class="priority-list">';
  priorities.forEach(function (p) {
    html += '<li class="priority-item">';
    html += '  <div>';
    html += '    <div class="priority-title">' + p.title + '</div>';
    html += '    <div class="priority-desc">' + p.desc + '</div>';
    html += '  </div>';
    html += '</li>';
  });
  html += '</ol>';

  body.innerHTML = html;
}


/* --------------------------------------------------------------------------
   SECTION 5: LIQUIDATION DECISION GATE
   -------------------------------------------------------------------------- */

function initLiquidation() {
  const body = document.getElementById('liquidation-body');
  const signalBadge = document.getElementById('liquidation-signal');

  function render() {
    const portfolioAssessed = Store.get('portfolio_value', 24000000);
    const discount = Store.get('liq_discount', 30);
    const taskCount = Store.get('task_count', 5);
    const effectiveRate = BASE_YIELD_RATE * YIELD_MULTIPLIERS[taskCount];
    const availableUPX = Store.get('upx_balance', 2077060.5);
    const sparkletBalance = Store.get('sparklet_balance', 7521);
    const sparkletPrice = Store.get('sparklet_price', 0.021);
    const monthlyHours = Store.get('monthly_hours', 2);

    // Subjective toggles
    const increasingEngagement = Store.get('liq_increasing_engagement', false);
    const baseRate2Seasons = Store.get('liq_base_rate_2_seasons', false);
    const declining3Seasons = Store.get('liq_declining_3_seasons', false);

    // Thresholds (configurable)
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

    // RED conditions
    if (hourlyReturn < thresholds.hourlyYellowMin && totalLiquidation > thresholds.liquidationMid) {
      signal = 'RED';
      signalClass = 'signal-red';
      signalReason = 'Hourly return below $' + thresholds.hourlyYellowMin + '/hr with liquidation value above $' + formatNumber(thresholds.liquidationMid, 0);
    } else if (declining3Seasons) {
      signal = 'RED';
      signalClass = 'signal-red';
      signalReason = 'Portfolio value declining for 3+ seasons. Exit window may be closing.';
    }
    // GREEN conditions
    else if (hourlyReturn >= thresholds.hourlyGreenMin && totalLiquidation < thresholds.liquidationLow) {
      signal = 'GREEN';
      signalClass = 'signal-green';
      signalReason = 'Strong hourly return ($' + formatNumber(hourlyReturn, 2) + '/hr). Liquidation value too low to justify selling.';
    } else if (annualYieldUSD >= thresholds.annualYieldGreenMin && increasingEngagement) {
      signal = 'GREEN';
      signalClass = 'signal-green';
      signalReason = 'Meaningful annual yield ($' + formatNumber(annualYieldUSD, 2) + ') with increasing engagement.';
    }
    // YELLOW conditions
    else if (hourlyReturn >= thresholds.hourlyYellowMin && hourlyReturn < thresholds.hourlyGreenMin) {
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

    // Update header badge
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

    html += '<div class="form-group">';
    html += '  <label class="form-label" for="liq-portfolio">Portfolio Assessed (UPX)</label>';
    html += '  <input type="number" class="form-input" id="liq-portfolio" value="' + portfolioAssessed + '" min="0" step="100000">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '  <label class="form-label" for="liq-discount">Marketplace Discount (%)</label>';
    html += '  <input type="number" class="form-input" id="liq-discount" value="' + discount + '" min="0" max="100" step="1">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '  <label class="form-label" for="liq-upx">Available UPX</label>';
    html += '  <input type="number" class="form-input" id="liq-upx" value="' + availableUPX + '" min="0" step="1000">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '  <label class="form-label" for="liq-sparklet-price">Sparklet Price (USD)</label>';
    html += '  <input type="number" class="form-input" id="liq-sparklet-price" value="' + sparkletPrice + '" min="0" step="0.001">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '  <label class="form-label" for="liq-hours">Monthly Hours Invested</label>';
    html += '  <input type="number" class="form-input" id="liq-hours" value="' + monthlyHours + '" min="0" step="0.5">';
    html += '</div>';

    html += '</div>'; // end liquidation-inputs

    // Auto-populated values
    html += '<div class="stat-grid mt-4">';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">Annual Yield Rate (auto)</span>';
    html += '    <span class="stat-value accent">' + (effectiveRate * 100).toFixed(2) + '%</span>';
    html += '  </div>';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">Sparklet Balance (auto)</span>';
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

    body.innerHTML = html;

    // Events
    document.getElementById('liq-portfolio').addEventListener('change', function () {
      const val = Math.max(0, parseFloat(this.value) || 0);
      Store.set('portfolio_value', val);
      render();
    });

    document.getElementById('liq-discount').addEventListener('change', function () {
      const val = Math.max(0, Math.min(100, parseFloat(this.value) || 0));
      Store.set('liq_discount', val);
      render();
    });

    document.getElementById('liq-upx').addEventListener('change', function () {
      const val = Math.max(0, parseFloat(this.value) || 0);
      Store.set('upx_balance', val);
      render();
    });

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

  // Listen for external changes
  Store.on('sparklet_balance', function () { render(); });
  Store.on('task_count', function () { render(); });
  Store.on('portfolio_value', function () { render(); });
  Store.on('upx_balance', function () { render(); });
}


/* --------------------------------------------------------------------------
   SECTION 6: PORTFOLIO DATA
   -------------------------------------------------------------------------- */

function initPortfolio() {
  const body = document.getElementById('portfolio-body');

  function render() {
    const upxBalance = Store.get('upx_balance', 2077060.5);
    const sparkletBalance = Store.get('sparklet_balance', 7521);
    const sparkletPrice = Store.get('sparklet_price', 0.021);
    const taskCount = Store.get('task_count', 5);
    const portfolioValue = Store.get('portfolio_value', 24000000);
    const effectiveRate = BASE_YIELD_RATE * YIELD_MULTIPLIERS[taskCount];

    const sparkletMarketValue = sparkletBalance * sparkletPrice;
    const deployedYield = upxBalance * effectiveRate / 1000;

    let html = '';

    // UPX balance
    html += '<div class="form-group">';
    html += '  <label class="form-label" for="upx-balance">Available UPX Balance</label>';
    html += '  <input type="number" class="form-input" id="upx-balance" value="' + upxBalance + '" min="0" step="1000">';
    html += '</div>';

    html += '<div class="stat-grid">';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">UPX Value (USD)</span>';
    html += '    <span class="stat-value">$' + formatNumber(upxBalance / 1000, 2) + '</span>';
    html += '  </div>';
    html += '  <div class="stat-block">';
    html += '    <span class="stat-label">Sparklet Balance</span>';
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
    html += '</div>';

    // Phase 2 placeholder
    html += '<div class="info-note mt-4">Property-level data coming in Phase 2. Pending UPXLand data export capability.</div>';

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

    body.innerHTML = html;

    // Events
    document.getElementById('upx-balance').addEventListener('change', function () {
      const val = Math.max(0, parseFloat(this.value) || 0);
      Store.set('upx_balance', val);
      render();
    });

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

  // Listen for external changes
  Store.on('sparklet_balance', function () { render(); });
  Store.on('sparklet_price', function () { render(); });
  Store.on('task_count', function () { render(); });
  Store.on('portfolio_value', function () { render(); });
}


/* --------------------------------------------------------------------------
   UTILITIES
   -------------------------------------------------------------------------- */

function formatNumber(n, decimals) {
  if (typeof decimals === 'number') {
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  return Number(n).toLocaleString('en-US');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


/* --------------------------------------------------------------------------
   INITIALIZATION
   -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', function () {
  initMissions();
  initSparklet();
  initYield();
  initPriorities();
  initLiquidation();
  initPortfolio();
});
