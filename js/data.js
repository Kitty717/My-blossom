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
let losses = [];
let adCampaigns = [];

// ── VIP settings ──
let vipSettings = { minInvoices: 5, minSpent: 500, inactiveDays: 30, discount: 10 };
let vipSkipped = [];

// ── Expenses ──
let expenses = [];
let expFilter = 'all';

// ── Finance filter state ──
let finPeriod = 'month';
let finStore  = 'all';
let finCostBy = 'eta';
let finCustomFrom = '';
let finCustomTo = '';
const _finOpen = new Set();

// ── Time helpers ──
function getNow(){ return new Date(); }
let now = new Date();
calYear  = new Date().getFullYear();
calMonth = new Date().getMonth();

// ═══════════════════════════════════════════════════
// IndexedDB
// VERSION 3: photos separated into their own store
// ═══════════════════════════════════════════════════
const IDB_NAME      = 'BlossomDB';
const IDB_VERSION   = 3;
const IDB_STORE     = 'appData';
const IDB_PHOTOS    = 'photoData';  // ← NEW: photos live here, NOT in products

let _dbPromise = null;
function _openIDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(IDB_STORE))  db.createObjectStore(IDB_STORE);
      if(!db.objectStoreNames.contains(IDB_PHOTOS)) db.createObjectStore(IDB_PHOTOS);
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => { _dbPromise = null; rej(req.error); };
  });
  return _dbPromise;
}

function _idbPut(key, value, store=IDB_STORE){
  return _openIDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  }));
}

function _idbGet(key, store=IDB_STORE){
  return _openIDB().then(db => new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  }));
}

function _idbDelete(key, store=IDB_STORE){
  return _openIDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  }));
}

function _idbGetAllKeys(store=IDB_STORE){
  return _openIDB().then(db => new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  }));
}

// ═══════════════════════════════════════════════════
// PHOTO HELPERS — compress + store separately
// ═══════════════════════════════════════════════════

// Compress a base64 image to max 600px wide, 0.75 JPEG quality
function _compressPhoto(dataUrl, maxPx=600, quality=0.75){
  return new Promise(res => {
    if(!dataUrl || !dataUrl.startsWith('data:image')) { res(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if(w > maxPx){ h = Math.round(h * maxPx / w); w = maxPx; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      res(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => res(dataUrl); // fallback: keep original
    img.src = dataUrl;
  });
}

// Save a photo for a product or variant. key = productId or "productId__v__variantId"
async function savePhoto(key, dataUrl){
  if(!key) return;
  if(!dataUrl){ await _idbDelete(key, IDB_PHOTOS); return; }
  const compressed = await _compressPhoto(dataUrl);
  await _idbPut(key, compressed, IDB_PHOTOS);
}

// Load a single photo
async function loadPhoto(key){
  if(!key) return '';
  return (await _idbGet(key, IDB_PHOTOS)) || '';
}

// Delete all photos for a product (main + all variants)
async function deleteProductPhotos(productId){
  const keys = await _idbGetAllKeys(IDB_PHOTOS);
  const toDelete = keys.filter(k => k === productId || k.startsWith(productId+'__v__'));
  await Promise.all(toDelete.map(k => _idbDelete(k, IDB_PHOTOS)));
}

// Attach photos back onto products array in memory (used after loadData)
async function _hydratePhotos(){
  const keys = await _idbGetAllKeys(IDB_PHOTOS);
  if(!keys.length) return;
  const db = await _openIDB();
  // batch-read all photos at once
  const entries = await new Promise((res, rej) => {
    const tx = db.transaction(IDB_PHOTOS, 'readonly');
    const store = tx.objectStore(IDB_PHOTOS);
    const result = {};
    const req = store.openCursor();
    req.onsuccess = e => {
      const cursor = e.target.result;
      if(cursor){ result[cursor.key] = cursor.value; cursor.continue(); }
      else res(result);
    };
    req.onerror = () => rej(req.error);
  });
  products.forEach(p => {
    if(entries[p.id]) p.photo = entries[p.id];
    (p.variants||[]).forEach(v => {
      const vk = p.id+'__v__'+v.id;
      if(entries[vk]) v.photo = entries[vk];
    });
  });
}

// ═══════════════════════════════════════════════════
// saveData — writes everything EXCEPT photos
// Photos are saved individually via savePhoto()
// ═══════════════════════════════════════════════════
async function saveData(){
  try {
    // Strip photos from products before saving — photos live in IDB_PHOTOS
    const productsClean = products.map(p => {
      const { photo, ...rest } = p;
      rest.variants = (p.variants||[]).map(v => {
        const { photo: vp, ...vrest } = v; return vrest;
      });
      return rest;
    });

    await _idbPut('biz_products',           productsClean);
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
// loadData — reads from IDB, falls back to localStorage
// Then silently migrates any photos still embedded in products
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

    // ── SILENT MIGRATION: move embedded photos into IDB_PHOTOS ──
    let needsMigration = false;
    for(const p of products){
      if(p.photo && p.photo.startsWith('data:')){
        await savePhoto(p.id, p.photo);
        delete p.photo;
        needsMigration = true;
      }
      for(const v of (p.variants||[])){
        if(v.photo && v.photo.startsWith('data:')){
          await savePhoto(p.id+'__v__'+v.id, v.photo);
          delete v.photo;
          needsMigration = true;
        }
      }
    }
    if(needsMigration){
      // Save clean products immediately
      const productsClean = products.map(p => {
        const { photo, ...rest } = p;
        rest.variants = (p.variants||[]).map(v => { const { photo:vp, ...vr } = v; return vr; });
        return rest;
      });
      await _idbPut('biz_products', productsClean);
    }

    // ── Migrate old separate localStorage photo store ──
    try {
      const oldPhotos = JSON.parse(localStorage.getItem('biz_product_photos') || 'null');
      if(oldPhotos && Object.keys(oldPhotos).length){
        for(const [k, v] of Object.entries(oldPhotos)){
          if(v) await savePhoto(k, v);
        }
        localStorage.removeItem('biz_product_photos');
      }
    } catch(e){}

    // ── Now hydrate photos from IDB_PHOTOS back onto products in memory ──
    await _hydratePhotos();

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
    adCampaigns       = await _g('biz_adCampaigns',         'biz_adCampaigns',        []);
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

// ── Compatibility stubs ──
function syncToIDB(){ /* no-op */ }
function loadExpenses(){ /* no-op — loaded by loadData() */ }
function saveExpenses(){ _idbPut('biz_expenses', expenses).catch(e => console.warn('saveExpenses error', e)); }

// ═══════════════════════════════════════════════════
// TARGETED SAVES — each section saves only its data
// Use these instead of saveData() for single-section changes
// ═══════════════════════════════════════════════════
function saveProducts(){
  const clean = products.map(p => {
    const { photo, ...rest } = p;
    rest.variants = (p.variants||[]).map(v => { const { photo:vp, ...vr } = v; return vr; });
    return rest;
  });
  return _idbPut('biz_products', clean).catch(e => console.warn('saveProducts error', e));
}
function saveCustomers()    { return _idbPut('biz_customers',   customers).catch(e=>console.warn(e)); }
function saveInvoices()     { return _idbPut('biz_invoices',    invoices).catch(e=>console.warn(e)); }
function saveShipments()    { return _idbPut('biz_shipments',   shipments).catch(e=>console.warn(e)); }
function saveFloraOrders()  { return _idbPut('biz_floraOrders', floraOrders).then(()=>_idbPut('biz_floraOrderCounter', floraOrderCounter)).catch(e=>console.warn(e)); }
function saveBundles()      { return _idbPut('biz_bundles',     bundles).catch(e=>console.warn(e)); }
function saveCollections()  { return _idbPut('biz_collections', collections).catch(e=>console.warn(e)); }
function saveSupplies()     { return _idbPut('biz_supplies',    supplies).catch(e=>console.warn(e)); }
function saveLosses()       { return _idbPut('biz_losses',      losses).catch(e=>console.warn(e)); }
function saveAdCampaigns()  { return _idbPut('biz_adCampaigns', adCampaigns).catch(e=>console.warn(e)); }
function saveReminders()    { return _idbPut('biz_reminders',   reminders).catch(e=>console.warn(e)); }
function saveTodos()        { return _idbPut('biz_todos',       todos).catch(e=>console.warn(e)); }
function saveCalEvents()    { return _idbPut('biz_calEvents',   calEvents).catch(e=>console.warn(e)); }
function saveVipSettings()  { return Promise.all([_idbPut('biz_vipSettings', vipSettings), _idbPut('biz_vipSkipped', vipSkipped)]).catch(e=>console.warn(e)); }
