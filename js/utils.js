// ═══════════════════════════════════════════════════
// UTILS.JS — Navigation, modals, toast, helpers
// ═══════════════════════════════════════════════════

// ── Page navigation ──
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg = document.getElementById('page-'+id);
  if(pg) pg.classList.add('active');
  document.querySelector('.content').scrollTop = 0;
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('m-confirm-ok').onclick = _confirmOk;
});
