/* ==========================================================================
   Upland Dashboard -- Auth State
   Session check, connect/disconnect, redirect.
   ========================================================================== */

'use strict';

const Auth = {
  _pollTimer: null,

  async startAuth() {
    const res = await fetch('/api/auth/init', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to start auth');
    return res.json(); // { sessionId, code }
  },

  startPolling(sessionId, onStatus) {
    this.stopPolling();
    this._pollTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/status?sessionId=' + encodeURIComponent(sessionId));
        if (!res.ok) {
          onStatus({ status: 'error', message: 'Status check failed' });
          return;
        }
        const data = await res.json();
        onStatus(data);
        if (data.status === 'connected' || data.status === 'failed') {
          this.stopPolling();
        }
      } catch (err) {
        onStatus({ status: 'error', message: err.message });
      }
    }, 3000);
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  async logout() {
    const sessionId = Api.getSessionId();
    if (sessionId) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId })
        });
      } catch {
        // Best effort
      }
    }
    Api.clearSession();
  },

  checkAuth() {
    return Api.isConnected();
  }
};
