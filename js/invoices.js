// ═══════════════════════════════════════════════════
// INVOICE SYSTEM  (js/invoices.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, inventory.js, dashboard.js, customers.js, currency.js
// ═══════════════════════════════════════════════════

let _invTab = 'all';
let _invStore = 'all';
let _invStatusSel = document.getElementById('inv-status');

function setInvStore(store){
  _invStore = store;
  ['all','ra','flora'].forEach(s=>{
    const btn = document.getElementById('inv-store-'+s);
    if(!btn) return;
    if(s===store){
      btn.style.background = 'var(--rose)';
      btn.style.color = 'white';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--muted)';
    }
  });
  renderInvoices();
}

function setInvTab(tab){
  _invTab = tab;
  ['all','unpaid','partial','shipped','paid','cancelled','orders'].forEach(t=>{
    const btn = document.getElementById('inv-tab-'+t);
    if(btn){ btn.className = t===tab ? 'btn btn-p btn-sm' : 'btn btn-g btn-sm'; }
  });
  const ordersEl = document.getElementById('shop-orders-list');
  const invoicesEl = document.getElementById('inv-page-list');
  const searchBar = document.getElementById('inv-search-bar');
  if(tab === 'orders'){
    if(ordersEl) ordersEl.style.display = '';
    if(invoicesEl) invoicesEl.style.display = 'none';
    if(searchBar) searchBar.style.display = 'none';
    renderShopOrders();
  } else {
    if(ordersEl) ordersEl.style.display = 'none';
    if(invoicesEl) invoicesEl.style.display = '';
    if(searchBar) searchBar.style.display = '';
    renderInvoices();
  }
}

function renderInvoices(){
  const el = document.getElementById('inv-page-list');
  if(!el) return;
  const q = (document.getElementById('inv-search')?.value||'').toLowerCase().trim();
  let list = [...invoices].sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  if(_invStore !== 'all') list = list.filter(i => (i.store||'ra') === _invStore);
  if(_invTab !== 'all') list = list.filter(i => i.status === _invTab);
  if(q) list = list.filter(i =>
    (i.customer||'').toLowerCase().includes(q) ||
    (i.num||'').toLowerCase().includes(q)
  );
  if(!list.length){
    el.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:14px">${q||_invTab!=='all'?'No invoices match':'No invoices yet'}<br><span style="font-size:12px">${q||_invTab!=='all'?'Try a different search or filter':'Tap + New to create one'}</span></div>`;
    return;
  }
  const STATUS = { unpaid:{label:'Unpaid',cls:'br'}, partial:{label:'Partial',cls:'ba'}, shipped:{label:'Shipped',cls:'bb'}, paid:{label:'Paid',cls:'bg'}, cancelled:{label:'Cancelled',cls:'bm'} };
  el.innerHTML = list.map(inv => {
    const st = STATUS[inv.status] || STATUS.unpaid;
    const date = inv.date ? new Date(inv.date+'T12:00:00').toLocaleDateString('en',{day:'numeric',month:'short'}) : '—';
    const storeIcon = inv.store === 'flora' ? '🌸' : '🏪';
    const shopIcon = inv.fromShop ? '🛍️ ' : '';
    const owes = inv.status==='partial' ? (inv.total-(inv.paidAmt||0)) : 0;
    return `<div class="inv" onclick="openInvoiceDetail('${inv.id}')">
      <div class="inv-left">
        <div class="inv-top">
          <span style="font-size:13px">${storeIcon}</span>
          <span class="inv-name">${shopIcon}${inv.customer||'—'}</span>
        </div>
        <div class="inv-meta">#${inv.num} · ${date}${owes>0?' · <b style="color:var(--amber)">owes $'+owes.toFixed(2)+'</b>':''}</div>
      </div>
      <div class="inv-right">
        <span class="inv-amt">$${(inv.total||0).toFixed(2)}</span>
        <span class="b ${st.cls}" style="font-size:10px">${st.label}</span>
      </div>
      <button class="btn btn-green btn-sm" style="padding:7px 10px;font-size:11px;flex-shrink:0" onclick="event.stopPropagation();shareInvoiceWA('${inv.id}')">📤</button>
    </div>`;
  }).join('');
}

function renderWholesale(){
  const raInvs = invoices.filter(i => (i.store === 'ra' || i.store === 'both') && i.status !== 'cancelled');
  const totalInvoiced = raInvs.reduce((s,i)=>s+(i.total||0), 0);
  const collected     = raInvs.filter(i=>i.status==='paid').reduce((s,i)=>s+(i.total||0),0)
                      + raInvs.filter(i=>i.status==='partial').reduce((s,i)=>s+(i.paidAmt||0),0);
  const stillOwed     = raInvs.reduce((s,i)=>{
    if(i.status==='unpaid'||i.status==='shipped')  return s+(i.total||0);
    if(i.status==='partial') return s+((i.total||0)-(i.paidAmt||0));
    return s;
  },0);

  const g = id => document.getElementById(id);
  if(g('ws-total-invoiced')) g('ws-total-invoiced').textContent = '$'+totalInvoiced.toFixed(0);
  if(g('ws-collected'))      g('ws-collected').textContent      = '$'+collected.toFixed(0);
  if(g('ws-still-owed'))     g('ws-still-owed').textContent     = '$'+stillOwed.toFixed(0);
  if(g('ws-stat-orders'))    g('ws-stat-orders').textContent    = raInvs.length;

  // Debt customers — build from invoices (sum per customer)
  const debtMap = {};
  raInvs.forEach(inv=>{
    if(!inv.customer) return;
    const owed = (inv.status==='unpaid'||inv.status==='shipped') ? (inv.total||0)
               : inv.status==='partial' ? ((inv.total||0)-(inv.paidAmt||0))
               : 0;
    if(owed > 0){
      if(!debtMap[inv.customer]) debtMap[inv.customer] = {name:inv.customer, owed:0, invoices:0};
      debtMap[inv.customer].owed    += owed;
      debtMap[inv.customer].invoices += 1;
    }
  });
  const debtList = Object.values(debtMap).sort((a,b)=>b.owed-a.owed);
  const debtEl = g('ws-debt-list');
  if(debtEl){
    if(!debtList.length){
      debtEl.innerHTML = '<div style="color:var(--green);font-size:13px;text-align:center;padding:8px 0;font-weight:600">No outstanding debts 🎉</div>';
    } else {
      debtEl.innerHTML = debtList.map(d=>`
        <div class="lr">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--red-soft);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--red);flex-shrink:0">${d.name.charAt(0).toUpperCase()}</div>
          <div class="lif">
            <div class="ln">${d.name}</div>
            <div class="lsub">${d.invoices} unpaid invoice${d.invoices!==1?'s':''}</div>
          </div>
          <div class="lright">
            <div class="lamt" style="color:var(--red)">$${d.owed.toFixed(2)}</div>
            <span class="b br" style="font-size:10px">owes</span>
          </div>
        </div>`).join('');
    }
  }

  // Recent invoices
  const STATUS = { unpaid:{label:'Unpaid',cls:'br'}, partial:{label:'Partial',cls:'ba'}, shipped:{label:'Shipped',cls:'bb'}, paid:{label:'Paid',cls:'bg'}, cancelled:{label:'Cancelled',cls:'bm'} };
  const recent = [...raInvs].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,8);
  const listEl = g('ws-recent-list');
  if(!listEl) return;
  if(!recent.length){
    listEl.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0">No RA invoices yet — tap + New Invoice to start</div>';
    return;
  }
  listEl.innerHTML = recent.map(inv=>{
    const st = STATUS[inv.status]||STATUS.unpaid;
    const date = inv.date ? new Date(inv.date+'T12:00:00').toLocaleDateString('en',{day:'numeric',month:'short'}) : '—';
    const owes = inv.status==='partial' ? (inv.total-(inv.paidAmt||0)) : 0;
    return `<div class="lr" onclick="openInvoiceDetail('${inv.id}')">
      <div class="lif">
        <div class="ln">#${inv.num} · ${inv.customer||'—'}</div>
        <div class="lsub">${date} · ${(inv.items||[]).length} item${(inv.items||[]).length!==1?'s':''}${owes>0?' · Owes <b style="color:var(--amber)">$'+owes.toFixed(2)+'</b>':''}</div>
      </div>
      <div class="lright"><div class="lamt">$${(inv.total||0).toFixed(2)}</div><span class="b ${st.cls}" style="font-size:10px">${st.label}</span></div>
    </div>`;
  }).join('');
}

function openNewInvoice(preStore){
  document.getElementById('inv-edit-id').value = '';
  document.getElementById('inv-modal-title').textContent = '🧾 New Invoice';
  if(preStore) document.getElementById('inv-store').value = preStore;
  const maxInvNum = invoices.reduce((mx,inv)=>{ const n=parseInt((inv.num||'').replace(/^INV-/,''),10)||0; return Math.max(mx,n); },0);
  const nextNum = 'INV-' + String(maxInvNum + 1).padStart(3,'0');
  document.getElementById('inv-modal-num').textContent = '#' + nextNum;
  document.getElementById('inv-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('inv-customer').value = '';
  document.getElementById('inv-delivery').value = '';
  document.getElementById('inv-discount').value = '';
  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-status').value = 'unpaid';
  document.getElementById('inv-paid-amt').value = '';
  document.getElementById('inv-paid-row').style.display = 'none';
  const dueEl = document.getElementById('inv-due-date');
  if(dueEl){ const d=new Date(); d.setDate(d.getDate()+7); dueEl.value=d.toISOString().slice(0,10); }
  const pmEl = document.getElementById('inv-payment-method');
  if(pmEl) pmEl.value = '';
  const infoEl = document.getElementById('inv-cust-info');
  if(infoEl) infoEl.style.display='none';
  document.getElementById('iitems').innerHTML = '';
  rebuildInvProductPicker();
  buildInvCustomerList();
  recalcInvTotal();
  // Status change listener
  document.getElementById('inv-status').onchange = function(){
    document.getElementById('inv-paid-row').style.display = this.value==='partial' ? '' : 'none';
  };
  showModal('m-invoice');
}

function rebuildInvProductPicker(){ /* no-op: picker is now sheet-based */ }
function buildInvProdOptions(sel){ /* no-op: picker is now sheet-based */ }
function addInvItem(){ openProdPicker(); }

// ── Product Picker Sheet ──────────────────────────────────────────────────
let _ppickStore = 'ra';
let _ppickProducts = [];

function openProdPicker(){
  _ppickStore = document.getElementById('inv-store')?.value || 'ra';
  // RA products can be sold in Flora (Flora pulls from RA stock), so show all products in Flora picker
  _ppickProducts = products.filter(p => !isProductInTransit(p) && (_ppickStore === 'flora' ? true : (!p.store || p.store === 'ra' || p.store === 'both')));
  document.getElementById('ppick-search').value = '';
  document.getElementById('ppick-title').textContent = '🛒 Add Product';
  document.getElementById('ppick-list').style.display = 'flex';
  document.getElementById('ppick-variants').style.display = 'none';
  ppickFilter();
  showModal('m-prod-picker');
}

function ppickFilter(){
  const q = document.getElementById('ppick-search').value.toLowerCase().trim();
  const list = _ppickProducts.filter(p => !q ||
    p.name.toLowerCase().includes(q) ||
    (p.category||'').toLowerCase().includes(q) ||
    p.variants.some(v=>
      (v.name||'').toLowerCase().includes(q) ||
      (v.label||'').toLowerCase().includes(q) ||
      (v.size||'').toLowerCase().includes(q)
    )
  );
  const el = document.getElementById('ppick-list');
  if(!list.length){
    el.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:24px">No products found</div>`;
    return;
  }
  el.innerHTML = list.map(p => {
    const price = _ppickStore==='ra' ? (p.priceRAPiece||0) : (p.priceFlora||p.priceRAPiece||0);
    const totalQty = (p.variants||[]).reduce((s,v)=>s+((p.store==='flora'?v.flora:v.ra)||0),0);
    const thumb = p.photo
      ? `<img src="${p.photo}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0">`
      : `<div style="width:44px;height:44px;border-radius:10px;background:var(--rose-soft);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${p.emoji||'📦'}</div>`;
    return `<div onclick="ppickSelectProduct('${p.id}')" style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--grey);border-radius:14px;cursor:pointer;transition:background 0.12s" onmousedown="this.style.background='var(--rose-pale)'" onmouseup="this.style.background='var(--grey)'" ontouchend="this.style.background='var(--grey)'">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${(p.variants||[]).length} variant${(p.variants||[]).length!==1?'s':''} · ${totalQty} in stock</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--rose);flex-shrink:0">$${price.toFixed(2)}</div>
    </div>`;
  }).join('');
}

function ppickSelectProduct(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  const variants = p.variants||[];
  // If only one variant, add directly
  if(variants.length === 1){
    ppickAddItem(pid, variants[0].id);
    return;
  }
  // Show variant picker
  document.getElementById('ppick-list').style.display = 'none';
  const vp = document.getElementById('ppick-variants');
  vp.style.display = 'flex';
  document.getElementById('ppick-var-title').textContent = (p.emoji||'📦') + ' ' + p.name;
  const price = _ppickStore==='ra' ? (p.priceRAPiece||0) : (p.priceFlora||0);
  document.getElementById('ppick-var-list').innerHTML = variants.map(v => {
    const qty = (p.store==='flora' ? v.flora : v.ra)||0;
    const vthumb = v.photo
      ? `<img src="${v.photo}" style="width:40px;height:40px;border-radius:9px;object-fit:cover;flex-shrink:0">`
      : (v.colorHex && v.colorHex!=='#ede6e8' && v.colorHex!=='#f4a0b0')
        ? `<div style="width:40px;height:40px;border-radius:9px;background:${v.colorHex};flex-shrink:0;border:1.5px solid var(--grey2)"></div>`
        : `<div style="width:40px;height:40px;border-radius:9px;background:var(--rose-soft);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${p.emoji||'📦'}</div>`;
    return `<div onclick="ppickAddItem('${pid}','${v.id}')" style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--grey);border-radius:14px;cursor:pointer;transition:background 0.12s" onmousedown="this.style.background='var(--rose-pale)'" onmouseup="this.style.background='var(--grey)'" ontouchend="this.style.background='var(--grey)'">
      ${vthumb}
      <div style="flex:1">
        <div style="font-size:14px;font-weight:600;color:var(--ink)">${v.label||''} ${v.name||'Standard'}</div>
        ${v.size?`<div style="font-size:11px;color:var(--muted)">${v.size}</div>`:''}
        <div style="font-size:11px;color:var(--muted);margin-top:1px">${qty} in stock</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--rose);flex-shrink:0">$${price.toFixed(2)}</div>
    </div>`;
  }).join('');
}

function ppickBackToProducts(){
  document.getElementById('ppick-list').style.display = 'flex';
  document.getElementById('ppick-variants').style.display = 'none';
}

function ppickAddItem(pid, vid, silent){
  const p = products.find(x=>x.id===pid);
  const v = p?.variants.find(x=>x.id===vid) || p?.variants[0];
  if(!p||!v) return;
  const store = _ppickStore;
  const isRA = store === 'ra';
  // Use variant price override if set, else product price
  const piecePrice = isRA ? ((v.pricePiece)||p.priceRAPiece||0) : (p.priceFlora||0);
  const dozenPrice = (v.priceDozen)||p.priceRADozen||0;
  const su = (p.standUnit&&p.standUnit.qty&&p.standUnit.price) ? p.standUnit : null;
  const row = document.createElement('div');
  row.className = 'inv-item-card';
  row.dataset.pid = pid;
  row.dataset.vid = vid;
  const thumbSrc = (v.photo && v.photo.startsWith('data:')) ? v.photo : (p.photo||'');
  const thumb = thumbSrc
    ? `<img src="${thumbSrc}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;flex-shrink:0">`
    : `<div style="width:40px;height:40px;border-radius:10px;background:var(--rose-soft);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${p.emoji||'📦'}</div>`;
  const varLabel = (v.label||v.name) && (v.label||v.name)!=='Standard' ? `<div style="font-size:11px;color:var(--muted)">${v.label||''} ${v.name||''}</div>` : '';
  const hasPriceOverride = v.pricePiece || v.priceDozen;
  row.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        ${varLabel}
        ${hasPriceOverride?`<div style="font-size:10px;color:var(--amber);font-weight:600">💲 Custom price variant</div>`:''}
      </div>
      <button onclick="this.closest('.inv-item-card').remove();recalcInvTotal()" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0;flex-shrink:0;line-height:1">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end">
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Qty</div>
        <input class="fi inv-item-qty" type="number" value="1" min="1" style="font-size:14px;font-weight:700;text-align:center;padding:9px" oninput="recalcInvTotal()">
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Price $</div>
        <input class="fi inv-item-price" type="number" value="${piecePrice.toFixed(2)}" step="0.01" style="font-size:14px;font-weight:700;text-align:center;padding:9px" oninput="recalcInvTotal()">
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:4px">Disc $</div>
        <input class="fi inv-item-disc" type="number" value="0" step="0.01" min="0" style="font-size:14px;font-weight:700;text-align:center;padding:9px;border-color:var(--green-soft)" oninput="recalcInvTotal()">
      </div>
    </div>
    ${isRA && dozenPrice ? `
    <div style="margin-top:8px;background:var(--amber-soft);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:10px">
      <span style="font-size:12px;color:var(--amber);font-weight:600">📦 Order by dozen?</span>
      <input class="inv-dozen-inp" type="number" min="0" placeholder="0" style="width:52px;padding:5px 8px;border:1.5px solid var(--amber);border-radius:7px;font-size:13px;font-weight:700;text-align:center;background:white;color:var(--ink)" oninput="onDozenChange(this,'${pid}','${vid}')">
      <span class="inv-dozen-hint" style="font-size:11px;color:var(--muted)">dozens = 0 pcs</span>
    </div>` : ''}
    ${isRA && su ? `
    <div style="margin-top:8px;background:var(--grey);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:10px;border:1px solid var(--grey2)">
      <span style="font-size:12px;color:var(--ink);font-weight:600">📦 ${su.name} (${su.qty} pcs = $${su.price.toFixed(2)})</span>
      <button onclick="ppickApplyStand(this,'${pid}','${vid}')" style="margin-left:auto;padding:5px 10px;background:var(--amber);color:white;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Use Stand Price</button>
    </div>` : ''}`;
  row.style.cssText = 'background:var(--blush);border-radius:14px;padding:12px;border:1px solid var(--grey2)';
  document.getElementById('iitems').appendChild(row);
  recalcInvTotal();
  if(!silent) closeModal('m-prod-picker');
}

function onInvProdChange(sel){ /* no-op: replaced by picker */ }

function ppickApplyStand(btn, pid, vid){
  const p = products.find(x=>x.id===pid);
  const v = p?.variants.find(x=>x.id===vid)||p?.variants[0];
  if(!p||!p.standUnit) return;
  const row = btn.closest('.inv-item-card');
  const qtyInp = row.querySelector('.inv-item-qty');
  const priceInp = row.querySelector('.inv-item-price');
  if(qtyInp) qtyInp.value = p.standUnit.qty;
  if(priceInp) priceInp.value = p.standUnit.price.toFixed(2);
  recalcInvTotal();
  showToast(`Stand price applied: $${p.standUnit.price.toFixed(2)} for ${p.standUnit.qty} pcs`);
}

function onDozenChange(dozenInp, pid, vid){
  const p = products.find(x=>x.id===pid);
  const v = p?.variants.find(x=>x.id===vid)||p?.variants[0];
  const row = dozenInp.closest('.inv-item-card');
  const dozens = parseInt(dozenInp.value,10)||0;
  const pieces = dozens * 12;
  const hint = row.querySelector('.inv-dozen-hint');
  if(hint) hint.textContent = `dozens = ${pieces} pcs`;
  const qtyInp = row.querySelector('.inv-item-qty');
  const priceInp = row.querySelector('.inv-item-price');
  if(qtyInp) qtyInp.value = pieces || 1;
  // Apply dozen price per piece (variant override or product level)
  const dozenPricePerPc = (v?.priceDozen)||p?.priceRADozen||0;
  if(priceInp && dozens > 0 && dozenPricePerPc) priceInp.value = dozenPricePerPc.toFixed(2);
  recalcInvTotal();
}

function recalcInvTotal(){
  let sub = 0;
  document.querySelectorAll('#iitems > div').forEach(row => {
    const qty   = parseFloat(row.querySelector('.inv-item-qty')?.value)||0;
    const price = parseFloat(row.querySelector('.inv-item-price')?.value)||0;
    const disc  = parseFloat(row.querySelector('.inv-item-disc')?.value)||0;
    sub += Math.max(0, qty * price - disc);
  });
  // Auto-apply VIP discount % if set and sub > 0
  const discEl = document.getElementById('inv-discount');
  const vipPct = discEl ? parseFloat(discEl.dataset.vipPct||'0') : 0;
  if(vipPct > 0 && sub > 0 && discEl){
    discEl.value = parseFloat((sub * vipPct / 100).toFixed(2));
  }
  const delivery = parseFloat(document.getElementById('inv-delivery')?.value)||0;
  const discount = parseFloat(document.getElementById('inv-discount')?.value)||0;
  const total = Math.max(0, sub + delivery - discount);
  const el = document.getElementById('inv-total-preview');
  if(el) el.textContent = '$' + total.toFixed(2);
}

function buildInvCustomerList(){ /* no-op: now using invCustSearch */ }
function invCheckNewCustomer(inp){ /* no-op */ }

function invCustSearch(inp){
  const val = inp.value.trim();
  const dd = document.getElementById('inv-cust-dropdown');
  const infoEl = document.getElementById('inv-cust-info');
  infoEl.style.display = 'none';
  // Clear VIP discount if customer changed
  const discEl = document.getElementById('inv-discount');
  if(discEl && !val) { discEl.value = ''; recalcInvTotal(); }
  if(!val){ dd.style.display='none'; return; }
  const matches = customers.filter(c=>!c.blacklisted && c.name.toLowerCase().includes(val.toLowerCase()));
  let html = matches.map(c=>`
    <div onclick="invCustSelect('${c.id}')" style="padding:11px 14px;cursor:pointer;border-bottom:1px solid var(--grey2);font-size:14px;font-weight:500;color:var(--ink)" onmousedown="event.preventDefault()">
      <div>${c.name}</div>
      ${c.wa||c.city ? `<div style="font-size:11px;color:var(--muted);margin-top:1px">${[c.wa,c.city].filter(Boolean).join(' · ')}</div>` : ''}
    </div>`).join('');
  // Always show + Add if name not exact match
  const exact = customers.some(c=>c.name.toLowerCase()===val.toLowerCase());
  if(!exact){
    html += `<div onclick="invCustGoAdd()" style="padding:11px 14px;cursor:pointer;font-size:13px;font-weight:700;color:var(--rose);display:flex;align-items:center;gap:6px" onmousedown="event.preventDefault()">➕ Add "${val}" as new customer</div>`;
  }
  dd.innerHTML = html;
  dd.style.display = 'block';
}

function invCustSelect(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  document.getElementById('inv-customer').value = c.name;
  document.getElementById('inv-cust-dropdown').style.display = 'none';
  invAutoFillCustomer(document.getElementById('inv-customer'));
}

function invCustHideDropdown(){
  const dd = document.getElementById('inv-cust-dropdown');
  if(dd) dd.style.display = 'none';
}

function invCustGoAdd(){
  const name = document.getElementById('inv-customer').value.trim();
  closeModal('m-invoice');
  showPage('customers'); setNav('customers');
  setTimeout(()=>{
    openNewCustomer();
    document.getElementById('nc-name').value = name;
  }, 300);
}

function invAutoFillCustomer(inp){
  const val = inp.value.trim();
  const cust = customers.find(c=>c.name&&c.name.toLowerCase()===val.toLowerCase());
  const infoEl = document.getElementById('inv-cust-info');
  if(!infoEl) return;
  if(cust && cust.vip && vipSettings.discount > 0){
    // Store VIP discount % on the element — recalcInvTotal will apply it automatically
    const discEl = document.getElementById('inv-discount');
    if(discEl){
      discEl.dataset.vipPct = vipSettings.discount;
      recalcInvTotal(); // apply immediately if items already in cart
    }
    showToast('⭐ VIP — '+vipSettings.discount+'% discount will auto-apply!', 'ok');
  } else {
    // Clear any stored VIP discount if non-VIP customer selected
    const discEl = document.getElementById('inv-discount');
    if(discEl) discEl.dataset.vipPct = '0';
  }
  if(cust && (cust.wa || cust.city)){
    const parts = [];
    if(cust.wa)   parts.push(`📱 ${cust.wa}`);
    if(cust.city) parts.push(`📍 ${cust.city}`);
    infoEl.innerHTML = parts.join('<span style="color:var(--blue);opacity:0.4;margin:0 4px">·</span>');
    infoEl.style.display = 'flex';
  } else {
    infoEl.style.display = 'none';
  }
}

function invQuickAddCustomer(){ /* no-op: replaced by invCustGoAdd */ }

function invUpdateStoreLabel(){
  // rebuilds product picker already via onchange — nothing extra needed
}

function saveInvoice(andShare){
  const store    = document.getElementById('inv-store').value;
  const date     = document.getElementById('inv-date').value;
  const dueDate  = document.getElementById('inv-due-date')?.value||'';
  const paymentMethod = document.getElementById('inv-payment-method')?.value||'';
  const customer = document.getElementById('inv-customer').value.trim();
  const delivery = parseFloat(document.getElementById('inv-delivery').value)||0;
  const discount = parseFloat(document.getElementById('inv-discount').value)||0;
  const status   = document.getElementById('inv-status').value;
  const paidAmt  = parseFloat(document.getElementById('inv-paid-amt').value)||0;
  const notes    = document.getElementById('inv-notes').value.trim();

  if(!customer){ showToast('Enter customer name','err'); return; }

  // Collect items
  const items = [];
  let sub = 0;
  document.querySelectorAll('#iitems .inv-item-card').forEach(row => {
    const pid   = row.dataset.pid;
    const vid   = row.dataset.vid;
    const qty   = parseFloat(row.querySelector('.inv-item-qty')?.value)||0;
    const price = parseFloat(row.querySelector('.inv-item-price')?.value)||0;
    if(!pid || qty<=0) return;
    const disc  = parseFloat(row.querySelector('.inv-item-disc')?.value)||0;
    const prod = products.find(p=>p.id===pid);
    const variant = prod?.variants.find(v=>v.id===vid);
    const itemTotal = Math.max(0, qty * price - disc);
    items.push({
      pid, vid,
      productId: pid, variantId: vid,
      name: prod ? prod.name : 'Product',
      variant: variant?.label||variant?.name||'',
      emoji: prod?.emoji||'📦',
      photo: (variant?.photo && variant.photo.startsWith('data:')) ? variant.photo : (prod?.photo||''),
      qty, price, disc,
      total: itemTotal
    });
    sub += itemTotal;
  });

  if(!items.length){ showToast('Add at least one item','err'); return; }

  // Stock check warning
  const overStock = items.filter(it => {
    const prod = products.find(p=>p.id===it.pid);
    const v = prod?.variants.find(vv=>vv.id===it.vid);
    if(!v) return false;
    const invStore = document.getElementById('inv-store')?.value || 'ra';
    const avail = (prod.store==='flora') ? (v.flora||0) : (v.ra||0);
    return it.qty > avail;
  });
  if(overStock.length){
    const names = overStock.map(it=>`• ${it.name} (qty: ${it.qty})`).join('\n');
    appConfirm('⚠️ Low Stock Warning', `These items exceed available stock:\n\n${names}\n\nSave anyway?`, 'Save Anyway', ()=>_doSaveInvoice(andShare));
    return;
  }
  _doSaveInvoice(andShare);
}

function _doSaveInvoice(andShare){
  const store    = document.getElementById('inv-store').value;
  const date     = document.getElementById('inv-date').value;
  const dueDate  = document.getElementById('inv-due-date')?.value||'';
  const paymentMethod = document.getElementById('inv-payment-method')?.value||'';
  const customer = document.getElementById('inv-customer').value.trim();
  const delivery = parseFloat(document.getElementById('inv-delivery').value)||0;
  const discount = parseFloat(document.getElementById('inv-discount').value)||0;
  const status   = document.getElementById('inv-status').value;
  const paidAmt  = parseFloat(document.getElementById('inv-paid-amt').value)||0;
  const notes    = document.getElementById('inv-notes').value.trim();
  const items = [];
  let sub = 0;
  document.querySelectorAll('#iitems .inv-item-card').forEach(row => {
    const pid   = row.dataset.pid;
    const vid   = row.dataset.vid;
    const qty   = parseFloat(row.querySelector('.inv-item-qty')?.value)||0;
    const price = parseFloat(row.querySelector('.inv-item-price')?.value)||0;
    if(!pid || qty<=0) return;
    const disc  = parseFloat(row.querySelector('.inv-item-disc')?.value)||0;
    const prod = products.find(p=>p.id===pid);
    const variant = prod?.variants.find(v=>v.id===vid);
    const itemTotal = Math.max(0, qty * price - disc);
    items.push({ pid, vid, productId: pid, variantId: vid, name: prod ? prod.name : 'Product', variant: variant?.label||variant?.name||'', emoji: prod?.emoji||'📦', photo: (variant?.photo && variant.photo.startsWith('data:')) ? variant.photo : (prod?.photo||''), qty, price, disc, total: itemTotal });
    sub += itemTotal;
  });
  const total = Math.max(0, sub + delivery - discount);
  const editId = document.getElementById('inv-edit-id').value;

  if(editId){
    const inv = invoices.find(i=>i.id===editId);
    if(inv){
      const prevStatus = inv.status;
      const prevTotal  = inv.total||0;
      const prevPaid   = inv.paidAmt||0;
      const prevCust   = inv.customer||'';
      // Reverse old debt contribution before applying new
      const oldCust = customers.find(c=>c.name&&c.name.toLowerCase()===prevCust.toLowerCase());
      if(oldCust){
        if(prevStatus==='unpaid')  oldCust.debt = Math.max(0,(oldCust.debt||0)-prevTotal);
        else if(prevStatus==='partial') oldCust.debt = Math.max(0,(oldCust.debt||0)-(prevTotal-prevPaid));
        else if(prevStatus==='shipped') oldCust.debt = Math.max(0,(oldCust.debt||0)-prevTotal);
      }
      inv.store=store; inv.date=date; inv.customer=customer;
      inv.dueDate=dueDate; inv.paymentMethod=paymentMethod;
      inv.delivery=delivery; inv.discount=discount; inv.status=status;
      inv.paidAmt=paidAmt; inv.notes=notes; inv.items=items; inv.total=total;
      // Apply new debt contribution
      const newCust = customers.find(c=>c.name&&c.name.toLowerCase()===customer.toLowerCase());
      if(newCust){
        if(status==='unpaid')  newCust.debt = (newCust.debt||0)+total;
        else if(status==='partial') newCust.debt = (newCust.debt||0)+(total-paidAmt);
        else if(status==='shipped') newCust.debt = (newCust.debt||0)+total;
      }
    }
  } else {
    const maxNum = invoices.reduce((mx,inv)=>{ const n=parseInt((inv.num||'').replace(/^INV-/,''),10)||0; return Math.max(mx,n); },0);
    const num = 'INV-' + String(maxNum + 1).padStart(3,'0');
    invoices.push({ id:'inv-'+Date.now(), num, store, date, dueDate, paymentMethod, customer, delivery, discount, status, paidAmt, notes, items, total, stockReduced: false });
  }

  // Auto-reduce stock when saved as shipped or paid
  const isNew = !editId;
  if(isNew){
    // New invoice: reduce if shipped/paid
    if(status === 'shipped' || status === 'paid'){
      const newInv = invoices[invoices.length-1];
      raInvoiceReduceStock(newInv);
    }
  } else {
    // Editing existing: re-sync stock if status or items changed
    const editedInv = invoices.find(i=>i.id===editId);
    if(editedInv){
      const nowActive = status === 'shipped' || status === 'paid';
      if(editedInv.stockReduced){
        // Was reduced — restore and re-reduce with new items
        raInvoiceRestoreStock(editedInv);
        if(nowActive) raInvoiceReduceStock(editedInv);
      } else if(nowActive){
        // Wasn't reduced but now active — reduce for first time
        raInvoiceReduceStock(editedInv);
      }
    }
  }

  // Update customer debt — only add debt once (on new invoice)
  const cust = customers.find(c=>c.name.toLowerCase()===customer.toLowerCase());
  if(cust && isNew){
    if(status==='unpaid')       cust.debt = (cust.debt||0) + total;
    else if(status==='partial') cust.debt = (cust.debt||0) + (total - paidAmt);
    else if(status==='shipped') cust.debt = (cust.debt||0) + total;
    // 'paid' = no debt, 'cancelled' = no debt
  }
  // Always update last order date
  updateCustLastOrder(customer, date);

  saveInvoices(); saveCustomers();

  // Sync status to Firebase if this invoice came from shop
  const savedInv = invoices.find(i=>i.id===editId) || invoices[invoices.length-1];
  if(savedInv?.fromShop && savedInv?.shopOrderId){
    const fbStatus = status==='paid'?'confirmed':status==='shipped'?'shipped':status==='cancelled'?'cancelled':'pending';
    const FB_DB_URL = 'https://ra-shop-3e01d-default-rtdb.firebaseio.com';
    fetch(`${FB_DB_URL}/orders/${savedInv.shopOrderId}/status.json`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(fbStatus)
    }).catch(()=>{});

    // WhatsApp thank you when marked paid
    if(status==='paid' && savedInv.customerPhone){
      const waPhone = (savedInv.customerPhone||'').replace(/\D/g,'');
      const waMsg = `Hi ${savedInv.customer||''}! 🌸\nYour order #${savedInv.num} has been paid & confirmed.\nThank you for shopping with RA Jemle LB! 💛`;
      setTimeout(()=>{
        appConfirm(
          '💬 Send Thank You?',
          `Send WhatsApp thank you to ${savedInv.customer}?`,
          '💬 Send',
          ()=>{ window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`,'_blank'); }
        );
      }, 500);
    }
  }

  closeModal('m-invoice');
  renderInvoices();
  initDashboard();
  checkVipPromotions();

  // Website sync modal
  onInvoiceSaved(items, store);

  if(andShare) shareInvoiceWA(editId || invoices[invoices.length-1]?.id);
  showToast('Invoice saved ✅');
}

// ── Invoice stock helpers ──
function raInvoiceReduceStock(inv){
  if(!inv || inv.stockReduced) return;
  const invStore = inv.store || 'ra';
  (inv.items||[]).forEach(it=>{
    const prod = products.find(p=>p.id===it.pid);
    const v = prod?.variants.find(vv=>vv.id===it.vid);
    if(v){
      if(invStore==='flora') v.flora = Math.max(0,(v.flora||0)-it.qty);
      else                   v.ra    = Math.max(0,(v.ra||0)-it.qty);
    }
  });
  inv.stockReduced = true;
}

function raInvoiceRestoreStock(inv){
  if(!inv || !inv.stockReduced) return;
  const invStore = inv.store || 'ra';
  (inv.items||[]).forEach(it=>{
    const prod = products.find(p=>p.id===it.pid);
    const v = prod?.variants.find(vv=>vv.id===it.vid);
    if(v){
      if(invStore==='flora') v.flora = (v.flora||0)+it.qty;
      else                   v.ra    = (v.ra||0)+it.qty;
    }
  });
  inv.stockReduced = false;
}

function deleteInvoice(id){
  appConfirm('Delete Invoice','Delete this invoice? Stock will be restored if it was shipped.','🗑️ Delete',()=>{
    const inv = invoices.find(i=>i.id===id);
    if(inv){
      raInvoiceRestoreStock(inv); // restore stock before removing
      // restore customer debt
      const cust = customers.find(c=>c.name&&c.name.toLowerCase()===inv.customer?.toLowerCase());
      if(cust){
        if(inv.status==='unpaid') cust.debt = Math.max(0,(cust.debt||0)-inv.total);
        else if(inv.status==='partial') cust.debt = Math.max(0,(cust.debt||0)-(inv.total-(inv.paidAmt||0)));
        else if(inv.status==='shipped') cust.debt = Math.max(0,(cust.debt||0)-inv.total);
      }
    }
    invoices = invoices.filter(i=>i.id!==id);
    saveInvoices(); saveCustomers(); renderInvoices(); renderInventory(); renderCustomers(); initDashboard();
    showToast('Invoice deleted — stock restored ↩️');
  });
}

function cancelInvoice(id){
  const inv = invoices.find(i=>i.id===id);
  if(!inv) return;
  appConfirm('Cancel Invoice', `Cancel ${inv.num}? Stock will be restored to inventory.`, '✕ Cancel Invoice', ()=>{
    const prevStatus = inv.status;
    raInvoiceRestoreStock(inv);
    // restore customer debt
    const cust = customers.find(c=>c.name&&c.name.toLowerCase()===inv.customer?.toLowerCase());
    if(cust){
      if(prevStatus==='unpaid') cust.debt = Math.max(0,(cust.debt||0)-inv.total);
      else if(prevStatus==='partial') cust.debt = Math.max(0,(cust.debt||0)-(inv.total-(inv.paidAmt||0)));
      else if(prevStatus==='shipped') cust.debt = Math.max(0,(cust.debt||0)-inv.total);
    }
    inv.status = 'cancelled';
    saveInvoices(); saveCustomers(); closeModal('m-inv-detail'); renderInvoices(); renderInventory(); renderCustomers(); initDashboard();
    showToast('Invoice cancelled — stock restored ↩️');
  });
}

function openInvoiceDetail(id){
  const inv = invoices.find(i=>i.id===id);
  if(!inv) return;
  const STATUS = { unpaid:{label:'⏳ Unpaid',cls:'br'}, partial:{label:'💛 Partial',cls:'ba'}, shipped:{label:'🚚 Shipped',cls:'bb'}, paid:{label:'✅ Paid',cls:'bg'}, cancelled:{label:'✕ Cancelled',cls:'bm'} };
  const st = STATUS[inv.status]||STATUS.unpaid;
  const date = inv.date ? new Date(inv.date+'T12:00:00').toLocaleDateString('en',{day:'numeric',month:'long',year:'numeric'}) : '—';
  const storeIcon = inv.store==='flora'?'🌸':'🏪';
  const owes = inv.status==='partial' ? inv.total-(inv.paidAmt||0) : 0;

  document.getElementById('invd-title').textContent = '#'+inv.num+' · '+inv.customer;
  document.getElementById('invd-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span class="b ${st.cls}">${st.label}</span>
      <span style="font-size:12px;color:var(--muted)">${storeIcon} ${inv.store==='flora'?'Flora':'RA'} · ${date}</span>
    </div>
    <div class="card" style="margin-bottom:12px;padding:14px">
      ${(()=>{
        const hasDisc=(inv.items||[]).some(it=>it.disc>0);
        const hdr=hasDisc?'<tr><th>Item</th><th>Qty</th><th>Price</th><th style="color:var(--green)">-Disc</th><th>Total</th></tr>':'<tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>';
        const rows=(inv.items||[]).map(it=>{
          const dCell=hasDisc?`<td style="text-align:right;color:var(--green);font-size:11px">${it.disc>0?'-$'+it.disc.toFixed(2):'—'}</td>`:'';
          const orig=it.disc>0?`<span style="text-decoration:line-through;opacity:0.4;font-size:10px;margin-right:2px">$${(it.price*it.qty).toFixed(2)}</span>`:'';
          return `<tr><td>${it.emoji} ${it.name||it.productName||"Product"}${it.variant?' <span style="font-size:10px;color:var(--muted)">'+it.variant+'</span>':''}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">$${(it.price||0).toFixed(2)}</td>${dCell}<td style="text-align:right;font-weight:700">${orig}$${(it.total||0).toFixed(2)}</td></tr>`;
        }).join('');
        return `<table class="invtbl"><thead>${hdr}</thead><tbody>${rows}</tbody></table>`;
      })()}
      ${inv.delivery?`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:10px;padding-top:8px;border-top:1px solid var(--grey2)"><span>Delivery</span><span>+$${inv.delivery.toFixed(2)}</span></div>`:''}
      ${inv.discount?`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--green);margin-top:4px"><span>Discount</span><span>-$${inv.discount.toFixed(2)}</span></div>`:''}
      <div class="invtotal">$${(inv.total||0).toFixed(2)}</div>
    </div>
    ${inv.status==='partial'?`<div class="card" style="margin-bottom:12px;padding:12px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>Paid</span><b style="color:var(--green)">$${(inv.paidAmt||0).toFixed(2)}</b></div>
      <div style="display:flex;justify-content:space-between;font-size:13px"><span>Still owes</span><b style="color:var(--amber)">$${owes.toFixed(2)}</b></div>
    </div>`:''}
    ${inv.notes?`<div style="font-size:12px;color:var(--muted);font-style:italic;margin-bottom:12px;padding:10px;background:var(--blush);border-radius:8px">"${inv.notes}"</div>`:''}`;

  const storeMode = inv.store==='flora' ? 'flora' : 'ra';
  const bs = 'style="padding:10px 8px;font-size:12px;border-radius:12px"';
  const tpls = getInvoiceTemplates();
  const tpl = tpls[storeMode]||{};
  const tplMissing = !tpl.logo && !tpl.wa && !tpl.headerImg;
  document.getElementById('invd-foot').innerHTML = `
    ${tplMissing?`<div onclick="closeModal('m-inv-detail');openInvoiceTemplate('${storeMode}')" style="width:100%;margin-bottom:8px;padding:9px 12px;background:var(--blue-soft);border-radius:10px;border:1.5px dashed var(--blue);cursor:pointer;text-align:center;font-size:12px;font-weight:600;color:var(--blue)">⚙️ Add your logo & contact for a branded PDF</div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;width:100%">
      <button class="btn btn-green btn-full" ${bs} onclick="shareInvoiceWA('${id}')">📤 WhatsApp</button>
      <button class="btn btn-full" ${bs} style="padding:7px 6px;font-size:12px;border-radius:10px;background:var(--purple-soft);color:var(--purple)" onclick="downloadInvoicePDF('${id}')">📄 PDF</button>
      ${inv.status==='unpaid'||inv.status==='partial'?`<button class="btn btn-blue btn-full" ${bs} onclick="markInvoiceShipped('${id}')">🚚 Shipped</button>`:''}
      ${inv.status!=='paid'&&inv.status!=='cancelled'?`<button class="btn btn-p btn-full" ${bs} onclick="markInvoicePaid('${id}')">✅ Paid</button>`:''}
      ${inv.status!=='cancelled'&&inv.status!=='paid'?`<button class="btn btn-full" ${bs} style="padding:7px 6px;font-size:12px;border-radius:10px;background:var(--amber-soft);color:var(--amber)" onclick="cancelInvoice('${id}')">✕ Cancel & Restore Stock</button>`:''}
      <button class="btn btn-s btn-full" ${bs} onclick="closeModal('m-inv-detail');editInvoice('${id}')">✏️ Edit</button>
      <button class="btn btn-s btn-full" ${bs} onclick="closeModal('m-inv-detail');openInvoiceTemplate('${storeMode}')">⚙️ Template</button>
      <button class="btn btn-g btn-full" ${bs} onclick="closeModal('m-inv-detail')">Close</button>
      <button class="btn btn-full" ${bs} style="padding:7px 6px;font-size:12px;border-radius:10px;background:var(--red-soft);color:var(--red)" onclick="closeModal('m-inv-detail');deleteInvoice('${id}')">🗑️ Delete</button>
    </div>`;
  showModal('m-inv-detail');
}

function markInvoicePaid(id){
  const inv = invoices.find(i=>i.id===id);
  if(!inv) return;
  const prevStatus = inv.status;
  const prevPaid   = inv.paidAmt||0;
  inv.status = 'paid'; inv.paidAmt = inv.total;
  raInvoiceReduceStock(inv);
  updateCustLastOrder(inv.customer, inv.date);
  // Fix customer debt
  const cust = customers.find(c=>c.name&&c.name.toLowerCase()===(inv.customer||'').toLowerCase());
  if(cust){
    if(prevStatus==='unpaid')  cust.debt = Math.max(0,(cust.debt||0) - inv.total);
    else if(prevStatus==='partial') cust.debt = Math.max(0,(cust.debt||0) - (inv.total - prevPaid));
    else if(prevStatus==='shipped') cust.debt = Math.max(0,(cust.debt||0) - inv.total);
  }
  saveInvoices(); saveCustomers(); closeModal('m-inv-detail'); renderInvoices(); renderCustomers(); initDashboard();
  onInvoiceSaved(inv.items, inv.store);
  showToast('Marked paid ✅');
}

function markInvoiceShipped(id){
  const inv = invoices.find(i=>i.id===id);
  if(!inv) return;
  const prevStatus = inv.status;
  const prevPaid   = inv.paidAmt||0;
  // Adjust customer debt: remove old debt contribution, add shipped (full total)
  const cust = customers.find(c=>c.name&&c.name.toLowerCase()===(inv.customer||'').toLowerCase());
  if(cust){
    if(prevStatus==='unpaid')        cust.debt = Math.max(0,(cust.debt||0) - inv.total);
    else if(prevStatus==='partial')  cust.debt = Math.max(0,(cust.debt||0) - (inv.total - prevPaid));
    // Add back as shipped (full total owed)
    cust.debt = (cust.debt||0) + inv.total;
  }
  inv.status = 'shipped';
  raInvoiceReduceStock(inv);
  updateCustLastOrder(inv.customer, inv.date);
  saveInvoices(); saveCustomers(); closeModal('m-inv-detail'); renderInvoices(); renderInventory(); renderCustomers(); initDashboard();
  showToast('Marked shipped 🚚 — stock reduced');
}

function editInvoice(id){
  const inv = invoices.find(i=>i.id===id);
  if(!inv) return;
  document.getElementById('inv-edit-id').value = id;
  document.getElementById('inv-modal-title').textContent = '✏️ Edit Invoice';
  document.getElementById('inv-modal-num').textContent = '#'+inv.num;
  document.getElementById('inv-store').value = inv.store||'ra';
  document.getElementById('inv-date').value = inv.date||'';
  const dueEl2 = document.getElementById('inv-due-date');
  if(dueEl2) dueEl2.value = inv.dueDate||'';
  const pmEl2 = document.getElementById('inv-payment-method');
  if(pmEl2) pmEl2.value = inv.paymentMethod||'';
  document.getElementById('inv-customer').value = inv.customer||'';
  invAutoFillCustomer(document.getElementById('inv-customer'));
  document.getElementById('inv-delivery').value = inv.delivery||'';
  document.getElementById('inv-discount').value = inv.discount||'';
  document.getElementById('inv-status').value = inv.status||'unpaid';
  document.getElementById('inv-paid-amt').value = inv.paidAmt||'';
  document.getElementById('inv-paid-row').style.display = inv.status==='partial' ? '' : 'none';
  document.getElementById('inv-notes').value = inv.notes||'';
  document.getElementById('iitems').innerHTML = '';
  buildInvCustomerList();
  _ppickStore = inv.store||'ra';
  // Restore items using new card format
  (inv.items||[]).forEach(it => {
    const pid = it.pid||it.productId;
    const vid = it.vid||it.variantId;
    if(!pid) return;
    ppickAddItem(pid, vid, true);
    // After card is added, update qty/price/disc
    const cards = document.querySelectorAll('#iitems .inv-item-card');
    const card = cards[cards.length-1];
    if(card){
      card.querySelector('.inv-item-qty').value = it.qty;
      card.querySelector('.inv-item-price').value = it.price;
      const d = card.querySelector('.inv-item-disc'); if(d) d.value = it.disc||0;
    }
  });
  document.getElementById('inv-status').onchange = function(){
    document.getElementById('inv-paid-row').style.display = this.value==='partial' ? '' : 'none';
  };
  recalcInvTotal();
  showModal('m-invoice');
}

function shareInvoiceWA(id){
  const inv = invoices.find(i=>i.id===id);
  if(!inv) return;
  // Get customer WA number from customer record
  const cust = customers.find(c=>c.name&&c.name.toLowerCase()===(inv.customer||'').toLowerCase());
  const wa = cust?.wa || '';
  const lines = [
    `🧾 *Invoice #${inv.num}*`,
    `📅 ${inv.date||''}`,
    `👤 ${inv.customer||''}`,
    '',
    ...(inv.items||[]).map(it=>`${it.emoji||'📦'} ${(it.name&&it.name!=='undefined'?it.name:'')||it.productName||products.find(p=>p.id===(it.productId||it.pid))?.name||'Product'}${it.variant?' ('+it.variant+')':''} × ${it.qty} = $${(it.total||0).toFixed(2)}`),
    '',
    inv.delivery ? `🚚 Delivery: $${inv.delivery.toFixed(2)}` : '',
    inv.discount  ? `🏷️ Discount: -$${inv.discount.toFixed(2)}`  : '',
    `💰 *Total: $${(inv.total||0).toFixed(2)}*`,
    inv.notes ? `\n📝 ${inv.notes}` : ''
  ].filter(l=>l!==null&&l!==undefined&&l!=='').join('\n').replace(/\n{3,}/g,'\n\n');
  const num = wa.replace(/\D/g,'');
  const url = num ? `https://wa.me/${num}?text=${encodeURIComponent(lines)}` : `https://wa.me/?text=${encodeURIComponent(lines)}`;
  window.open(url,'_blank');
}

function downloadInvoicePDF(id){
  const inv = invoices.find(i=>i.id===id);
  if(!inv) return;
  const tpls = getInvoiceTemplates();
  const t = inv.store==='flora' ? (tpls.flora||{}) : (tpls.ra||{});
  const storeLabel = inv.store==='flora' ? '🌸 Flora Gift Shop' : '🏪 RA Warehouse';
  const dateStr = inv.date ? new Date(inv.date+'T12:00:00').toLocaleDateString('en',{day:'numeric',month:'long',year:'numeric'}) : '';
  const dueDateStr = inv.dueDate ? new Date(inv.dueDate+'T12:00:00').toLocaleDateString('en',{day:'numeric',month:'long',year:'numeric'}) : '';
  const STATUS_LABELS = { unpaid:'Unpaid', partial:'Partial Payment', shipped:'Shipped', paid:'Paid' };
  const STATUS_COLORS = { unpaid:'#f5a623', partial:'#5b8dee', shipped:'#5b8dee', paid:'#4caf7d' };
  const statusLabel = STATUS_LABELS[inv.status]||'Unpaid';
  const statusColor = STATUS_COLORS[inv.status]||'#f5a623';

  // Currency formatting
  const cur = t.currency||'usd';
  const rate = parseFloat(t.rate)||89500;
  function fmtAmt(usd){
    if(cur==='lbp') return (usd*rate).toLocaleString()+' ل.ل';
    if(cur==='both') return `$${usd.toFixed(2)} <span style="color:#999;font-size:0.82em">(${(usd*rate).toLocaleString()} ل.ل)</span>`;
    return '$'+usd.toFixed(2);
  }

  // Build items rows
  const hasDisc = (inv.items||[]).some(it=>it.disc>0);
  const itemRows = (inv.items||[]).map(it=>{
    const prod = products.find(p=>p.id===it.pid);
    const variant = prod?.variants.find(v=>v.id===it.vid);
    const itBadge = prod?.badge==='bestseller'
      ? `<span style="display:inline-block;background:#fff8e1;color:#c9a84c;border:1px solid #f0d080;border-radius:20px;font-size:9px;font-weight:800;padding:1px 7px;margin-left:6px;vertical-align:middle">⭐ BEST SELLER</span>`
      : prod?.badge==='new'
      ? `<span style="display:inline-block;background:#fce8f0;color:#d4557a;border:1px solid #f7a0c0;border-radius:20px;font-size:9px;font-weight:800;padding:1px 7px;margin-left:6px;vertical-align:middle">✨ NEW</span>`
      : '';
    const vColorDot = (variant?.colorHex && variant.colorHex!=='#ede6e8' && variant.colorHex!=='#f4a0b0' && variant.colorHex!=='')
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${variant.colorHex};border:1px solid rgba(0,0,0,0.15);margin-right:4px;vertical-align:middle"></span>` : '';
    const fullVariant = variant ? [variant.label, variant.name, variant.size].filter(Boolean).join(' · ') : (it.variant||'');
    const showVariant = fullVariant && fullVariant!=='Standard';
    return `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        ${it.photo ? `<img src="${it.photo}" style="width:36px;height:36px;border-radius:7px;object-fit:cover;flex-shrink:0">` : `<span style="font-size:20px;width:36px;text-align:center;flex-shrink:0">${it.emoji||'📦'}</span>`}
        <div><strong>${it.name||'Product'}</strong>${itBadge}${showVariant?`<br><span class="var">${vColorDot}${fullVariant}</span>`:''}</div>
      </div></td>
      <td class="c">${it.qty}</td>
      <td class="r">${fmtAmt(it.price||0)}</td>
      ${hasDisc?`<td class="r disc">${it.disc>0?'-'+fmtAmt(it.disc):'—'}</td>`:''}
      <td class="r total">${fmtAmt(it.total||0)}</td>
    </tr>`;
  }).join('');

  const sub = (inv.items||[]).reduce((s,it)=>s+(it.total||0),0);

  const isRA = inv.store !== 'flora';

  // ── RA Warehouse: navy/slate professional wholesale theme ──────────────────
  const raCSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{font-family:'Inter',sans-serif;background:#f4f6f9;color:#1a2332;font-size:14px}
  @page{margin:0;size:A4}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}.no-print{display:none!important}.wrap{box-shadow:none!important;border-radius:0!important}}

  body{padding:20px 0 40px}
  .wrap{max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12)}

  /* ── HEADER: banner image fills top, no crop ── */
  .inv-hero{position:relative;background:#1a2332}
  .inv-banner{width:100%;height:180px;object-fit:cover;object-position:center;display:block;opacity:0.82}
  .inv-hero-overlay{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent 0%,rgba(15,25,45,0.96) 60%)}
  .inv-hero-bar{padding:18px 28px 20px;display:flex;justify-content:space-between;align-items:flex-end}
  .inv-biz-name{font-size:20px;font-weight:700;color:#fff;letter-spacing:0.2px;line-height:1.2}
  .inv-biz-desc{font-size:10.5px;color:#8fa3bc;letter-spacing:1px;text-transform:uppercase;margin-top:3px}
  .inv-title{font-size:44px;font-weight:900;letter-spacing:-2px;color:#fff;line-height:0.95;text-align:right}
  .inv-num-badge{font-size:12px;color:#7aa3c8;text-align:right;margin-top:5px;letter-spacing:0.5px;font-weight:500}

  /* No banner fallback */
  .inv-noimg-bar{background:linear-gradient(135deg,#1a2332 0%,#2d3f58 50%,#1a2332 100%);padding:28px 28px;display:flex;justify-content:space-between;align-items:center;position:relative;overflow:hidden}
  .inv-noimg-bar::before{content:'';position:absolute;top:-30px;right:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.04)}
  .inv-noimg-bar::after{content:'';position:absolute;bottom:-40px;left:60px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.03)}

  /* ── WHITE SUBHEADER: logo + contact + meta ── */
  .inv-subhead{display:flex;align-items:center;gap:20px;padding:18px 28px 16px;border-bottom:1px solid #eaecf0;background:#fff}
  .inv-logo{width:58px;height:58px;border-radius:10px;object-fit:cover;display:block;border:1.5px solid #e2e8f0;flex-shrink:0}
  .inv-logo-placeholder{width:58px;height:58px;border-radius:10px;background:#f0f4f8;display:flex;align-items:center;justify-content:center;font-size:24px;border:1.5px solid #e2e8f0;flex-shrink:0}
  .inv-contact{flex:1;font-size:12px;color:#5a6a7e;line-height:2}
  .inv-contact strong{color:#1a2332;font-weight:600}
  .inv-meta-box{background:#f7fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;text-align:right;flex-shrink:0;min-width:160px}
  .status-pill{display:inline-block;padding:3px 11px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;color:white;background:${statusColor};margin-bottom:7px}
  .inv-meta-line{font-size:11.5px;color:#718096;line-height:1.9}
  .inv-meta-line strong{color:#2d3748;font-weight:600}

  /* ── BILL TO ── */
  .inv-billto{padding:14px 28px;background:#f7fafc;border-bottom:1px solid #eaecf0;display:flex;gap:40px}
  .bt-cell{flex:1}
  .bt-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#a0aec0;margin-bottom:4px}
  .bt-val{font-size:15px;font-weight:700;color:#1a2332}

  /* ── ITEMS TABLE ── */
  .inv-table-wrap{padding:22px 28px 4px}
  .section-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#a0aec0;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e8ecf0}
  thead tr{background:#1a2332}
  thead th{padding:11px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.9px;color:#a8c0d6;text-align:left}
  th.c{text-align:center}th.r{text-align:right}
  tbody tr{border-bottom:1px solid #f0f4f8}
  tbody tr:last-child{border-bottom:none}
  tbody td{padding:12px 14px;font-size:13.5px;color:#2d3748;vertical-align:middle}
  td.c{text-align:center;color:#718096;font-weight:500}td.r{text-align:right}
  td.disc{color:#38a169}td.total{font-weight:700;color:#1a2332;font-size:14px}
  .var{font-size:11px;color:#a0aec0;font-weight:400;display:block;margin-top:2px}

  /* ── TOTALS ── */
  .totals-wrap{padding:4px 28px 22px;display:flex;justify-content:flex-end}
  .totals{width:260px}
  .tot-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:13px;color:#718096;border-bottom:1px solid #f0f4f8}
  .tot-row:last-child{border-bottom:none;border-top:2px solid #1a2332;padding-top:12px;margin-top:4px}
  .tot-row.grand{font-size:17px;font-weight:800;color:#1a2332;letter-spacing:-0.3px}
  .tot-row.paid-row{color:#38a169}
  .tot-row.owed-row{color:#c8922a;font-weight:600}

  /* ── BANK ── */
  .bank-box{margin:0 28px 22px;border:1px solid #d6e4f0;border-radius:10px;padding:14px 18px;background:#f0f6fc;border-left:4px solid #2d6a9f}
  .bank-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#2d6a9f;margin-bottom:8px}
  .bank-row{font-size:12.5px;color:#4a5568;line-height:2}
  .bank-label{font-weight:700;color:#1a2332;margin-right:6px}

  /* ── NOTES ── */
  .inv-notes{margin:0 28px 22px;font-size:12px;color:#718096;background:#fffdf0;border-radius:10px;padding:12px 16px;border-left:4px solid #d69e2e;font-style:italic;line-height:1.6}

  /* ── FOOTER ── */
  .inv-footer{background:#1a2332;padding:16px 28px;display:flex;justify-content:space-between;align-items:center}
  .inv-thankyou{font-size:13.5px;font-weight:600;color:#fff}
  .inv-terms{font-size:10.5px;color:#8fa3bc;max-width:340px;text-align:right;line-height:1.6}

  /* Print bar */
  .print-bar{position:fixed;bottom:24px;right:24px;display:flex;gap:10px;z-index:999}
  .print-bar button{padding:12px 22px;border:none;border-radius:10px;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;box-shadow:0 4px 20px rgba(0,0,0,0.2);transition:transform 0.1s}
  .print-bar button:active{transform:scale(0.96)}
  .btn-print{background:#1a2332;color:white}
  .btn-close{background:#fff;color:#4a5568;border:1px solid #e2e8f0}`;

  // ── Flora: warm blush retail theme (unchanged) ─────────────────────────
  const floraCSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{font-family:'DM Sans',sans-serif;background:#fff;color:#2c1a1f;font-size:14px}
  @page{margin:18mm 16mm}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}

  .wrap{max-width:720px;margin:0 auto;padding:32px 28px}
  .inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;gap:20px}
  .inv-brand{flex:1}
  .inv-logo{width:72px;height:72px;border-radius:14px;object-fit:cover;margin-bottom:10px;display:block}
  .inv-logo-placeholder{width:72px;height:72px;border-radius:14px;background:#fce8ec;display:flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:10px}
  .inv-biz-name{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#e8748a;line-height:1.2}
  .inv-biz-desc{font-size:12px;color:#b89aa0;margin-top:3px}
  .inv-contact{font-size:11.5px;color:#6b4c54;margin-top:8px;line-height:1.7}
  .inv-badge{text-align:right}
  .inv-title{font-family:'Playfair Display',serif;font-size:30px;font-weight:700;color:#2c1a1f;letter-spacing:-0.5px}
  .inv-num{font-size:13px;color:#b89aa0;margin-top:4px;font-weight:500}
  .status-pill{display:inline-block;padding:4px 12px;border-radius:50px;font-size:11px;font-weight:700;letter-spacing:0.5px;margin-top:8px;color:white;background:${statusColor}}
  .inv-banner{width:100%;max-height:100px;object-fit:cover;border-radius:12px;margin-bottom:22px;display:block}
  .inv-meta-strip{display:flex;gap:0;border:1.5px solid #ede6e8;border-radius:12px;overflow:hidden;margin-bottom:26px}
  .inv-meta-cell{flex:1;padding:10px 14px;border-right:1.5px solid #ede6e8}
  .inv-meta-cell:last-child{border-right:none}
  .mc-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#b89aa0;margin-bottom:3px}
  .mc-val{font-size:13px;font-weight:600;color:#2c1a1f}
  .inv-table-wrap{margin-bottom:20px}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#fce8ec}
  thead th{padding:9px 12px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#e8748a;text-align:left}
  th.c,th.r{text-align:center}th.r{text-align:right}
  tbody tr{border-bottom:1px solid #f7f3f4}tbody tr:last-child{border-bottom:none}
  tbody td{padding:10px 12px;font-size:13px;color:#2c1a1f;vertical-align:top}
  td.c{text-align:center;color:#6b4c54}td.r{text-align:right}
  td.disc{color:#4caf7d;font-size:12px}td.total{font-weight:700}
  .var{font-size:10.5px;color:#b89aa0;font-weight:400}
  .totals{margin-left:auto;width:240px;margin-bottom:22px}
  .tot-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#6b4c54;border-bottom:1px solid #f7f3f4}
  .tot-row:last-child{border-bottom:none;padding-top:10px;margin-top:4px;border-top:2px solid #e8748a}
  .tot-row.grand{font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#2c1a1f}
  .tot-row.paid-row{color:#4caf7d}.tot-row.owed-row{color:#f5a623}
  .bank-box{border:1.5px solid #ede6e8;border-radius:12px;padding:14px 16px;margin-bottom:22px;background:#fff5f7}
  .bank-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#b89aa0;margin-bottom:8px}
  .bank-row{font-size:12.5px;color:#2c1a1f;line-height:1.9}.bank-label{font-weight:600;color:#6b4c54;margin-right:4px}
  .inv-footer{border-top:1.5px solid #fce8ec;padding-top:16px;text-align:center}
  .inv-thankyou{font-family:'Playfair Display',serif;font-size:16px;color:#e8748a;margin-bottom:6px}
  .inv-terms{font-size:11px;color:#b89aa0;line-height:1.6}
  .print-bar{position:fixed;bottom:20px;right:20px;display:flex;gap:10px;z-index:999}
  .print-bar button{padding:12px 22px;border:none;border-radius:50px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;box-shadow:0 4px 18px rgba(0,0,0,0.15);transition:transform 0.1s}
  .print-bar button:active{transform:scale(0.96)}
  .btn-print{background:#e8748a;color:white}.btn-close{background:#f7f3f4;color:#6b4c54}`;

  // ── RA HTML body ───────────────────────────────────────────────────────
  const raBody = `
  <!-- ── HERO: banner image + dark overlay with biz name + INVOICE ── -->
  ${t.headerImg ? `
  <div class="inv-hero">
    <img class="inv-banner" src="${t.headerImg}" alt="header">
    <div class="inv-hero-overlay">
      <div class="inv-hero-bar">
        <div>
          <div class="inv-biz-name">${t.bizName||'RA Warehouse'}</div>
          <div class="inv-biz-desc">${t.desc||'Wholesale Beauty & Cosmetics'}</div>
        </div>
        <div>
          <div class="inv-title">INVOICE</div>
          <div class="inv-num-badge">${inv.num}</div>
        </div>
      </div>
    </div>
  </div>` : `
  <div class="inv-noimg-bar">
    <div>
      <div class="inv-biz-name">${t.bizName||'RA Warehouse'}</div>
      <div class="inv-biz-desc">${t.desc||'Wholesale Beauty & Cosmetics'}</div>
    </div>
    <div style="text-align:right">
      <div class="inv-title">INVOICE</div>
      <div class="inv-num-badge">${inv.num}</div>
    </div>
  </div>`}

  <!-- ── WHITE SUBHEADER: logo + contact + status/dates ── -->
  <div class="inv-subhead">
    ${t.logo?`<img class="inv-logo" src="${t.logo}" alt="logo">`:`<div class="inv-logo-placeholder">🏪</div>`}
    <div class="inv-contact">
      ${t.wa?`<div>📱 <strong>${t.wa}</strong></div>`:''}
      ${t.ig?`<div>📸 <strong>${t.ig}</strong></div>`:''}
      ${t.address?`<div>📍 ${t.address}</div>`:''}
    </div>
    <div class="inv-meta-box">
      <div><span class="status-pill">${statusLabel}</span></div>
      <div class="inv-meta-line">Date &nbsp;<strong>${dateStr||'—'}</strong></div>
      ${dueDateStr?`<div class="inv-meta-line">Due &nbsp;<strong>${dueDateStr}</strong></div>`:''}
      ${inv.paymentMethod?`<div class="inv-meta-line">Payment &nbsp;<strong>${inv.paymentMethod}</strong></div>`:''}
    </div>
  </div>

  <!-- ── BILL TO ── -->
  <div class="inv-billto">
    <div class="bt-cell">
      <div class="bt-label">Bill To</div>
      <div class="bt-val">${inv.customer||'—'}</div>
      ${(()=>{ const c = customers.find(x=>x.name&&x.name.toLowerCase()===(inv.customer||'').toLowerCase()); const parts=[]; if(c?.wa) parts.push('📱 '+c.wa); if(c?.city) parts.push('📍 '+c.city); return parts.length?`<div style="font-size:12px;color:#718096;margin-top:4px;line-height:1.8">${parts.join(' &nbsp;·&nbsp; ')}</div>`:''; })()}
    </div>
    ${inv.notes?`<div class="bt-cell"><div class="bt-label">Notes</div><div class="bt-val" style="font-weight:400;font-size:13px;color:#718096">${inv.notes}</div></div>`:''}
  </div>

  <!-- ── ITEMS TABLE ── -->
  <div class="inv-table-wrap">
    <table>
      <thead><tr>
        <th>Description</th>
        <th class="c">Qty</th>
        <th class="r">Unit Price</th>
        ${hasDisc?'<th class="r">Discount</th>':''}
        <th class="r">Amount</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <!-- ── TOTALS ── -->
  <div class="totals-wrap">
    <div class="totals">
      ${sub!==inv.total?`<div class="tot-row"><span>Subtotal</span><span>${fmtAmt(sub)}</span></div>`:''}
      ${inv.delivery?`<div class="tot-row"><span>Delivery</span><span>+${fmtAmt(inv.delivery)}</span></div>`:''}
      ${inv.discount?`<div class="tot-row" style="color:#38a169"><span>Discount</span><span>-${fmtAmt(inv.discount)}</span></div>`:''}
      <div class="tot-row grand"><span>TOTAL DUE</span><span>${fmtAmt(inv.total||0)}</span></div>
      ${inv.status==='partial'&&inv.paidAmt?`
      <div class="tot-row paid-row"><span>✓ Paid</span><span>${fmtAmt(inv.paidAmt)}</span></div>
      <div class="tot-row owed-row"><span>Balance Due</span><span>${fmtAmt((inv.total||0)-(inv.paidAmt||0))}</span></div>`:''}
    </div>
  </div>

  ${t.showBank!==false&&(t.bank||t.acc)?`
  <div class="bank-box">
    <div class="bank-title">Bank / Payment Details</div>
    ${t.bank?`<div class="bank-row"><span class="bank-label">Bank:</span>${t.bank}</div>`:''}
    ${t.acc?`<div class="bank-row"><span class="bank-label">Account / IBAN:</span>${t.acc}</div>`:''}
  </div>`:''}

  <!-- ── FOOTER ── -->
  <div class="inv-footer">
    <div class="inv-thankyou">${t.thankyou||'Thank you for your business.'}</div>
    <div class="inv-terms">${t.terms||''}</div>
  </div>`;

  // ── Flora HTML body ────────────────────────────────────────────────────
  const floraBody = `
  ${t.headerImg
    ? `<img class="inv-banner" src="${t.headerImg}" alt="header">`
    : `<div style="height:8px;background:linear-gradient(90deg,#e8748a,#f4a0b0,#fce8ec,#f4a0b0,#e8748a);margin-bottom:0"></div>`}
  <div class="inv-header" style="${!t.headerImg?'padding-top:28px':''}">
    <div class="inv-brand">
      ${t.logo?`<img class="inv-logo" src="${t.logo}" alt="logo">`:`<div class="inv-logo-placeholder">🌸</div>`}
      <div class="inv-biz-name">${t.bizName||'Flora Gift Shop'}</div>
      ${t.desc?`<div class="inv-biz-desc">${t.desc}</div>`:'<div class="inv-biz-desc">Retail Gifts & Beauty</div>'}
      <div class="inv-contact">
        ${t.wa?`📱 ${t.wa}<br>`:''}
        ${t.ig?`📸 ${t.ig}<br>`:''}
        ${t.address?`📍 ${t.address}`:''}
      </div>
    </div>
    <div class="inv-badge">
      <div class="inv-title">Invoice</div>
      <div class="inv-num">#${inv.num}</div>
      <div><span class="status-pill">${statusLabel}</span></div>
    </div>
  </div>
  <div class="inv-meta-strip">
    <div class="inv-meta-cell"><div class="mc-label">Bill To</div><div class="mc-val">${inv.customer||'—'}</div>${(()=>{ const c = customers.find(x=>x.name&&x.name.toLowerCase()===(inv.customer||'').toLowerCase()); const parts=[]; if(c?.wa) parts.push('📱 '+c.wa); if(c?.city) parts.push('📍 '+c.city); return parts.length?`<div style="font-size:11px;color:#b89aa0;margin-top:3px">${parts.join(' · ')}</div>`:''; })()}</div>
    <div class="inv-meta-cell"><div class="mc-label">Date</div><div class="mc-val">${dateStr||'—'}</div></div>
    ${dueDateStr?`<div class="inv-meta-cell"><div class="mc-label">Due Date</div><div class="mc-val">${dueDateStr}</div></div>`:''}
    ${inv.paymentMethod?`<div class="inv-meta-cell"><div class="mc-label">Payment</div><div class="mc-val">${inv.paymentMethod}</div></div>`:''}
  </div>
  <div class="inv-table-wrap">
    <table>
      <thead><tr>
        <th>Item</th><th class="c">Qty</th><th class="r">Price</th>
        ${hasDisc?'<th class="r">Discount</th>':''}
        <th class="r">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>
  <div class="totals">
    ${sub!==inv.total?`<div class="tot-row"><span>Subtotal</span><span>${fmtAmt(sub)}</span></div>`:''}
    ${inv.delivery?`<div class="tot-row"><span>🚚 Delivery</span><span>+${fmtAmt(inv.delivery)}</span></div>`:''}
    ${inv.discount?`<div class="tot-row" style="color:#4caf7d"><span>🏷️ Discount</span><span>-${fmtAmt(inv.discount)}</span></div>`:''}
    <div class="tot-row grand"><span>Total</span><span>${fmtAmt(inv.total||0)}</span></div>
    ${inv.status==='partial'&&inv.paidAmt?`
    <div class="tot-row paid-row"><span>✅ Paid</span><span>${fmtAmt(inv.paidAmt)}</span></div>
    <div class="tot-row owed-row"><span>⏳ Balance Due</span><span>${fmtAmt((inv.total||0)-(inv.paidAmt||0))}</span></div>`:''}
  </div>
  ${t.showBank!==false&&(t.bank||t.acc)?`
  <div class="bank-box">
    <div class="bank-title">🏦 Payment Details</div>
    ${t.bank?`<div class="bank-row"><span class="bank-label">Bank:</span>${t.bank}</div>`:''}
    ${t.acc?`<div class="bank-row"><span class="bank-label">Account:</span>${t.acc}</div>`:''}
  </div>`:''}
  ${inv.notes?`<div style="font-size:12px;color:#6b4c54;background:#fff5f7;border-radius:10px;padding:11px 14px;margin-bottom:20px;border-left:3px solid #e8748a;font-style:italic">📝 ${inv.notes}</div>`:''}
  <div class="inv-footer">
    ${t.thankyou?`<div class="inv-thankyou">${t.thankyou}</div>`:'<div class="inv-thankyou">Thank you for your business! 🌸</div>'}
    ${t.terms?`<div class="inv-terms">${t.terms}</div>`:''}
  </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${inv.num} – ${inv.customer}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500;600&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${isRA ? raCSS : floraCSS}</style>
</head>
<body>
<div class="no-print print-bar">
  <button class="btn-close" onclick="window.close()">✕ Close</button>
  <button class="btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
</div>
<div class="wrap">${isRA ? raBody : floraBody}</div>
<script>// window.onload=()=>window.print();<\/script>

</body></html>`;

  const w = window.open('','_blank');
  if(!w){ showToast('Allow popups to open PDF','err'); return; }
  w.document.write(html);
  w.document.close();
}

function addItem(){ addInvItem(); } // backward compat


function saveAndShareInvoice(){ saveInvoice(true); }

function onInvoiceSaved(items, store){
  triggerWebsiteUpdateNotif(items||[]);
  syncToIDB();
}


// ── triggerWebsiteUpdateNotif ──
function triggerWebsiteUpdateNotif(invoiceItems, storeName){
  const itemsHTML = (invoiceItems && invoiceItems.length)
    ? invoiceItems.map(it=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--grey);border-radius:10px;margin-bottom:6px">
        <div style="font-size:20px">${it.emoji||'📦'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--ink)">${it.name||it.productName||'Product'}${it.variant&&it.variant!=='Standard'?' · <span style="color:var(--muted);font-weight:400">'+it.variant+'</span>':''}</div>
          <div style="font-size:12px;color:var(--muted)">Reduce by ${it.qty} unit${it.qty!==1?'s':''}</div>
        </div>
        <span style="font-size:14px;font-weight:700;color:var(--red)">−${it.qty}</span>
      </div>`).join('')
    : `<div style="font-size:13px;color:var(--muted);padding:10px 0">Check your invoice for product quantities.</div>`;
  const storeEl = document.getElementById('wsync-store');
  if(storeEl) storeEl.textContent = 'app.easy-orders.net/#/products 🌐';
  document.getElementById('wsync-items').innerHTML = itemsHTML;
  document.getElementById('m-wsync').style.display = 'flex';
}

// ── Invoice Template Builder ──
// =================================================
// INVOICE TEMPLATE BUILDER
// =================================================
let _itplMode = 'ra';
let _itplLogoData   = { ra:'', flora:'' };
let _itplHeaderData = { ra:'', flora:'' };

const ITPL_DEFAULTS = {
  ra:    { bizName:'RA Warehouse',    desc:'Wholesale Beauty & Cosmetics', wa:'', ig:'', address:'', bank:'', acc:'', showBank:true, currency:'usd', rate:'', thankyou:'Thank you for your business!', terms:'', logo:'', headerImg:'' },
  flora: { bizName:'Flora Gift Shop', desc:'Retail Gifts & Accessories',   wa:'', ig:'', address:'', bank:'', acc:'', showBank:true, currency:'usd', rate:'', thankyou:'Thank you for shopping with us! 🌸', terms:'', logo:'', headerImg:'' }
};

function getInvoiceTemplates(){
  try{
    const s = localStorage.getItem('invoiceTemplates');
    if(s){ const p=JSON.parse(s); return { ra:Object.assign({},ITPL_DEFAULTS.ra,p.ra||{}), flora:Object.assign({},ITPL_DEFAULTS.flora,p.flora||{}) }; }
  }catch(e){}
  return { ra:{...ITPL_DEFAULTS.ra}, flora:{...ITPL_DEFAULTS.flora} };
}

function saveInvoiceTemplates(t){ localStorage.setItem('invoiceTemplates',JSON.stringify(t)); }

function openInvoiceTemplate(mode){
  _itplMode = mode;
  const t = getInvoiceTemplates()[mode];
  const tabRa=document.getElementById('itpl-tab-ra'), tabFl=document.getElementById('itpl-tab-flora');
  tabRa.style.background    = mode==='ra'    ? 'var(--rose)' : 'transparent';
  tabRa.style.color         = mode==='ra'    ? 'white' : 'var(--muted)';
  tabFl.style.background    = mode==='flora' ? 'var(--rose)' : 'transparent';
  tabFl.style.color         = mode==='flora' ? 'white' : 'var(--muted)';
  document.getElementById('itpl-biz-name').value = t.bizName  || '';
  document.getElementById('itpl-desc').value     = t.desc     || '';
  document.getElementById('itpl-wa').value       = t.wa       || '';
  document.getElementById('itpl-ig').value       = t.ig       || '';
  document.getElementById('itpl-address').value  = t.address  || '';
  document.getElementById('itpl-bank').value     = t.bank     || '';
  document.getElementById('itpl-acc').value      = t.acc      || '';
  document.getElementById('itpl-currency').value = t.currency || 'usd';
  document.getElementById('itpl-rate').value     = t.rate     || '';
  document.getElementById('itpl-thankyou').value = t.thankyou || '';
  document.getElementById('itpl-terms').value    = t.terms    || '';
  const bt=document.getElementById('itpl-toggle-bank');
  if(t.showBank!==false) bt.classList.add('active'); else bt.classList.remove('active');
  itplCurrencyChange(t.currency||'usd');
  _itplLogoData[mode] = t.logo||'';
  _itplHeaderData[mode] = t.headerImg||'';
  const prev=document.getElementById('itpl-logo-preview'), clr=document.getElementById('itpl-logo-clear');
  if(t.logo){ prev.innerHTML=`<img src="${t.logo}" style="width:100%;height:100%;object-fit:cover">`; clr.style.display='block'; }
  else { prev.innerHTML=`<span style="font-size:26px">${mode==='ra'?'🏪':'🌸'}</span>`; clr.style.display='none'; }
  const hprev=document.getElementById('itpl-header-preview'), hclr=document.getElementById('itpl-header-clear');
  if(t.headerImg){ hprev.innerHTML=`<img src="${t.headerImg}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`; hclr.style.display='block'; }
  else { hprev.innerHTML=`<span style="font-size:11px;color:var(--muted);text-align:center">No header image</span>`; hclr.style.display='none'; }
  showModal('m-inv-tpl');
}

function switchInvoiceTab(mode){
  const tpls=getInvoiceTemplates(); tpls[_itplMode]=itplGetCurrent();
  openInvoiceTemplate(mode);
}

function itplCurrencyChange(val){
  const r=document.getElementById('itpl-rate-row'); if(r) r.style.display=(val==='lbp'||val==='both')?'':'none';
}

function itplToggle(el){ el.classList.toggle('active'); }
function itplIsOn(id){ return document.getElementById(id)?.classList.contains('active'); }

function itplSetLogo(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{ _itplLogoData[_itplMode]=e.target.result; document.getElementById('itpl-logo-preview').innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`; document.getElementById('itpl-logo-clear').style.display='block'; };
  reader.readAsDataURL(file);
}

function itplClearLogo(){
  _itplLogoData[_itplMode]='';
  document.getElementById('itpl-logo-preview').innerHTML=`<span style="font-size:26px">${_itplMode==='ra'?'🏪':'🌸'}</span>`;
  document.getElementById('itpl-logo-clear').style.display='none';
}

function itplGetCurrent(){
  return { bizName:document.getElementById('itpl-biz-name').value.trim(), desc:document.getElementById('itpl-desc').value.trim(), wa:document.getElementById('itpl-wa').value.trim(), ig:document.getElementById('itpl-ig').value.trim(), address:document.getElementById('itpl-address').value.trim(), bank:document.getElementById('itpl-bank').value.trim(), acc:document.getElementById('itpl-acc').value.trim(), showBank:itplIsOn('itpl-toggle-bank'), currency:document.getElementById('itpl-currency').value, rate:document.getElementById('itpl-rate').value.trim(), thankyou:document.getElementById('itpl-thankyou').value.trim(), terms:document.getElementById('itpl-terms').value.trim(), logo:_itplLogoData[_itplMode]||'', headerImg:_itplHeaderData[_itplMode]||'' };
}

function itplSetHeader(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{ _itplHeaderData[_itplMode]=e.target.result; document.getElementById('itpl-header-preview').innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`; document.getElementById('itpl-header-clear').style.display='block'; };
  reader.readAsDataURL(file);
}

function itplClearHeader(){
  _itplHeaderData[_itplMode]='';
  document.getElementById('itpl-header-preview').innerHTML=`<span style="font-size:11px;color:var(--muted);text-align:center">No header image</span>`;
  document.getElementById('itpl-header-clear').style.display='none';
}

function itplSave(){
  try{
    const tpls=getInvoiceTemplates();
    tpls[_itplMode]=itplGetCurrent();
    localStorage.setItem('invoiceTemplates',JSON.stringify(tpls));
    closeModal('m-inv-tpl');
    showToast((_itplMode==='ra'?'RA':'Flora')+' template saved ✅');
  }catch(e){ showToast('Save failed: '+e.message,'err'); }
}

// ═══════════════════════════════════════════════════
// SHOP ORDERS TAB  — Firebase orders → Invoices
// ═══════════════════════════════════════════════════

const FB_ORDERS_URL = 'https://ra-shop-3e01d-default-rtdb.firebaseio.com/orders';

async function renderShopOrders(){
  const outer = document.getElementById('shop-orders-list');
  const el = document.getElementById('shop-orders-inner') || outer;
  if(!el) return;
  el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted);font-size:13px">⏳ Loading orders...</div>`;
  try{
    const res = await fetch(`${FB_ORDERS_URL}.json`);
    if(res.status === 401 || res.status === 403){
      el.innerHTML = `<div style="text-align:center;padding:24px;font-size:13px;color:var(--red)">🔒 Firebase rules are blocking reads.<br><span style="font-size:11px;color:var(--muted)">Go to Firebase Console → Realtime Database → Rules → set <b>.read: true</b></span></div>`;
      return;
    }
    const data = await res.json();
    if(!data || data.error || typeof data !== 'object'){
      el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);font-size:14px">No orders yet 🛒<br><span style="font-size:12px">Orders placed from your shop will appear here</span></div>`;
      return;
    }
    const orders = Object.values(data).filter(o=>o&&o.id&&!o.deleted).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    if(!orders.length){ el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">No orders yet 🛒</div>`; return; }
    orders.forEach(o => { _lastOrdersData[o.id] = o; });
    el.innerHTML = orders.map(o => _renderOrderCard(o)).join('');
  }catch(e){
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red);font-size:13px">❌ Could not load orders<br><span style="font-size:11px;color:var(--muted)">${e.message}</span><br><button onclick="renderShopOrders()" style="margin-top:10px;padding:8px 16px;background:var(--rose);color:white;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:12px">🔄 Try Again</button></div>`;
  }
}

// Track expanded order cards
const _expandedOrders = new Set();

function toggleOrderCard(id){
  if(_expandedOrders.has(id)) _expandedOrders.delete(id);
  else _expandedOrders.add(id);
  // Re-render just this card
  const el = document.querySelector(`[data-order-id="${id}"]`);
  if(el) el.outerHTML = _renderOrderCard(_lastOrdersData?.[id] || {id});
}

let _lastOrdersData = {};

function _renderOrderCard(o){
  _lastOrdersData[o.id] = o;
  const isExpanded = _expandedOrders.has(o.id);
  const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
  const statusDot = { pending:'#f59e0b', confirmed:'var(--green)', cancelled:'var(--muted)' };
  const statusLabel = { pending:'Pending', confirmed:'Confirmed', cancelled:'Cancelled' };
  const dotColor = statusDot[o.status] || statusDot.pending;
  const label = statusLabel[o.status] || 'Pending';

  // Thumbnails row — up to 4 items
  const thumbs = (o.items||[]).slice(0,4).map(i => {
    const hasPhoto = i.photo && i.photo.startsWith('data:');
    return hasPhoto
      ? `<div style="width:36px;height:36px;border-radius:8px;overflow:hidden;border:1.5px solid var(--grey2);flex-shrink:0"><img src="${i.photo}" style="width:100%;height:100%;object-fit:cover"></div>`
      : `<div style="width:36px;height:36px;border-radius:8px;background:var(--rose2);border:1.5px solid var(--grey2);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${i.emoji||'📦'}</div>`;
  }).join('');
  const extraCount = (o.items||[]).length > 4 ? `<div style="font-size:10px;color:var(--muted);margin-left:2px;align-self:center">+${(o.items||[]).length-4}</div>` : '';

  // Expanded item list
  const itemList = isExpanded ? `
    <div style="margin-top:10px;border-top:1px solid var(--grey2);padding-top:10px;display:flex;flex-direction:column;gap:6px">
      ${(o.items||[]).map(i => {
        const hasPhoto = i.photo && i.photo.startsWith('data:');
        const thumb = hasPhoto
          ? `<div style="width:40px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0"><img src="${i.photo}" style="width:100%;height:100%;object-fit:cover"></div>`
          : `<div style="width:40px;height:40px;border-radius:8px;background:var(--rose2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${i.emoji||'📦'}</div>`;
        const qty = i.qtyType==='dozen' ? `${i.qty} dz` : `${i.qty} pc`;
        return `<div style="display:flex;align-items:center;gap:10px">
          ${thumb}
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i.name||'Product'}</div>
            ${i.variantLabel?`<div style="font-size:10px;color:var(--muted)">${i.variantLabel}</div>`:''}
          </div>
          <div style="font-size:12px;font-weight:700;color:var(--ink);flex-shrink:0">${qty}</div>
        </div>`;
      }).join('')}
      ${o.customerPhone?`<div style="font-size:11px;color:var(--muted);padding-top:4px">📞 ${o.customerPhone}</div>`:''}
      ${o.address?`<div style="font-size:11px;color:var(--muted)">📍 ${o.address}</div>`:''}
      ${o.notes?`<div style="font-size:11px;color:var(--muted);font-style:italic">"${o.notes}"</div>`:''}
    </div>` : '';

  const actionBtns = isExpanded ? (o.status === 'pending' ? `
    <div style="display:flex;gap:8px;margin-top:12px">
      <button onclick="event.stopPropagation();confirmShopOrder('${o.id}')" style="flex:1;padding:9px;background:var(--rose);color:white;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✅ Confirm → Invoice</button>
      <button onclick="event.stopPropagation();cancelShopOrder('${o.id}')" style="padding:9px 14px;background:var(--grey2);color:var(--muted);border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✕</button>
    </div>` : `
    <div style="display:flex;gap:8px;margin-top:12px">
      ${o.status==='confirmed'?`<button onclick="event.stopPropagation();editShopOrder('${o.id}')" style="flex:1;padding:9px;background:var(--grey2);color:var(--ink);border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✏️ View Invoice</button>`:''}
      <button onclick="event.stopPropagation();deleteShopOrder('${o.id}')" style="padding:9px 14px;background:var(--grey2);color:var(--red);border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">🗑️</button>
    </div>`) : '';

  return `<div data-order-id="${o.id}" onclick="toggleOrderCard('${o.id}')" style="background:white;border-radius:14px;padding:14px 16px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:pointer;border:1.5px solid ${isExpanded?'var(--rose2)':'transparent'}">
    <div style="display:flex;align-items:center;gap:10px">
      <!-- thumbs -->
      <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">${thumbs}${extraCount}</div>
      <!-- info -->
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.customerName||'—'}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px">#${o.id} · ${date}</div>
      </div>
      <!-- right: total + status -->
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:15px;font-weight:800;color:var(--ink)">$${(o.total||0).toFixed(2)}</div>
        <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-top:3px">
          <div style="width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0"></div>
          <div style="font-size:10px;font-weight:600;color:${dotColor}">${label}</div>
        </div>
      </div>
      <div style="color:var(--muted);font-size:12px;margin-left:2px">${isExpanded?'▲':'▼'}</div>
    </div>
    ${itemList}
    ${actionBtns}
  </div>`;
}

async function confirmShopOrder(orderId){
  try{
    const res = await fetch(`${FB_ORDERS_URL}/${orderId}.json`);
    const o = await res.json();
    if(!o) return showToast('Order not found','err');

    // Find or create customer
    let custName = o.customerName || 'Shop Customer';
    let cust = customers.find(c => c.name.toLowerCase() === custName.toLowerCase());
    if(!cust){
      cust = { id:'cust-'+Date.now(), name:custName, phone:o.customerPhone||'', debt:0, notes:'' };
      customers.push(cust);
    }

    // Map order items to invoice items
    const invItems = (o.items||[]).map(i => {
      const prod = products.find(p => p.id === i.productId);
      const variant = prod?.variants?.find(v => v.id === i.variantId);
      const itemName = i.name || prod?.name || 'Product';
      const itemVariant = i.variantLabel || variant?.label || variant?.name || '';
      const itemEmoji = i.emoji || prod?.emoji || '\u{1F4E6}';
      const itemPhoto = (variant?.photo && variant.photo.startsWith('data:')) ? variant.photo : (prod?.photo || i.photo || '');
      const itemPrice = i.unitPrice || 0;
      const itemQty = i.qtyType === 'stand' ? (i.qty * (i.standQty||1)) : (i.qtyType === 'dozen' ? (i.qty * 12) : (i.qty || 1));
      const itemQtyLabel = i.qtyType === 'stand' ? `${i.qty} ${i.standName||'stand'} (${itemQty} pcs)` : i.qtyType === 'dozen' ? `${i.qty} dz (${itemQty} pcs)` : `${itemQty} pcs`;
      return {
        productId: i.productId||'',
        variantId: i.variantId||'',
        pid: i.productId||'',
        vid: i.variantId||'',
        name: itemName,
        variant: itemVariant,
        variantLabel: itemVariant,
        emoji: itemEmoji,
        photo: itemPhoto,
        qty: itemQty,
        qtyLabel: itemQtyLabel,
        price: itemPrice,
        disc: 0,
        discount: 0,
        total: itemPrice * i.qty,
        dozen: i.qtyType==='dozen',
        stand: i.qtyType==='stand',
        standName: i.standName||'',
        standQty: i.standQty||0
      };
    });

    const total = o.total || invItems.reduce((s,it)=>s+(it.price*it.qty),0);
    const invNum = o.id; // invoice number = order number (e.g. RA-1234)
    const newInv = {
      id: 'inv-'+Date.now(),
      num: invNum,
      store: o.store||'ra',
      date: new Date().toISOString().split('T')[0],
      dueDate: '',
      paymentMethod: 'cash',
      customer: custName,
      customerId: cust.id,
      delivery: 0,
      discount: 0,
      status: 'unpaid',
      paidAmt: 0,
      notes: `Shop order #${orderId}${o.address?' | 📍 '+o.address:''}${o.notes?' | '+o.notes:''}`,
      address: o.address||'',
      items: invItems,
      total,
      stockReduced: false,
      fromShopOrder: orderId,
      fromShop: true
    };

    invoices.push(newInv);
    cust.debt = (cust.debt||0) + total;

    // Deduct stock from inventory on confirm
    invItems.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if(!prod) return;
      const variant = prod.variants?.find(v => v.id === item.variantId) || prod.variants?.[0];
      if(!variant) return;
      const deduct = item.qty || 0;
      if(prod.store === 'flora') variant.flora = Math.max(0,(variant.flora||0)-deduct);
      else { variant.ra = Math.max(0,(variant.ra||0)-deduct); }
    });

    // Mark customer as shop customer
    if(!cust.fromShop) { cust.fromShop = true; cust.notes = (cust.notes||'') + ' 🛍️'; }
    if(o.address && !cust.address) cust.address = o.address;

    saveInvoices(); saveCustomers(); saveProducts();
    renderInventory(); renderCustomers(); initDashboard();

    // Mark Firebase order as confirmed
    await fetch(`${FB_ORDERS_URL}/${orderId}.json`, {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({status:'confirmed', invoiceId: newInv.id})
    });

    showToast(`✅ Invoice ${invNum} created!`);
    renderShopOrders();
  }catch(e){
    showToast('Failed: '+e.message,'err');
  }
}

async function cancelShopOrder(orderId){
  appConfirm('Cancel Order','Cancel this order? Stock will be restored if it was confirmed.','✕ Cancel Order', async ()=>{
    try{
      // Restore stock if invoice exists (was confirmed)
      const inv = invoices.find(i=>i.fromShopOrder===orderId);
      if(inv && inv.stockReduced){
        raInvoiceRestoreStock(inv);
        inv.status = 'cancelled';
        saveInvoices(); saveProducts();
      } else if(inv){
        inv.status = 'cancelled';
        saveInvoices();
      }
      await fetch(`${FB_ORDERS_URL}/${orderId}.json`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status:'cancelled'})
      });
      showToast('Order cancelled — stock restored');
      renderShopOrders(); renderInventory(); initDashboard();
    }catch(e){ showToast('Failed: '+e.message,'err'); }
  });
}

async function deleteShopOrder(orderId){
  appConfirm('Delete Order','Remove this cancelled order from the list?','🗑️ Delete',async()=>{
    try{
      // Soft delete — mark as deleted in Firebase
      await fetch(`${FB_ORDERS_URL}/${orderId}.json`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({deleted:true})
      });
      showToast('Order removed 🗑️');
      renderShopOrders();
    }catch(e){ showToast('Failed: '+e.message,'err'); }
  });
}

function editShopOrder(orderId){
  // Find the invoice created from this order and open it
  const inv = invoices.find(i => i.fromShopOrder === orderId);
  if(inv){ openInvoiceDetail(inv.id); }
  else { showToast('Invoice not found','err'); }
}

function openCustomerWhatsApp(phone){
  if(!phone){ showToast('No phone number','err'); return; }
  const wa = phone.replace(/\D/g,'');
  if(!wa){ showToast('Invalid phone number','err'); return; }
  window.open(`https://wa.me/${wa}`, '_blank');
}
