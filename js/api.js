/* ==========================================================================
   Upland Dashboard -- API Client
   Session management, fetch wrapper, error handling.
   ========================================================================== */

'use strict';

const Api = {
  SESSION_KEY: 'upland_session_id',

  getSessionId() {
    return localStorage.getItem(this.SESSION_KEY);
  },

  setSessionId(id) {
    localStorage.setItem(this.SESSION_KEY, id);
  },

  clearSession() {
    localStorage.removeItem(this.SESSION_KEY);
  },

  isConnected() {
    return !!this.getSessionId();
  },

  async fetchApi(endpoint) {
    const sessionId = this.getSessionId();
    if (!sessionId) throw new Error('Not connected');

    const res = await fetch(endpoint, {
      headers: { 'x-session-id': sessionId }
    });

    if (res.status === 401) {
      this.clearSession();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      throw new Error('API error: ' + res.status);
    }

    return res.json();
  },

  async syncFromApi() {
    if (!this.isConnected()) return;

    try {
      const [profile, balances, properties, nfts] = await Promise.all([
        this.fetchApi('/api/user/profile'),
        this.fetchApi('/api/user/balances'),
        this.fetchApi('/api/user/properties'),
        this.fetchApi('/api/user/nfts')
      ]);

      Store.set('portfolio_value', profile.networth);
      Store.set('user_profile', {
        username: profile.username,
        level: profile.level,
        currentCity: profile.currentCity,
        avatarUrl: profile.avatarUrl
      });

      Store.set('upx_balance', balances.availableUpx);
      Store.set('sparklet_balance', balances.availableSpark);
      Store.set('staked_spark', balances.stakedSpark);

      Store.set('properties', properties.results || properties);
      Store.set('nfts', nfts.results || nfts);
      Store.set('last_sync', Date.now());
    } catch (err) {
      console.error('Sync failed:', err.message);
      throw err;
    }
  }
};

function showToast(message, type) {
  var el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast--error' : '');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(function () {
    el.remove();
  }, 4000);
}
