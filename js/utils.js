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
  if(id==='shop-manager'){ renderShopManager(); }
  if(id==='finance'){ renderFinance(); }
  if(id==='currency'){ renderCurGrid(); populateCurSelects(); runConverter(); if(typeof checkCurrencyUpdateReminder==='function') checkCurrencyUpdateReminder(); }
  if(id==='expenses'){ renderExpenses(); }
  if(id==='todo'){ renderTodos(); }
  if(id==='calendar'){ renderCalendar(); }
  if(id==='ai'){ renderAiCustSheet(); if(typeof renderAiHistory==='function') renderAiHistory(); }
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
  'invoices':          ['js/invoices.js'],
  'wholesale':         ['js/invoices.js'],
  'shop-manager':      ['js/shop-manager.js'],
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

// ── WhatsApp helpers (always available) ──
function openCustomerWhatsApp(phone){
  if(!phone){ showToast('No phone number','err'); return; }
  const wa = phone.replace(/\D/g,'');
  if(!wa){ showToast('Invalid phone number','err'); return; }
  window.open('https://wa.me/'+wa, '_blank');
}

// ═══════════════════════════════════════════════════
// COMPATIBILITY STUBS
// Functions that were removed or live elsewhere but
// may still be referenced from HTML or other JS files
// ═══════════════════════════════════════════════════

function getStoreWA(store){
  if(typeof BIZ_DEFAULTS === 'undefined') return '';
  const p = BIZ_DEFAULTS[store] || BIZ_DEFAULTS.ra;
  return (p.wa||'').replace(/\D/g,'');
}

function showLowStockThresholdPicker(){
  const current = parseInt(localStorage.getItem('biz_lowstock_threshold')||'10');
  const ov = document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(44,26,31,0.5);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML=`<div style="background:var(--cream);border-radius:24px 24px 0 0;width:100%;max-width:480px;padding:24px;font-family:'DM Sans',sans-serif">
    <div style="width:36px;height:4px;background:rgba(26,10,16,0.12);border-radius:4px;margin:0 auto 18px"></div>
    <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:4px">⚠️ Low Stock Threshold</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Show "Low" badge when stock drops below this number</div>
    <input id="lst-inp" type="number" min="1" max="999" value="${current}" style="width:100%;padding:12px;border:1.5px solid rgba(201,144,10,0.3);border-radius:12px;font-family:inherit;font-size:18px;font-weight:700;text-align:center;color:var(--ink);outline:none;margin-bottom:14px">
    <div style="display:flex;gap:10px">
      <button onclick="this.closest('div').parentElement.remove()" style="flex:1;padding:12px;background:var(--grey);border:none;border-radius:12px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;color:var(--muted)">Cancel</button>
      <button onclick="saveLowStockThreshold(document.getElementById('lst-inp').value);this.closest('div').parentElement.remove()" style="flex:2;padding:12px;background:linear-gradient(135deg,var(--rose),var(--brand));border:none;border-radius:12px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;color:white">Save</button>
    </div>
  </div>`;
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('lst-inp')?.focus(),100);
}

function saveLowStockThreshold(val){
  const n = parseInt(val)||10;
  localStorage.setItem('biz_lowstock_threshold', n);
  if(typeof alertThresholds!=='undefined') alertThresholds.lowStock = n;
  showToast('Low stock threshold set to '+n+' ✅');
  if(typeof rebuildInvTabs==='function') rebuildInvTabs();
  if(typeof renderInventory==='function') renderInventory();
}

function checkMorningSummary(){ /* removed — no-op */ }
function goToReorderTab(){ if(typeof showPage==='function'){showPage('products');setNav('products');} }
function renderReorderView(){ /* removed — no-op */ }
function dismissReorder(){ /* removed — no-op */ }
function snoozeReorder(){ /* removed — no-op */ }
function renderCashFlow(){ /* moved to finance.js — no-op */ }
function renderProfitPerShipment(){ /* moved to finance.js — no-op */ }
function renderCapitalRecoveryBanner(){ /* moved to finance.js — no-op */ }
