/* ==========================================================================
   Upland Dashboard -- Shared Data Layer & Constants
   Centralized localStorage access with event-based cross-section sync.
   ========================================================================== */

'use strict';

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

// Debounced render helper -- prevents cascading re-renders
function debouncedRender(renderFn) {
  let scheduled = false;
  return function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      renderFn();
    });
  };
}


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

function formatDateForInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}
