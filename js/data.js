// ═══════════════════════════════════════════════════
// DATA.JS — Global state, IndexedDB, save/load
// ═══════════════════════════════════════════════════

// ── Exchange rate fallback ──
let _r = 89500;

// ── UI / filter state ──
let invFilter = 'all', catFilter = 'all', remFilter = 'all', todoFilter = 'all', shipFilter = 'all';
let scanMode = 'update';
let currentScanStream = null;
let barcodeDetector = null;
let calYear, calMonth;
let _updatingProductId = null, _updatingVariantId = null;
let invSession = null;
let invCountFilter = '';

const PRIO_COLORS = {high:'#e05263', med:'#f5a623', low:'#4caf7d'};

// ── Core data arrays ──
let products = [];
let reminders = [];
let todos = [];
let calEvents = [];
let customers = [];
let shipments = [];
let bundles = [];
let collections = [];
let invoices = [];
let floraOrders = [];
let floraFilter = 'all';
let floraOrderCounter = 0;
let supplies = [];
let losses = []; // [{id, type, amount, date, note, shipmentId?, customerId?}]

// ── VIP settings (previously declared near Customers section) ──
let vipSettings = { minInvoices: 5, minSpent: 500, inactiveDays: 30, discount: 10 };
let vipSkipped = []; // customer IDs we said "no" to VIP promotion

// ── Expenses (previously declared near Expenses section) ──
let expenses = [];
let expFilter = 'all';

// ── Finance filter state ──
let finPeriod = 'month';
let finStore  = 'all';
let finCostBy = 'eta'; // 'eta' | 'order'
let finCustomFrom = '';
let finCustomTo = '';
const _finOpen = new Set();

// ── Time helpers ──
function getNow(){ return new Date(); }
let now = new Date(); // kept for backward compat — refreshed on each initDashboard call
calYear  = new Date().getFullYear();
calMonth = new Date().getMonth();

// ═══════════════════════════════════════════════════
// IndexedDB — unlimited storage (no 5MB cap)
// ═══════════════════════════════════════════════════
const IDB_NAME    = 'BlossomDB';
const IDB_VERSION = 2;
const IDB_STORE   = 'appData';

function _openIDB(){
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(req.error);
  });
}

function _idbPut(key, value){
  return _openIDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  }));
}

function _idbGet(key){
  return _openIDB().then(db => new Promise((res, rej) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  }));
}

// ═══════════════════════════════════════════════════
// saveData — writes everything to IndexedDB
// ═══════════════════════════════════════════════════
async function saveData(){
  try {
    await _idbPut('biz_products',           products);
    await _idbPut('biz_reminders',          reminders);
    await _idbPut('biz_todos',              todos);
    await _idbPut('biz_calEvents',          calEvents);
    await _idbPut('biz_customers',          customers);
    await _idbPut('biz_shipments',          shipments);
    await _idbPut('biz_bundles',            bundles);
    await _idbPut('biz_collections',        collections);
    await _idbPut('biz_invoices',           invoices);
    await _idbPut('biz_floraOrders',        floraOrders);
    await _idbPut('biz_floraOrderCounter',  floraOrderCounter);
    await _idbPut('biz_supplies',           supplies);
    await _idbPut('biz_vipSettings',        vipSettings);
    await _idbPut('biz_vipSkipped',         vipSkipped);
    await _idbPut('biz_losses',             losses);
    await _idbPut('biz_expenses',           expenses);
  } catch(e){
    console.warn('saveData error', e);
    showToast('⚠️ Could not save data', 'err');
  }
}

// ═══════════════════════════════════════════════════
// loadData — reads from IndexedDB, falls back to localStorage
// ═══════════════════════════════════════════════════
async function loadData(){
  try {
    const _g = async (key, fallbackLSKey, def) => {
      let val = await _idbGet(key);
      if(val === undefined || val === null){
        const ls = localStorage.getItem(fallbackLSKey || key);
        val = ls ? JSON.parse(ls) : def;
      }
      return val;
    };

    products = await _g('biz_products', 'biz_products', []);

    // Migrate old separate photo store if needed
    try {
      const oldPhotos = JSON.parse(localStorage.getItem('biz_product_photos') || 'null');
      if(oldPhotos && Object.keys(oldPhotos).length){
        products.forEach(p => {
          if(!p.photo && oldPhotos[p.id]) p.photo = oldPhotos[p.id];
          (p.variants||[]).forEach(v => {
            const vk = p.id+'__v__'+v.id;
            if(!v.photo && oldPhotos[vk]) v.photo = oldPhotos[vk];
          });
        });
      }
    } catch(e){}

    reminders         = await _g('biz_reminders',          'biz_reminders',          []);
    todos             = await _g('biz_todos',               'biz_todos',              []);
    calEvents         = await _g('biz_calEvents',           'biz_calEvents',          []);
    customers         = await _g('biz_customers',           'biz_customers',          []);
    shipments         = await _g('biz_shipments',           'biz_shipments',          []);
    bundles           = await _g('biz_bundles',             'biz_bundles',            []);
    collections       = await _g('biz_collections',         'biz_collections',        []);
    invoices          = await _g('biz_invoices',            'biz_invoices',           []);
    floraOrders       = await _g('biz_floraOrders',         'biz_floraOrders',        []);
    floraOrderCounter = await _g('biz_floraOrderCounter',   'biz_floraOrderCounter',  0);
    floraOrderCounter = parseInt(floraOrderCounter, 10) || floraOrders.length;
    supplies          = await _g('biz_supplies',            'biz_supplies',           []);
    losses            = await _g('biz_losses',              'biz_losses',             []);
    expenses          = await _g('biz_expenses',            'biz_expenses',           []);
    vipSkipped        = await _g('biz_vipSkipped',          'biz_vipSkipped',         []);
    const vs          = await _g('biz_vipSettings',         'biz_vipSettings',        {});
    vipSettings       = { minInvoices:5, minSpent:500, inactiveDays:30, discount:10, ...vs };

  } catch(e){
    console.warn('loadData error', e);
  }
}

// ── Helper: update customer's last order date ──
function updateCustLastOrder(customerName, dateStr){
  if(!customerName) return;
  const c = customers.find(x => x.name && x.name.toLowerCase() === customerName.toLowerCase());
  if(!c) return;
  const d = dateStr || new Date().toISOString().split('T')[0];
  if(!c.lastOrderDate || d > c.lastOrderDate) c.lastOrderDate = d;
}

// ── Compatibility stub (saveData handles all IDB writes) ──
function syncToIDB(){ /* no-op */ }
function loadExpenses(){ /* no-op — loaded by loadData() */ }
function saveExpenses(){ _idbPut('biz_expenses', expenses).catch(e => console.warn('saveExpenses error', e)); }
