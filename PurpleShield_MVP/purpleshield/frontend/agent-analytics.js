/* PurpleShield: Local Agent Results (Admin) + Local Agent Analytics (Blue Team).
   Loaded AFTER app.js. Does not edit app.js: it reuses its globals (state, req, esc, icon,
   rolePages, pageTitles, refreshData, renderAll) and wraps refreshData/renderAll.
   Uses ONE existing endpoint: GET /api/agent/results (returns only the signed-in user's scans). */
(function () {
  'use strict';

  function start() {
    if (typeof state === 'undefined' || typeof req !== 'function' || typeof rolePages === 'undefined' ||
        typeof refreshData !== 'function' || typeof renderAll !== 'function') {
      console.warn('[agent-analytics] app.js globals not found; feature not started.');
      return;
    }
    const safe = typeof esc === 'function' ? esc : function (v) {
      return String(v == null ? '—' : v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    const svg = function (name) { return typeof icon === 'function' ? icon(name) : ''; };

    const AGENT_TTL_MS = 30000; // reuse fetched data for 30s unless Refresh/Retry forces a reload
    const agent = { rows: [], loaded: false, loading: false, error: '', owner: '', fetchedAt: 0, force: false, promise: null };
    const STATES = ['open', 'closed', 'filtered', 'unknown'];
    const COLORS = { open: '#f6ae4f', closed: '#3bc797', filtered: '#579eff', unknown: '#626a7b' };

    /* ---------- role access ---------- */
    function canLoad() { return ['admin', 'blue_analyst'].indexOf(state.role) !== -1; }
    function isAdmin() { return state.role === 'admin'; }

    /* ---------- pure helpers ---------- */
    function normState(value) {
      const s = String(value == null ? '' : value).toLowerCase();
      return STATES.indexOf(s) === -1 ? 'unknown' : s;
    }
    function fmtDate(v) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }
    function fmtTime(v) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    function scanCounts(scan) {
      const counts = { open: 0, closed: 0, filtered: 0, unknown: 0, total: 0 };
      (Array.isArray(scan.results) ? scan.results : []).forEach(function (item) {
        counts[normState(item && item.state)]++;
        counts.total++;
      });
      return counts;
    }
    function summarize(rows) {
      const devices = new Map();
      const ports = new Map();
      const totals = { open: 0, closed: 0, filtered: 0, unknown: 0, total: 0 };
      rows.forEach(function (scan) {
        const name = scan.device || 'Unknown device';
        const d = devices.get(name) || { name: name, scans: 0, last: null, targets: new Set() };
        d.scans++;
        d.targets.add(scan.target || '—');
        if (!d.last || new Date(scan.created_at) > new Date(d.last)) d.last = scan.created_at;
        devices.set(name, d);
        (Array.isArray(scan.results) ? scan.results : []).forEach(function (item) {
          const st = normState(item && item.state);
          const port = Number(item && item.port);
          totals[st]++; totals.total++;
          if (!Number.isFinite(port)) return;
          const p = ports.get(port) || { port: port, scans: 0, open: 0, closed: 0, filtered: 0, unknown: 0 };
          p.scans++; p[st]++;
          ports.set(port, p);
        });
      });
      const portStats = Array.from(ports.values()).sort(function (a, b) {
        return b.open - a.open || b.scans - a.scans || a.port - b.port;
      });
      return { devices: Array.from(devices.values()), scans: rows.length, totals: totals, portStats: portStats };
    }
    window.__agentSummarize = summarize; // exposed for testing only

    /* ---------- markup builders ---------- */
    function stat(label, value, iconName, tone) {
      return '<article class="mini-metric ag-stat"><span class="mini-metric-icon tone-' + tone + '">' + svg(iconName) +
        '</span><span><b>' + Number(value).toLocaleString() + '</b><small>' + safe(label) + '</small></span></article>';
    }
    function chip(port, st) {
      return '<span class="ag-port ag-' + safe(st) + '" title="Port ' + safe(port) + ': ' + safe(st) + '">' +
        safe(port) + ' <em>' + safe(st.toUpperCase()) + '</em></span>';
    }
    function stateBlock(kind) {
      if (agent.loading && !agent.loaded) {
        return '<div class="empty-state compact-empty"><span class="spinner"></span><b>Loading local agent data…</b></div>';
      }
      if (agent.error) {
        return '<div class="ag-error"><b>Could not load Local Agent data</b><span>' + safe(agent.error) +
          '</span><button type="button" class="button button-quiet" data-agent-retry>Retry</button></div>';
      }
      if (agent.loaded && !agent.rows.length) {
        return '<div class="empty-state compact-empty"><span class="empty-icon">⌁</span><b>No local agent scans yet</b>' +
          '<small>Scans appear after a Local Agent is connected for this account and sends results.</small></div>';
      }
      return '';
    }
    function distribution(totals) {
      if (!totals.total) return 'conic-gradient(#303442 0 100%)';
      let cursor = 0;
      const parts = STATES.map(function (s) {
        const start = cursor; cursor += totals[s] / totals.total * 100;
        return COLORS[s] + ' ' + start + '% ' + cursor + '%';
      });
      return 'conic-gradient(from -90deg,' + parts.join(',') + ')';
    }
    function matches(scan) {
      const q = String(state.search || '').trim().toLowerCase();
      if (!q) return true;
      const ports = (Array.isArray(scan.results) ? scan.results : []).map(function (r) { return r.port + ' ' + r.state; }).join(' ');
      return [scan.device, scan.target, scan.created_at, ports].join(' ').toLowerCase().indexOf(q) !== -1;
    }

    /* ---------- Admin page: Local Agent Results ---------- */
    function resultsHtml() {
      const status = stateBlock('results');
      if (status) return status;
      const s = summarize(agent.rows);
      const shown = agent.rows.filter(matches);
      const devices = '<div class="table-wrap"><table><thead><tr><th>Device</th><th>Target IP</th><th>Scans</th><th>Last scan</th></tr></thead><tbody>' +
        s.devices.map(function (d) {
          return '<tr><td><b class="table-primary">' + safe(d.name) + '</b></td><td>' + safe(Array.from(d.targets).join(', ')) +
            '</td><td>' + d.scans + '</td><td>' + safe(fmtDate(d.last)) + ' · ' + safe(fmtTime(d.last)) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      const scans = shown.length
        ? '<div class="table-wrap"><table><thead><tr><th>Device</th><th>Target IP</th><th>Scan date</th><th>Scan time</th><th>Ports scanned</th><th>Open</th><th>Port status</th></tr></thead><tbody>' +
          shown.map(function (scan) {
            const c = scanCounts(scan);
            const chips = (Array.isArray(scan.results) ? scan.results : []).map(function (r) {
              return chip(r.port, normState(r.state));
            }).join('');
            return '<tr><td><b class="table-primary">' + safe(scan.device) + '</b></td><td>' + safe(scan.target) + '</td><td>' +
              safe(fmtDate(scan.created_at)) + '</td><td>' + safe(fmtTime(scan.created_at)) + '</td><td>' + c.total +
              '</td><td>' + c.open + '</td><td><div class="ag-chips">' + (chips || '<span class="muted-cell">No ports</span>') + '</div></td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="empty-state compact-empty"><b>No scans match your search</b><small>Clear the search box to see all scans.</small></div>';
      return '<div class="mini-metric-grid ag-grid">' +
        stat('Connected devices', s.devices.length, 'server', 'blue') +
        stat('Total scans', s.scans, 'list', 'violet') +
        stat('Ports scanned', s.totals.total, 'target', 'amber') +
        stat('Open ports', s.totals.open, 'alert', 'red') + '</div>' +
        '<article class="panel table-panel"><div class="panel-heading"><div><div class="eyebrow">AGENT DEVICES</div><h3>Connected devices</h3></div></div>' + devices + '</article>' +
        '<article class="panel table-panel"><div class="panel-heading"><div><div class="eyebrow">SCAN RESULTS</div><h3>Local agent scans</h3></div><span class="panel-count">' + shown.length + ' of ' + agent.rows.length + ' (latest 50)</span></div>' + scans + '</article>';
    }
    function renderResults() {
      const root = document.getElementById('agent-results-body');
      if (root) root.innerHTML = resultsHtml();
    }

    /* ---------- Blue Team card: Local Agent Analytics ---------- */
    function analyticsHtml() {
      const status = stateBlock('analytics');
      if (status) return status;
      const s = summarize(agent.rows);
      const t = s.totals;
      const legend = STATES.map(function (st) {
        return '<div class="ag-legend-row"><i style="background:' + COLORS[st] + '"></i><span>' + st.toUpperCase() + '</span><b>' + t[st] + '</b></div>';
      }).join('');
      const top = s.portStats.slice(0, 8);
      const maxScans = Math.max.apply(null, [1].concat(top.map(function (p) { return p.scans; })));
      const bars = top.length ? top.map(function (p) {
        const w = function (n) { return Math.round(n / maxScans * 100); };
        return '<div class="ag-bar-row"><span class="ag-bar-port">Port ' + safe(p.port) + '</span>' +
          '<span class="ag-bar"><i class="ag-seg ag-open" style="width:' + w(p.open) + '%"></i>' +
          '<i class="ag-seg ag-closed" style="width:' + w(p.closed) + '%"></i>' +
          '<i class="ag-seg ag-filtered" style="width:' + w(p.filtered) + '%"></i>' +
          '<i class="ag-seg ag-unknown" style="width:' + w(p.unknown) + '%"></i></span>' +
          '<span class="ag-bar-meta">' + p.open + ' open / ' + p.scans + ' scans</span></div>';
      }).join('') : '<div class="muted-cell">No port data.</div>';
      return '<div class="mini-metric-grid ag-grid">' +
        stat('Connected devices', s.devices.length, 'server', 'blue') +
        stat('Total scans', s.scans, 'list', 'violet') +
        stat('Ports scanned', t.total, 'target', 'amber') +
        stat('Open ports', t.open, 'alert', 'red') + '</div>' +
        '<div class="ag-split"><div class="ag-donut-wrap"><div class="ag-donut" role="img" aria-label="Port status distribution" style="background:' + distribution(t) + '"><span><b>' + t.total + '</b><small>ports</small></span></div>' +
        '<div class="ag-legend">' + legend + '</div></div><div class="ag-bars"><div class="eyebrow">PORT-LEVEL STATISTICS</div>' + bars + '</div></div>';
    }
    function renderAnalytics() {
      const root = document.getElementById('agent-analytics-body');
      if (root) root.innerHTML = analyticsHtml();
    }

    /* ---------- one render entry point ---------- */
    function renderAgents() {
      if (!state.user) return;
      const nav = document.querySelector('[data-page="agents"]');
      if (nav) nav.hidden = !isAdmin();
      const card = document.getElementById('agent-analytics-card');
      if (card) card.hidden = !canLoad();
      if (!canLoad()) return;
      if (isAdmin()) renderResults();
      renderAnalytics();
    }

    /* ---------- ONE API call, shared by both sections ---------- */
    function resetAgent() {
      agent.rows = []; agent.loaded = false; agent.error = ''; agent.fetchedAt = 0; agent.force = false;
    }
    async function loadAgent() {
      if (!state.token || !canLoad()) { resetAgent(); agent.owner = ''; return; }
      if (agent.owner !== state.user) { resetAgent(); agent.owner = state.user; } // new login = clean slate
      const fresh = agent.loaded && !agent.error && (Date.now() - agent.fetchedAt < AGENT_TTL_MS);
      if (fresh && !agent.force) return;
      if (agent.promise) return agent.promise; // a request is already running: share it
      agent.force = false; agent.loading = true; agent.error = '';
      renderAgents();
      agent.promise = (async function () {
        try {
          const data = await req('/agent/results');
          agent.rows = Array.isArray(data) ? data : [];
          agent.loaded = true;
          agent.fetchedAt = Date.now();
        } catch (error) {
          agent.error = (error && error.message) || 'Request failed';
          agent.loaded = false;
        } finally {
          agent.loading = false;
          agent.promise = null;
        }
      })();
      return agent.promise;
    }

    /* ---------- inject UI (nav item, admin page, blue card, styles) ---------- */
    function injectStyles() {
      if (document.getElementById('agent-analytics-style')) return;
      const style = document.createElement('style');
      style.id = 'agent-analytics-style';
      style.textContent =
        '.ag-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}' +
        '.ag-split{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr);gap:24px;align-items:start;margin-top:18px}' +
        '.ag-donut-wrap{display:flex;align-items:center;gap:20px;flex-wrap:wrap}' +
        '.ag-donut{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;flex:none}' +
        '.ag-donut span{width:96px;height:96px;border-radius:50%;background:#0d0b13;display:flex;flex-direction:column;align-items:center;justify-content:center}' +
        '.ag-donut b{font-size:24px;line-height:1}.ag-donut small{color:#858b9a;font-size:11px}' +
        '.ag-legend{display:grid;gap:8px;min-width:130px}.ag-legend-row{display:grid;grid-template-columns:10px 1fr auto;gap:8px;align-items:center;font-size:12px;color:#aab0be}' +
        '.ag-legend-row i{width:9px;height:9px;border-radius:50%}.ag-legend-row b{color:#f0f1f7}' +
        '.ag-bars{display:grid;gap:10px;min-width:0}' +
        '.ag-bar-row{display:grid;grid-template-columns:78px minmax(80px,1fr) auto;gap:10px;align-items:center;font-size:12px}' +
        '.ag-bar-port{color:#e6e3f2;font-weight:600}.ag-bar-meta{color:#858b9a;white-space:nowrap;font-size:11px}' +
        '.ag-bar{display:flex;height:12px;border-radius:7px;background:#0b0911;border:1px solid #1b1727;overflow:hidden}' +
        '.ag-seg{display:block;height:100%}' +
        '.ag-seg.ag-open{background:#f6ae4f}.ag-seg.ag-closed{background:#3bc797}.ag-seg.ag-filtered{background:#579eff}.ag-seg.ag-unknown{background:#626a7b}' +
        '.ag-chips{display:flex;flex-wrap:wrap;gap:6px;min-width:220px}' +
        '.ag-port{display:inline-flex;gap:6px;align-items:center;padding:3px 9px;border-radius:8px;border:1px solid;font-size:11px;font-weight:600;white-space:nowrap}' +
        '.ag-port em{font-style:normal;font-size:9px;letter-spacing:.5px}' +
        '.ag-port.ag-open{color:#f5c074;background:rgba(246,174,79,.1);border-color:rgba(246,174,79,.3)}' +
        '.ag-port.ag-closed{color:#70d8b3;background:rgba(59,199,151,.1);border-color:rgba(59,199,151,.3)}' +
        '.ag-port.ag-filtered{color:#83b9ff;background:rgba(87,158,255,.1);border-color:rgba(87,158,255,.3)}' +
        '.ag-port.ag-unknown{color:#9aa0b0;background:rgba(98,106,123,.12);border-color:rgba(98,106,123,.35)}' +
        '.ag-error{display:grid;gap:10px;justify-items:start;padding:16px;border:1px solid rgba(239,96,114,.35);border-radius:12px;background:rgba(239,96,114,.08);color:#ff9ba7;font-size:13px}' +
        '.ag-note{margin-bottom:14px}' +
        '@media(max-width:1000px){.ag-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.ag-split{grid-template-columns:1fr}}' +
        '@media(max-width:520px){.ag-grid{grid-template-columns:1fr!important}.ag-bar-row{grid-template-columns:64px 1fr}.ag-bar-meta{grid-column:1/-1}}';
      document.head.appendChild(style);
    }

    function injectUi() {
      injectStyles();

      // Admin: nav item + page (page title and role access registered with app.js)
      pageTitles.agents = 'Local Agent Results';
      if (Array.isArray(rolePages.admin) && rolePages.admin.indexOf('agents') === -1) rolePages.admin.push('agents');

      const nav = document.getElementById('primary-nav') || document.querySelector('.primary-nav');
      if (nav && !nav.querySelector('[data-page="agents"]')) {
        const button = document.createElement('button');
        button.className = 'nav-item';
        button.setAttribute('data-page', 'agents');
        button.hidden = true;
        button.innerHTML = '<span class="nav-icon">' + svg('server') + '</span><span class="nav-label">Local Agent Results</span>';
        const audit = nav.querySelector('[data-page="audit"]');
        if (audit && audit.parentNode === nav) nav.insertBefore(button, audit.nextSibling); else nav.appendChild(button);
      }

      const firstView = document.querySelector('.page-view');
      const content = document.getElementById('page-content') || (firstView && firstView.parentNode);
      if (content && !document.getElementById('page-agents')) {
        const section = document.createElement('section');
        section.id = 'page-agents';
        section.className = 'page-view';
        section.setAttribute('data-view', 'agents');
        section.hidden = true;
        section.innerHTML =
          '<div class="page-intro"><div><div class="eyebrow">LOCAL AGENT</div><h2>Local Agent Results</h2>' +
          '<p class="muted">Devices and localhost port scans reported by your Local Agent.</p></div></div>' +
          '<div class="info-note ag-note"><span>i</span><p>The API returns only scans sent by the signed-in account’s own agent (latest 50). It does not list other users’ agents.</p></div>' +
          '<div id="agent-results-body"></div>';
        content.appendChild(section);
      }

      // Blue Team: analytics card
      const blue = document.querySelector('[data-view="blue"]');
      if (blue && !document.getElementById('agent-analytics-card')) {
        const card = document.createElement('article');
        card.id = 'agent-analytics-card';
        card.className = 'panel table-panel';
        card.hidden = true;
        card.innerHTML = '<div class="panel-heading"><div><div class="eyebrow">LOCAL AGENT</div><h3>Local Agent Analytics</h3></div>' +
          '<span class="panel-count">Your agent’s scans</span></div><div id="agent-analytics-body"></div>';
        const anchor = document.getElementById('blue-mini-stats');
        if (anchor && anchor.parentNode === blue) blue.insertBefore(card, anchor.nextSibling); else blue.appendChild(card);
      }
    }

    injectUi();

    /* ---------- hook into existing refresh/render (no edits to app.js) ---------- */
    const originalRender = renderAll;
    renderAll = function () {
      originalRender.apply(this, arguments);
      try { renderAgents(); } catch (error) { console.error('[agent-analytics] render failed:', error); }
    };
    const originalRefresh = refreshData;
    refreshData = async function () {
      const agentTask = loadAgent();
      try {
        return await originalRefresh.apply(this, arguments);
      } finally {
        await agentTask;
        try { renderAgents(); } catch (error) { console.error('[agent-analytics] render failed:', error); }
      }
    };

    document.addEventListener('click', function (event) {
      if (event.target.closest('[data-agent-retry]')) { agent.force = true; loadAgent().then(renderAgents); }
    });
    // The header Refresh button should always fetch fresh agent data (capture phase = runs first).
    document.addEventListener('click', function (event) {
      if (event.target.closest('#refresh-button')) agent.force = true;
    }, true);

    document.documentElement.setAttribute('data-agent-analytics', 'ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();