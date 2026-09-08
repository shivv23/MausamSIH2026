"""Admin dashboard HTML (self-contained, no build step).

Served at GET /admin. Uses Tailwind via CDN and vanilla JS to call the
/admin/api JSON endpoints. All state is DB-backed via the admin store.
"""
from __future__ import annotations


def dashboard_html() -> str:
    return _HTML


_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mausam Admin — IMD Operators</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; }
  .hidden { display: none !important; }
  .tab-btn.active { background:#2563eb; color:#fff; }
  table.data { width:100%; border-collapse:collapse; }
  table.data th { text-align:left; padding:8px 10px; font-size:12px; color:#475569; }
  table.data td { padding:8px 10px; font-size:13px; border-top:1px solid #e2e8f0; }
  .badge { display:inline-block; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; }
</style>
</head>
<body class="bg-slate-100 min-h-screen">

<!-- ============ LOGIN VIEW ============ -->
<div id="view-login" class="flex items-center justify-center min-h-screen">
  <div class="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold">M</div>
      <div>
        <div class="text-lg font-bold text-slate-800">Mausam Admin</div>
        <div class="text-xs text-slate-500">IMD Operators Console</div>
      </div>
    </div>
    <div id="login-err" class="hidden bg-red-50 text-red-700 text-sm rounded p-2 mb-3"></div>
    <label class="block text-sm text-slate-600 mb-1">Username</label>
    <input id="login-username" type="text" class="w-full border rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin" />
    <label class="block text-sm text-slate-600 mb-1">Password</label>
    <input id="login-password" type="password" class="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
    <button onclick="doLogin()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg">Sign in</button>
  </div>
</div>

<!-- ============ DASHBOARD VIEW ============ -->
<div id="view-dash" class="hidden flex">
  <!-- Sidebar -->
  <aside class="w-60 bg-slate-900 text-slate-200 h-screen sticky top-0 flex flex-col">
    <div class="p-4 flex items-center gap-3 border-b border-slate-700">
      <div class="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">M</div>
      <div>
        <div class="font-bold text-white">Mausam Admin</div>
        <div class="text-[11px] text-slate-400">IMD Console</div>
      </div>
    </div>
    <nav class="flex-1 p-3 space-y-1">
      <button class="tab-btn w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-800" data-tab="overview" onclick="switchTab('overview')">📊 Overview</button>
      <button class="tab-btn w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-800" data-tab="users" onclick="switchTab('users')">👥 Users</button>
      <button class="tab-btn w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-800" data-tab="alerts" onclick="switchTab('alerts')">🚨 Alerts</button>
      <button class="tab-btn w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-800" data-tab="activities" onclick="switchTab('activities')">🏃 Activities</button>
    </nav>
    <div class="p-3 border-t border-slate-700">
      <div id="whoami" class="text-xs text-slate-400 mb-2"></div>
      <button onclick="doLogout()" class="w-full bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 rounded-lg">Logout</button>
    </div>
  </aside>

  <!-- Main -->
  <main class="flex-1 p-6 overflow-y-auto">
    <!-- OVERVIEW -->
    <section id="tab-overview">
      <h1 class="text-2xl font-bold text-slate-800 mb-4">Dashboard Overview</h1>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-xl shadow p-5">
          <div class="text-sm text-slate-500">Total Users</div>
          <div id="ov-users" class="text-3xl font-bold text-slate-800">—</div>
        </div>
        <div class="bg-white rounded-xl shadow p-5">
          <div class="text-sm text-slate-500">Active Alerts</div>
          <div id="ov-alerts" class="text-3xl font-bold text-slate-800">—</div>
        </div>
        <div class="bg-white rounded-xl shadow p-5">
          <div class="text-sm text-slate-500">Cities Covered</div>
          <div id="ov-cities" class="text-3xl font-bold text-slate-800">—</div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <h2 class="font-semibold text-slate-700 mb-3">Users by City</h2>
        <div id="ov-citylist" class="space-y-2"></div>
      </div>
    </section>

    <!-- USERS -->
    <section id="tab-users" class="hidden">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-slate-800">Users</h1>
        <input id="user-q" oninput="loadUsers(0, this.value)" class="border rounded-lg px-3 py-2 w-64" placeholder="Search by name / id / city..." />
      </div>
      <div class="bg-white rounded-xl shadow overflow-hidden">
        <div class="overflow-x-auto"><table class="data" id="users-table">
          <thead><tr><th>ID</th><th>Name</th><th>Personas</th><th>Language</th><th>City</th><th>Created</th><th></th></tr></thead>
          <tbody id="users-body"></tbody>
        </table></div>
      </div>
    </section>

    <!-- ALERTS -->
    <section id="tab-alerts" class="hidden">
      <h1 class="text-2xl font-bold text-slate-800 mb-4">Alerts</h1>
      <div class="bg-white rounded-xl shadow p-5 mb-6">
        <h2 class="font-semibold text-slate-700 mb-3">Publish Alert</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><label class="text-xs text-slate-500">Severity</label>
            <select id="a-severity" class="w-full border rounded-lg px-3 py-2">
              <option value="green">Green</option><option value="yellow">Yellow</option>
              <option value="orange" selected>Orange</option><option value="red">Red</option>
            </select></div>
          <div><label class="text-xs text-slate-500">Event Type</label>
            <select id="a-type" class="w-full border rounded-lg px-3 py-2">
              <option value="heavy_rain">Heavy Rain</option><option value="cyclone">Cyclone</option>
              <option value="heatwave">Heatwave</option><option value="thunderstorm">Thunderstorm</option>
              <option value="flood">Flood</option>
            </select></div>
          <div><label class="text-xs text-slate-500">Region (city)</label>
            <input id="a-region" class="w-full border rounded-lg px-3 py-2" placeholder="Pune" /></div>
          <div class="col-span-2"><label class="text-xs text-slate-500">Headline</label>
            <input id="a-headline" class="w-full border rounded-lg px-3 py-2" placeholder="Heavy rain expected in low-lying areas" /></div>
          <div><label class="text-xs text-slate-500">Radius (km)</label>
            <input id="a-radius" type="number" value="40" class="w-full border rounded-lg px-3 py-2" /></div>
          <div><label class="text-xs text-slate-500">Valid (hours)</label>
            <input id="a-hours" type="number" value="24" class="w-full border rounded-lg px-3 py-2" /></div>
          <div class="col-span-2"><label class="text-xs text-slate-500">Detail</label>
            <input id="a-detail" class="w-full border rounded-lg px-3 py-2" placeholder="Optional advisory detail" /></div>
        </div>
        <button onclick="createAlert()" class="mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg">Publish Alert</button>
        <span id="alert-msg" class="ml-3 text-sm"></span>
      </div>
      <div class="bg-white rounded-xl shadow overflow-hidden">
        <h2 class="font-semibold text-slate-700 p-5 pb-2">Active Alerts</h2>
        <div class="overflow-x-auto"><table class="data">
          <thead><tr><th>Severity</th><th>Event</th><th>Headline</th><th>Region</th><th>Issued</th><th>Valid Until</th><th></th></tr></thead>
          <tbody id="alerts-body"></tbody>
        </table></div>
      </div>
    </section>

    <!-- ACTIVITIES -->
    <section id="tab-activities" class="hidden">
      <h1 class="text-2xl font-bold text-slate-800 mb-4">User Activities</h1>
      <div class="bg-white rounded-xl shadow p-4 mb-4 flex items-center gap-3">
        <label class="text-sm text-slate-600">User ID</label>
        <input id="act-user" class="border rounded-lg px-3 py-2 w-64" placeholder="Enter user id" />
        <button onclick="loadActivities()" class="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg">Load</button>
      </div>
      <div class="bg-white rounded-xl shadow overflow-hidden">
        <div class="overflow-x-auto"><table class="data">
          <thead><tr><th>Activity ID</th><th>Type</th><th>Label</th><th>Days</th><th>Preferred</th><th></th></tr></thead>
          <tbody id="activities-body"></tbody>
        </table></div>
      </div>
    </section>

    <!-- IMPACT MODAL -->
    <div id="impact-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[80vh] overflow-y-auto p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-bold text-slate-800" id="impact-title">Impact</h2>
          <button onclick="closeImpact()" class="text-slate-500 hover:text-slate-800 text-xl">×</button>
        </div>
        <div id="impact-summary" class="text-sm text-slate-600 mb-3"></div>
        <table class="data">
          <thead><tr><th>User</th><th>City</th><th>Status</th><th>Distance</th></tr></thead>
          <tbody id="impact-body"></tbody>
        </table>
      </div>
    </div>
  </main>
</div>

<script>
const API = '/api/admin';
let currentTab = 'overview';

// ---------- auth ----------
function getCookie(n){const m=('; '+document.cookie).split('; '+n+'=');return m.length===2?decodeURIComponent(m.pop().split(';').shift()):'';}
function setMsg(el, txt, ok){ el.textContent=txt; el.style.color = ok?'#16a34a':'#dc2626'; }

async function doLogin(){
  const err=document.getElementById('login-err');
  err.classList.add('hidden');
  document.getElementById('login-password').focus();
  const res = await fetch(API+'/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:document.getElementById('login-username').value.trim(),
      password:document.getElementById('login-password').value})});
  if(res.ok){ await boot(); } else {
    const d=await res.json(); err.textContent=d.detail||'Login failed'; err.classList.remove('hidden');
  }
}
async function doLogout(){ await fetch(API+'/logout',{method:'POST'}); location.reload(); }

async function boot(){
  const me = await (await fetch(API+'/me')).json();
  document.getElementById('whoami').textContent = me.display_name||me.username+' ('+me.role+')';
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-dash').classList.remove('hidden');
  document.getElementById('view-dash').classList.add('flex');
  loadOverview();
}

// ---------- tabs ----------
function switchTab(t){
  currentTab=t;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===t));
  ['overview','users','alerts','activities'].forEach(x=>document.getElementById('tab-'+x).classList.toggle('hidden', x!==t));
  if(t==='overview') loadOverview();
  if(t==='users') loadUsers(0,'');
  if(t==='alerts') loadAlerts();
}

// ---------- overview ----------
async function loadOverview(){
  const d = await (await fetch(API+'/overview')).json();
  document.getElementById('ov-users').textContent=d.users_total;
  document.getElementById('ov-alerts').textContent=d.alerts_active;
  document.getElementById('ov-cities').textContent=d.cities.length;
  const citylist=document.getElementById('ov-citylist'); citylist.innerHTML='';
  const max=Math.max(1,...d.cities.map(c=>c.count));
  d.cities.forEach(c=>{
    citylist.innerHTML+=`<div class="flex items-center gap-2"><span class="w-28 text-sm">${esc(c.city)}</span>
      <div class="flex-1 h-4 bg-slate-100 rounded"><div class="h-4 bg-blue-500 rounded" style="width:${(c.count/max*100).toFixed(1)}%"></div></div>
      <span class="text-sm font-semibold">${c.count}</span></div>`;
  });
}

// ---------- users ----------
async function loadUsers(offset, q){
  const url=API+'/users?limit=200&offset='+offset+(q?'&q='+encodeURIComponent(q):'');
  const d = await (await fetch(url)).json();
  const tb=document.getElementById('users-body'); tb.innerHTML='';
  if(!d.users.length){tb.innerHTML='<tr><td colspan="7" class="text-center text-slate-400 py-6">No users</td></tr>';}
  d.users.forEach(u=>{
    tb.innerHTML+=`<tr>
      <td class="font-mono text-xs">${esc(u.id)}</td>
      <td>${esc(u.display_name||'—')}</td>
      <td>${(u.personas||[]).map(p=>`<span class="badge bg-blue-100 text-blue-700 mr-1">${esc(p)}</span>`).join('')||'—'}</td>
      <td>${esc(u.language||'en')}</td>
      <td>${esc(u.city||'—')}</td>
      <td class="text-xs">${u.created_at?esc(u.created_at.replace('T',' ').slice(0,16)):'—'}</td>
      <td class="whitespace-nowrap">
        <button onclick="openEditUser('${esc(u.id)}')" class="text-blue-600 hover:underline text-sm">Edit</button>
        <button onclick="delUser('${esc(u.id)}')" class="text-red-600 hover:underline text-sm ml-2">Delete</button>
      </td></tr>`;
  });
}
function openEditUser(id){
  const name=prompt('Display name:', ''); if(name===null)return;
  const lang=prompt('Language (en/hi/ta/te/bn/mr/gu/kn/ml/or/pa):','en'); if(lang===null)return;
  const city=prompt('City:',''); if(city===null)return;
  const personas=prompt('Personas (comma-sep: health,fitness,beach,travel,parent,agriculture,commuter,events):','commuter'); if(personas===null)return;
  fetch(API+'/users/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    display_name:name || null, language:lang || 'en', city:city || null,
    personas:personas.split(',').map(s=>s.trim()).filter(Boolean)})}).then(r=>{ if(r.ok) loadUsers(0,''); else alert('Update failed'); });
}
async function delUser(id){ if(!confirm('Delete user '+id+' and their activities?'))return; await fetch(API+'/users/'+id,{method:'DELETE'}); loadUsers(0,''); }

// ---------- alerts ----------
async function loadAlerts(){
  const d = await (await fetch(API+'/alerts')).json();
  const tb=document.getElementById('alerts-body'); tb.innerHTML='';
  if(!d.alerts.length){tb.innerHTML='<tr><td colspan="7" class="text-center text-slate-400 py-6">No active alerts</td></tr>';}
  d.alerts.forEach(a=>{
    const sev=(a.severity||'').toUpperCase();
    const col=a.severity==='red'?'#dc2626':a.severity==='orange'?'#ea580c':a.severity==='yellow'?'#ca8a04':'#16a34a';
    tb.innerHTML+=`<tr>
      <td><span class="badge" style="background:${col}22;color:${col}">${sev}</span></td>
      <td>${esc(a.event_type)}</td><td>${esc(a.headline)}</td><td>${esc(a.region||'')}</td>
      <td class="text-xs">${a.issued_at?esc(a.issued_at.replace('T',' ').slice(0,16)):'—'}</td>
      <td class="text-xs">${a.valid_until?esc(a.valid_until.replace('T',' ').slice(0,16)):'—'}</td>
      <td class="whitespace-nowrap">
        <button onclick="openImpact('${esc(a.id)}','${esc(a.headline)}')" class="text-blue-600 hover:underline text-sm">Impact</button>
        <button onclick="delAlert('${esc(a.id)}')" class="text-red-600 hover:underline text-sm ml-2">Delete</button>
      </td></tr>`;
  });
}
async function createAlert(){
  const d = await fetch(API+'/alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    severity:document.getElementById('a-severity').value,
    event_type:document.getElementById('a-type').value,
    headline:document.getElementById('a-headline').value,
    region:document.getElementById('a-region').value||'Pune',
    radius_km:parseFloat(document.getElementById('a-radius').value)||40,
    valid_hours:parseInt(document.getElementById('a-hours').value)||24,
    detail:document.getElementById('a-detail').value})});
  if(d.ok){ setMsg(document.getElementById('alert-msg'),'Alert published',true); document.getElementById('a-headline').value=''; loadAlerts(); }
  else { setMsg(document.getElementById('alert-msg'),'Failed to publish',false); }
}
async function delAlert(id){ if(!confirm('Delete alert?'))return; await fetch(API+'/alerts/'+id,{method:'DELETE'}); loadAlerts(); }

// ---------- impact ----------
async function openImpact(id, headline){
  document.getElementById('impact-title').textContent='Impact — '+headline;
  const d = await (await fetch(API+'/alerts/'+id+'/impact')).json();
  document.getElementById('impact-summary').textContent = d.total_affected+' users affected, '+d.total_not_affected+' not affected';
  const tb=document.getElementById('impact-body'); tb.innerHTML='';
  [...d.affected,...d.not_affected].forEach(u=>{
    tb.innerHTML+=`<tr><td class="font-mono text-xs">${esc(u.user_id)}</td><td>${esc(u.city||'')}</td>
      <td><span class="badge ${u.in_range?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}">${u.in_range?'Affected':'Not affected'}</span></td>
      <td>${u.distance_km} km</td></tr>`;
  });
  document.getElementById('impact-modal').classList.remove('hidden');
}
function closeImpact(){ document.getElementById('impact-modal').classList.add('hidden'); }

// ---------- activities ----------
async function loadActivities(){
  const uid=document.getElementById('act-user').value.trim(); if(!uid){return alert('Enter a user id');}
  const d = await (await fetch(API+'/users/'+uid+'/activities')).json();
  const tb=document.getElementById('activities-body'); tb.innerHTML='';
  if(!d.activities.length){tb.innerHTML='<tr><td colspan="6" class="text-center text-slate-400 py-6">No activities for this user</td></tr>';}
  d.activities.forEach(x=>{
    tb.innerHTML+=`<tr><td class="font-mono text-xs">${esc(x.id)}</td><td>${esc(x.activity_type)}</td>
      <td>${esc(x.label||'')}</td><td>${(x.days||[]).join(',')||'daily'}</td>
      <td>${(x.preferred_start||'')+(x.preferred_end?'-'+x.preferred_end:'')}</td>
      <td><button onclick="delActivity('${uid}','${esc(x.id)}')" class="text-red-600 hover:underline text-sm">Delete</button></td></tr>`;
  });
}
async function delActivity(uid, aid){ if(!confirm('Delete activity?'))return; await fetch(API+'/users/'+uid+'/activities/'+aid,{method:'DELETE'}); loadActivities(); }

// ---------- helpers ----------
function esc(s){ s=String(s==null?'':s); return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
document.getElementById('login-password').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });

(async()=>{
  try{ const m=await (await fetch(API+'/me')).json(); if(m.admin_id) await boot(); }
  catch(e){ document.getElementById('view-login').classList.remove('hidden'); }
})();
</script>
</body>
</html>
"""
