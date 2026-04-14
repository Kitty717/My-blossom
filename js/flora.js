// ═══════════════════════════════════════════════════
// FLORA ORDERS  (js/flora.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, inventory.js, dashboard.js, customers.js
// ═══════════════════════════════════════════════════

const FLORA_CH_ICON = {website:'🌐', whatsapp:'💬', instagram:'📱', tiktok:'🎵', walkin:'🚶'};
const FLORA_ST_CLS  = {processing:'ba', shipped:'bb', delivered:'bg', cancelled:'bm'};
const FLORA_ST_LBL  = {processing:'⏳ Processing', shipped:'🚚 Shipped', delivered:'✅ Delivered', cancelled:'✕ Cancelled'};
let _foItems = [];
let _pendingBundleSupplies = null;
let _pendingBundleId = null;

function renderFloraPage(){
  const orders = floraOrders;
  const revenue = orders.filter(o=>o.status==='delivered').reduce((s,o)=>s+o.total,0);
  const proc = orders.filter(o=>o.status==='processing').length;
  const ship = orders.filter(o=>o.status==='shipped').length;
  const el_o = document.getElementById('flora-stat-orders');  if(el_o) el_o.textContent = orders.filter(o=>o.status!=='cancelled').length;
  const el_r = document.getElementById('flora-stat-rev');     if(el_r) el_r.textContent = '$'+revenue.toFixed(2);
  const el_p = document.getElementById('flora-stat-proc');    if(el_p) el_p.textContent = proc;
  const el_s = document.getElementById('flora-stat-ship');    if(el_s) el_s.textContent = ship;
  renderFloraOrders();
}

function renderFloraOrders(){
  const el = document.getElementById('flora-orders-list');
  if(!el) return;
  const q = (document.getElementById('flora-search')?.value||'').toLowerCase().trim();
  let list = [...floraOrders].sort((a,b)=>b.createdAt-a.createdAt);
  if(floraFilter!=='all') list = list.filter(o=>o.status===floraFilter);
  if(q) list = list.filter(o=>
    (o.num||'').toLowerCase().includes(q)||
    (o.customer||'').toLowerCase().includes(q)||
    (o.channel||'').toLowerCase().includes(q)||
    o.items.some(it=>(it.productName||'').toLowerCase().includes(q))
  );
  if(!list.length){
    el.innerHTML = `<div style="text-align:center;padding:50px 20px;color:var(--muted)">
      <div style="font-size:48px;margin-bottom:12px">🌸</div>
      <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">${floraFilter==='all'?'No orders yet':'No '+floraFilter+' orders'}</div>
      <div style="font-size:13px">${floraFilter==='all'?'Tap <b>+ New</b> to log your first Flora order':''}</div>
    </div>`;
    return;
  }
  el.innerHTML = list.map(o=>{
    const chIcon = FLORA_CH_ICON[o.channel]||'🛍️';
    const stCls  = FLORA_ST_CLS[o.status]||'bm';
    const stLbl  = FLORA_ST_LBL[o.status]||o.status;
    const date   = new Date(o.createdAt).toLocaleDateString('en',{month:'short',day:'numeric'});
    const preview = o.items.slice(0,2).map(it=>`${it.productEmoji||'📦'} ${it.productName}${it.variantName&&it.variantName!=='Standard'?' · '+it.variantName:''} ×${it.qty}`).join('  ·  ');
    return `<div class="card" style="cursor:pointer;margin-bottom:10px;padding:16px" onclick="openFloraOrderDetail('${o.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
        <div style="flex:1;min-width:0;margin-right:10px">
          <div style="font-size:14px;font-weight:700;color:var(--ink)">${o.num}${o.customer?' · '+o.customer:''}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${chIcon} ${o.channel} · ${o.items.length} item${o.items.length!==1?'s':''} · ${date}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <span style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--ink)">$${o.total.toFixed(2)}</span>
          <span class="b ${stCls}" style="font-size:10px">${stLbl}</span>
        </div>
      </div>
      <div style="font-size:12px;color:var(--ink-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${preview}${o.items.length>2?' · +more':''}</div>
    </div>`;
  }).join('');
}

// ── New / Edit Order ──
let _foEditId = null;

function openNewFloraOrder(){
  _foEditId = null;
  _foItems = [];
  document.getElementById('fo-customer').value = '';
  document.getElementById('fo-channel').value = 'website';
  document.getElementById('fo-status').value = 'processing';
  document.getElementById('fo-notes').value = '';
  // Populate customer autocomplete
  const dl = document.getElementById('fo-cust-list');
  if(dl) dl.innerHTML = customers.filter(c=>!c.blacklisted).map(c=>`<option value="${c.name}">`).join('');
  // Update modal title
  const title = document.querySelector('#m-flora .mtitle');
  if(title) title.textContent = '🌸 New Flora Order';
  renderFoItems();
  showModal('m-flora');
}

function editFloraOrder(oid){
  const o = floraOrders.find(x=>x.id===oid);
  if(!o) return;
  _foEditId = oid;
  _foItems = JSON.parse(JSON.stringify(o.items));
  document.getElementById('fo-customer').value = o.customer||'';
  document.getElementById('fo-channel').value = o.channel||'website';
  document.getElementById('fo-status').value = o.status||'processing';
  document.getElementById('fo-notes').value = o.notes||'';
  // Populate customer autocomplete
  const dl = document.getElementById('fo-cust-list');
  if(dl) dl.innerHTML = customers.filter(c=>!c.blacklisted).map(c=>`<option value="${c.name}">`).join('');
  // Update modal title
  const title = document.querySelector('#m-flora .mtitle');
  if(title) title.textContent = '✏️ Edit '+o.num;
  closeFloraOrderSheet();
  renderFoItems();
  showModal('m-flora');
}

function renderFoItems(){
  const el = document.getElementById('fo-items');
  if(!el) return;
  if(!_foItems.length){
    el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--muted);font-size:13px;background:var(--grey);border-radius:10px">No items yet — tap + Add Item</div>';
  } else {
    el.innerHTML = _foItems.map((it,idx)=>`
      <div style="background:var(--grey);border-radius:12px;padding:10px 12px;display:flex;align-items:flex-start;gap:8px">
        <div style="font-size:22px;line-height:1;padding-top:2px">${it.productEmoji||'📦'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.productName}${it.variantName&&it.variantName!=='Standard'?' · <span style="color:var(--muted);font-weight:400">'+it.variantName+'</span>':''}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap">
            <label style="font-size:11px;color:var(--muted);font-weight:600">Qty</label>
            <input type="number" value="${it.qty}" min="1" style="width:52px;padding:5px 8px;border:1.5px solid var(--grey2);border-radius:8px;font-size:13px;font-weight:700;text-align:center;font-family:inherit;color:var(--ink);background:var(--white);outline:none" onchange="foUpdateQty(${idx},this.value)">
            <label style="font-size:11px;color:var(--muted);font-weight:600">$</label>
            <input type="number" value="${it.price.toFixed(2)}" min="0" step="0.01" style="width:68px;padding:5px 8px;border:1.5px solid var(--grey2);border-radius:8px;font-size:13px;font-weight:700;text-align:center;font-family:inherit;color:var(--ink);background:var(--white);outline:none" onchange="foUpdatePrice(${idx},this.value)">
            <span style="font-size:12px;color:var(--rose);font-weight:700;margin-left:4px">= $${(it.qty*it.price).toFixed(2)}</span>
          </div>
        </div>
        <button onclick="foRemoveItem(${idx})" style="background:var(--red-soft);color:var(--red);border:none;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:13px;flex-shrink:0">✕</button>
      </div>`).join('');
  }
  foRecalcTotal();
}

function foUpdateQty(idx,val){ _foItems[idx].qty=Math.max(1,parseInt(val,10)||1); renderFoItems(); }
function foUpdatePrice(idx,val){ _foItems[idx].price=parseFloat(val)||0; renderFoItems(); }
function foRemoveItem(idx){ _foItems.splice(idx,1); renderFoItems(); }
function foRecalcTotal(){
  const total = _foItems.reduce((s,it)=>s+it.qty*it.price,0);
  const el = document.getElementById('fo-total');
  if(el) el.textContent = '$'+total.toFixed(2);
}

// ── Product Picker ──
function openFloraPicker(){
  const existing = document.getElementById('flora-picker-sheet');
  if(existing) existing.remove();
  const sheet = document.createElement('div');
  sheet.id = 'flora-picker-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(44,26,31,0.45);display:flex;flex-direction:column;justify-content:flex-end;backdrop-filter:blur(2px);animation:fu 0.2s ease';
  sheet.innerHTML = `
    <div style="background:var(--white);border-radius:24px 24px 0 0;padding:18px 16px 36px;max-height:85dvh;overflow-y:auto">
      <div style="width:40px;height:4px;background:var(--grey2);border-radius:4px;margin:0 auto 16px"></div>
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;margin-bottom:12px;color:var(--ink)">📦 Pick a Product</div>
      <div style="display:flex;align-items:center;gap:6px;background:var(--grey);border-radius:50px;padding:9px 14px;margin-bottom:14px">
        <span>🔍</span>
        <input id="fp-search" placeholder="Search..." style="border:none;outline:none;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--ink);background:transparent;flex:1" oninput="fpFilter(this.value)">
      </div>
      <div id="fp-list">${buildFpList(products.filter(p=>!isProductInTransit(p)))}</div>
    </div>`;
  sheet.addEventListener('click',e=>{ if(e.target===sheet) closeFloraPicker(); });
  document.body.appendChild(sheet);
}

// For 'both' products, Flora pulls from RA warehouse. For 'flora'-only, use flora field.
function fpGetStock(p, v){ return p.store==='flora' ? (v.flora||0) : (v.ra||0); }

function buildFpList(prods, q=''){
  const src = q ? prods.filter(p=>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.variants.some(v=>
      (v.name||'').toLowerCase().includes(q.toLowerCase()) ||
      (v.label||'').toLowerCase().includes(q.toLowerCase()) ||
      (v.size||'').toLowerCase().includes(q.toLowerCase())
    )
  ) : prods;
  if(!src.length) return '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No products found</div>';
  return src.map(p=>{
    const totalStock = p.variants.reduce((s,v)=>s+fpGetStock(p,v),0);
    const stockLabel = p.store==='flora' ? '🌸 Flora stock' : '📦 RA stock';
    const noPriceWarn = !p.priceFlora ? '<span style="font-size:10px;font-weight:700;color:var(--amber);background:var(--amber-soft);padding:2px 6px;border-radius:20px;margin-left:4px">⚠️ No price</span>' : '';
    const isMulti = p.variants.length>1||(p.variants.length===1&&p.variants[0].name&&p.variants[0].name!=='Standard');
    if(!isMulti){
      const v = p.variants[0]||{id:'',name:'Standard',ra:0,flora:0};
      const qty = fpGetStock(p,v);
      return `<div onclick="fpPickItem('${p.id}','${v.id||''}')" style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--grey);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:background 0.12s" onmousedown="this.style.background='var(--rose-pale)'" onmouseup="this.style.background='var(--grey)'">
        <div style="font-size:22px">${p.emoji}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--ink)">${p.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">${stockLabel}: ${qty}${p.priceFlora?' · $'+p.priceFlora.toFixed(2):''}${noPriceWarn}</div>
        </div>
        <span style="font-size:18px;color:var(--rose)">›</span>
      </div>`;
    } else {
      return `<div style="background:var(--grey);border-radius:12px;margin-bottom:8px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
          <div style="font-size:22px">${p.emoji}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:var(--ink)">${p.name}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:1px">${(p.variants.length>1||(p.variants.length===1&&p.variants[0].name&&p.variants[0].name!=='Standard'&&p.variants[0].name!=='')) ? p.variants.length+' variants' : 'No variants'} · ${stockLabel}: ${totalStock}${p.priceFlora?' · from $'+p.priceFlora.toFixed(2):''}</div>
          </div>
          <span style="color:var(--muted);font-size:13px">▾</span>
        </div>
        <div style="display:none;padding:0 12px 12px">
          ${p.variants.map(v=>{
            const qty = fpGetStock(p,v);
            const dot = v.colorHex&&v.colorHex!=='#ede6e8'?`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${v.colorHex};border:1px solid rgba(0,0,0,0.1);margin-right:5px;vertical-align:middle"></span>`:'';
            return `<div onclick="fpPickItem('${p.id}','${v.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:9px 10px;margin-bottom:4px;background:var(--white);border-radius:10px;cursor:pointer">
              <span style="font-size:13px;color:var(--ink)">${dot}${v.name}${v.size?' · <span style="color:var(--muted);font-size:11px">'+v.size+'</span>':''}</span>
              <span style="font-size:12px;font-weight:700;color:${qty<1?'var(--red)':'var(--green)'}">Qty: ${qty}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }
  }).join('');
}

function fpFilter(q){
  const el = document.getElementById('fp-list');
  if(el) el.innerHTML = buildFpList(products.filter(p=>!isProductInTransit(p)), q);
}

function fpPickItem(pid, vid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  const v = (vid ? p.variants.find(x=>x.id===vid) : null)||p.variants[0]||{};
  _foItems.push({
    productId: pid,
    variantId: v.id||'',
    productName: p.name,
    productEmoji: p.emoji,
    variantName: v.name||'',
    qty: 1,
    price: p.priceFlora||0
  });
  closeFloraPicker();
  renderFoItems();
}

function closeFloraPicker(){
  const s = document.getElementById('flora-picker-sheet');
  if(s) s.remove();
}

// ── Save Order ──
function saveFloraOrder(){
  if(!_foItems.length){ showToast('Add at least one item','err'); return; }
  const zeroPrice = _foItems.filter(it=>it.price===0);
  if(zeroPrice.length){
    const names = zeroPrice.map(it=>it.productName).join(', ');
    appConfirm('⚠️ Items with $0 Price', `${zeroPrice.length} item(s) have no price set:\n${names}\n\nSave anyway?`, 'Save Anyway', ()=>_doSaveFloraOrder());
    return;
  }
  _doSaveFloraOrder();
}

function _doSaveFloraOrder(){
  const customer = document.getElementById('fo-customer').value.trim();
  const channel  = document.getElementById('fo-channel').value;
  const status   = document.getElementById('fo-status').value;
  const notes    = document.getElementById('fo-notes').value.trim();
  const total    = _foItems.reduce((s,it)=>s+it.qty*it.price, 0);

  if(_foEditId){
    // Editing existing order
    const o = floraOrders.find(x=>x.id===_foEditId);
    if(!o){ showToast('Order not found','err'); return; }
    const wasReduced = o.stockReduced;
    // If already stock-reduced, restore old items' stock before overwriting
    if(wasReduced) floraRestoreStock(o);
    o.customer = customer; o.channel = channel; o.notes = notes;
    o.items = JSON.parse(JSON.stringify(_foItems)); o.total = total;
    const newStatus = status;
    const willReduce = (newStatus==='shipped'||newStatus==='delivered') && newStatus!=='cancelled';
    if(willReduce){
      o.status = newStatus;
      floraReduceStock(o);
      o.stockReduced = true;
      saveFloraOrders(); saveCustomers(); closeModal('m-flora'); renderFloraPage(); renderInventory(); initDashboard();
      showToast('🌸 '+o.num+' updated!');
      setTimeout(()=>showWsync(o), 400);
    } else {
      o.status = newStatus;
      o.stockReduced = false;
      saveFloraOrders(); saveCustomers(); closeModal('m-flora'); renderFloraPage(); renderInventory(); initDashboard();
      showToast('🌸 '+o.num+' updated!');
    }
    return;
  }

  // New order
  floraOrderCounter++;
  const num = 'FL-'+String(floraOrderCounter).padStart(3,'0');
  const order = {
    id: 'fl-'+Date.now(),
    num, customer, channel,
    items: JSON.parse(JSON.stringify(_foItems)),
    status, notes, total,
    createdAt: Date.now(),
    stockReduced: false
  };
  floraOrders.push(order);
  if(status==='shipped'||status==='delivered'){
    floraReduceStock(order);
    order.stockReduced = true;
  }
  // Deduct bundle supplies NOW (order confirmed)
  if(_pendingBundleSupplies){ reduceSupplyStock(_pendingBundleSupplies); _pendingBundleSupplies=null; _pendingBundleId=null; }
  saveFloraOrders(); saveCustomers();
  closeModal('m-flora');
  renderFloraPage();
  renderInventory();
  initDashboard();
  showToast('🌸 '+num+' saved!');
  if(status==='shipped'||status==='delivered'){
    setTimeout(()=>showWsync(order), 400);
  }
}

// ── Order Detail Sheet ──
function openFloraOrderDetail(oid){
  const o = floraOrders.find(x=>x.id===oid);
  if(!o) return;
  const stCls  = FLORA_ST_CLS[o.status]||'bm';
  const stLbl  = FLORA_ST_LBL[o.status]||o.status;
  const chIcon = FLORA_CH_ICON[o.channel]||'🛍️';
  const date   = new Date(o.createdAt).toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'});
  const STATUS_FLOW = {processing:['shipped','delivered','cancelled'],shipped:['delivered','cancelled'],delivered:[],cancelled:[]};
  const ST_BTN = {
    shipped:   ['background:var(--blue);color:white',  '🚚 Mark Shipped'],
    delivered: ['background:var(--green);color:white', '✅ Mark Delivered'],
    cancelled: ['background:var(--red-soft);color:var(--red)', '✕ Cancel Order']
  };
  const nextBtns = (STATUS_FLOW[o.status]||[]).map(st=>
    `<button style="${ST_BTN[st][0]};border:none;border-radius:50px;padding:12px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;flex:1;text-align:center" onclick="floraUpdateStatus('${o.id}','${st}')">${ST_BTN[st][1]}</button>`
  ).join('');
  const itemsHtml = o.items.map(it=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--grey2)">
      <div style="font-size:22px;flex-shrink:0">${it.productEmoji||'📦'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.productName}${it.variantName&&it.variantName!=='Standard'?' · <span style="color:var(--muted);font-weight:400">'+it.variantName+'</span>':''}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:1px">Qty: ${it.qty} × $${(it.price||0).toFixed(2)}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--ink);flex-shrink:0">$${((it.qty||0)*(it.price||0)).toFixed(2)}</div>
    </div>`).join('');
  const existing = document.getElementById('flora-order-sheet');
  if(existing) existing.remove();
  const sheet = document.createElement('div');
  sheet.id = 'flora-order-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(44,26,31,0.45);display:flex;flex-direction:column;justify-content:flex-end;backdrop-filter:blur(2px);animation:fu 0.2s ease';
  sheet.innerHTML = `
    <div style="background:var(--white);border-radius:24px 24px 0 0;padding:20px 18px 36px;max-height:90dvh;overflow-y:auto">
      <div style="width:40px;height:4px;background:var(--grey2);border-radius:4px;margin:0 auto 16px"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:var(--ink)">${o.num}</div>
          <div style="font-size:13px;color:var(--ink-light);margin-top:3px">${o.customer||'No name'} · ${chIcon} ${o.channel}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">📅 ${date}</div>
        </div>
        <span class="b ${stCls}" style="font-size:12px;flex-shrink:0">${stLbl}</span>
      </div>
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Items</div>
      ${itemsHtml}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:2px solid var(--rose-soft);margin-top:2px">
        <span style="font-size:14px;font-weight:700;color:var(--ink-light)">Total</span>
        <span style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--rose)">$${o.total.toFixed(2)}</span>
      </div>
      ${o.notes?`<div style="background:var(--blush);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--ink-light);margin-bottom:12px">📝 ${o.notes}</div>`:''}
      ${o.stockReduced?'<div style="background:var(--green-soft);border-radius:10px;padding:8px 12px;font-size:12px;color:var(--green);font-weight:600;margin-bottom:12px">✅ Flora stock already reduced</div>':''}
      ${nextBtns?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${nextBtns}</div>`:''}
      <div style="display:flex;gap:8px;margin-top:4px">
        <button onclick="editFloraOrder('${o.id}')" style="background:var(--rose-soft);color:var(--rose);border:none;border-radius:50px;padding:13px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">✏️ Edit</button>
        <button onclick="closeFloraOrderSheet()" style="flex:1;background:var(--grey);color:var(--ink-light);border:none;border-radius:50px;padding:13px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Close</button>
        <button onclick="floraOrderReceipt('${o.id}')" style="background:var(--purple-soft);color:var(--purple);border:none;border-radius:50px;padding:13px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">📄</button>
        <button onclick="deleteFloraOrder('${o.id}')" style="background:var(--red-soft);color:var(--red);border:none;border-radius:50px;padding:13px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">🗑️</button>
      </div>
    </div>`;
  sheet.addEventListener('click',e=>{ if(e.target===sheet) closeFloraOrderSheet(); });
  document.body.appendChild(sheet);
}

function floraOrderReceipt(oid){
  const o = floraOrders.find(x=>x.id===oid);
  if(!o) return;
  const tpls = getCatalogTemplates();
  const t = tpls.flora || {};
  const date = new Date(o.createdAt).toLocaleDateString('en',{day:'numeric',month:'long',year:'numeric'});
  const itemsHtml = o.items.map(it=>`
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:#3d1f2e;font-weight:600">${it.productEmoji||'📦'} ${it.productName}${it.variantName&&it.variantName!=='Standard'?' <span style="color:#c0839a;font-weight:400">· '+it.variantName+'</span>':''}</td>
      <td style="padding:10px 14px;text-align:center;font-size:13px;color:#a05070">${it.qty}</td>
      <td style="padding:10px 14px;text-align:right;font-size:13px;color:#a05070">$${(it.price||0).toFixed(2)}</td>
      <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#d4557a">$${((it.qty||0)*(it.price||0)).toFixed(2)}</td>
    </tr>`).join('');
  const logoHTML = t.logo ? `<img src="${t.logo}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #f7a0c0">` : `<div style="width:56px;height:56px;border-radius:50%;background:#fce8f0;display:flex;align-items:center;justify-content:center;font-size:26px;border:2px solid #f7a0c0">🌸</div>`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${o.num} Receipt</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#fff0f5;padding:30px 20px 60px}
.wrap{max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(212,85,122,0.15)}
.header{background:linear-gradient(135deg,#fce8f0,#ffd6e8);padding:24px 24px 20px;display:flex;align-items:center;gap:16px}
.biz{flex:1}.biz-name{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#c23067}.biz-tag{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#d4557a;margin-top:3px}
.biz-contact{font-size:11px;color:#b06080;margin-top:6px}
.order-meta{padding:16px 24px;border-bottom:1px solid #fce0ea;background:#fffbfc}
.order-num{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#3d1f2e}
.order-sub{font-size:12px;color:#a05070;margin-top:4px;display:flex;gap:14px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse}
thead{background:#fce8f0}
thead th{padding:9px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c23067;text-align:left}
thead th:nth-child(2),thead th:nth-child(3),thead th:nth-child(4){text-align:center;text-align:right}
tbody tr{border-bottom:1px solid #fce0ea}
tbody tr:nth-child(even){background:#fffbfc}
.total-row{padding:16px 24px;display:flex;justify-content:space-between;align-items:center;border-top:2px solid #fce8f0;background:#fff5f8}
.total-lbl{font-size:14px;font-weight:700;color:#a05070}
.total-val{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#d4557a}
.footer{background:#fce8f0;padding:14px 24px;text-align:center;font-size:11px;color:#c0839a}
.status-pill{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#e8f5ee;color:#4caf7d}
.print-bar{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:999}
.print-bar button{padding:11px 20px;border:none;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;box-shadow:0 4px 16px rgba(212,85,122,0.2)}
.btn-print{background:linear-gradient(135deg,#e8748a,#c23067);color:white}
.btn-close{background:#fff;color:#a05070;border:1px solid #fce0ea}
@media print{.print-bar{display:none!important}body{background:#fff;padding:0}.wrap{box-shadow:none;border-radius:0;max-width:100%}}
</style></head><body>
<div class="print-bar no-print">
  <button class="btn-close" onclick="window.close()">✕ Close</button>
  <button class="btn-print" onclick="window.print()">🖨️ Save PDF</button>
</div>
<div class="wrap">
  <div class="header">
    <div class="biz">
      <div class="biz-name">${t.bizName||'Flora Gift Shop'}</div>
      <div class="biz-tag">Receipt</div>
      <div class="biz-contact">${t.wa?'📱 '+t.wa:''} ${t.ig?'· 📸 '+t.ig:''}</div>
    </div>
    ${logoHTML}
  </div>
  <div class="order-meta">
    <div class="order-num">${o.num}</div>
    <div class="order-sub">
      <span>👤 ${o.customer||'Customer'}</span>
      <span>📅 ${date}</span>
      <span class="status-pill">✅ ${o.status}</span>
    </div>
    ${o.notes?`<div style="margin-top:8px;font-size:12px;color:#a05070;background:#fff5f8;border-radius:8px;padding:7px 10px">📝 ${o.notes}</div>`:''}
  </div>
  <table>
    <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="total-row">
    <div class="total-lbl">Total</div>
    <div class="total-val">$${o.total.toFixed(2)}</div>
  </div>
  <div class="footer">${t.bizName||'Flora Gift Shop'} · ${date}${t.address?' · '+t.address:''}<br>Thank you! 🌸</div>
</div>

</body></html>`;
  const w = window.open('','_blank');
  if(!w){ showToast('Allow popups to open PDF','err'); return; }
  w.document.write(html);
  w.document.close();
}


function closeFloraOrderSheet(){
  const s = document.getElementById('flora-order-sheet');
  if(s) s.remove();
}

// ── Status Update + Stock Reduce ──
function floraUpdateStatus(oid, newStatus){
  const o = floraOrders.find(x=>x.id===oid);
  if(!o) return;
  const wasReduced = o.stockReduced;
  const willReduce = (newStatus==='shipped'||newStatus==='delivered') && !wasReduced;
  const willRestore = newStatus==='cancelled' && wasReduced;

  const doUpdate = ()=>{
    o.status = newStatus;
    if(willReduce){
      floraReduceStock(o);
      o.stockReduced = true;
    }
    if(willRestore){
      floraRestoreStock(o);
      o.stockReduced = false;
    }
    if(newStatus==='delivered') updateCustLastOrder(o.customer, new Date().toISOString().split('T')[0]);
    saveFloraOrders(); saveCustomers();
    closeFloraOrderSheet();
    renderFloraPage();
    initDashboard();
    showToast('Order → '+FLORA_ST_LBL[newStatus]);
    if(newStatus==='shipped'||newStatus==='delivered'){
      setTimeout(()=>showWsync(o), 400);
    }
  };

  if(willReduce){
    const itemLines = o.items.map(it=>`• ${it.productName}${it.variantName&&it.variantName!=='Standard'?' ('+it.variantName+')':''}: −${it.qty}`).join('\n');
    appConfirm(
      'Reduce Flora Stock?',
      `Marking as ${FLORA_ST_LBL[newStatus]} will reduce:\n\n${itemLines}\n\nThis cannot be undone.`,
      '✅ Confirm',
      doUpdate
    );
  } else if(willRestore){
    const itemLines = o.items.map(it=>`• ${it.productName}${it.variantName&&it.variantName!=='Standard'?' ('+it.variantName+')':''}: +${it.qty}`).join('\n');
    appConfirm(
      'Restore Flora Stock?',
      `Cancelling will restore:\n\n${itemLines}\n\nback to Flora inventory.`,
      '✕ Cancel Order',
      doUpdate
    );
  } else {
    doUpdate();
  }
}

function floraReduceStock(order){
  order.items.forEach(it=>{
    const p = products.find(x=>x.id===it.productId);
    if(!p) return;
    const v = p.variants.find(x=>x.id===it.variantId)||p.variants[0];
    if(!v) return;
    // 'flora'-only products use their own stock; 'both' products pull from RA warehouse
    if(p.store==='flora'){
      v.flora = Math.max(0,(v.flora||0)-it.qty);
    } else {
      v.ra = Math.max(0,(v.ra||0)-it.qty);
    }
  });
  saveFloraOrders(); saveCustomers();
  renderInventory();
  initDashboard();
}

function floraRestoreStock(order){
  order.items.forEach(it=>{
    const p = products.find(x=>x.id===it.productId);
    if(!p) return;
    const v = p.variants.find(x=>x.id===it.variantId)||p.variants[0];
    if(!v) return;
    if(p.store==='flora'){
      v.flora = (v.flora||0)+it.qty;
    } else {
      v.ra = (v.ra||0)+it.qty;
    }
  });
  saveFloraOrders(); saveCustomers();
  renderInventory();
  initDashboard();
}

function deleteFloraOrder(oid){
  const o = floraOrders.find(x=>x.id===oid);
  if(!o) return;
  const msg = o.stockReduced
    ? `Delete ${o.num}? Stock will be restored.`
    : `Delete ${o.num}?`;
  appConfirm('Delete Order', msg, '🗑️ Delete', ()=>{
    if(o.stockReduced) floraRestoreStock(o);
    floraOrders = floraOrders.filter(x=>x.id!==oid);
    saveFloraOrders(); saveCustomers();
    closeFloraOrderSheet();
    renderFloraPage();
    renderInventory();
    initDashboard();
    showToast('Order deleted' + (o.stockReduced ? ' — stock restored ↩️' : ''));
  });
}

// ── WSync helper ──
function showWsync(order){
  const el = document.getElementById('wsync-items');
  if(!el) return;
  el.innerHTML = order.items.map(it=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--grey);border-radius:10px;margin-bottom:6px">
      <div style="font-size:20px">${it.productEmoji||'📦'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.productName}${it.variantName&&it.variantName!=='Standard'?' · '+it.variantName:''}</div>
        <div style="font-size:12px;color:var(--muted)">Reduce by ${it.qty} unit${it.qty!==1?'s':''}</div>
      </div>
      <span style="font-size:14px;font-weight:700;color:var(--red);flex-shrink:0">−${it.qty}</span>
    </div>`).join('');
  const storeEl = document.getElementById('wsync-store');
  if(storeEl) storeEl.textContent = 'https://app.easy-orders.net/#/products 🌐';
  const wsync = document.getElementById('m-wsync');
  if(wsync){
    // Update description to be order-specific
    const desc = wsync.querySelector('[style*="font-size:12px;color:var(--muted)"]');
    if(desc) desc.innerHTML = `<strong>${order.num}</strong> fulfilled — reduce these on your website:`;
    wsync.style.display = 'flex';
  }
}
