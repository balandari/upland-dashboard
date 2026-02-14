/* ==========================================================================
   Upland Dashboard -- Navigation Bar
   Renders into #nav on each page. Sticky top, responsive hamburger.
   ========================================================================== */

'use strict';

const Nav = {
  init() {
    const container = document.getElementById('nav');
    if (!container) return;

    const currentPath = window.location.pathname.replace(/\/$/, '').split('/').pop() || 'index';
    const connected = Api.isConnected();
    const profile = Store.get('user_profile', null);

    const links = [
      { href: '/dashboard', label: 'Dashboard', id: 'dashboard' },
      { href: '/portfolio', label: 'Portfolio', id: 'portfolio' },
      { href: '/guide', label: 'Guide', id: 'guide' }
    ];

    let html = '';
    html += '<nav class="site-nav" role="navigation" aria-label="Main navigation">';
    html += '  <div class="nav-inner">';
    html += '    <a href="/" class="nav-brand">Upland Dashboard</a>';
    html += '    <button class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">';
    html += '      <span class="nav-toggle-bar"></span>';
    html += '      <span class="nav-toggle-bar"></span>';
    html += '      <span class="nav-toggle-bar"></span>';
    html += '    </button>';
    html += '    <div class="nav-links" id="nav-links">';

    links.forEach(function (link) {
      const isActive = currentPath === link.id ||
        (currentPath === 'index' && link.id === 'index');
      html += '      <a href="' + link.href + '" class="nav-link' + (isActive ? ' nav-link--active' : '') + '">' + link.label + '</a>';
    });

    if (connected && profile) {
      html += '      <button class="nav-link" id="nav-refresh">Refresh</button>';
      html += '      <span class="nav-user">' + escapeHtml(profile.username) + '</span>';
      html += '      <button class="nav-link nav-disconnect" id="nav-disconnect">Disconnect</button>';
    } else if (connected) {
      html += '      <button class="nav-link" id="nav-refresh">Refresh</button>';
      html += '      <span class="nav-user">Connected</span>';
      html += '      <button class="nav-link nav-disconnect" id="nav-disconnect">Disconnect</button>';
    } else {
      html += '      <a href="/" class="nav-link nav-connect">Connect</a>';
    }

    html += '    </div>';
    html += '  </div>';
    html += '</nav>';

    container.innerHTML = html;

    // Hamburger toggle
    var toggle = document.getElementById('nav-toggle');
    var navLinks = document.getElementById('nav-links');
    if (toggle && navLinks) {
      toggle.addEventListener('click', function () {
        var isOpen = navLinks.classList.toggle('nav-links--open');
        toggle.classList.toggle('nav-toggle--open', isOpen);
        toggle.setAttribute('aria-expanded', isOpen);
      });
    }

    // Disconnect button
    var disconnectBtn = document.getElementById('nav-disconnect');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', async function () {
        await Auth.logout();
        window.location.href = '/';
      });
    }

    // Refresh button
    var refreshBtn = document.getElementById('nav-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async function () {
        refreshBtn.textContent = 'Syncing...';
        refreshBtn.disabled = true;
        try {
          await Api.syncFromApi();
          refreshBtn.textContent = 'Refresh';
        } catch (err) {
          showToast('Sync failed: ' + err.message, 'error');
          refreshBtn.textContent = 'Refresh';
        }
        refreshBtn.disabled = false;
      });
    }
  }
};
