const API = 'http://127.0.0.1:8000/api';
const $ = (id) => document.getElementById(id);
const state = {
  token: localStorage.getItem('ps_token') || '', user: null, role: '', page: 'overview', search: '',
  dashboard: null, findings: [], events: [], detections: [], incidents: [], validations: [], audit: [], latestScan: null,
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
const pageTitles = {overview:'Overview',dashboard:'Security Dashboard',red:'Red Team',blue:'Blue Team',purple:'Purple Team',findings:'Findings',incidents:'Incidents',validations:'Validation History',audit:'Audit Logs',settings:'Settings'};
const findingStatuses = ['Open','In Progress','Fixed','Retest Required'];
const incidentStatuses = ['Open','In Progress','Fixed','Retest Required','Closed'];

function esc(value) { return String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function roleName(role = state.role) { return String(role || '').split('_').map(s => s[0]?.toUpperCase()+s.slice(1)).join(' '); }
function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
}
function dateShort(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleDateString([], {month:'short',day:'numeric'});
}
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`; }
function badge(value) {
  const key = String(value || '').toLowerCase().replaceAll(' ','-');
  return `<span class="badge badge-${esc(key)}">${esc(value || '—')}</span>`;
}
function showToast(message, tone='success') {
  const region = $('toast-region');
  const toast = document.createElement('div'); toast.className = `toast toast-${tone}`; toast.textContent = message;
  region.appendChild(toast); window.setTimeout(() => toast.remove(), 3800);
}
function showPageError(message) {
  $('page-error').textContent = message; $('page-error').hidden = !message;
}
function clearSession(message='') {
  state.token=''; state.user=null; state.role=''; localStorage.removeItem('ps_token');
  $('app').hidden=true; $('login-panel').hidden=false;
  $('login-error').textContent=message;
}
async function req(path, options={}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers:{...(options.body ? {'Content-Type':'application/json'} : {}), ...(state.token ? {Authorization:`Bearer ${state.token}`} : {}), ...(options.headers || {})},
    });
  } catch (error) { throw new Error('Backend unavailable. Start the PurpleShield API and try again.'); }
  let data={}; try { data=await response.json(); } catch { /* empty response */ }
  if (!response.ok) {
    if (response.status === 401 && state.token && path !== '/auth/login') clearSession('Your session expired. Sign in again.');
    throw new Error(data.detail || `Request failed (${response.status})`);
  }
  return data;
}

function setAuthenticated(data) {
  state.token=data.access_token; state.user=data.username; state.role=data.role;
  localStorage.setItem('ps_token',state.token);
  $('login-panel').hidden=true; $('app').hidden=false;
  $('profile-name').textContent=state.user; $('profile-role').textContent=roleName(); $('profile-initial').textContent=(state.user[0] || 'P').toUpperCase();
  $('settings-username').textContent=state.user; $('settings-role').textContent=roleName(); $('settings-avatar').textContent=(state.user[0] || 'P').toUpperCase();
  $('settings-permission-summary').textContent=`${roleName()} permissions are enforced by the API.`;
  applyRoleNavigation();
  refreshData().then(() => navigate('overview')).catch(error => { showPageError(error.message); navigate('overview'); });
}
function applyRoleNavigation() {
  const allowed=rolePages[state.role] || [];
  document.querySelectorAll('.nav-item').forEach(button => { button.hidden=!allowed.includes(button.dataset.page); });
  document.querySelectorAll('[data-go]').forEach(button => { button.hidden=!allowed.includes(button.dataset.go); });
  $('seed-button').hidden=!['admin','blue_analyst','purple_analyst'].includes(state.role);
  $('blue-seed-button').hidden=!['admin','blue_analyst'].includes(state.role);
}
async function authenticate(username, password) {
  const data=await req('/auth/login',{method:'POST',body:JSON.stringify({username,password})});
  setAuthenticated(data);
}

async function refreshData() {
  if (!state.token) return;
  $('loading-state').hidden=false; showPageError('');
  const role=state.role;
  const tasks=[
    req('/dashboard').then(data=>state.dashboard=data),
    req('/red/findings').then(data=>state.findings=data),
  ];
  if (['admin','blue_analyst'].includes(role)) {
    tasks.push(req('/blue/events').then(data=>state.events=data));
    tasks.push(req('/blue/incidents').then(data=>state.incidents=data));
  } else { state.events=[]; state.incidents=[]; }
  if (['admin','blue_analyst','purple_analyst'].includes(role)) tasks.push(req('/blue/detections').then(data=>state.detections=data));
  else state.detections=[];
  if (['admin','purple_analyst'].includes(role)) tasks.push(req('/purple/validations').then(data=>state.validations=data));
  else state.validations=[];
  if (role==='admin') tasks.push(req('/audit').then(data=>state.audit=data));
  else state.audit=[];
  try {
    await Promise.all(tasks);
    renderAll();
    $('dashboard-updated').textContent=`Updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
  } catch(error) { showPageError(error.message); throw error; }
  finally { $('loading-state').hidden=true; }
}

function navigate(page) {
  const allowed=rolePages[state.role] || [];
  if (!allowed.includes(page)) { showToast('This page is unavailable for your role.','error'); return; }
  state.page=page;
  document.querySelectorAll('.page-view').forEach(view => { view.hidden=view.dataset.view!==page; });
  document.querySelectorAll('.nav-item').forEach(item => { const active=item.dataset.page===page; item.classList.toggle('active',active); if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current'); });
  $('page-title').textContent=pageTitles[page] || 'PurpleShield';
  document.body.classList.remove('sidebar-open');
  renderAll();
}
function goTo(page) { navigate(page); }
function filtered(rows, fields) {
  const q=state.search.trim().toLowerCase();
  if (!q) return rows || [];
  return (rows || []).filter(row=>fields.some(field=>String(row[field] ?? '').toLowerCase().includes(q)));
}
function table(rows, columns, emptyTitle='No records yet', emptyNote='Records will appear here when the backend has data.') {
  if (!rows?.length) return `<div class="empty-state compact-empty"><span class="empty-icon">⌁</span><b>${esc(emptyTitle)}</b><small>${esc(emptyNote)}</small></div>`;
  return `<table><thead><tr>${columns.map(col=>`<th>${esc(col.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(col=>`<td>${col.render ? col.render(row[col.key],row) : esc(row[col.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function statusSelect(value, id, kind='finding') {
  const options=kind==='finding' ? findingStatuses : incidentStatuses;
  const attribute=kind==='finding' ? 'data-finding-status' : 'data-incident-status';
  return `<select class="status-select" aria-label="${kind==='finding'?'Finding':'Incident'} status" ${attribute}="${Number(id)}">${options.map(status=>`<option value="${esc(status)}"${status===value?' selected':''}>${esc(status)}</option>`).join('')}</select>`;
}

function metricCard(label, value, iconName, accent, note='From saved records') {
  const display=typeof value==='number' ? value.toLocaleString() : esc(value ?? '—');
  return `<article class="metric-card metric-${accent}"><div class="metric-top"><span class="metric-icon">${icon(iconName)}</span><span class="metric-note">${esc(note)}</span></div><div class="metric-value">${display}</div><div class="metric-label">${esc(label)}</div></article>`;
}
function statusCount(status) { return state.findings.filter(f=>f.status===status).length; }
function activityRecords() {
  const items=[];
  state.findings.forEach(f=>items.push({type:'Finding',title:`Open TCP port ${f.port} on ${f.target}`,detail:`${f.service || 'Unknown'} · ${f.status}`,time:f.created_at,icon:'flag',tone:'amber'}));
  state.events.forEach(e=>items.push({type:'Event',title:e.event_type,detail:`${e.username || 'Unknown user'} · ${e.details || e.source_ip || 'Security event'}`,time:e.created_at,icon:'pulse',tone:'blue'}));
  state.detections.forEach(d=>items.push({type:'Detection',title:d.rule_name,detail:`${d.severity || 'Unrated'} · ${d.description}`,time:d.created_at,icon:'shield',tone:'violet'}));
  state.incidents.forEach(i=>items.push({type:'Incident',title:i.title,detail:`${i.severity || 'Unrated'} · ${i.status}`,time:i.created_at,icon:'alert',tone:'red'}));
  state.validations.forEach(v=>items.push({type:'Validation',title:v.finding_id ? `Finding #${v.finding_id} retest` : v.scenario,detail:`${v.result} · ${v.observed}`,time:v.created_at,icon:'check',tone:v.result==='PASS'?'green':'amber'}));
  return items.sort((a,b)=>new Date(b.time||0)-new Date(a.time||0));
}
function activityList(items, limit=6) {
  const visible=items.slice(0,limit);
  if (!visible.length) return `<div class="empty-state compact-empty"><span class="empty-icon">⌁</span><b>No recent activity</b><small>Activity will appear when events, findings or validations are recorded.</small></div>`;
  return visible.map(item=>`<div class="activity-item"><span class="activity-icon tone-${item.tone}">${icon(item.icon)}</span><span class="activity-copy"><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></span><span class="activity-time">${esc(dateShort(item.time))}</span></div>`).join('');
}
function findingsTable(rows, compact=false, statuses=false) {
  const columns=[
    {key:'target',label:'Target IP'}, {key:'port',label:'Port'}, {key:'service',label:'Probable service'},
    {key:'severity',label:'Severity',render:v=>badge(v)},
    {key:'status',label:'Status',render:(v,r)=>statuses && ['admin','blue_analyst'].includes(state.role) ? statusSelect(v,r.id) : badge(v)},
  ];
  if (!compact) columns.push({key:'description',label:'Description',render:v=>`<span class="cell-description" title="${esc(v)}">${esc(v)}</span>`},{key:'created_at',label:'Created',render:v=>dateTime(v)});
  return table(rows,columns,'No findings yet','Run a localhost assessment to create a persisted Red Team finding.');
}
function validationsTable(rows) {
  return table(rows,[
    {key:'finding_id',label:'Finding ID',render:v=>v ? `#${esc(v)}` : '<span class="muted-cell">Synthetic</span>'},
    {key:'scenario',label:'Scenario'}, {key:'expected',label:'Expected result'}, {key:'observed',label:'Observed result'},
    {key:'result',label:'Outcome',render:v=>badge(v)}, {key:'technique_id',label:'ATT&CK',render:v=>v || '<span class="muted-cell">—</span>'},
    {key:'created_at',label:'Timestamp',render:v=>dateTime(v)},
  ],'No validation records','Run a finding retest or the synthetic repeated-login validation.');
}
function renderOverview() {
  const d=state.dashboard || {};
  const items=[['Persisted findings',d.findings,'flag','violet'],['Open for review',statusCount('Open'),'alert','amber'],['In progress',statusCount('In Progress'),'clock','blue'],['Validations recorded',d.validations,'check','green']];
  $('overview-stats').innerHTML=items.map(([label,value,iconName,tone])=>`<div class="overview-stat"><span class="overview-stat-icon tone-${tone}">${icon(iconName)}</span><span><b>${Number(value||0).toLocaleString()}</b><small>${esc(label)}</small></span></div>`).join('');
  $('overview-activity').innerHTML=activityList(activityRecords(),5);
}
function renderSeverityChart() {
  const severities=['Critical','High','Medium','Low','Info'];
  const counts=severities.map(severity=>({severity,count:state.findings.filter(f=>String(f.severity||'').toLowerCase()===severity.toLowerCase()).length}));
  const max=Math.max(1,...counts.map(x=>x.count));
  $('severity-chart').innerHTML=counts.map(item=>`<div class="severity-row"><span class="severity-label">${badge(item.severity)}</span><span class="severity-track"><i class="severity-fill severity-fill-${item.severity.toLowerCase()}" style="width:${item.count ? Math.max(5,Math.round(item.count/max*100)) : 0}%"></i></span><b>${item.count}</b></div>`).join('') + (state.findings.length ? `<div class="chart-footnote">${state.findings.length} findings in the current record set</div>` : `<div class="chart-footnote">No persisted findings to chart.</div>`);
}
function renderOperationalCharts() {
  const statuses=[
    {label:'Open',color:'#f5ae57'},
    {label:'In Progress',color:'#579eff'},
    {label:'Fixed',color:'#3bc797'},
    {label:'Retest Required',color:'#a18aff'},
  ];
  const total=state.findings.length;
  let cursor=0;
  const slices=statuses.map(item=>{
    const count=state.findings.filter(f=>f.status===item.label).length;
    const start=cursor; cursor+=total ? count/total*100 : 0;
    return {...item,count,start,end:cursor};
  });
  const donut=slices.length && total
    ? `conic-gradient(from -90deg,${slices.map(item=>`${item.color} ${item.start}% ${item.end}%`).join(',')})`
    : 'conic-gradient(#303442 0% 100%)';
  $('finding-status-chart').style.background=donut;
  $('finding-status-chart').innerHTML=`<span class="donut-hole"><b>${total.toLocaleString()}</b><small>Total</small></span>`;
  $('finding-status-chart').setAttribute('aria-label',`${total} findings distributed across remediation statuses`);
  $('finding-status-total').textContent=`${total.toLocaleString()} findings`;
  $('finding-status-legend').innerHTML=slices.map(item=>`<div class="status-legend-row"><span class="status-legend-dot" style="--legend-color:${item.color}"></span><span>${esc(item.label)}</span><b>${item.count.toLocaleString()}</b></div>`).join('');

  const canReadEvents=['admin','blue_analyst'].includes(state.role);
  if(!canReadEvents){
    $('event-type-total').textContent='Restricted';
    $('event-type-chart').innerHTML='<div class="unavailable-copy">Security event details are restricted for this role.</div>';
    return;
  }
  const groups=new Map();
  state.events.forEach(event=>groups.set(event.event_type,(groups.get(event.event_type)||0)+1));
  const types=[...groups.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
  const count=state.events.length, max=Math.max(1,...types.map(([,value])=>value));
  $('event-type-total').textContent=`${count.toLocaleString()} events`;
  $('event-type-chart').innerHTML=types.length ? types.map(([name,value])=>`<div class="event-type-row"><span title="${esc(name)}">${esc(name.replaceAll('_',' '))}</span><i><b style="width:${Math.round(value/max*100)}%"></b></i><strong>${value.toLocaleString()}</strong></div>`).join('') : '<div class="empty-state compact-empty"><b>No persisted events</b><small>Event categories appear after Blue Team records security events.</small></div>';
}
function renderDashboard() {
  const d=state.dashboard || {};
  const pass=state.validations.filter(v=>v.result==='PASS').length;
  const fail=state.validations.filter(v=>v.result==='FAIL').length;
  const validationAccess=['admin','purple_analyst'].includes(state.role);
  const metrics=[
    ['Total findings',d.findings,'flag','violet'],['Open findings',statusCount('Open'),'alert','amber'],
    ['In progress',statusCount('In Progress'),'clock','blue'],['Fixed findings',statusCount('Fixed'),'check','green'],
    ['Retest required',statusCount('Retest Required'),'refresh','orange'],
    ['Validation PASS',validationAccess?pass:'—','check','green',validationAccess?'From saved records':'Role restricted'],
    ['Validation FAIL',validationAccess?fail:'—','alert','red',validationAccess?'From saved records':'Role restricted'],
  ];
  $('metric-grid').innerHTML=metrics.map(x=>metricCard(...x)).join('');
  renderSeverityChart(); renderOperationalCharts();
  const activity=filtered(activityRecords(),['type','title','detail']);
  $('dashboard-activity').innerHTML=activityList(activity,8); $('activity-count').textContent=`${activity.length} records`;
  const lastScan=state.latestScan;
  $('red-summary').innerHTML=`<div class="summary-number">${Number(d.findings||0).toLocaleString()}</div><div class="summary-line"><span>Saved findings</span><b>${statusCount('Open')} open</b></div><div class="summary-line"><span>Last assessment</span><b>${lastScan ? `${lastScan.openCount} open / ${lastScan.results.length} ports` : 'Not run this session'}</b></div>`;
  const detectionAccessible=['admin','blue_analyst','purple_analyst'].includes(state.role);
  $('blue-summary').innerHTML=detectionAccessible ? `<div class="summary-number">${Number(d.detections||0).toLocaleString()}</div><div class="summary-line"><span>Security detections</span><b>${state.detections.filter(x=>x.status==='Open').length} open</b></div><div class="summary-line"><span>Open incidents</span><b>${Number(d.open_incidents||0).toLocaleString()}</b></div>` : `<div class="unavailable-copy">Detection details are restricted for this role.</div>`;
  const validationAccessible=['admin','purple_analyst'].includes(state.role);
  const gap=state.validations.filter(v=>v.result==='GAP').length;
  $('purple-summary').innerHTML=validationAccessible ? `<div class="summary-number">${Number(d.validations||0).toLocaleString()}</div><div class="summary-line"><span>PASS / FAIL</span><b><span class="text-good">${pass}</span> / <span class="text-bad">${fail}</span></b></div><div class="summary-line"><span>Coverage gaps</span><b>${gap}</b></div>` : `<div class="unavailable-copy">Validation details are restricted for this role.</div>`;
  $('dashboard-findings').innerHTML=findingsTable(filtered(state.findings,['target','port','service','severity','description','status']),true,false);
  $('dashboard-validations').innerHTML=validationAccess ? validationsTable(filtered(state.validations,['scenario','expected','observed','result','technique_id'])) : `<div class="unavailable-copy">Validation history is restricted for this role.</div>`;
  $('dashboard-incidents').innerHTML=['admin','blue_analyst'].includes(state.role) ? incidentTable(filtered(state.incidents,['title','description','severity','status']).slice(0,5)) : `<div class="unavailable-copy">Incident details are restricted for this role.</div>`;
}
function renderRed() {
  $('red-finding-total').textContent=state.findings.length.toLocaleString();
  const scan=state.latestScan;
  $('scan-result-count').textContent=scan ? `${scan.results.length} ports checked` : 'No assessment yet';
  $('scan-results-table').innerHTML=scan ? table(scan.results.map(item=>{
    const finding=state.findings.find(f=>f.target===scan.target && Number(f.port)===Number(item.port));
    return {...item,target:scan.target,service:item.state==='open' ? (finding?.service || 'Unknown') : '—',severity:item.state==='open' ? finding?.severity : '—',status:item.state==='open' ? finding?.status : '—'};
  }),[
    {key:'target',label:'Target IP'}, {key:'port',label:'Port'}, {key:'state',label:'TCP state',render:v=>badge(v)},
    {key:'service',label:'Probable service'}, {key:'severity',label:'Severity',render:v=>v==='—' ? v : badge(v)},
    {key:'status',label:'Finding status',render:v=>v==='—' ? v : badge(v)},
  ],'No results','No port results were returned.') : `<div class="empty-state compact-empty"><span class="empty-icon">⌁</span><b>No assessment in this session</b><small>Start a localhost assessment to see open and closed TCP results here.</small></div>`;
  $('red-findings-table').innerHTML=findingsTable(filtered(state.findings,['target','port','service','severity','description','status']),false,false);
}
function renderBlue() {
  const d=state.dashboard || {};
  $('blue-mini-stats').innerHTML=[['Security events',d.events,'pulse','blue'],['Detections',d.detections,'shield','violet'],['Open incidents',d.open_incidents,'alert','red']].map(([label,value,iconName,tone])=>miniMetric(label,value,iconName,tone)).join('');
  $('blue-findings-table').innerHTML=findingsTable(filtered(state.findings,['target','port','service','severity','description','status']),false,true);
  $('blue-detections-table').innerHTML=table(filtered(state.detections,['rule_name','severity','description','status']),[
    {key:'rule_name',label:'Rule'}, {key:'severity',label:'Severity',render:v=>badge(v)}, {key:'description',label:'Details',render:v=>`<span class="cell-description">${esc(v)}</span>`}, {key:'status',label:'Status',render:v=>badge(v)},
  ],'No detections recorded','Synthetic detections appear after events are ingested or seeded.');
  $('blue-incidents-table').innerHTML=incidentTable(filtered(state.incidents,['title','description','severity','status']));
  $('blue-events-table').innerHTML=eventsTable(filtered(state.events,['event_type','username','source_ip','details','created_at']));
}
function miniMetric(label,value,iconName,tone) { return `<article class="mini-metric"><span class="mini-metric-icon tone-${tone}">${icon(iconName)}</span><span><b>${Number(value||0).toLocaleString()}</b><small>${esc(label)}</small></span></article>`; }
function incidentTable(rows) {
  return table(rows,[
    {key:'title',label:'Incident',render:(v,r)=>`<b class="table-primary">${esc(v)}</b><small class="table-secondary">${esc(r.description)}</small>`},
    {key:'severity',label:'Severity',render:v=>badge(v)}, {key:'status',label:'Status',render:(v,r)=>['admin','blue_analyst'].includes(state.role) ? statusSelect(v,r.id,'incident') : badge(v)},
    {key:'detection_ids',label:'Related detections',render:v=>relationPills(v,'D')}, {key:'finding_ids',label:'Related findings',render:v=>relationPills(v,'F')},
    {key:'created_at',label:'Created',render:v=>dateTime(v)},
  ],'No incidents recorded','Incidents are generated by the repeated failed-login detection rule.');
}
function relationPills(ids,prefix) { return Array.isArray(ids)&&ids.length ? ids.map(id=>`<span class="relation-pill">${prefix}#${esc(id)}</span>`).join(' ') : '<span class="muted-cell">None linked</span>'; }
function eventsTable(rows) {
  return table(rows,[{key:'event_type',label:'Event',render:v=>badge(v)},{key:'username',label:'User'},{key:'source_ip',label:'Source IP'},{key:'details',label:'Details',render:v=>`<span class="cell-description">${esc(v)}</span>`},{key:'created_at',label:'Timestamp',render:v=>dateTime(v)}],'No security events','Ingest a synthetic event or load the demo events to populate this stream.');
}
function renderPurple() {
  const select=$('finding-to-validate');
  const prior=select.value;
  const findings=state.findings;
  select.innerHTML='<option value="">Choose a persisted finding…</option>'+findings.map(f=>`<option value="${Number(f.id)}">#${Number(f.id)} · ${esc(f.target)}:${Number(f.port)} · ${esc(f.service)} · ${esc(f.status)}</option>`).join('');
  if (findings.some(f=>String(f.id)===prior)) select.value=prior;
  $('purple-validations-table').innerHTML=validationsTable(filtered(state.validations,['scenario','expected','observed','result','technique_id','finding_id']));
}
function renderFindings() {
  $('findings-total').textContent=`${state.findings.length} findings`;
  $('findings-table').innerHTML=findingsTable(filtered(state.findings,['target','port','service','severity','description','status']),false,['admin','blue_analyst'].includes(state.role));
}
function renderIncidents() {
  const open=state.incidents.filter(i=>i.status==='Open').length;
  const working=state.incidents.filter(i=>i.status==='In Progress').length;
  const closed=state.incidents.filter(i=>['Fixed','Closed'].includes(i.status)).length;
  $('incident-stats').innerHTML=[['Open',open,'alert','red'],['In progress',working,'clock','amber'],['Resolved',closed,'check','green']].map(([label,value,iconName,tone])=>miniMetric(label,value,iconName,tone)).join('');
  $('incidents-table').innerHTML=incidentTable(filtered(state.incidents,['title','description','severity','status']));
}
function renderValidations() {
  const pass=state.validations.filter(v=>v.result==='PASS').length;
  const fail=state.validations.filter(v=>v.result==='FAIL').length;
  const gaps=state.validations.filter(v=>v.result==='GAP').length;
  $('validation-stats').innerHTML=[['PASS',pass,'check','green'],['FAIL',fail,'alert','red'],['Coverage gaps',gaps,'flag','amber']].map(([label,value,iconName,tone])=>miniMetric(label,value,iconName,tone)).join('');
  $('validations-table').innerHTML=validationsTable(filtered(state.validations,['scenario','expected','observed','result','technique_id','finding_id']));
}
function renderAudit() {
  $('audit-table').innerHTML=table(filtered(state.audit,['username','action','details','created_at']),[
    {key:'created_at',label:'Timestamp',render:v=>dateTime(v)}, {key:'username',label:'User'}, {key:'action',label:'Action',render:v=>badge(v)}, {key:'details',label:'Details',render:v=>`<span class="cell-description">${esc(v)}</span>`},
  ],'No audit records','Authenticated actions will appear here when recorded by the backend.');
}
function renderSettings() { /* Account data is populated from the authenticated /api/me response. */ }
function renderAll() {
  if (!state.user) return;
  renderOverview(); renderDashboard(); renderRed(); renderBlue(); renderPurple(); renderFindings(); renderIncidents(); renderValidations(); renderAudit(); renderSettings();
  const open=state.dashboard?.open_findings || 0;
  $('nav-open-findings').textContent=Number(open).toLocaleString(); $('nav-open-findings').hidden=!open;
  $('notification-dot').hidden=!open;
}

async function submitScan(event) {
  event.preventDefault();
  const target=$('scan-target').value.trim();
  const raw=$('ports').value.split(',').map(value=>value.trim());
  if (!target) { $('scan-result').textContent='Enter a localhost IP address.'; return; }
  if (!['127.0.0.1','::1'].includes(target)) { $('scan-result').textContent='Only 127.0.0.1 or ::1 is allowed.'; return; }
  if (!raw.length || raw.length>20 || raw.some(value=>!/^\d+$/.test(value)||Number(value)<1||Number(value)>65535)) { $('scan-result').textContent='Enter 1–20 comma-separated port numbers between 1 and 65535.'; return; }
  const ports=raw.map(Number);
  $('scan-button').disabled=true; $('scan-button').innerHTML='<span class="spinner spinner-small"></span> Assessing…'; $('scan-result').textContent='Checking the specified localhost ports…';
  try {
    const data=await req('/red/assess-local',{method:'POST',body:JSON.stringify({target,ports})});
    state.latestScan={target:data.target,results:data.results,openCount:data.results.filter(x=>x.state==='open').length};
    await refreshData();
    $('scan-result').textContent=`${data.results.length} TCP ports checked. ${state.latestScan.openCount} open.`;
    showToast('Local assessment completed.','success');
  } catch(error) { $('scan-result').textContent=error.message; showToast(error.message,'error'); }
  finally { $('scan-button').disabled=false; $('scan-button').innerHTML=`${icon('target')} Start localhost assessment`; renderRed(); }
}
async function changeFinding(id,status,element) {
  if (!findingStatuses.includes(status)) return;
  if (element) element.disabled=true;
  try { await req(`/blue/findings/${Number(id)}`,{method:'PATCH',body:JSON.stringify({status})}); await refreshData(); showToast(`Finding #${id} updated to ${status}.`); }
  catch(error) { showToast(error.message,'error'); await refreshData().catch(()=>{}); }
  finally { if (element) element.disabled=false; }
}
async function changeIncident(id,status,element) {
  if (element) element.disabled=true;
  try { await req(`/blue/incidents/${Number(id)}`,{method:'PATCH',body:JSON.stringify({status})}); await refreshData(); showToast('Incident status saved.'); }
  catch(error) { showToast(error.message,'error'); await refreshData().catch(()=>{}); }
  finally { if (element) element.disabled=false; }
}
async function validateFinding(event) {
  event.preventDefault();
  const id=Number($('finding-to-validate').value);
  if (!id) { showToast('Select a finding to retest.','error'); return; }
  $('retest-button').disabled=true; $('retest-button').textContent='Retesting…';
  try {
    const result=await req('/purple/validate-finding',{method:'POST',body:JSON.stringify({finding_id:id})});
    $('finding-validation-result').innerHTML=`<div class="result-card result-${esc(String(result.result).toLowerCase())}"><div class="result-heading"><span class="result-mark">${result.result==='PASS'?'✓':'!'}</span><div><b>${esc(result.result)}</b><small>Finding #${Number(result.finding_id)} · ${esc(dateTime(result.timestamp))}</small></div></div><div class="result-pair"><span>Expected</span><b>${esc(result.expected)}</b></div><div class="result-pair"><span>Observed</span><b>${esc(result.observed)}</b></div><div class="result-footnote">Finding status remains ${esc(result.finding_status)}.</div></div>`;
    await refreshData(); showToast(`Finding retest recorded: ${result.result}.`,result.result==='PASS'?'success':'warning');
  } catch(error) { $('finding-validation-result').innerHTML=`<div class="inline-error">${esc(error.message)}</div>`; }
  finally { $('retest-button').disabled=false; $('retest-button').innerHTML=`${icon('check')} Validate remediation`; }
}
async function validateDemo() {
  const button=$('validate'); button.disabled=true; button.textContent='Checking detection…';
  try {
    const result=await req('/purple/validate-demo',{method:'POST'});
    const outcome=result.result==='PASS'?'pass':'gap';
    $('validation-result').innerHTML=`<div class="synthetic-outcome synthetic-${outcome}"><span>${result.result==='PASS'?'✓':'!'}</span><div><b>${esc(result.result)}</b><small>Expected: ${esc(result.expected)} · Observed: ${esc(result.observed)} · ${esc(result.mitre_attack_id)}</small></div></div>`;
    await refreshData(); showToast(`Synthetic validation recorded: ${result.result}.`,result.result==='PASS'?'success':'warning');
  } catch(error) { $('validation-result').innerHTML=`<p class="inline-error">${esc(error.message)}</p>`; }
  finally { button.disabled=false; button.innerHTML='Run synthetic validation <span>→</span>'; }
}
async function seedDemo() {
  try { const result=await req('/demo/seed',{method:'POST'}); await refreshData(); showToast(result.message); }
  catch(error) { showToast(error.message,'error'); }
}

$('login-form').addEventListener('submit',async event=>{
  event.preventDefault(); $('login-error').textContent='';
  const button=event.currentTarget.querySelector('button[type="submit"]'); button.disabled=true; button.querySelector('span').textContent='Signing in…';
  try { await authenticate($('username').value.trim(),$('password').value); $('password').value=''; }
  catch(error) { $('login-error').textContent=error.message; }
  finally { button.disabled=false; button.querySelector('span').textContent='Sign in'; }
});
$('logout').addEventListener('click',async()=>{
  try { if (state.token) await req('/auth/logout',{method:'POST'}); } catch { /* clear local session even if API is unavailable */ }
  clearSession('');
});
$('settings-logout').addEventListener('click',()=> $('logout').click());
$('scan-form').addEventListener('submit',submitScan);
$('finding-validation-form').addEventListener('submit',validateFinding);
$('validate').addEventListener('click',validateDemo);
$('seed-button').addEventListener('click',seedDemo);
$('blue-seed-button').addEventListener('click',seedDemo);
$('refresh-button').addEventListener('click',()=>refreshData().then(()=>showToast('Workspace refreshed.')).catch(error=>showToast(error.message,'error')));
$('global-search').addEventListener('input',event=>{state.search=event.target.value;renderAll();});
[['findings-filter','findings'],['validations-filter','validations'],['audit-filter','audit']].forEach(([id])=>$(id).addEventListener('input',event=>{state.search=event.target.value;renderAll();}));
$('notification-button').addEventListener('click',()=>navigate('findings'));
$('sidebar-toggle').addEventListener('click',()=>document.body.classList.toggle('sidebar-collapsed'));
$('mobile-menu').addEventListener('click',()=>document.body.classList.toggle('sidebar-open'));
document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-page]'); if (nav) navigate(nav.dataset.page);
  const go=event.target.closest('[data-go]'); if (go) navigate(go.dataset.go);
  const route=event.target.closest('[data-route]'); if (route) { event.preventDefault(); navigate(route.dataset.route); }
});
document.addEventListener('change',event=>{
  const finding=event.target.closest('[data-finding-status]'); if (finding) changeFinding(finding.dataset.findingStatus,finding.value,finding);
  const incident=event.target.closest('[data-incident-status]'); if (incident) changeIncident(incident.dataset.incidentStatus,incident.value,incident);
});
document.addEventListener('keydown',event=>{
  if ((event.metaKey||event.ctrlKey) && event.key.toLowerCase()==='k') { event.preventDefault(); $('global-search').focus(); }
  if (event.key==='Escape') { document.body.classList.remove('sidebar-open'); }
});

(async function restoreSession(){
  if (!state.token) return;
  try { const user=await req('/me'); setAuthenticated({access_token:state.token,...user}); }
  catch { clearSession('Your saved session is no longer valid. Sign in to continue.'); }
})();
