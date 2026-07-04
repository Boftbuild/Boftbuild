const MODULES = ['Finance','Web App','Drive System','AI Workflow','Automation','Admin','Marketing','Architecture','Debug','Other'];
const CATEGORIES = ['Development','Architecture','Research','Debug','Planning','Documentation','Testing','Design','Admin'];
const RESULTS = ['Completed','Partial','Blocked','Research only'];
const IMPACTS = ['Low','Medium','High','Critical'];
const LOCAL_SESSIONS_KEY = 'boft-founder-time:sessions';
const LOCAL_SETTINGS_KEY = 'boft-founder-time:settings';

let sessions = [];
let settings = { hourlyRate: 75 };
let timerHandle = null;
let backendOnline = false;

const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init(){
  bindElements();
  hydrateSelects();
  bindEvents();
  loadLocalState();
  render();
  await syncFromBackend();
}

function bindElements(){
  [
    'dashboardCards','startForm','startBtn','projectInput','moduleInput','categoryInput','noteInput',
    'hourlyRateInput','timerPanel','timerState','timerValue','activeMeta','activeNote','endBtn',
    'endModal','endForm','keepRunningBtn','cancelEndBtn','historyBody','filterDate','filterModule',
    'filterCategory','filterImpact','filterResult','moduleHours','categoryHours','highImpactHours',
    'blockedHours','totalHoursMetric','totalValueMetric','syncState','syncBtn','exportJsonBtn','exportCsvBtn',
    'whatWasDone','whatChanged','filesAffected','problemsFound','solutionOrNextStep','knowledgeGained',
    'nextAction','resultInput','impactInput'
  ].forEach(id => els[id] = document.getElementById(id));
}

function hydrateSelects(){
  fillOptions(els.moduleInput, MODULES);
  fillOptions(els.categoryInput, CATEGORIES);
  fillOptions(els.filterModule, MODULES, true);
  fillOptions(els.filterCategory, CATEGORIES, true);
  fillOptions(els.filterResult, RESULTS, true);
  fillOptions(els.filterImpact, IMPACTS, true);
  fillOptions(els.resultInput, RESULTS);
  fillOptions(els.impactInput, IMPACTS);
  els.moduleInput.value = 'Web App';
  els.categoryInput.value = 'Development';
  els.impactInput.value = 'Medium';
}

function bindEvents(){
  els.startForm.addEventListener('submit', startSession);
  els.endBtn.addEventListener('click', () => els.endModal.classList.remove('hidden'));
  els.keepRunningBtn.addEventListener('click', closeEndModal);
  els.cancelEndBtn.addEventListener('click', closeEndModal);
  els.endForm.addEventListener('submit', completeSession);
  els.syncBtn.addEventListener('click', syncFromBackend);
  els.exportJsonBtn.addEventListener('click', exportJson);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.hourlyRateInput.addEventListener('change', updateHourlyRate);
  ['filterDate','filterModule','filterCategory','filterImpact','filterResult'].forEach(id => {
    els[id].addEventListener('change', renderHistory);
  });
  window.addEventListener('beforeunload', event => {
    if(!getActiveSession()) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

function loadLocalState(){
  sessions = readJson(LOCAL_SESSIONS_KEY, []);
  settings = readJson(LOCAL_SETTINGS_KEY, { hourlyRate: 75 });
  els.hourlyRateInput.value = settings.hourlyRate;
}

async function syncFromBackend(){
  setSyncState('Syncing...');
  try{
    const settingsResponse = await api('getSettings');
    const sessionsResponse = await api('listSessions');
    settings = settingsResponse.data || settings;
    sessions = sessionsResponse.data || [];
    backendOnline = true;
    persistLocal();
    setSyncState('Workspace synced');
    render();
  }catch(err){
    backendOnline = false;
    setSyncState('Local mode');
  }
}

async function startSession(event){
  event.preventDefault();
  if(getActiveSession()) return;

  const session = {
    id: crypto.randomUUID(),
    project: els.projectInput.value.trim() || 'BOFT System',
    module: els.moduleInput.value,
    category: els.categoryInput.value,
    note: els.noteInput.value.trim(),
    startTime: new Date().toISOString(),
    hourlyRate: Number(settings.hourlyRate || 75),
    status: 'active'
  };

  sessions = [session, ...sessions];
  persistLocal();
  render();

  try{
    const response = await api('createSession', { session });
    replaceSession(session.id, response.data);
    backendOnline = true;
    setSyncState('Workspace synced');
  }catch(err){
    backendOnline = false;
    setSyncState('Local mode');
  }

  els.noteInput.value = '';
}

async function completeSession(event){
  event.preventDefault();
  const active = getActiveSession();
  if(!active) return;

  const report = {
    whatWasDone: els.whatWasDone.value.trim(),
    whatChanged: els.whatChanged.value.trim(),
    filesAffected: els.filesAffected.value.trim(),
    problemsFound: els.problemsFound.value.trim(),
    solutionOrNextStep: els.solutionOrNextStep.value.trim(),
    result: els.resultInput.value,
    impact: els.impactInput.value,
    knowledgeGained: els.knowledgeGained.value.trim(),
    nextAction: els.nextAction.value.trim()
  };

  const endTime = new Date().toISOString();
  const completed = finishSession(active, report, endTime);
  replaceSession(active.id, completed);
  persistLocal();
  closeEndModal();
  els.endForm.reset();
  els.resultInput.value = 'Completed';
  els.impactInput.value = 'Medium';
  render();

  try{
    const response = await api('endSession', { id: active.id, report, endTime });
    replaceSession(active.id, response.data);
    persistLocal();
    backendOnline = true;
    setSyncState('Workspace synced');
    render();
  }catch(err){
    backendOnline = false;
    setSyncState('Local mode');
  }
}

async function updateHourlyRate(){
  settings.hourlyRate = Number(els.hourlyRateInput.value || 75);
  persistLocal();
  try{
    const response = await api('updateSettings', { settings });
    settings = response.data || settings;
    persistLocal();
    setSyncState('Workspace synced');
  }catch(err){
    setSyncState('Local mode');
  }
  render();
}

function finishSession(session, report, endTime){
  const durationMinutes = Math.max(0, Math.round((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 60000));
  const durationHours = Number((durationMinutes / 60).toFixed(2));
  const hourlyRate = Number(session.hourlyRate || settings.hourlyRate || 75);
  return {
    ...session,
    endTime,
    durationMinutes,
    durationHours,
    hourlyRate,
    internalValue: Number((durationHours * hourlyRate).toFixed(2)),
    status: 'completed',
    ...report,
    report
  };
}

function render(){
  renderDashboard();
  renderTimer();
  renderMetrics();
  renderHistory();
}

function renderDashboard(){
  const completed = getCompletedSessions();
  const todayHours = sumHours(completed.filter(session => isSameDay(session.startTime)));
  const weekHours = sumHours(completed.filter(session => isThisWeek(session.startTime)));
  const monthHours = sumHours(completed.filter(session => isThisMonth(session.startTime)));
  const totalHours = sumHours(completed);
  const totalValue = sumValue(completed);
  const cards = [
    ['Today hours', `${todayHours}h`, 'cyan'],
    ['This week hours', `${weekHours}h`, 'cyan'],
    ['This month hours', `${monthHours}h`, ''],
    ['Total hours', `${totalHours}h`, ''],
    ['Internal value total', money(totalValue), 'gold'],
    ['Most worked module', mostWorkedModule(completed), ''],
    ['Current momentum', momentum(weekHours), 'gold']
  ];

  els.dashboardCards.innerHTML = cards.map(([label,value,tone]) => `
    <article class="status-card ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join('');
}

function renderTimer(){
  const active = getActiveSession();
  els.startBtn.disabled = Boolean(active);
  els.projectInput.disabled = Boolean(active);
  els.moduleInput.disabled = Boolean(active);
  els.categoryInput.disabled = Boolean(active);
  els.noteInput.disabled = Boolean(active);

  if(timerHandle) clearInterval(timerHandle);

  if(!active){
    els.timerState.textContent = 'System idle';
    els.timerValue.textContent = '0m';
    els.activeMeta.innerHTML = '';
    els.activeNote.textContent = 'Start a focused work session to begin tracking founder value.';
    els.endBtn.classList.add('hidden');
    return;
  }

  els.timerState.textContent = 'Live session';
  els.activeMeta.innerHTML = [active.project, active.module, active.category].map(item => `<span>${escapeHtml(item)}</span>`).join('');
  els.activeNote.textContent = active.note || 'Session running.';
  els.endBtn.classList.remove('hidden');

  const tick = () => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(active.startTime).getTime()) / 60000));
    els.timerValue.textContent = formatDuration(minutes);
  };
  tick();
  timerHandle = setInterval(tick, 1000);
}

function renderMetrics(){
  const completed = getCompletedSessions();
  const totalHours = sumHours(completed);
  const totalValue = sumValue(completed);
  els.totalHoursMetric.textContent = `${totalHours}h`;
  els.totalValueMetric.textContent = money(totalValue);
  els.moduleHours.innerHTML = renderMetricRows(groupHours(completed, 'module'));
  els.categoryHours.innerHTML = renderMetricRows(groupHours(completed, 'category'));
  els.highImpactHours.textContent = `${sumHours(completed.filter(s => ['High','Critical'].includes(readImpact(s))))}h`;
  els.blockedHours.textContent = `${sumHours(completed.filter(s => readResult(s) === 'Blocked'))}h`;
}

function renderHistory(){
  const filtered = sessions.filter(session => {
    const report = session.report || session;
    return (!els.filterDate.value || session.startTime.slice(0,10) === els.filterDate.value)
      && (!els.filterModule.value || session.module === els.filterModule.value)
      && (!els.filterCategory.value || session.category === els.filterCategory.value)
      && (!els.filterImpact.value || report.impact === els.filterImpact.value)
      && (!els.filterResult.value || report.result === els.filterResult.value);
  });

  els.historyBody.innerHTML = filtered.map(session => {
    const report = session.report || session;
    return `<tr>
      <td>${dateOnly(session.startTime)}</td>
      <td>${timeOnly(session.startTime)}</td>
      <td>${session.endTime ? timeOnly(session.endTime) : 'Active'}</td>
      <td>${formatDuration(Number(session.durationMinutes || 0))}</td>
      <td>${escapeHtml(session.project)}</td>
      <td>${escapeHtml(session.module)}</td>
      <td>${escapeHtml(session.category)}</td>
      <td>${escapeHtml(report.result || '-')}</td>
      <td>${escapeHtml(report.impact || '-')}</td>
      <td>${escapeHtml(report.whatWasDone || session.note || '-')}</td>
      <td>${money(Number(session.internalValue || 0))}</td>
    </tr>`;
  }).join('');
}

function renderMetricRows(values){
  const rows = Object.entries(values).sort((a,b) => b[1] - a[1]);
  if(!rows.length) return '<p class="empty">No completed sessions yet.</p>';
  return rows.map(([label,value]) => `<div class="bar-row"><span>${escapeHtml(label)}</span><strong>${value}h</strong></div>`).join('');
}

async function api(action, payload = {}){
  const options = payload && Object.keys(payload).length
    ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action, ...payload }) }
    : { method:'GET' };
  const url = options.method === 'GET' ? `/api/founder-time?action=${encodeURIComponent(action)}` : '/api/founder-time';
  const response = await fetch(url, options);
  const data = await response.json();
  if(!response.ok || !data.ok) throw new Error(data.error || 'Founder Time API error');
  return data;
}

function persistLocal(){
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
}

function getActiveSession(){ return sessions.find(session => session.status === 'active'); }
function getCompletedSessions(){ return sessions.filter(session => session.status === 'completed'); }
function replaceSession(id, next){ sessions = sessions.map(session => session.id === id ? next : session); persistLocal(); }
function closeEndModal(){ els.endModal.classList.add('hidden'); }
function setSyncState(text){ els.syncState.textContent = text; }

function fillOptions(select, values, keepFirst){
  const first = keepFirst ? select.innerHTML : '';
  select.innerHTML = first + values.map(value => `<option value="${value}">${value}</option>`).join('');
}

function groupHours(items, key){
  return items.reduce((acc, session) => {
    acc[session[key]] = Number(((acc[session[key]] || 0) + Number(session.durationHours || 0)).toFixed(2));
    return acc;
  }, {});
}

function sumHours(items){ return Number(items.reduce((sum, s) => sum + Number(s.durationHours || 0), 0).toFixed(2)); }
function sumValue(items){ return Number(items.reduce((sum, s) => sum + Number(s.internalValue || 0), 0).toFixed(2)); }
function readResult(session){ return (session.report || session).result || ''; }
function readImpact(session){ return (session.report || session).impact || ''; }
function mostWorkedModule(items){
  const entries = Object.entries(groupHours(items, 'module')).sort((a,b) => b[1] - a[1]);
  return entries[0] ? entries[0][0] : 'No data';
}
function momentum(hours){ return hours >= 20 ? 'Excellent' : hours >= 10 ? 'Good' : hours >= 5 ? 'Low' : 'Cold'; }
function isSameDay(iso){ return new Date(iso).toDateString() === new Date().toDateString(); }
function isThisMonth(iso){ const d = new Date(iso), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }
function isThisWeek(iso){
  const d = new Date(iso), n = new Date(), start = new Date(n);
  start.setHours(0,0,0,0);
  start.setDate(n.getDate() - n.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}
function formatDuration(minutes){
  if(!minutes) return '0m';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function money(value){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value || 0); }
function dateOnly(iso){ return new Date(iso).toLocaleDateString(); }
function timeOnly(iso){ return new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }
function readJson(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) || fallback; }catch(err){ return fallback; } }
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}

function exportJson(){
  download('boft-founder-time-sessions.json', JSON.stringify(sessions, null, 2), 'application/json');
}
function exportCsv(){
  const headers = ['Date','Start','End','Duration','Project','Module','Category','Result','Impact','Summary','Internal value'];
  const rows = sessions.map(session => {
    const report = session.report || session;
    return [
      dateOnly(session.startTime), timeOnly(session.startTime), session.endTime ? timeOnly(session.endTime) : 'Active',
      session.durationMinutes || 0, session.project, session.module, session.category, report.result || '',
      report.impact || '', report.whatWasDone || session.note || '', session.internalValue || 0
    ];
  });
  download('boft-founder-time-sessions.csv', [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n'), 'text/csv');
}
function csvCell(value){
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
}
function download(filename, content, type){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Demo data is intentionally not seeded into the real Workspace sheet.
// Use this manually in the browser console only if a visual demo is needed.
function seedDemoData(){
  sessions = [
    finishSession({ id: crypto.randomUUID(), project:'BOFT System', module:'Architecture', category:'Planning', note:'Mapped tracker structure.', startTime:new Date(Date.now()-7200000).toISOString(), hourlyRate:75, status:'active' }, { whatWasDone:'Mapped tracker structure.', result:'Completed', impact:'High' }, new Date(Date.now()-3600000).toISOString()),
    finishSession({ id: crypto.randomUUID(), project:'BOFT System', module:'Web App', category:'Development', note:'Built session flow.', startTime:new Date(Date.now()-172000000).toISOString(), hourlyRate:75, status:'active' }, { whatWasDone:'Built session flow.', result:'Partial', impact:'Medium' }, new Date(Date.now()-164000000).toISOString()),
    finishSession({ id: crypto.randomUUID(), project:'BOFT System', module:'AI Workflow', category:'Research', note:'Reviewed automation options.', startTime:new Date(Date.now()-432000000).toISOString(), hourlyRate:75, status:'active' }, { whatWasDone:'Reviewed automation options.', result:'Research only', impact:'Low' }, new Date(Date.now()-428000000).toISOString())
  ];
  persistLocal();
  render();
}
