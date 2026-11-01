const API = 'https://purpleshield.onrender.com/api';
const $ = (id) => document.getElementById(id);

const state = {
  token: localStorage.getItem('ps_token') || '',
  user: null,
  role: '',
  page: 'overview',
  search: '',
  dashboard: null,
  findings: [],
  events: [],
  detections: [],
  incidents: [],
  validations: [],
  audit: [],
  latestScan: null,
  assessmentHistory: [],
  historyError: '',
  users: [],
  usersError: '',
  agentScans: [],
  agentScansError: '',
};

const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  chart:'<path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M17 6h3v3"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  shield:'<path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
  flag:'<path d="M5 21V5"/><path d="M5 5c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  alert:'<path d="M12 3 2.7 19h18.6L12 3Z"/><path d="M12 9v4"/><path d="M12 16h.01"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.4-.5a7.9 7.9 0 0 1-1.5.9l-.2 1.5h-2.4l-.3-1.5a7.9 7.9 0 0 1-1.5-.9l-1.4.5-1.2-2.1 1.2-.9a7 7 0 0 1 0-1.8l-1.2-.9 1.2-2.1 1.4.5a7.9 7.9 0 0 1 1.5-.9l.3-1.5h2.4l.2 1.5a7.9 7.9 0 0 1 1.5.9l1.4-.5 1.2 2.1-1.2.9a7 7 0 0 1 0 1.8Z" transform="translate(-2 -2)"/>',
  bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  logout:'<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  refresh:'<path d="M20 7v5h-5"/><path d="M4.9 9A8 8 0 0 1 18.5 6L20 12M4 17v-5h5"/><path d="M19.1 15A8 8 0 0 1 5.5 18L4 12"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pulse:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  server:'<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01M12 7.5h5M12 16.5h5"/>',
  search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
};

document.querySelectorAll('[data-icon]').forEach(el => {
  const path = icons[el.dataset.icon];
  if (path) el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
});

const rolePages = {
  admin:['overview','dashboard','red','blue','purple','findings','incidents','validations','audit','settings'],
  red_operator:['overview','dashboard','red','findings','settings'],
  blue_analyst:['overview','dashboard','blue','findings','incidents','settings'],
  purple_analyst:['overview','dashboard','purple','findings','validations','settings'],
};

const pageTitles = {
  overview:'Overview',
  dashboard:'Security Dashboard',
  red:'Red Team',
  blue:'Blue Team',
  purple:'Purple Team',
  findings:'Findings',
  incidents:'Incidents',
  validations:'Validation History',
  audit:'Audit Logs',
  settings:'Settings'
};

const findingStatuses = ['Open','In Progress','Fixed','Retest Required'];
const incidentStatuses = ['Open','In Progress','Fixed','Retest Required','Closed'];

function esc(value) {
  return String(value ?? '—').replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

function roleName(role = state.role) {
  return String(role || '').split('_').map(s => s[0]?.toUpperCase()+s.slice(1)).join(' ');
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? esc(value)
    : date.toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
}

function dateShort(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? esc(value)
    : date.toLocaleDateString([], {month:'short',day:'numeric'});
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
}

function badge(value) {
  const key = String(value || '').toLowerCase().replaceAll(' ','-');
  return `<span class="badge badge-${esc(key)}">${esc(value || '—')}</span>`;
}

function showToast(message, tone='success') {
  const region = $('toast-region');
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3800);
}

function showPageError(message) {
  $('page-error').textContent = message;
  $('page-error').hidden = !message;
}

function clearSession(message='') {
  state.token='';
  state.user=null;
  state.role='';
  localStorage.removeItem('ps_token');
  state.assessmentHistory=[];
  state.historyError='';
  state.agentScans=[];
  state.agentScansError='';
  $('app').hidden=true;
  $('login-panel').hidden=false;
  $('login-error').textContent=message;
}

async function req(path, options={}) {
  let response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers:{
        ...(options.body ? {'Content-Type':'application/json'} : {}),
        ...(state.token ? {Authorization:`Bearer ${state.token}`} : {}),
        ...(options.headers || {})
      },
    });
  } catch (error) {
    throw new Error('Backend unavailable. Start the PurpleShield API and try again.');
  }

  let data={};
  try {
    data=await response.json();
  } catch {
    /* empty response */
  }

  if (!response.ok) {
    if (response.status === 401 && state.token && path !== '/auth/login') {
      clearSession('Your session expired. Sign in again.');
    }
    throw new Error(data.detail || `Request failed (${response.status})`);
  }

  return data;
}

function setAuthenticated(data) {
  state.token=data.access_token;
  state.user=data.username;
  state.role=data.role;

  localStorage.setItem('ps_token',state.token);
  $('login-panel').hidden=true;
  $('app').hidden=false;

  $('profile-name').textContent=state.user;
  $('profile-role').textContent=roleName();
  $('profile-initial').textContent=(state.user[0] || 'P').toUpperCase();

  $('settings-username').textContent=state.user;
  $('settings-role').textContent=roleName();
  $('settings-avatar').textContent=(state.user[0] || 'P').toUpperCase();

  $('settings-permission-summary').textContent=`${roleName()} permissions are enforced by the API.`;

  applyRoleNavigation();

  refreshData().then(() => navigate('overview')).catch(error => {
    showPageError(error.message);
    navigate('overview');
  });
}

function applyRoleNavigation() {
  const allowed=rolePages[state.role] || [];

  document.querySelectorAll('.nav-item').forEach(button => {
    button.hidden=!allowed.includes(button.dataset.page);
  });

  document.querySelectorAll('[data-go]').forEach(button => {
    button.hidden=!allowed.includes(button.dataset.go);
  });

  $('seed-button').hidden=!['admin','blue_analyst','purple_analyst'].includes(state.role);
  $('blue-seed-button').hidden=!['admin','blue_analyst'].includes(state.role);
}

async function authenticate(username, password) {
  const data=await req('/auth/login',{
    method:'POST',
    body:JSON.stringify({username,password})
  });

  setAuthenticated(data);
}

// Red Team Assessment History
function canViewAssessmentHistory() {
  return ['admin','red_operator'].includes(state.role);
}

async function loadAssessmentHistory() {
  if (!state.token || !canViewAssessmentHistory()) {
    state.assessmentHistory=[];
    state.historyError='';
    return;
  }

  try {
    const rows=await req('/red/assessment-history');
    state.assessmentHistory=Array.isArray(rows) ? rows : [];
    state.historyError='';
  } catch(error) {
    state.historyError=error.message;
  }
}

// Local Agent scan history
function canViewAgentResults() {
  return ['admin','blue_analyst'].includes(state.role);
}

async function loadAgentResults() {
  if (!state.token || !canViewAgentResults()) {
    state.agentScans=[];
    state.agentScansError='';
    return;
  }

  try {
    const rows=await req('/agent/results');
    state.agentScans=Array.isArray(rows) ? rows : [];
    state.agentScansError='';
  } catch(error) {
    state.agentScans=[];
    state.agentScansError=error.message;
  }
}

async function refreshData() {
  if (!state.token) return;

  $('loading-state').hidden=false;
  showPageError('');

  const role=state.role;

  const tasks=[
    req('/dashboard').then(data=>state.dashboard=data),
    req('/red/findings').then(data=>state.findings=data),
  ];

  if (['admin','blue_analyst'].includes(role)) {
    tasks.push(req('/blue/events').then(data=>state.events=data));
    tasks.push(req('/blue/incidents').then(data=>state.incidents=data));
  } else {
    state.events=[];
    state.incidents=[];
  }

  if (['admin','blue_analyst','purple_analyst'].includes(role)) {
    tasks.push(req('/blue/detections').then(data=>state.detections=data));
  } else {
    state.detections=[];
  }

  if (['admin','purple_analyst'].includes(role)) {
    tasks.push(req('/purple/validations').then(data=>state.validations=data));
  } else {
    state.validations=[];
  }

  if (role==='admin') {
    tasks.push(req('/audit').then(data=>state.audit=data));
    tasks.push(req('/admin/users').then(data=>{
      state.users=Array.isArray(data)?data:[];
      state.usersError='';
    }).catch(error=>{
      state.users=[];
      state.usersError=error.message;
    }));
  } else {
    state.audit=[];
    state.users=[];
    state.usersError='';
  }

  if (canViewAssessmentHistory()) tasks.push(loadAssessmentHistory());
  if (canViewAgentResults()) tasks.push(loadAgentResults());

  try {
    await Promise.all(tasks);
    renderAll();
  } finally {
    $('loading-state').hidden=true;
  }
}

function filtered(rows, fields) {
  const query=state.search.trim().toLowerCase();
  if (!query) return rows;

  return rows.filter(row =>
    fields.some(field => String(row[field] ?? '').toLowerCase().includes(query))
  );
}

function table(rows, columns, emptyTitle='No records', emptyText='') {
  if (!rows.length) {
    return `<div class="empty-state"><b>${esc(emptyTitle)}</b><span>${esc(emptyText)}</span></div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${columns.map(column=>`<th>${esc(column.label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row=>`
            <tr>
              ${columns.map(column=>`
                <td>${column.render
                  ? column.render(row[column.key],row)
                  : esc(row[column.key])}</td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Local Agent dashboard panel
function renderAgentResults() {
  const container = $('agent-results-panel');
  if (!container) return;

  const isAllowed = canViewAgentResults();
  container.hidden = !isAllowed;

  if (!isAllowed) return;

  if (state.agentScansError) {
    container.innerHTML = `
      <div class="inline-error">
        Could not load Local Agent results: ${esc(state.agentScansError)}
      </div>
    `;
    return;
  }

  const scans = state.agentScans || [];

  const allPorts = scans.flatMap(scan =>
    (Array.isArray(scan.results) ? scan.results : []).map(item => ({
      ...item,
      device: scan.device || 'Unknown device',
      target: scan.target || '127.0.0.1',
      created_at: scan.created_at || scan.timestamp || null
    }))
  );

  const openCount = allPorts.filter(item => item.state === 'open').length;
  const filteredCount = allPorts.filter(item => item.state === 'filtered').length;
  const closedCount = allPorts.filter(item => item.state === 'closed').length;
  const deviceCount = new Set(scans.map(scan => scan.device).filter(Boolean)).size;

  const latestScan = scans[0] || null;

  container.innerHTML = `
    <div class="section-heading">
      <div>
        <h3>Local Agent Results</h3>
        <p>Scan results received from your connected device</p>
      </div>
      <span class="badge badge-success">${scans.length} scans</span>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span>Total Scans</span>
        <strong>${scans.length}</strong>
      </div>
      <div class="stat-card">
        <span>Connected Devices</span>
        <strong>${deviceCount}</strong>
      </div>
      <div class="stat-card">
        <span>Open Ports</span>
        <strong>${openCount}</strong>
      </div>
      <div class="stat-card">
        <span>Filtered Ports</span>
        <strong>${filteredCount}</strong>
      </div>
      <div class="stat-card">
        <span>Closed Ports</span>
        <strong>${closedCount}</strong>
      </div>
    </div>

    <div class="analytics-card">
      <h4>Port State Distribution</h4>
      <div class="agent-state-bars">
        <div>
          <span>Open</span>
          <strong>${openCount}</strong>
          <div class="agent-bar"><i style="width:${allPorts.length ? openCount/allPorts.length*100 : 0}%"></i></div>
        </div>
        <div>
          <span>Filtered</span>
          <strong>${filteredCount}</strong>
          <div class="agent-bar"><i style="width:${allPorts.length ? filteredCount/allPorts.length*100 : 0}%"></i></div>
        </div>
        <div>
          <span>Closed</span>
          <strong>${closedCount}</strong>
          <div class="agent-bar"><i style="width:${allPorts.length ? closedCount/allPorts.length*100 : 0}%"></i></div>
        </div>
      </div>
    </div>

    <div class="analytics-card">
      <h4>Latest Scan Details</h4>
      ${
        latestScan
          ? `<p><b>Device:</b> ${esc(latestScan.device || 'Unknown')}</p>
             <p><b>Target:</b> ${esc(latestScan.target || '127.0.0.1')}</p>
             <p><b>Last Scan:</b> ${esc(dateTime(latestScan.created_at || latestScan.timestamp))}</p>`
          : '<div class="empty-state"><b>No scans received yet</b><span>Run your Local Agent to upload scan results.</span></div>'
      }
    </div>

    <div class="analytics-card">
      <h4>Local Agent Port Results</h4>
      ${table(
        filtered(allPorts,['device','target','port','state','reason']),
        [
          {key:'device',label:'Device'},
          {key:'target',label:'Target IP'},
          {key:'port',label:'Port'},
          {key:'state',label:'Port Status',render:value=>badge(value)},
          {key:'reason',label:'Reason'},
          {key:'created_at',label:'Scan Time',render:value=>dateTime(value)}
        ],
        'No Local Agent results',
        'Connect your Local Agent and run a localhost scan.'
      )}
    </div>
  `;
}

// Blue Team Analytics Panel
function renderBlueAgentAnalytics() {
  const container = $('blue-agent-analytics');
  if (!container) return;

  const isAllowed = ['admin','blue_analyst'].includes(state.role);
  container.hidden = !isAllowed;

  if (!isAllowed) return;

  const scans = state.agentScans || [];
  const allPorts = scans.flatMap(scan =>
    (Array.isArray(scan.results) ? scan.results : []).map(item => ({
      ...item,
      device: scan.device || 'Unknown device',
      target: scan.target || '127.0.0.1'
    }))
  );

  const openCount = allPorts.filter(item => item.state === 'open').length;
  const filteredCount = allPorts.filter(item => item.state === 'filtered').length;
  const closedCount = allPorts.filter(item => item.state === 'closed').length;

  container.innerHTML = `
    <div class="section-heading">
      <div>
        <h3>Blue Team — Local Agent Analytics</h3>
        <p>Visibility into localhost scan activity reported by connected agents</p>
      </div>
      <span class="badge badge-info">${allPorts.length} port records</span>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span>Agent Scans</span>
        <strong>${scans.length}</strong>
      </div>
      <div class="stat-card">
        <span>Open Ports</span>
        <strong>${openCount}</strong>
      </div>
      <div class="stat-card">
        <span>Filtered Ports</span>
        <strong>${filteredCount}</strong>
      </div>
      <div class="stat-card">
        <span>Closed Ports</span>
        <strong>${closedCount}</strong>
      </div>
    </div>

    <div class="analytics-card">
      <h4>Blue Team Agent Port Analytics</h4>
      ${table(
        filtered(allPorts,['device','target','port','state','reason']),
        [
          {key:'device',label:'Device'},
          {key:'target',label:'Target'},
          {key:'port',label:'Port'},
          {key:'state',label:'Status',render:value=>badge(value)},
          {key:'reason',label:'Details'}
        ],
        'No Agent Analytics Available',
        'No Local Agent scans have been received for this account.'
      )}
    </div>
  `;
}

// Overview
function renderOverview() {
  const d=state.dashboard || {};
  const stats=[
    ['Total Findings',d.total_findings ?? state.findings.length,'alert'],
    ['Open Findings',d.open_findings ?? state.findings.filter(x=>x.status==='Open').length,'flag'],
    ['Incidents',d.total_incidents ?? state.incidents.length,'shield'],
    ['Validations',d.total_validations ?? state.validations.length,'check'],
  ];

  $('overview-stats').innerHTML=stats.map(([label,value,ico])=>`
    <div class="stat-card">
      <div class="stat-icon">${icon(ico)}</div>
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  $('overview-findings').innerHTML=table(
    filtered(state.findings,['title','severity','status','target_ip']),
    [
      {key:'title',label:'Finding'},
      {key:'severity',label:'Severity',render:v=>badge(v)},
      {key:'status',label:'Status',render:v=>badge(v)},
      {key:'target_ip',label:'Target'}
    ],
    'No findings yet',
    'Run an authorized localhost assessment to create findings.'
  );

  $('overview-events').innerHTML=table(
    state.events.slice(0,5),
    [
      {key:'event_type',label:'Event'},
      {key:'source',label:'Source'},
      {key:'severity',label:'Severity',render:v=>badge(v)},
      {key:'created_at',label:'Time',render:v=>dateTime(v)}
    ],
    'No security events',
    'Security events will appear here.'
  );

  renderAgentResults();
}

// Security dashboard
function renderDashboard() {
  const d=state.dashboard || {};
  const metrics=[
    ['Findings',d.total_findings ?? state.findings.length],
    ['Incidents',d.total_incidents ?? state.incidents.length],
    ['Detections',d.total_detections ?? state.detections.length],
    ['Validations',d.total_validations ?? state.validations.length]
  ];

  $('dashboard-metrics').innerHTML=metrics.map(([label,value])=>`
    <div class="metric-card">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  $('dashboard-findings').innerHTML=table(
    state.findings.slice(0,8),
    [
      {key:'title',label:'Finding'},
      {key:'severity',label:'Severity',render:v=>badge(v)},
      {key:'status',label:'Status',render:v=>badge(v)}
    ],
    'No findings'
  );
}

// Red Team
function renderRed() {
  $('red-findings').innerHTML=table(
    filtered(state.findings,['title','severity','status','target_ip']),
    [
      {key:'title',label:'Finding'},
      {key:'target_ip',label:'Target'},
      {key:'port',label:'Port'},
      {key:'severity',label:'Severity',render:v=>badge(v)},
      {key:'status',label:'Status',render:v=>badge(v)}
    ],
    'No findings',
    'Run a localhost assessment to create findings.'
  );

  const historyBox=$('assessment-history');
  if (historyBox) {
    historyBox.innerHTML=state.historyError
      ? `<div class="inline-error">${esc(state.historyError)}</div>`
      : table(
          state.assessmentHistory,
          [
            {key:'target_ip',label:'Target'},
            {key:'ports_scanned',label:'Ports'},
            {key:'open_ports',label:'Open'},
            {key:'created_at',label:'Time',render:v=>dateTime(v)}
          ],
          'No assessment history',
          'Completed Red Team assessments will appear here.'
        );
  }
}

// Blue Team
function renderBlue() {
  $('blue-detections').innerHTML=table(
    filtered(state.detections,['title','severity','status','description']),
    [
      {key:'title',label:'Detection'},
      {key:'severity',label:'Severity',render:v=>badge(v)},
      {key:'status',label:'Status',render:v=>badge(v)},
      {key:'description',label:'Description'}
    ],
    'No detections',
    'Security detections will appear here.'
  );

  $('blue-incidents').innerHTML=table(
    filtered(state.incidents,['title','severity','status']),
    [
      {key:'title',label:'Incident'},
      {key:'severity',label:'Severity',render:v=>badge(v)},
      {key:'status',label:'Status',render:(v,row)=>`
        <select data-incident-status="${row.id}">
          ${incidentStatuses.map(s=>`<option ${s===v?'selected':''}>${s}</option>`).join('')}
        </select>
      `}
    ],
    'No incidents',
    'Incidents created by detection rules will appear here.'
  );

  $('blue-events').innerHTML=table(
    filtered(state.events,['event_type','source','severity','description']),
    [
      {key:'event_type',label:'Event'},
      {key:'source',label:'Source'},
      {key:'severity',label:'Severity',render:v=>badge(v)},
      {key:'created_at',label:'Time',render:v=>dateTime(v)}
    ],
    'No security events',
    'Ingested events will appear here.'
  );

  renderBlueAgentAnalytics();
}

// Purple Team
function renderPurple() {
  $('validation-history').innerHTML=table(
    state.validations,
    [
      {key:'finding_id',label:'Finding'},
      {key:'result',label:'Result',render:v=>badge(v)},
      {key:'expected',label:'Expected'},
      {key:'observed',label:'Observed'},
      {key:'timestamp',label:'Time',render:v=>dateTime(v)}
    ],
    'No validations',
    'Purple Team validation results will appear here.'
  );

  const select=$('finding-to-validate');
  if (select) {
    const options=state.findings.filter(x=>x.status!=='Fixed');
    select.innerHTML='<option value="">Select a finding…</option>'+options.map(x=>`
      <option value="${x.id}">#${x.id} · ${esc(x.title)} (${esc(x.status)})</option>
    `).join('');
  }
}

// Findings
function renderFindings() {
  $('findings-table').innerHTML=table(
    filtered(state.findings,['title','severity','status','target_ip']),
    [
      {key:'title',label:'Finding'},
      {key:'target_ip',label:'Target'},
      {key:'port',label:'Port'},
      {key:'severity',label:'Severity',render:v=>badge(v)},
      {key:'status',label:'Status',render:(v,row)=>`
        <select data-finding-status="${row.id}">
          ${findingStatuses.map(s=>`<option ${s===v?'selected':''}>${s}</option>`).join('')}
        </select>
      `}
    ],
    'No findings',
    'No findings match your search.'
  );
}

// Incidents
function renderIncidents() {
  $('incidents-table').innerHTML=table(
    filtered(state.incidents,['title','severity','status']),
    [
      {key:'title',label:'Incident'},
      {key:'severity',label:'Severity',render:v=>badge(v)},
      {key:'status',label:'Status',render:(v,row)=>`
        <select data-incident-status="${row.id}">
          ${incidentStatuses.map(s=>`<option ${s===v?'selected':''}>${s}</option>`).join('')}
        </select>
      `}
    ],
    'No incidents',
    'No incidents match your search.'
  );
}

// Validations
function renderValidations() {
  $('validations-table').innerHTML=table(
    filtered(state.validations,['result','expected','observed','mitre_attack_id']),
    [
      {key:'finding_id',label:'Finding'},
      {key:'result',label:'Result',render:v=>badge(v)},
      {key:'expected',label:'Expected'},
      {key:'observed',label:'Observed'},
      {key:'timestamp',label:'Time',render:v=>dateTime(v)}
    ],
    'No validations',
    'No validation records match your search.'
  );
}

// Audit
function renderAudit() {
  $('audit-table').innerHTML=table(
    filtered(state.audit,['username','action','details']),
    [
      {key:'username',label:'User'},
      {key:'action',label:'Action'},
      {key:'details',label:'Details'},
      {key:'created_at',label:'Time',render:v=>dateTime(v)}
    ],
    'No audit logs',
    'Audit records will appear here.'
  );
}

// Settings
function renderSettings() {
  const box=$('users-table');
  if (!box) return;

  if (state.usersError) {
    box.innerHTML=`<div class="inline-error">${esc(state.usersError)}</div>`;
    return;
  }

  box.innerHTML=table(
    state.users,
    [
      {key:'username',label:'Username'},
      {key:'role',label:'Role',render:(v,row)=>`
        <select data-user-role="${row.id}">
          ${['admin','red_operator','blue_analyst','purple_analyst'].map(role=>`
            <option value="${role}" ${role===v?'selected':''}>${roleName(role)}</option>
          `).join('')}
        </select>
      `},
      {key:'is_active',label:'Status',render:(v,row)=>`
        <button class="btn btn-small" data-user-active="${row.id}" data-next-active="${!v}">
          ${v?'Deactivate':'Activate'}
        </button>
      `}
    ],
    'No users',
    'Managed users will appear here.'
  );
}

function renderAll() {
  renderOverview();
  renderDashboard();
  renderRed();
  renderBlue();
  renderPurple();
  renderFindings();
  renderIncidents();
  renderValidations();
  renderAudit();
  renderSettings();
}

function navigate(page) {
  const allowed=rolePages[state.role] || [];
  if (!allowed.includes(page)) return;

  state.page=page;

  document.querySelectorAll('.page-view').forEach(view=>{
    view.hidden=view.dataset.view!==page;
  });

  document.querySelectorAll('.nav-item').forEach(button=>{
    button.classList.toggle('active',button.dataset.page===page);
  });

  $('page-title').textContent=pageTitles[page] || page;
  document.body.classList.remove('sidebar-open');
  showPageError('');
}

// Red Team scan
async function submitScan(event) {
  event.preventDefault();

  const target=$('scan-target').value.trim();
  const ports=$('scan-ports').value.trim();
  const button=$('scan-button');

  button.disabled=true;
  button.textContent='Scanning…';

  try {
    const result=await req('/red/assess-local',{
      method:'POST',
      body:JSON.stringify({target_ip:target,ports:ports.split(',').map(Number)})
    });

    $('scan-result').innerHTML=`
      <div class="result-card">
        <h3>Assessment completed</h3>
        <p>Target: ${esc(result.target_ip || target)}</p>
        <p>Open ports: ${esc(result.open_ports ?? 0)}</p>
        <p>Findings created: ${esc(result.findings_created ?? 0)}</p>
      </div>
    `;

    await refreshData();
    showToast('Local assessment completed.');
  } catch(error) {
    $('scan-result').innerHTML=`<div class="inline-error">${esc(error.message)}</div>`;
  } finally {
    button.disabled=false;
    button.textContent='Run assessment';
  }
}

async function changeFinding(id,status,element) {
  if (element) element.disabled=true;

  try {
    await req(`/blue/findings/${Number(id)}`,{
      method:'PATCH',
      body:JSON.stringify({status})
    });

    await refreshData();
    showToast(`Finding #${id} updated to ${status}.`);
  } catch(error) {
    showToast(error.message,'error');
    await refreshData().catch(()=>{});
  } finally {
    if (element) element.disabled=false;
  }
}

async function changeIncident(id,status,element) {
  if (element) element.disabled=true;

  try {
    await req(`/blue/incidents/${Number(id)}`,{
      method:'PATCH',
      body:JSON.stringify({status})
    });

    await refreshData();
    showToast('Incident status saved.');
  } catch(error) {
    showToast(error.message,'error');
    await refreshData().catch(()=>{});
  } finally {
    if (element) element.disabled=false;
  }
}

async function validateFinding(event) {
  event.preventDefault();

  const id=Number($('finding-to-validate').value);

  if (!id) {
    showToast('Select a finding to retest.','error');
    return;
  }

  $('retest-button').disabled=true;
  $('retest-button').textContent='Retesting…';

  try {
    const result=await req('/purple/validate-finding',{
      method:'POST',
      body:JSON.stringify({finding_id:id})
    });

    $('finding-validation-result').innerHTML=`
      <div class="result-card result-${esc(String(result.result).toLowerCase())}">
        <div class="result-heading">
          <span class="result-mark">${result.result==='PASS'?'✓':'!'}</span>
          <div>
            <b>${esc(result.result)}</b>
            <small>Finding #${Number(result.finding_id)} · ${esc(dateTime(result.timestamp))}</small>
          </div>
        </div>
        <div class="result-pair"><span>Expected</span><b>${esc(result.expected)}</b></div>
        <div class="result-pair"><span>Observed</span><b>${esc(result.observed)}</b></div>
        <div class="result-footnote">Finding status remains ${esc(result.finding_status)}.</div>
      </div>
    `;

    await refreshData();
    showToast(
      `Finding retest recorded: ${result.result}.`,
      result.result==='PASS'?'success':'warning'
    );
  } catch(error) {
    $('finding-validation-result').innerHTML=`<div class="inline-error">${esc(error.message)}</div>`;
  } finally {
    $('retest-button').disabled=false;
    $('retest-button').innerHTML=`${icon('check')} Validate remediation`;
  }
}

async function validateDemo() {
  const button=$('validate');
  button.disabled=true;
  button.textContent='Checking detection…';

  try {
    const result=await req('/purple/validate-demo',{method:'POST'});
    const outcome=result.result==='PASS'?'pass':'gap';

    $('validation-result').innerHTML=`
      <div class="synthetic-outcome synthetic-${outcome}">
        <span>${result.result==='PASS'?'✓':'!'}</span>
        <div>
          <b>${esc(result.result)}</b>
          <small>Expected: ${esc(result.expected)} · Observed: ${esc(result.observed)} · ${esc(result.mitre_attack_id)}</small>
        </div>
      </div>
    `;

    await refreshData();
    showToast(
      `Synthetic validation recorded: ${result.result}.`,
      result.result==='PASS'?'success':'warning'
    );
  } catch(error) {
    $('validation-result').innerHTML=`<p class="inline-error">${esc(error.message)}</p>`;
  } finally {
    button.disabled=false;
    button.innerHTML='Run synthetic validation <span>→</span>';
  }
}

async function seedDemo() {
  try {
    const result=await req('/demo/seed',{method:'POST'});
    await refreshData();
    showToast(result.message);
  } catch(error) {
    showToast(error.message,'error');
  }
}

async function createManagedUser(event) {
  event.preventDefault();
  if (state.role !== 'admin') return;

  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const feedback = $('user-create-feedback');
  const formData = new FormData(form);

  const payload = {
    username: String(formData.get('username') || '').trim(),
    password: String(formData.get('password') || ''),
    role: String(formData.get('role') || 'red_operator'),
  };

  if (!/^[A-Za-z0-9_.-]{3,80}$/.test(payload.username)) {
    feedback.textContent = 'Username must be 3–80 characters: letters, numbers, dot, underscore or hyphen.';
    return;
  }

  if (payload.password.length < 10) {
    feedback.textContent = 'Password must contain at least 10 characters.';
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Creating user…';
  feedback.textContent = '';

  try {
    const result = await req('/admin/users',{
      method:'POST',
      body:JSON.stringify(payload)
    });

    form.reset();
    await refreshData();
    showToast(`User ${payload.username} created successfully.`);
    feedback.textContent = result.message || 'User created successfully.';
  } catch (error) {
    feedback.textContent = error.message;
    showToast(error.message, 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Create user';
  }
}

async function updateManagedUserRole(userId, role, element) {
  if (state.role !== 'admin') return;
  if (!['admin','red_operator','blue_analyst','purple_analyst'].includes(role)) return;

  if (element) element.disabled = true;

  try {
    await req(`/admin/users/${Number(userId)}`,{
      method:'PATCH',
      body:JSON.stringify({role})
    });

    await refreshData();
    showToast('User role updated successfully.');
  } catch (error) {
    showToast(error.message, 'error');
    await refreshData().catch(()=>{});
  } finally {
    if (element) element.disabled = false;
  }
}

async function updateManagedUserStatus(userId, isActive, element) {
  if (state.role !== 'admin') return;

  const user = state.users.find(item => Number(item.id) === Number(userId));
  if (!user) return;

  if (user.username === state.user) {
    showToast('You cannot deactivate your own admin account.', 'error');
    return;
  }

  const verb = isActive ? 'activate' : 'deactivate';

  if (!window.confirm(`Are you sure you want to ${verb} ${user.username}?`)) return;

  if (element) element.disabled = true;

  try {
    await req(`/admin/users/${Number(userId)}`,{
      method:'PATCH',
      body:JSON.stringify({is_active:isActive})
    });

    await refreshData();
    showToast(`User ${user.username} ${isActive?'activated':'deactivated'}.`);
  } catch (error) {
    showToast(error.message, 'error');
    await refreshData().catch(()=>{});
  } finally {
    if (element) element.disabled = false;
  }
}

$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();
  $('login-error').textContent='';

  const button=event.currentTarget.querySelector('button[type="submit"]');
  button.disabled=true;
  button.querySelector('span').textContent='Signing in…';

  try {
    await authenticate($('username').value.trim(),$('password').value);
    $('password').value='';
  } catch(error) {
    $('login-error').textContent=error.message;
  } finally {
    button.disabled=false;
    button.querySelector('span').textContent='Sign in';
  }
});

$('logout').addEventListener('click',async()=>{
  try {
    if (state.token) await req('/auth/logout',{method:'POST'});
  } catch {
    /* clear local session even if API is unavailable */
  }

  clearSession('');
});

$('settings-logout').addEventListener('click',()=> $('logout').click());
$('user-create-form').addEventListener('submit',createManagedUser);

$('refresh-users-button').addEventListener('click',async()=>{
  if (state.role !== 'admin') return;

  const button=$('refresh-users-button');
  button.disabled=true;

  try {
    const rows=await req('/admin/users');
    state.users=Array.isArray(rows)?rows:[];
    state.usersError='';
    renderSettings();
    showToast('User list refreshed.');
  } catch(error) {
    state.usersError=error.message;
    renderSettings();
    showToast(error.message,'error');
  } finally {
    button.disabled=false;
  }
});

$('scan-form').addEventListener('submit',submitScan);
$('finding-validation-form').addEventListener('submit',validateFinding);
$('validate').addEventListener('click',validateDemo);
$('seed-button').addEventListener('click',seedDemo);
$('blue-seed-button').addEventListener('click',seedDemo);

$('refresh-button').addEventListener('click',()=>{
  refreshData()
    .then(()=>showToast('Workspace refreshed.'))
    .catch(error=>showToast(error.message,'error'));
});

$('global-search').addEventListener('input',event=>{
  state.search=event.target.value;
  renderAll();
});

[['findings-filter','findings'],['validations-filter','validations'],['audit-filter','audit']].forEach(([id])=>{
  $(id).addEventListener('input',event=>{
    state.search=event.target.value;
    renderAll();
  });
});

$('notification-button').addEventListener('click',()=>navigate('findings'));
$('sidebar-toggle').addEventListener('click',()=>document.body.classList.toggle('sidebar-collapsed'));
$('mobile-menu').addEventListener('click',()=>document.body.classList.toggle('sidebar-open'));

document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-page]');
  if (nav) navigate(nav.dataset.page);

  const go=event.target.closest('[data-go]');
  if (go) navigate(go.dataset.go);

  const route=event.target.closest('[data-route]');
  if (route) {
    event.preventDefault();
    navigate(route.dataset.route);
  }
});

document.addEventListener('change',event=>{
  const finding=event.target.closest('[data-finding-status]');
  if (finding) changeFinding(finding.dataset.findingStatus,finding.value,finding);

  const incident=event.target.closest('[data-incident-status]');
  if (incident) changeIncident(incident.dataset.incidentStatus,incident.value,incident);

  const userRole=event.target.closest('[data-user-role]');
  if (userRole) updateManagedUserRole(userRole.dataset.userRole,userRole.value,userRole);
});

document.addEventListener('click',event=>{
  const userAction=event.target.closest('[data-user-active]');
  if (userAction) {
    updateManagedUserStatus(
      userAction.dataset.userActive,
      userAction.dataset.nextActive==='true',
      userAction
    );
  }
});

document.addEventListener('keydown',event=>{
  if ((event.metaKey||event.ctrlKey) && event.key.toLowerCase()==='k') {
    event.preventDefault();
    $('global-search').focus();
  }

  if (event.key==='Escape') {
    document.body.classList.remove('sidebar-open');
  }
});

(async function restoreSession(){
  if (!state.token) return;

  try {
    const user=await req('/me');
    setAuthenticated({access_token:state.token,...user});
  } catch {
    clearSession('Your saved session is no longer valid. Sign in to continue.');
  }
})();
