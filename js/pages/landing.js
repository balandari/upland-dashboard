/* ==========================================================================
   Upland Dashboard -- Landing Page Logic
   Auth flow UI: display code, poll status, redirect on success.
   Depends on: js/store.js, js/api.js, js/auth.js, js/nav.js
   ========================================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', function () {
  Nav.init();

  var container = document.getElementById('auth-flow');
  if (!container) return;

  // If already connected, show connected state
  if (Auth.checkAuth()) {
    renderConnected();
    return;
  }

  renderInitial();

  function renderInitial() {
    var html = '';
    html += '<button class="btn-connect" id="btn-connect">Connect Your Account</button>';
    html += '<p class="auth-hint">You\'ll receive a code to enter in the Upland app</p>';
    container.innerHTML = html;

    document.getElementById('btn-connect').addEventListener('click', startConnect);
  }

  async function startConnect() {
    container.innerHTML = '<div class="auth-loading"><div class="spinner"></div><p>Initializing...</p></div>';

    try {
      var result = await Auth.startAuth();
      Api.setSessionId(result.sessionId);
      renderCode(result.code, result.sessionId);
    } catch (err) {
      renderError(err.message);
    }
  }

  function renderCode(code, sessionId) {
    var html = '';
    html += '<div class="auth-code-display">';
    html += '  <p class="auth-instruction">Enter this code in the Upland app:</p>';
    html += '  <div class="auth-code">' + escapeHtml(code) + '</div>';
    html += '  <div class="auth-polling"><div class="spinner"></div><span>Waiting for confirmation...</span></div>';
    html += '</div>';
    container.innerHTML = html;

    Auth.startPolling(sessionId, function (data) {
      if (data.status === 'connected') {
        renderSuccess(data.username);
      } else if (data.status === 'failed' || data.status === 'error') {
        renderError(data.message || 'Authentication failed');
      }
    });
  }

  function renderSuccess(username) {
    var html = '';
    html += '<div class="auth-success">';
    html += '  <p class="auth-success-text">Connected' + (username ? ' as <strong>' + escapeHtml(username) + '</strong>' : '') + '</p>';
    html += '  <p class="auth-redirect">Redirecting to dashboard...</p>';
    html += '</div>';
    container.innerHTML = html;

    setTimeout(function () {
      window.location.href = '/dashboard';
    }, 1500);
  }

  function renderError(message) {
    var html = '';
    html += '<div class="auth-error">';
    html += '  <p class="auth-error-text">' + escapeHtml(message) + '</p>';
    html += '  <button class="btn-connect" id="btn-retry">Try Again</button>';
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('btn-retry').addEventListener('click', startConnect);
  }

  function renderConnected() {
    var profile = Store.get('user_profile', null);
    var html = '';
    html += '<div class="auth-connected">';
    if (profile) {
      html += '  <p class="auth-success-text">Connected as <strong>' + escapeHtml(profile.username) + '</strong></p>';
    } else {
      html += '  <p class="auth-success-text">Account connected</p>';
    }
    html += '  <div class="auth-actions">';
    html += '    <a href="/dashboard" class="btn-connect">Go to Dashboard</a>';
    html += '    <button class="btn-disconnect" id="btn-disconnect">Disconnect</button>';
    html += '  </div>';
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('btn-disconnect').addEventListener('click', async function () {
      await Auth.logout();
      renderInitial();
      Nav.init();
    });
  }
});
