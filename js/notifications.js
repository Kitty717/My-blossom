// ═══════════════════════════════════════════════════
// REMINDERS + PWA + NOTIFICATIONS  (js/notifications.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, dashboard.js
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════════════
const PRESETS = [
  {id:'pre1', icon:'📱', title:'Post on Instagram (RA)', type:'other'},
  {id:'pre2', icon:'🌸', title:'Post on Instagram (Flora)', type:'other'},
  {id:'pre3', icon:'📊', title:'Check sales & profits', type:'sales'},
  {id:'pre4', icon:'🧾', title:'Review expenses', type:'payment'},
  {id:'pre5', icon:'📦', title:'Physical inventory count', type:'order'},
  {id:'pre6', icon:'🎁', title:'Reorder packaging & boxes', type:'order'},
  {id:'pre7', icon:'🚢', title:'Follow up with China supplier', type:'shipment'},
  {id:'pre8', icon:'👑', title:'Message VIP customers', type:'payment'},
  {id:'pre9', icon:'🎯', title:'Send promotions to customers', type:'other'},
];
let presetState = {}; // {id: {on, time}}
try { const _ps = localStorage.getItem('biz_presetState'); if(_ps) presetState = JSON.parse(_ps); } catch(e){}

let _remType = 'payment';
let _remRepeat = 'once';
let _remDays = [];

function selectRemType(type){
  _remType = type;
  ['payment','shipment','order','other'].forEach(t=>{
    const el = document.getElementById('rtp-'+t);
    if(el) el.className = 'type-pill' + (t===type?' sel-'+t:'');
  });
}

function selectRepeat(rep){
  _remRepeat = rep;
  ['once','daily','weekly','monthly'].forEach(r=>{
    const el = document.getElementById('rrep-'+r);
    if(el) el.classList.toggle('active', r===rep);
  });
  const daysWrap = document.getElementById('rem-days-wrap');
  const countWrap = document.getElementById('rem-count-wrap');
  if(daysWrap) daysWrap.style.display = rep==='weekly' ? 'block' : 'none';
  if(countWrap) countWrap.style.display = rep==='once' ? 'none' : 'block';
}

function toggleRemDay(day){
  const el = document.getElementById('rday-'+day);
  if(!el) return;
  if(_remDays.includes(day)){ _remDays = _remDays.filter(d=>d!==day); el.classList.remove('active'); }
  else { _remDays.push(day); el.classList.add('active'); }
}

function resetReminderModal(){
  _remType = 'payment'; _remRepeat = 'once'; _remDays = [];
  ['payment','shipment','order','other'].forEach(t=>{
    const el = document.getElementById('rtp-'+t);
    if(el) el.className = 'type-pill';
  });
  const pay = document.getElementById('rtp-payment');
  if(pay) pay.className = 'type-pill sel-payment';
  ['once','daily','weekly','monthly'].forEach(r=>{
    const el = document.getElementById('rrep-'+r);
    if(el) el.classList.toggle('active', r==='once');
  });
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>{ const el=document.getElementById('rday-'+d); if(el) el.classList.remove('active'); });
  document.getElementById('rem-days-wrap').style.display='none';
  document.getElementById('rem-count-wrap').style.display='none';
  ['rem-title','rem-note'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const t=document.getElementById('rem-time'); if(t) t.value='09:00';
  const d=document.getElementById('rem-date'); if(d) d.value='';
  const c=document.getElementById('rem-count'); if(c) c.value='3';
}

function renderPresets(){
  const el = document.getElementById('preset-list');
  if(!el) return;
  const REPEATS = ['Once','Daily','Weekly','Monthly'];
  el.innerHTML = PRESETS.map(p=>{
    const state = presetState[p.id] || {on:false, times:['09:00'], date:'', repeat:'Once'};
    if(!presetState[p.id]) presetState[p.id] = state;
    if(!state.times) state.times = [state.time||'09:00'];
    if(!state.repeat) state.repeat = 'Once';
    let dateLabel = 'Pick date';
    if(state.date){ const d=new Date(state.date+'T12:00:00'); dateLabel=d.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'}); }
    const timePills = state.times.map((t,i)=>{
      const [h,m]=t.split(':').map(Number);
      const label=(h%12||12)+':'+(m<10?'0'+m:m)+' '+(h>=12?'PM':'AM');
      return `<label style="position:relative;display:inline-flex;align-items:center;gap:4px;background:var(--purple-soft);border-radius:8px;padding:5px 9px;font-size:11px;font-weight:700;color:var(--purple);cursor:pointer">🕐 ${label}<input type="time" value="${t}" onchange="updatePresetTimeAt('${p.id}',${i},this.value)" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%">${state.times.length>1?`<span onclick="event.preventDefault();removePresetTime('${p.id}',${i})" style="margin-left:2px;cursor:pointer;font-size:10px">✕</span>`:''}</label>`;
    }).join('');
    const repeatPills = REPEATS.map(r=>`<button onclick="updatePresetRepeat('${p.id}','${r}')" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${state.repeat===r?'var(--rose)':'var(--grey2)'};background:${state.repeat===r?'var(--rose)':'var(--white)'};color:${state.repeat===r?'white':'var(--muted)'};font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">${r}</button>`).join('');
    return `<div class="preset-row" style="flex-wrap:wrap;row-gap:8px;padding:12px 14px">
      <span class="preset-icon">${p.icon}</span>
      <span class="preset-title" style="flex:1">${p.title}</span>
      <button class="p-toggle${state.on?' on':''}" onclick="togglePreset('${p.id}')"><div class="p-toggle-k"></div></button>
      ${state.on ? `<div style="width:100%;padding-left:30px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <label style="position:relative;display:inline-flex;align-items:center;gap:4px;background:var(--grey);border-radius:8px;padding:5px 9px;font-size:11px;font-weight:700;color:var(--ink);cursor:pointer">📅 ${dateLabel}<input type="date" value="${state.date||''}" onchange="updatePresetDate('${p.id}',this.value)" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%"></label>
          ${timePills}
          ${state.times.length<4?`<button onclick="addPresetTime('${p.id}')" style="width:26px;height:26px;border-radius:50%;border:1.5px dashed var(--rose);background:transparent;color:var(--rose);font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">+</button>`:''}
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">${repeatPills}</div>
      </div>` : ''}
    </div>`;
  }).join('');
}

function togglePreset(id){
  if(!presetState[id]) presetState[id]={on:false,times:['09:00'],date:'',repeat:'Once'};
  presetState[id].on=!presetState[id].on;
  renderPresets(); showToast(presetState[id].on?'Reminder on 🔔':'Reminder off');
  scheduleAllPresets(); syncToIDB(); localStorage.setItem('biz_presetState', JSON.stringify(presetState));
}
function updatePresetTimeAt(id,idx,val){
  if(!presetState[id]||!presetState[id].times) return;
  presetState[id].times[idx]=val; renderPresets(); scheduleAllPresets(); syncToIDB(); localStorage.setItem('biz_presetState', JSON.stringify(presetState));
}
function addPresetTime(id){
  if(!presetState[id].times) presetState[id].times=['09:00'];
  if(presetState[id].times.length>=4) return;
  presetState[id].times.push('12:00'); renderPresets(); scheduleAllPresets(); syncToIDB(); localStorage.setItem('biz_presetState', JSON.stringify(presetState));
}
function removePresetTime(id,idx){
  if(!presetState[id].times||presetState[id].times.length<=1) return;
  presetState[id].times.splice(idx,1); renderPresets(); scheduleAllPresets(); syncToIDB(); localStorage.setItem('biz_presetState', JSON.stringify(presetState));
}
function updatePresetDate(id,val){
  if(!presetState[id]) presetState[id]={on:true,times:['09:00'],date:val,repeat:'Once'};
  else presetState[id].date=val; renderPresets(); scheduleAllPresets(); syncToIDB(); localStorage.setItem('biz_presetState', JSON.stringify(presetState));
}
function updatePresetRepeat(id,val){
  if(!presetState[id]) presetState[id]={on:true,times:['09:00'],date:'',repeat:val};
  else presetState[id].repeat=val; renderPresets(); scheduleAllPresets(); syncToIDB(); localStorage.setItem('biz_presetState', JSON.stringify(presetState));
}
function updatePresetTime(id,val){
  if(!presetState[id]) presetState[id]={on:true,times:[val],date:'',repeat:'Once'};
  else presetState[id].times=[val]; scheduleAllPresets(); syncToIDB(); localStorage.setItem('biz_presetState', JSON.stringify(presetState));
}

function renderReminders(){
  const today = new Date().toISOString().split('T')[0];
  const list = reminders.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const repeatLabels = {once:'', daily:'Daily', weekly:'Weekly', monthly:'Monthly'};

  const html = list.length ? list.map(r=>{
    const overdue = !r.done && r.date < today;
    const isToday = r.date === today;
    const dateStr = new Date(r.date+'T12:00:00').toLocaleDateString('en',{month:'short',day:'numeric'});
    const dateCls = r.done?'done':overdue?'overdue':isToday?'today':'date';
    const dateLabel = r.done?'Done':overdue?'Overdue':isToday?'Today':dateStr;
    const timeTxt = r.time ? formatTime(r.time) : '';
    const repeatTxt = r.repeat && r.repeat!=='once' ? (repeatLabels[r.repeat]+(r.repeatCount>1?' ×'+r.repeatCount:'')) : '';

    return `<div class="rem-row${r.done?' done-row':''}">
      <div class="rem-dot ${r.type||'other'}"></div>
      <div class="rem-row-title">${r.title}</div>
      <div class="rem-row-meta">
        <span class="rem-mini-tag ${dateCls}">${dateLabel}</span>
        ${timeTxt?`<span class="rem-mini-tag time">${timeTxt}</span>`:''}
        ${repeatTxt?`<span class="rem-mini-tag repeat">${repeatTxt}</span>`:''}
      </div>
      <button class="rem-row-btn rem-row-check${r.done?' done':''}" onclick="toggleReminder('${r.id}')">${r.done?'✓':'✔'}</button>
      <button class="rem-row-btn rem-row-del" onclick="deleteReminder('${r.id}')">🗑</button>
    </div>`;
  }).join('') : `<div style="padding:14px;color:var(--muted);font-size:13px;text-align:center">No reminders yet 🎉</div>`;

  const badge = document.getElementById('rem-count-badge');
  if(badge) badge.textContent = list.filter(r=>!r.done).length || '';

  ['rem-list'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=html; });
}

function formatTime(t){
  if(!t) return '';
  const [h,m] = t.split(':').map(Number);
  const ampm = h>=12?'PM':'AM';
  return (h%12||12)+':'+(m<10?'0':'')+m+' '+ampm;
}

function renderRemindersAll(){ renderReminders(); }
function setRchip(el){ el.closest('div').querySelectorAll('.rchip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); }

function toggleReminder(id){
  const r=reminders.find(x=>x.id===id);
  if(r){ r.done=!r.done; saveReminders(); renderReminders(); initDashboard(); showToast(r.done?'Done ✅':'Marked pending'); }
}
function deleteReminder(id){
  const r=reminders.find(x=>x.id===id);
  if(!r) return;
  appConfirm('Delete Reminder',`Delete "${r.title}"?`,'🗑️ Delete',()=>{
    reminders=reminders.filter(x=>x.id!==id); saveReminders(); renderReminders(); initDashboard(); showToast('Reminder deleted');
  });
}
function clearDoneReminders(){
  const count=reminders.filter(r=>r.done).length;
  if(!count){ showToast('No completed reminders','err'); return; }
  reminders=reminders.filter(r=>!r.done); saveReminders(); renderReminders(); initDashboard(); showToast(count+' cleared 🧹');
}

function saveReminder(){
  const title=document.getElementById('rem-title').value.trim();
  if(!title){ showToast('Enter a title','err'); return; }
  if(_remRepeat==='weekly'&&_remDays.length===0){ showToast('Pick at least one day','err'); return; }
  const date=document.getElementById('rem-date').value;
  const time=document.getElementById('rem-time').value||'09:00';
  const repeatCount=parseInt(document.getElementById('rem-count')?.value,10)||1;
  reminders.push({
    id:'r-'+Date.now(), title, type:_remType,
    note:document.getElementById('rem-note').value.trim(),
    date:date||new Date().toISOString().split('T')[0],
    time, repeat:_remRepeat,
    days:[..._remDays],
    repeatCount:_remRepeat==='once'?1:repeatCount,
    done:false
  });
  closeModal('m-add-reminder');
  resetReminderModal();
  saveReminders();
  renderReminders(); initDashboard();
  scheduleAllPresets();
  showToast('Reminder saved! 🔔');
}

function toggleDarkMode(el){
  el.classList.toggle('on');
  const on = el.classList.contains('on');
  document.body.classList.toggle('dark-mode', on);
  localStorage.setItem('darkMode', on ? '1' : '0');
  showToast(on ? 'Dark mode on 🌙' : 'Dark mode off ☀️');
}
function toggleCompact(el){
  el.classList.toggle('on');
  const on = el.classList.contains('on');
  document.body.classList.toggle('compact-mode', on);
  localStorage.setItem('compactMode', on ? '1' : '0');
  showToast(on ? 'Compact view on 📳' : 'Compact view off');
}
function loadDisplayPrefs(){
  if(localStorage.getItem('darkMode')==='1'){
    document.body.classList.add('dark-mode');
    const t = document.getElementById('toggle-dark');
    if(t) t.classList.add('on');
  }
  if(localStorage.getItem('compactMode')==='1'){
    document.body.classList.add('compact-mode');
    const t = document.getElementById('toggle-compact');
    if(t) t.classList.add('on');
  }
}
function exportData(){
  try {
    const backup = {
      // ── Main data (from memory / IDB) ──
      products,
      reminders,
      todos,
      bundles,
      customers,
      shipments,
      invoices,
      floraOrders,
      floraOrderCounter,
      supplies,
      collections,
      calEvents,
      vipSettings,
      vipSkipped,
      losses,
      expenses,
      scHistory: window._scHistoryCache || [],
      // ── Settings (from localStorage) ──
      presetState:      JSON.parse(localStorage.getItem('biz_presetState')      || '{}'),
      bizProfiles:      JSON.parse(localStorage.getItem('bizProfiles')          || '{}'),
      catalogTemplates: JSON.parse(localStorage.getItem('catalogTemplates')     || '{}'),
      invoiceTemplates: JSON.parse(localStorage.getItem('invoiceTemplates')     || '{}'),
      customCategories: JSON.parse(localStorage.getItem('customCategories')     || '[]'),
      alertThresholds:  JSON.parse(localStorage.getItem('biz_alert_thresholds') || '{}'),
      // ── Meta ──
      exportedAt: new Date().toISOString(),
      version: 2,
    };

    const data = JSON.stringify(backup, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = 'blossom-backup-' + dateStr + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    localStorage.setItem('biz_lastBackup', Date.now().toString());
    const banner = document.getElementById('dash-backup-banner');
    if(banner) banner.style.display = 'none';

    const prodCount = (products||[]).length;
    const custCount = (customers||[]).length;
    const invCount  = (invoices||[]).length;
    showToast(`✅ Backup saved — ${prodCount} products, ${custCount} customers, ${invCount} invoices`);
  } catch(err){
    console.error('Export error:', err);
    showToast('❌ Export failed: ' + (err.message || 'unknown error'));
  }
}

function importDataFromFile(){
  document.getElementById('import-data-input').click();
}

function handleImportFile(input){
  const file = input.files[0];
  if(!file) return;

  // Validate it's a JSON file first
  if(!file.name.endsWith('.json') && file.type !== 'application/json'){
    showToast('❌ Please select a .json backup file'); input.value=''; return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    let d;
    try {
      d = JSON.parse(e.target.result);
    } catch(err){
      showToast('❌ File is corrupted or not valid JSON'); input.value=''; return;
    }

    // Validate it has at least some recognisable data
    if(!d || typeof d !== 'object' ||
       (!d.products && !d.customers && !d.invoices && !d.reminders && !d.shipments)){
      showToast("❌ This doesn't look like a Blossom backup file"); input.value=''; return;
    }

    // Show what will be restored
    const counts = [
      d.products?.length    && `${d.products.length} products`,
      d.customers?.length   && `${d.customers.length} customers`,
      d.invoices?.length    && `${d.invoices.length} invoices`,
      d.shipments?.length   && `${d.shipments.length} shipments`,
      d.floraOrders?.length && `${d.floraOrders.length} flora orders`,
      d.expenses?.length    && `${d.expenses.length} expenses`,
      d.losses?.length      && `${d.losses.length} losses`,
    ].filter(Boolean).join(', ');

    appConfirm(
      '📥 Import Backup',
      `Restore: ${counts || 'all data'}?

This will REPLACE everything currently in the app.`,
      '📥 Yes, Import',
      async () => {
        showToast('⏳ Importing... please wait');
        try {
          // Write all main data to IDB — each awaited so we know it's done
          const writes = [
            ['biz_products',          d.products],
            ['biz_reminders',         d.reminders],
            ['biz_todos',             d.todos],
            ['biz_calEvents',         d.calEvents],
            ['biz_customers',         d.customers],
            ['biz_shipments',         d.shipments],
            ['biz_bundles',           d.bundles],
            ['biz_collections',       d.collections],
            ['biz_invoices',          d.invoices],
            ['biz_floraOrders',       d.floraOrders],
            ['biz_floraOrderCounter', d.floraOrderCounter],
            ['biz_supplies',          d.supplies],
            ['biz_vipSettings',       d.vipSettings],
            ['biz_vipSkipped',        d.vipSkipped],
            ['biz_losses',            d.losses],
            ['biz_expenses',          d.expenses],
            ['scHistory',             d.scHistory],
            ['invSession',            null], // clear any active session
          ];

          for(const [key, val] of writes){
            if(val !== undefined && val !== null || key === 'invSession'){
              await _idbPut(key, val !== undefined ? val : null);
            }
          }

          // Settings that stay in localStorage
          if(d.presetState)      localStorage.setItem('biz_presetState',      JSON.stringify(d.presetState));
          if(d.bizProfiles)      localStorage.setItem('bizProfiles',          JSON.stringify(d.bizProfiles));
          if(d.catalogTemplates) localStorage.setItem('catalogTemplates',     JSON.stringify(d.catalogTemplates));
          if(d.invoiceTemplates) localStorage.setItem('invoiceTemplates',     JSON.stringify(d.invoiceTemplates));
          if(d.customCategories) localStorage.setItem('customCategories',     JSON.stringify(d.customCategories));
          if(d.alertThresholds)  localStorage.setItem('biz_alert_thresholds', JSON.stringify(d.alertThresholds));

          // Mark seeded so demo data doesn't overwrite
          localStorage.setItem('biz_seeded_v1', '1');
          // Clear any old localStorage data keys so they don't interfere
          ['biz_products','biz_product_photos','biz_reminders','biz_todos','biz_calEvents',
           'biz_customers','biz_shipments','biz_bundles','biz_collections','biz_invoices',
           'biz_floraOrders','biz_floraOrderCounter','biz_supplies','biz_vipSettings',
           'biz_vipSkipped','biz_losses','biz_expenses'].forEach(k => localStorage.removeItem(k));

          // All writes confirmed — now safe to reload
          showToast(`✅ Imported ${counts || 'all data'} — reloading!`);
          setTimeout(() => location.reload(), 1200);

        } catch(err){
          console.error('Import error:', err);
          showToast('❌ Import failed: ' + (err.message || 'unknown error'));
        }
      }
    );
    input.value = '';
  };
  reader.onerror = () => { showToast('❌ Could not read file'); input.value=''; };
  reader.readAsText(file);
}

function confirmEraseData(){
  appConfirm(
    '⚠️ Erase All Data',
    'This will permanently delete ALL your products, customers, invoices, shipments, reminders and settings. This CANNOT be undone.',
    '🗑️ Erase Everything',
    async ()=>{
      // Clear IDB
      try {
        const db = await _openIDB();
        await new Promise((res,rej)=>{
          const tx = db.transaction(IDB_STORE,'readwrite');
          tx.objectStore(IDB_STORE).clear();
          tx.oncomplete = res; tx.onerror = ()=>rej(tx.error);
        });
      } catch(e){ console.warn('IDB clear error',e); }
      localStorage.clear();
      localStorage.setItem('biz_seeded_v1','1'); // prevent re-seeding demo data
      showToast('All data erased. Restarting...');
      setTimeout(()=>location.reload(), 1500);
    }
  );
}


// ── PWA + In-app Notifications ──
let inAppNotifs = JSON.parse(localStorage.getItem('biz_inAppNotifs')||'[]');
let _notifPanelOpen = false;
function saveInAppNotifs(){ localStorage.setItem('biz_inAppNotifs', JSON.stringify(inAppNotifs)); }
let _scheduledTimers = [];

async function initPWA(){
  // Apple touch icon
  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon'; appleIcon.href = './icon-192.png';
  document.head.appendChild(appleIcon);

  // Register service worker - try external sw.js, fall back to inline
  if('serviceWorker' in navigator){
    try{
      await navigator.serviceWorker.register('./sw.js', {scope:'./'});
    }catch(e){
      // Fall back to inline service worker (works when opened as local file)
      try{
        const swCode = `const CACHE='blossom-v${Date.now()}';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});`;
        const swBlob = new Blob([swCode],{type:'application/javascript'});
        await navigator.serviceWorker.register(URL.createObjectURL(swBlob),{scope:'./'});
      }catch(e2){}
    }
  }

  // Check notification permission
  if('Notification' in window && Notification.permission === 'default'){
    showPermissionBanner();
  }
}

function showPermissionBanner(){
  const rem = document.getElementById('page-reminders');
  if(!rem || document.getElementById('notif-perm-banner')) return;
  const b = document.createElement('div');
  b.id = 'notif-perm-banner';
  b.className = 'notif-perm-banner';
  b.innerHTML = `<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--ink)">Enable notifications 🔔</div><div style="font-size:11.5px;color:var(--muted);margin-top:2px">Get alerts for low stock, payments & more</div></div><button class="btn btn-p btn-sm" onclick="requestNotifPermission()">Allow</button>`;
  rem.insertBefore(b, rem.firstChild.nextSibling);
}

async function requestNotifPermission(){
  if(!('Notification' in window)) return;
  const result = await Notification.requestPermission();
  const banner = document.getElementById('notif-perm-banner');
  if(banner) banner.remove();
  if(result === 'granted'){
    showToast('Notifications enabled! 🔔');
    scheduleAllPresets();
    syncToIDB();
  } else {
    showToast('Notifications blocked','err');
  }
}

function fireNotif(title, body, tag, icon){
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  try{
    const n = new Notification(title,{body, icon:icon||'', tag:tag||'blossom-'+Date.now(), badge:''});
    n.onclick = ()=>{ window.focus(); n.close(); };
  }catch(e){}
}

// ─── IN-APP NOTIFICATIONS ───────────────────────────
function buildNotifications(){
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const existing = new Set(inAppNotifs.map(n=>n.id));
  const newNotifs = [];

  // Low stock (≤5 pieces) — per variant
  products.filter(p=>!isProductInTransit(p)).forEach(p=>{
    p.variants.forEach(v=>{
      const total = (v.ra||0)+(v.flora||0);
      if(total<=5){
        const id = 'low-'+p.id+'-'+v.id;
        const label = v.name&&v.name!=='Standard' ? p.name+' ('+v.name+')' : p.name;
        if(!existing.has(id)) newNotifs.push({id, icon:p.emoji, type:'stock', title:'⚠️ Low Stock: '+label, body:'Only '+total+' piece'+(total===1?'':'s')+' left!', time:now.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'}), dismissed:false});
      }
    });
  });

  // Unpaid customers
  customers.filter(c=>c.debt>0).forEach(c=>{
    const id = 'debt-'+c.id;
    if(!existing.has(id)) newNotifs.push({id, icon:'💰', type:'payment', title:'Unpaid: '+c.name, body:'Owes you $'+c.debt+' — follow up today', time:'', dismissed:false});
  });

  // Shipment ETAs — alert if arriving within 3 days or overdue
  shipments.filter(s=>s.status==='onway'||s.status==='ordered').forEach(s=>{
    const diff = Math.ceil((new Date(s.eta+'T12:00:00') - now)/(1000*60*60*24));
    if(diff<=3){
      const id = 'ship-'+s.id;
      const body = diff<0 ? 'Was due '+Math.abs(diff)+' day'+(Math.abs(diff)===1?'':'s')+' ago — check status!' : diff===0 ? 'Arriving today! Get ready 📦' : 'Arriving in '+diff+' day'+(diff===1?'':'s');
      if(!existing.has(id)) newNotifs.push({id, icon:'🚢', type:'shipment', title:s.name, body, time:'', dismissed:false});
    }
  });

  // Overdue custom reminders
  reminders.filter(r=>!r.done && r.date < today).forEach(r=>{
    const icons = {payment:'💰',shipment:'🚢',order:'📦',other:'📌'};
    const id = 'rem-'+r.id;
    if(!existing.has(id)) newNotifs.push({id, icon:icons[r.type]||'📌', type:r.type, title:'Overdue: '+r.title, body:r.note||'Past due date', time:r.date, dismissed:false});
  });

  // Monthly sales (1st of month)
  if(now.getDate()===1){
    const id = 'monthly-'+now.getMonth()+'-'+now.getFullYear();
    if(!existing.has(id)) newNotifs.push({id, icon:'📊', type:'sales', title:'Monthly Summary', body:'Review your sales & profits for '+now.toLocaleString('en',{month:'long'}), time:'', dismissed:false});
  }

  // Fire browser notifications for new ones
  newNotifs.forEach(n=> fireNotif(n.title, n.body, n.id));
  inAppNotifs = [...newNotifs, ...inAppNotifs];
  saveInAppNotifs();
  updateBellBadge();
  renderNotifPanel();
}

function addNotif(id, icon, type, title, body){
  if(inAppNotifs.find(n=>n.id===id)) return;
  const now = new Date();
  inAppNotifs.unshift({id, icon, type, title, body, time:now.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'}), dismissed:false});
  saveInAppNotifs();
  fireNotif(title, body, id);
  updateBellBadge();
  renderNotifPanel();
}

function updateBellBadge(){
  const count = inAppNotifs.filter(n=>!n.dismissed).length;
  const badge = document.getElementById('notif-badge');
  if(badge){ badge.style.display = count>0?'flex':'none'; badge.textContent = count>9?'9+':(count||''); }
}

function toggleNotifPanel(){
  _notifPanelOpen = !_notifPanelOpen;
  document.getElementById('notif-panel').classList.toggle('open', _notifPanelOpen);
  document.getElementById('notif-overlay').classList.toggle('open', _notifPanelOpen);
}

function renderNotifPanel(){
  const el = document.getElementById('notif-items');
  if(!el) return;
  const active = inAppNotifs.filter(n=>!n.dismissed);
  if(!active.length){ el.innerHTML='<div class="notif-empty">All clear! You\'re on top of everything 🎉</div>'; return; }
  el.innerHTML = active.map(n=>`
    <div class="notif-item">
      <div class="notif-item-icon ${n.type}">${n.icon}</div>
      <div class="notif-item-info">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-body">${n.body}</div>
        ${n.time?`<div class="notif-item-time">${n.time}</div>`:''}
      </div>
      <button class="notif-dismiss" onclick="dismissNotif('${n.id}')">✕</button>
    </div>`).join('');
}

function dismissNotif(id){
  const n = inAppNotifs.find(x=>x.id===id);
  if(n){ n.dismissed=true; saveInAppNotifs(); updateBellBadge(); renderNotifPanel(); }
}

function dismissAllNotifs(){
  inAppNotifs.forEach(n=>n.dismissed=true);
  saveInAppNotifs(); updateBellBadge(); renderNotifPanel();
}

// ─── SMART AUTO-TRIGGERS ────────────────────────────
// Called after saving invoice — shows actionable website sync modal
// triggerWebsiteUpdateNotif → js/invoices.js

// ─── PRESET SCHEDULING ──────────────────────────────
function scheduleAllPresets(){
  _scheduledTimers.forEach(t=>clearTimeout(t));
  _scheduledTimers = [];
  // Schedule preset reminders
  PRESETS.forEach(p=>{
    const state = presetState[p.id];
    if(state && state.on && state.times){
      state.times.forEach(t=>schedulePresetNotif(p, t));
    } else if(state && state.on && state.time){
      schedulePresetNotif(p, state.time);
    }
  });
  // Schedule custom reminders
  const today = new Date().toISOString().split('T')[0];
  reminders.filter(r=>!r.done && r.date >= today && r.time).forEach(r=>{
    const [h,m] = r.time.split(':').map(Number);
    const target = new Date(r.date+'T'+r.time+':00');
    const delay = target - Date.now();
    if(delay > 0 && delay < 86400000*2){ // within 2 days
      const tid = setTimeout(()=>{
        playReminderSound();
        showReminderPopup(r.title, r.note||'', '🔔');
        addNotif('rem-'+r.id, '🔔', 'reminder', r.title, r.note||'Time for your reminder!');
      }, delay);
      _scheduledTimers.push(tid);
    }
  });
}

function schedulePresetNotif(preset, timeStr){
  const [h,m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h,m,0,0);
  if(target <= now) target.setDate(target.getDate()+1);
  const delay = target - now;
  const tid = setTimeout(()=>{
    const body = getPresetNotifBody(preset.id);
    addNotif('preset-'+preset.id+'-'+Date.now(), preset.icon, 'preset', '🔔 '+preset.title, body);
    playReminderSound();
    showReminderPopup(preset.title, body, preset.icon);
    schedulePresetNotif(preset, timeStr); // reschedule daily
  }, delay);
  _scheduledTimers.push(tid);
}

function getPresetNotifBody(id){
  switch(id){
    case 'pre1': return '📱 Time to post on Instagram for RA Warehouse!';
    case 'pre2': return '🌸 Time to post on Instagram for Flora Gift Shop!';
    case 'pre3':{
      const rev = invoices.filter(i=>(i.status==='paid'||i.status==='partial')).reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0);
      const owed = customers.filter(c=>c.debt>0).reduce((s,c)=>s+(c.debt||0),0);
      return `📊 Revenue: $${rev.toFixed(0)} · Outstanding: $${owed.toFixed(0)}`;
    }
    case 'pre4':{
      loadExpenses();
      const thisMonth = new Date().toISOString().slice(0,7);
      const monthExp = expenses.filter(e=>(e.date||'').startsWith(thisMonth)).reduce((s,e)=>s+(e.amount||0),0);
      return `🧾 This month's expenses: $${monthExp.toFixed(2)}`;
    }
    case 'pre5': return '📦 Time to do your monthly physical inventory count!';
    case 'pre6': return '🎁 Check packaging & boxes — time to reorder supplies?';
    case 'pre7':{
      const active = shipments.filter(s=>s.status==='onway'||s.status==='ordered');
      return active.length ? `🚢 ${active.length} shipment${active.length>1?'s':''} active — follow up with supplier` : '🚢 No active shipments. Ready to order?';
    }
    case 'pre8':{
      const vips = customers.filter(c=>c.vip&&!c.blacklisted);
      return vips.length ? `👑 Message your ${vips.length} VIP customer${vips.length>1?'s':''}!` : '👑 Message your best customers today';
    }
    case 'pre9':{
      const total = customers.filter(c=>!c.blacklisted).length;
      return `🎯 Send a promo to your ${total} customer${total>1?'s':''}!`;
    }
    default: return '';
  }
}

// ─── INDEXEDDB SYNC (for SW background checks) ──────
// ═══════════════════════════════════════════════════
// REMINDER SOUND & POPUP
// ═══════════════════════════════════════════════════
function playReminderSound(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const notes = [523, 659, 784, 1047]; // C E G C - pleasant chime
    notes.forEach((freq, i)=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i*0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t+0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t+0.4);
      osc.start(t); osc.stop(t+0.4);
    });
  }catch(e){}
}

function showReminderPopup(title, body, icon='🔔'){
  const existing = document.getElementById('rem-popup-overlay');
  if(existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'rem-popup-overlay';
  el.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,0.3);animation:fu 0.2s ease;padding-top:20px';
  el.innerHTML = `
    <div style="background:white;border-radius:20px;padding:20px;width:90%;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.2);animation:sup 0.3s cubic-bezier(0.4,0,0.2,1)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="font-size:32px">${icon}</div>
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#2c1a1f">${title}</div>
          <div style="font-size:12px;color:#e8748a;font-weight:600;margin-top:2px">⏰ Reminder</div>
        </div>
      </div>
      ${body ? `<div style="font-size:13px;color:#666;line-height:1.5;margin-bottom:14px">${body}</div>` : ''}
      <button onclick="document.getElementById('rem-popup-overlay').remove()" style="width:100%;padding:12px;background:#e8748a;color:white;border:none;border-radius:50px;font-size:14px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">Got it ✓</button>
    </div>`;
  el.addEventListener('click', e=>{ if(e.target===el) el.remove(); });
  document.body.appendChild(el);
  // Auto dismiss after 10s
  setTimeout(()=>{ if(document.getElementById('rem-popup-overlay')) document.getElementById('rem-popup-overlay').remove(); }, 10000);
}

function checkTodayReminders(){
  const today = new Date().toISOString().split('T')[0];
  const due = reminders.filter(r => !r.done && r.date === today);
  if(!due.length) return;

  const existing = document.getElementById('today-rem-popup');
  if(existing) return; // already shown

  const el = document.createElement('div');
  el.id = 'today-rem-popup';
  el.style.cssText = 'position:fixed;inset:0;z-index:99997;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);padding:20px';
  const list = due.map(r=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0e0e5">
    <span style="font-size:18px">🔔</span>
    <div>
      <div style="font-size:13px;font-weight:600;color:#2c1a1f">${r.title}</div>
      ${r.time ? `<div style="font-size:11px;color:#e8748a">⏰ ${r.time}</div>` : ''}
    </div>
  </div>`).join('');

  el.innerHTML = `
    <div style="background:white;border-radius:24px;padding:24px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:36px;margin-bottom:8px">🌸</div>
        <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#2c1a1f">Today's Reminders</div>
        <div style="font-size:12px;color:#999;margin-top:4px">${due.length} reminder${due.length>1?'s':''} due today</div>
      </div>
      <div style="margin-bottom:16px">${list}</div>
      <button onclick="document.getElementById('today-rem-popup').remove()" style="width:100%;padding:13px;background:#e8748a;color:white;border:none;border-radius:50px;font-size:14px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">Let's go! 💪</button>
    </div>`;
  el.addEventListener('click', e=>{ if(e.target===el) el.remove(); });
  document.body.appendChild(el);
  playReminderSound();
}
