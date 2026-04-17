// ═══════════════════════════════════════════════════
// UTILS.JS — Navigation, modals, toast, helpers
// ═══════════════════════════════════════════════════

// ── Page navigation ──
async function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg = document.getElementById('page-'+id);
  if(pg) pg.classList.add('active');
  document.querySelector('.content').scrollTop = 0;

  // Lazy-load section scripts if not yet loaded
  await _ensureSection(id);

  if(id==='settings'){ renderReminders(); const rp=document.getElementById('set-rate-preview'); if(rp) rp.textContent='1 USD = '+_r2.toLocaleString()+' LBP'; }
  if(id==='reminders'){ renderSmartAlerts(); renderReminders(); renderPresets(); }
  if(id==='shipments'){ renderShipments(); }
  if(id==='products'||id==='inventory'){ rebuildInvTabs(); renderInventory(); renderCount(); }
  if(id==='customers'){ renderCustomers(); }
  if(id==='catalog'){ renderCatalog(); }
  if(id==='invoices'){ renderInvoices(); }
  if(id==='collections'){ renderCollections(); }
  if(id==='collection-detail'){ renderCollectionDetail(); }
  if(id==='flora'){ renderFloraPage(); }
  if(id==='bundles'){ renderBundles(); }
  if(id==='supplies'){ renderSupplies(); }
  if(id==='wholesale'){ renderWholesale(); }
  if(id==='finance'){ renderFinance(); }
  if(id==='currency'){ renderCurGrid(); populateCurSelects(); runConverter(); }
  if(id==='expenses'){ renderExpenses(); }
  if(id==='todo'){ renderTodos(); }
  if(id==='calendar'){ renderCalendar(); }
  if(id==='ai'){ renderAiCustSheet(); }
}

function setNav(el){ /* bottom nav removed */ }

function toggleDrawer(){
  document.getElementById('drw').classList.toggle('open');
  document.getElementById('dbg').classList.toggle('open');
}

// ── Modals ──
function showModal(id){
  document.getElementById(id).classList.add('open');
  if(id==='m-add-reminder') resetReminderModal();
  if(id==='m-add-product') varPhotoClear('vp-default');
}

function closeModal(id){ document.getElementById(id).classList.remove('open'); }

// Close modal when tapping outside
document.querySelectorAll('.mo').forEach(o => o.addEventListener('click', function(e){
  if(e.target === this) this.classList.remove('open');
}));

// ── Toast notifications ──
function showToast(msg, cls='ok'){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + cls + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

function saveT(mid, msg){ closeModal(mid); setTimeout(() => showToast(msg), 200); }

// ── Tab helpers ──
function ftab(el){
  el.closest('.tabs').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

function goReminders(){ showPage('settings'); renderRemindersAll(); }

// ── Product quantity helper ──
function getTotalQty(p){
  return (p.variants||[]).reduce((s,v) => s + (v.ra||0) + (v.flora||0), 0);
}

// ── Confirm dialog ──
let _confirmCallback = null;

function appConfirm(title, msg, okLabel, cb){
  document.getElementById('m-confirm-title').textContent = title;
  document.getElementById('m-confirm-msg').textContent = msg;
  document.getElementById('m-confirm-ok').textContent = okLabel || 'Delete';
  document.getElementById('m-confirm').style.display = 'flex';
  _confirmCallback = cb;
}

async function _confirmOk(){
  document.getElementById('m-confirm').style.display = 'none';
  if(_confirmCallback){
    try { await _confirmCallback(); } catch(e){ console.warn('confirmOk error', e); }
  }
  _confirmCallback = null;
}

function _confirmCancel(){
  document.getElementById('m-confirm').style.display = 'none';
  _confirmCallback = null;
}

// m-confirm-ok uses onclick="_confirmOk()" directly in HTML

// ═══════════════════════════════════════════════════
// LAZY SCRIPT LOADER
// Loads a JS file once, by injecting a <script> tag.
// Functions stay global (no module scope issues).
// ═══════════════════════════════════════════════════
const _loadedScripts = new Set();

function _lazyLoad(src){
  if(_loadedScripts.has(src)) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload  = () => { _loadedScripts.add(src); res(); };
    s.onerror = () => rej(new Error('Failed to load: ' + src));
    document.head.appendChild(s);
  });
}

// Section → scripts map
const _sectionScripts = {
  'products':          ['js/inventory.js','js/catalog.js'],
  'inventory':         ['js/inventory.js','js/catalog.js'],
  'catalog':           ['js/inventory.js','js/catalog.js'],
  'customers':         ['js/customers.js'],
  'settings':          ['js/settings.js','js/notifications.js','js/invoices.js'],
  'reminders':         ['js/notifications.js'],
  'invoices':          ['js/invoices.js'],
  'wholesale':         ['js/invoices.js'],
  'flora':             ['js/flora.js'],
  'bundles':           ['js/bundles.js'],
  'collections':       ['js/collections.js'],
  'collection-detail': ['js/collections.js'],
  'currency':          ['js/currency.js'],
  'expenses':          ['js/expenses.js'],
  'calendar':          ['js/calendar.js'],
  'todo':              ['js/calendar.js'],
  'supplies':          ['js/supplies.js'],
};

async function _ensureSection(id){
  const scripts = _sectionScripts[id];
  if(!scripts) return; // no lazy scripts needed (dashboard, ai, etc.)
  await Promise.all(scripts.map(_lazyLoad));
}
