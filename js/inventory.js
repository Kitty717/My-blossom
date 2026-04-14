// ═══════════════════════════════════════════════════
// INVENTORY.JS — Products, variants, add/edit/delete
// Depends on: data.js, utils.js
// Cross-module calls: if(typeof renderCatalog==='function') renderCatalog(), initDashboard(),
//   showQR(), getReorderDismissed(), dismissReorder(),
//   snoozeReorder(), reorderSwipeStart/Move/End(),
//   createReorderTodo(), setCatChipValue(),
//   injectCustomCatChip(), isProductInTransit(),
//   openVColorPicker()
// ═══════════════════════════════════════════════════

// ── State ──
let _lpTimer = null;
let _lpPid = null;
let _selectedProducts = new Set();
let _invGridMode = false;
let _npPhotoData = '';
let _editingProductId = null, _epPhotoData = '';
let _npBadge = '', _epBadge = '';
// _updatingProductId / _updatingVariantId declared in data.js

// ── Virtual Scroll ──
let _invVirtualList = [];
let _invVirtualStart = 0;
const INV_PAGE = 12;
let _invScrollListener = null;

function _renderVirtualInventory(){
  const el = document.getElementById('inv-list');
  if(!el) return;
  if(!_invVirtualList.length){
    el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:30px 0;font-size:14px">No products found</div>';
    return;
  }
  _invVirtualStart = INV_PAGE;
  el.innerHTML = _invVirtualList.slice(0, INV_PAGE).map(p => renderInvCard(p)).join('');
  if(_invVirtualList.length <= INV_PAGE) return;
  const sentinel = document.createElement('div');
  sentinel.id = 'inv-scroll-sentinel';
  sentinel.style.cssText = 'height:60px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px';
  sentinel.textContent = '⏳ Loading more...';
  el.appendChild(sentinel);
  const scroller = document.querySelector('.content');
  if(_invScrollListener && scroller) scroller.removeEventListener('scroll', _invScrollListener);
  _invScrollListener = () => {
    const sent = document.getElementById('inv-scroll-sentinel');
    if(!sent) return;
    const rect = sent.getBoundingClientRect();
    const viewH = window.innerHeight || document.documentElement.clientHeight;
    if(rect.top <= viewH + 200){
      const next = _invVirtualList.slice(_invVirtualStart, _invVirtualStart + INV_PAGE);
      if(!next.length){ sent.remove(); if(scroller) scroller.removeEventListener('scroll', _invScrollListener); return; }
      const frag = document.createDocumentFragment();
      next.forEach(p => { const div = document.createElement('div'); div.innerHTML = renderInvCard(p); frag.appendChild(div.firstElementChild); });
      el.insertBefore(frag, sent);
      _invVirtualStart += INV_PAGE;
      if(_invVirtualStart >= _invVirtualList.length) sent.remove();
    }
  };
  if(scroller) scroller.addEventListener('scroll', _invScrollListener, { passive: true });
}

// ── Tabs ──

function rebuildInvTabs(){
  const tabs = document.getElementById('inv-tabs');
  if(!tabs) return;
  const urgentCount = products.filter(p=>!isProductInTransit(p)&&getTotalQty(p)<(p.reorderAt||10)).length;
  const reorderBadge = urgentCount > 0 ? `<span style="background:var(--red);color:white;border-radius:50px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:4px">${urgentCount}</span>` : '';
  // Update drawer badge
  const drawerBadge = document.getElementById('drawer-reorder-badge');
  if(drawerBadge){ drawerBadge.textContent = urgentCount; drawerBadge.style.display = urgentCount > 0 ? 'inline' : 'none'; }
  const base = `
    <div class="tab${invFilter==='all'?' active':''}" onclick="invFilter='all';ftab(this);renderInventory()">All</div>
    <div class="tab${invFilter==='low'?' active':''}" onclick="invFilter='low';ftab(this);renderInventory()">⚠️ Low</div>
    <div class="tab${invFilter==='reorder'?' active':''}" onclick="invFilter='reorder';ftab(this);renderInventory()">📋 Reorder${reorderBadge}</div>
    <div class="tab${invFilter==='flora'?' active':''}" onclick="invFilter='flora';ftab(this);renderInventory()">🌸 Flora</div>
    <div class="tab${invFilter==='ra'?' active':''}" onclick="invFilter='ra';ftab(this);renderInventory()">🏪 RA</div>`;
  const shipTabs = shipments.map(s=>{
    const active = invFilter==='ship-'+s.id;
    return `<div class="tab${active?' active':''}" data-sid="${s.id}" onclick="invFilter='ship-${s.id}';ftab(this);renderInventory()">${s.name}</div>`;
  }).join('');
  tabs.innerHTML = base + shipTabs;
}

// ── Render ──

function fmtVariant(v){
  const parts = [];
  if(v.label) parts.push(v.label);
  if(v.name && v.name !== 'Standard') parts.push(v.name);
  else if(!v.label) parts.push(v.name||'Standard');
  if(v.size) parts.push(v.size);
  return parts.join(' · ');
}

function renderInventory(){
  const invListEl = document.getElementById('inv-list');
  const reorderViewEl = document.getElementById('reorder-view');

  // Show reorder tab view
  if(invFilter === 'reorder'){
    if(invListEl) invListEl.style.display = 'none';
    if(reorderViewEl) { reorderViewEl.style.display = 'block'; renderReorderView(); }
    document.getElementById('inv-count-sub').textContent = 'Reorder Dashboard';
    return;
  }
  if(invListEl) invListEl.style.display = '';
  if(reorderViewEl) reorderViewEl.style.display = 'none';

  const q = (document.getElementById('prod-search')?.value||'').toLowerCase();
  let list = products.filter(p=>{
    if(invFilter==='low') return getTotalQty(p)<(p.reorderAt||10);
    if(invFilter==='flora') return p.store==='flora'||p.store==='both';
    if(invFilter==='ra') return p.store==='ra'||p.store==='both';
    if(invFilter.startsWith('ship-')) return p.shipmentId===invFilter.replace('ship-','');
    return true;
  });
  if(q) list = list.filter(p=>
    p.name.toLowerCase().includes(q) ||
    (p.category||'').toLowerCase().includes(q) ||
    p.variants.some(v=>(v.label||'').toLowerCase().includes(q)||(v.name||'').toLowerCase().includes(q)||(v.size||'').toLowerCase().includes(q)||(v.id||'').includes(q))
  );

  const total = products.reduce((s,p)=>s+getTotalQty(p),0);
  const inTransitCount = products.filter(p=>isProductInTransit(p)).length;
  const lowCount = products.filter(p=>!isProductInTransit(p)&&getTotalQty(p)<(p.reorderAt||10)).length;
  document.getElementById('inv-count-sub').textContent = total+' units · '+lowCount+' low'+(inTransitCount>0?' · '+inTransitCount+' on the way 🚢':'');

  _invVirtualList = list;
  _renderVirtualInventory();

  const reorderProds = products.filter(p=>!isProductInTransit(p)&&getTotalQty(p)<(p.reorderAt||10));
  const rEl = document.getElementById('reorder-list');
  const reorderDismissed = getReorderDismissed();
  const visibleReorder = reorderProds.filter(p=>{
    const d = reorderDismissed[p.id];
    if(!d) return true;
    if(d.startsWith('snooze:')) return Date.now() > parseInt(d.split(':')[1],10);
    return getTotalQty(p) !== parseInt(d,10);
  });
  if(rEl) rEl.innerHTML = visibleReorder.map(p=>`
    <div class="reorder-card" style="margin-bottom:10px">
      <div style="font-size:26px">${p.emoji}</div>
      <div class="reorder-info"><div class="reorder-name">${p.name}</div><div class="reorder-sub">Only ${getTotalQty(p)} left · reorder at ${p.reorderAt}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button onclick="event.stopPropagation();createReorderTodo('${p.id}')" style="background:var(--amber);color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap">📋 Reorder</button>
        <button onclick="snoozeReorder('${p.id}',${getTotalQty(p)})" style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap">😴 Snooze</button>
        <button onclick="dismissReorder('${p.id}',${getTotalQty(p)})" style="background:var(--red);color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap">✕ Dismiss</button>
      </div>
    </div>`).join('');
}

function goToReorderTab(){
  invFilter = 'reorder';
  showPage('products'); setNav('products');
  rebuildInvTabs(); renderInventory();
}

function renderReorderView(){
  const el = document.getElementById('reorder-view');
  if(!el) return;

  // 1. Urgent — below threshold, not in transit
  const reorderDismissed = getReorderDismissed();
  const urgent = products.filter(p => !isProductInTransit(p) && getTotalQty(p) < (p.reorderAt||10));
  const visibleUrgent = urgent.filter(p => {
    const d = reorderDismissed[p.id];
    if(!d) return true;
    if(d.startsWith('snooze:')) return Date.now() > parseInt(d.split(':')[1],10);
    return getTotalQty(p) !== parseInt(d,10);
  });

  // 2. High demand — top products by invoice frequency last 60 days
  const cutoff = Date.now() - 60*24*60*60*1000;
  const freq = {};
  invoices.filter(i => new Date(i.date).getTime() > cutoff).forEach(inv => {
    (inv.items||[]).forEach(it => { freq[it.productId] = (freq[it.productId]||0) + (it.qty||1); });
  });
  const highDemand = products
    .filter(p => (freq[p.id]||0) > 0 && !urgent.find(u=>u.id===p.id))
    .sort((a,b) => (freq[b.id]||0) - (freq[a.id]||0))
    .slice(0, 6);

  // 3. In transit
  const inTransit = products.filter(p => isProductInTransit(p));

  // 4. Recently restocked — products edited in last 7 days with stock > reorderAt
  const recentCutoff = Date.now() - 7*24*60*60*1000;
  const recentlyRestocked = products.filter(p => {
    const qty = getTotalQty(p);
    return p.restockedAt && p.restockedAt > recentCutoff && qty >= (p.reorderAt||10);
  });

  const urgentHtml = visibleUrgent.length ? visibleUrgent.map(p => `
    <div class="reorder-card" style="margin-bottom:10px">
      <div style="font-size:26px">${p.emoji}</div>
      <div class="reorder-info"><div class="reorder-name">${p.name}</div><div class="reorder-sub">Only ${getTotalQty(p)} left · reorder at ${p.reorderAt||10}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button onclick="event.stopPropagation();createReorderTodo('${p.id}')" style="background:var(--amber);color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap">📋 Reorder</button>
        <button onclick="snoozeReorder('${p.id}',${getTotalQty(p)})" style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap">😴 Snooze</button>
        <button onclick="dismissReorder('${p.id}',${getTotalQty(p)})" style="background:var(--red);color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap">✕ Dismiss</button>
      </div>
    </div>`).join('') : '<div style="color:var(--green);font-size:13px;font-weight:600;padding:12px 0">✅ Nothing urgent right now!</div>';

  const demandHtml = highDemand.length ? highDemand.map((p,i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--white);border-radius:12px;margin-bottom:8px;border:1.5px solid var(--grey2)">
      <div style="font-size:22px">${p.emoji}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--ink)">${p.name}</div>
        <div style="font-size:11px;color:var(--muted)">${freq[p.id]} sold in 60 days · ${getTotalQty(p)} in stock</div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--amber);background:var(--amber-soft);padding:3px 8px;border-radius:20px">#${i+1}</div>
    </div>`).join('') : '<div style="color:var(--muted);font-size:13px;padding:12px 0">No invoice data yet</div>';

  const transitHtml = inTransit.length ? inTransit.map(p => {
    const ship = shipments.find(s=>s.id===p.shipmentId);
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--blue-soft);border-radius:12px;margin-bottom:8px;border:1.5px solid rgba(91,141,238,0.2)">
      <div style="font-size:22px">${p.emoji}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--ink)">${p.name}</div>
        <div style="font-size:11px;color:var(--muted)">${ship ? (ship.status==='onway'?'🚢 On the way':'📋 Ordered') + ' · ' + ship.name : 'In transit'}</div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--blue)">${ship?.eta ? '📅 '+ship.eta : ''}</div>
    </div>`;
  }).join('') : '<div style="color:var(--muted);font-size:13px;padding:12px 0">Nothing on the way</div>';

  const restockedHtml = recentlyRestocked.length ? recentlyRestocked.map(p => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--green-soft);border-radius:12px;margin-bottom:8px;border:1.5px solid rgba(76,175,125,0.2)">
      <div style="font-size:22px">${p.emoji}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--ink)">${p.name}</div>
        <div style="font-size:11px;color:var(--muted)">${getTotalQty(p)} in stock · restocked recently</div>
      </div>
      <div style="font-size:16px">✅</div>
    </div>`).join('') : '<div style="color:var(--muted);font-size:13px;padding:12px 0">No recent restocks tracked</div>';

  el.innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🚨 Urgent — Order Now (${visibleUrgent.length})</div>
      ${urgentHtml}
    </div>
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">📈 High Demand — Reorder Soon</div>
      ${demandHtml}
    </div>
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🚢 Already On The Way (${inTransit.length})</div>
      ${transitHtml}
    </div>
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">✅ Recently Restocked</div>
      ${restockedHtml}
    </div>`;
}

function renderInvCard(p){
  const totalQty = getTotalQty(p);
  const isLow = totalQty < (p.reorderAt||10);
  const ship = p.shipmentId ? shipments.find(s=>s.id===p.shipmentId) : null;
  const shipTag = ship ? `<div class="ship-tag">${ship.status==='arrived'?'✅':ship.status==='onway'?'🚢':'📋'} ${ship.name}${ship.status!=='arrived'?' · '+ship.status:''}</div>` : '';
  const photoHtml = p.photo
    ? `<img class="inv-grid-photo" src="${p.photo}" style="width:100%;height:80px;object-fit:cover;flex-shrink:0">`
    : `<div class="inv-grid-photo-placeholder" style="width:100%;height:64px;display:flex;align-items:center;justify-content:center;font-size:28px;background:var(--rose-pale);flex-shrink:0">${p.emoji}</div>`;
  return `<div class="inv-prod-card" id="ipc-${p.id}"
    onclick="invCardTap('${p.id}',event)"
    ontouchstart="invLpStart('${p.id}',this)"
    ontouchend="invLpEnd()"
    ontouchmove="invLpCancel()"
    oncontextmenu="invLpContext('${p.id}',event)"
    style="position:relative">
    <div class="inv-select-overlay"></div>
    <div class="inv-select-check">✓</div>
    ${photoHtml}
    <div class="inv-prod-head">
      <div class="inv-list-thumb">${p.photo ? `<img src="${p.photo}">` : p.emoji}</div>
      <div class="inv-prod-emoji">${p.emoji}</div>
      <div class="inv-prod-info">
        <div class="inv-prod-name">${p.name}</div>
        <div class="inv-prod-sub">${(p.variants.length>1||(p.variants.length===1&&p.variants[0].name&&p.variants[0].name!=='Standard'&&p.variants[0].name!=='')) ? p.variants.length+' variant'+(p.variants.length>1?'s':'') : 'No variants'} · ${totalQty} total ${isLow?'⚠️':''}</div>
        ${shipTag}
      </div>
      <button class="icon-btn icon-btn-s list-only-btn" onclick="event.stopPropagation();showQR('${p.id}')" title="QR Code">⬛</button>
      <button class="icon-btn icon-btn-s list-only-btn" onclick="event.stopPropagation();openEditProduct('${p.id}')" title="Edit" style="color:var(--blue)">✏️</button>
      <button class="icon-btn icon-btn-s list-only-btn" onclick="event.stopPropagation();deleteProduct('${p.id}')" title="Delete" style="color:var(--red)">🗑️</button>
      <div class="inv-prod-arrow" style="margin-left:6px">▾</div>
    </div>
    <div class="inv-variants">
      ${p.variants.map(v=>{
        const noColor = !v.colorHex || v.colorHex === '#ede6e8' || v.colorHex === '#f4a0b0' || v.colorHex === '';
        const dot = noColor ? '' : `<div class="var-dot" style="background:${v.colorHex}"></div>`;
        const isGeneric = v.name.toLowerCase()==='standard' && !v.size && noColor;
        const vPhoto = v.photo || '';
        const vThumb = vPhoto ? `<img src="${vPhoto}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;flex-shrink:0">` : '';
        const label = (!isGeneric || vPhoto) ? `${vThumb}${!isGeneric ? dot+'<div class="var-name">'+fmtVariant(v)+'</div>' : ''}` : '';
        const vid = p.id+'-'+v.id;
        const qtyHtml = p.store==='ra' ? `<div class="var-stock"><span class="var-stock-val${v.ra<3?' low':''}">${v.ra}</span><span class="var-stock-lbl">RA</span></div>` :
          p.store==='flora' ? `<div class="var-stock"><span class="var-stock-val${v.flora<3?' low':''}">${v.flora}</span><span class="var-stock-lbl">Flora</span></div>` :
          `<div class="var-stock"><span class="var-stock-val${(v.ra+v.flora)<3?' low':''}">${v.ra+v.flora}</span><span class="var-stock-lbl">Qty</span></div>`;
        const pricingRows = [
          p.costSource ? `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--grey2);font-size:12px"><span style="color:var(--muted)">🌍 Source Cost</span><span style="font-weight:600">$${p.costSource.toFixed(2)}</span></div>` : '',
          p.cost ? `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--grey2);font-size:12px"><span style="color:var(--muted)">📦 Arrival Cost</span><span style="font-weight:600">$${p.cost.toFixed(2)}</span></div>` : '',
          (p.store==='ra'||p.store==='both') && p.priceRAPiece ? `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--grey2);font-size:12px"><span style="color:var(--muted)">🏪 RA Piece</span><span style="font-weight:600;color:var(--amber)">$${p.priceRAPiece.toFixed(2)}</span></div>` : '',
          (p.store==='ra'||p.store==='both') && p.priceRADozen ? `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--grey2);font-size:12px"><span style="color:var(--muted)">🏪 RA Dozen</span><span style="font-weight:600;color:var(--amber)">$${p.priceRADozen.toFixed(2)}/pc · $${(p.priceRADozen*12).toFixed(2)} total</span></div>` : '',
          (p.store==='ra'||p.store==='both') && p.standUnit && p.standUnit.qty && p.standUnit.price ? `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--grey2);font-size:12px"><span style="color:var(--muted)">📦 ${p.standUnit.name||'Stand'}</span><span style="font-weight:600;color:var(--amber)">$${p.standUnit.price.toFixed(2)} · ${p.standUnit.qty} pcs</span></div>` : '',
          (p.store==='flora'||p.store==='both') && p.priceFlora ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px"><span style="color:var(--muted)">🌸 Flora Retail</span><span style="font-weight:600;color:var(--rose)">$${p.priceFlora.toFixed(2)}</span></div>` : '',
        ].filter(Boolean).join('');
        const hasPricing = pricingRows.length > 0;
        return `<div class="inv-var-row" style="flex-direction:column;align-items:stretch;cursor:${hasPricing?'pointer':'default'}" onclick="event.stopPropagation();${hasPricing?`toggleVarPricing('${vid}',event)`:''}" id="ivr-${vid}">
          <div style="display:flex;align-items:center">
            <div style="flex:1">${label}</div>
            <div class="var-stocks" style="${isGeneric?'margin-left:auto':''}">
              ${qtyHtml}
            </div>
            ${hasPricing ? `<span id="ivr-arr-${vid}" style="font-size:11px;color:var(--muted);margin-left:6px">▾</span>` : ''}
          </div>
          <div id="ivr-detail-${vid}" style="display:none;background:var(--blush);border-radius:10px;padding:8px 12px;margin-top:8px">
            ${pricingRows}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function toggleVarPricing(vid, event){
  if(event) event.stopPropagation();
  const detail = document.getElementById('ivr-detail-'+vid);
  const arr = document.getElementById('ivr-arr-'+vid);
  if(!detail) return;
  const open = detail.style.display==='block';
  detail.style.display = open ? 'none' : 'block';
  if(arr) arr.textContent = open ? '▾' : '▴';
}

// ── Long-press to enter select mode ──

function invLpStart(pid, el){
  _lpPid = pid;
  el.classList.add('lp-active');
  _lpTimer = setTimeout(()=>{
    el.classList.remove('lp-active');
    if(!document.body.classList.contains('select-mode')) enterSelectMode(pid);
  }, 500);
}
function invLpEnd(){
  clearTimeout(_lpTimer);
  _lpTimer = null;
  document.querySelectorAll('.lp-active').forEach(e=>e.classList.remove('lp-active'));
}
function invLpCancel(){ invLpEnd(); }
function invLpContext(pid, e){
  e.preventDefault();
  if(!document.body.classList.contains('select-mode')) enterSelectMode(pid);
}

function invCardTap(pid, event){
  if(document.body.classList.contains('select-mode')){ toggleSelectProduct(pid); return; }
  const isGrid = document.getElementById('inv-list')?.classList.contains('grid-view');
  if(isGrid) openInvGridView(pid);
  else toggleInvCard(pid);
}

// ── Select / Bulk delete mode ──

function enterSelectMode(firstPid){
  _selectedProducts.clear();
  document.body.classList.add('select-mode');
  const fab = document.getElementById('inv-select-fab');
  if(fab) fab.classList.add('active');
  if(firstPid) toggleSelectProduct(firstPid, true);
  else updateSelectBar();
}

function exitSelectMode(){
  _selectedProducts.clear();
  document.body.classList.remove('select-mode');
  const fab = document.getElementById('inv-select-fab');
  if(fab) fab.classList.remove('active');
  document.querySelectorAll('.inv-prod-card.selected').forEach(el=>el.classList.remove('selected'));
}

function toggleSelectProduct(pid, skipBarUpdate){
  const el = document.getElementById('ipc-'+pid);
  if(!el) return;
  if(_selectedProducts.has(pid)){ _selectedProducts.delete(pid); el.classList.remove('selected'); }
  else { _selectedProducts.add(pid); el.classList.add('selected'); }
  if(!skipBarUpdate) updateSelectBar();
}

function selectAllProducts(){
  const visible = document.querySelectorAll('#inv-list .inv-prod-card');
  const allSelected = visible.length === _selectedProducts.size;
  if(allSelected){ exitSelectMode(); }
  else {
    visible.forEach(el=>{ const pid = el.id.replace('ipc-',''); _selectedProducts.add(pid); el.classList.add('selected'); });
    updateSelectBar();
  }
}

function updateSelectBar(){
  const n = _selectedProducts.size;
  const label = document.getElementById('inv-select-label');
  if(label) label.textContent = n === 0 ? 'Hold card to select' : `${n} selected`;
  const delBtn = document.getElementById('inv-select-del');
  if(delBtn){ delBtn.style.opacity = n > 0 ? '1' : '0.4'; delBtn.style.pointerEvents = n > 0 ? 'auto' : 'none'; }
}

function bulkDeleteSelected(){
  const n = _selectedProducts.size;
  if(n === 0) return;
  appConfirm('Delete Products', `Delete ${n} product${n>1?'s':''}? This cannot be undone.`, `🗑️ Delete ${n}`, ()=>{
    _selectedProducts.forEach(pid=>{ const idx = products.findIndex(p=>p.id===pid); if(idx !== -1) products.splice(idx,1); });
    saveProducts(); exitSelectMode();
    renderInventory(); if(typeof renderCatalog==='function') renderCatalog(); initDashboard();
    showToast(`🗑️ ${n} product${n>1?'s':''} deleted`);
  });
}

function toggleInvCard(pid){
  const el = document.getElementById('ipc-'+pid);
  if(el) el.classList.toggle('collapsed');
}

// ── View toggle ──

function setInvView(mode){
  _invGridMode = (mode === 'grid');
  const list = document.getElementById('inv-list');
  const iconList = document.getElementById('ivt-icon-list');
  const iconGrid = document.getElementById('ivt-icon-grid');
  const label = document.getElementById('ivt-label');
  if(_invGridMode){
    list.classList.add('grid-view');
    if(iconList) iconList.style.display = 'none';
    if(iconGrid) iconGrid.style.display = 'block';
    if(label) label.textContent = 'Grid view';
  } else {
    list.classList.remove('grid-view');
    if(iconList) iconList.style.display = 'block';
    if(iconGrid) iconGrid.style.display = 'none';
    if(label) label.textContent = 'List view';
  }
}
function toggleInvGrid(){ setInvView(_invGridMode?'list':'grid'); }

function npShowPhotoChoice(e, mode){
  if(mode==='gallery') document.getElementById('np-photo-input').click();
  else document.getElementById('np-photo-camera').click();
}

// ── Grid view sheet ──

function openInvGridView(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  const totalQty = getTotalQty(p);
  const isLow = totalQty < (p.reorderAt||10);
  const ship = p.shipmentId ? shipments.find(s=>s.id===p.shipmentId) : null;
  const isRealVariants = p.variants.length > 1 || (p.variants.length === 1 && p.variants[0].name && p.variants[0].name !== 'Standard' && p.variants[0].name !== '');
  const sv = p.variants[0] || {ra:0, flora:0};
  const html = `
    <div style="background:var(--white);border-radius:20px 20px 0 0;padding:20px 18px 36px;max-height:80dvh;overflow-y:auto">
      <div style="width:36px;height:4px;background:var(--grey2);border-radius:2px;margin:0 auto 16px"></div>
      ${p.photo?`<img src="${p.photo}" style="width:100%;height:160px;object-fit:cover;border-radius:14px;margin-bottom:14px">`:
        `<div style="width:100%;height:90px;display:flex;align-items:center;justify-content:center;font-size:52px;background:var(--rose-pale);border-radius:14px;margin-bottom:14px">${p.emoji}</div>`}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:18px;font-weight:700;color:var(--ink)">${p.emoji} ${p.name}</div>
        ${isLow?'<span class="b br">⚠️ Low</span>':'<span class="b bg">✅ OK</span>'}
      </div>
      <div style="font-size:12px;color:var(--ink-light);margin-bottom:14px">${ship?'📦 '+ship.name:'No shipment'} · ${isRealVariants ? p.variants.length+' variant'+(p.variants.length>1?'s':'') : 'No variants'}</div>
      <div style="border-radius:12px;overflow:hidden;border:1px solid var(--grey2);margin-bottom:16px">
        ${isRealVariants ? `
        <div style="background:var(--grey);padding:8px 14px;display:grid;grid-template-columns:1fr auto auto;gap:0">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">Variant</div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;width:48px;text-align:center">RA</div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;width:52px;text-align:center">Flora</div>
        </div>
        ${p.variants.map(v=>`
          <div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:0;padding:10px 14px;border-top:1px solid var(--grey2);background:var(--white)">
            <div style="display:flex;align-items:center;gap:8px">
              ${(v.colorHex && v.colorHex!=='#ede6e8' && v.colorHex!=='#f4a0b0') ? '<div style="width:9px;height:9px;border-radius:50%;background:'+v.colorHex+';border:1.5px solid rgba(0,0,0,0.12);flex-shrink:0"></div>' : ''}
              <div style="font-size:13px;font-weight:500;color:var(--ink)">${fmtVariant(v)}</div>
            </div>
            <div style="width:48px;text-align:center;font-size:14px;font-weight:700;color:${v.ra<3?'var(--red)':'var(--ink)'}">${v.ra}</div>
            <div style="width:52px;text-align:center;font-size:14px;font-weight:700;color:${v.flora<3?'var(--red)':'var(--ink)'}">${v.flora}</div>
          </div>`).join('')}
        ` : `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
          <div style="padding:14px;text-align:center;border-right:1px solid var(--grey2)">
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">RA Stock</div>
            <div style="font-size:22px;font-weight:700;color:${sv.ra<3?'var(--red)':'var(--ink)'}">${sv.ra||0}</div>
          </div>
          <div style="padding:14px;text-align:center">
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Flora Stock</div>
            <div style="font-size:22px;font-weight:700;color:${sv.flora<3?'var(--red)':'var(--ink)'}">${sv.flora||0}</div>
          </div>
        </div>
        `}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <button class="btn btn-s btn-sm btn-full" onclick="closeInvGridView();openEditProduct('${pid}')">✏️ Edit</button>
        <button class="btn btn-s btn-sm btn-full" onclick="closeInvGridView();showQR('${pid}')">⬛ QR</button>
        <button class="btn btn-sm btn-full" style="background:var(--red-soft);color:var(--red)" onclick="closeInvGridView();deleteProduct('${pid}')">🗑️ Delete</button>
      </div>
    </div>`;
  let sheet = document.getElementById('inv-grid-sheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.id = 'inv-grid-sheet';
    sheet.style.cssText='position:fixed;inset:0;z-index:800;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(44,26,31,0.45)';
    sheet.onclick = e=>{ if(e.target===sheet) closeInvGridView(); };
    document.body.appendChild(sheet);
  }
  sheet.innerHTML = html;
  sheet.style.display='flex';
}

function closeInvGridView(){
  const s = document.getElementById('inv-grid-sheet');
  if(s) s.style.display='none';
}

// ── Edit Product ──

function openEditProduct(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  _editingProductId = pid;
  _epPhotoData = p.photo||'';

  document.getElementById('ep-emoji').value = p.emoji||'📦';
  document.getElementById('ep-name').value = p.name||'';
  if(p.category) injectCustomCatChip(p.category);
  setCatChipValue('ep-cat', p.category||'lips');
  document.getElementById('ep-store').value = p.store==='both'?'ra':(p.store||'ra');
  document.getElementById('ep-reorder').value = p.reorderAt||10;
  document.getElementById('ep-barcode').value = p.barcode||'';
  document.getElementById('ep-cost-source').value = p.costSource||'';
  document.getElementById('ep-cost').value = p.cost||'';
  document.getElementById('ep-price-ra-piece').value = p.priceRAPiece||p.priceRA||'';
  document.getElementById('ep-price-ra-dozen').value = p.priceRADozen||'';
  document.getElementById('ep-price-flora').value = p.priceFlora||'';
  if(document.getElementById('ep-description')) document.getElementById('ep-description').value = p.description||'';
  if(document.getElementById('ep-stand-name')) document.getElementById('ep-stand-name').value = p.standUnit?.name||'';
  if(document.getElementById('ep-stand-qty'))  document.getElementById('ep-stand-qty').value  = p.standUnit?.qty||'';
  if(document.getElementById('ep-stand-price'))document.getElementById('ep-stand-price').value= p.standUnit?.price||'';

  const sel = document.getElementById('ep-shipment');
  sel.innerHTML = '<option value="">— No shipment —</option>';
  shipments.forEach(s=>{ sel.innerHTML += `<option value="${s.id}"${p.shipmentId===s.id?' selected':''}>${s.name}</option>`; });

  const colSel = document.getElementById('ep-collection');
  if(colSel){
    colSel.innerHTML = '<option value="">— None —</option>';
    collections.forEach(c=>{ colSel.innerHTML += `<option value="${c.id}"${p.collectionId===c.id?' selected':''}>${c.emoji||'📁'} ${c.name}</option>`; });
  }

  if(_epPhotoData){
    document.getElementById('ep-photo-img').src = _epPhotoData;
    document.getElementById('ep-photo-wrap').style.display='block';
  } else {
    document.getElementById('ep-photo-wrap').style.display='none';
  }

  const vc = document.getElementById('ep-variants');
  vc.innerHTML = '';
  const epStore = p.store==='both'?'ra':(p.store||'ra');
  const epQtyLbl = epStore==='flora' ? '🌸 Qty' : epStore==='ra' ? '🏪 Qty' : '📦 Qty';
  p.variants.forEach(v=>{
    const uid = 'vp-ep-'+v.id;
    const hasVPhoto = v.photo && v.photo.startsWith('data:');
    const d = document.createElement('div');
    d.className = 'variant-input-row ep-var-row';
    d.dataset.vid = v.id;
    d.style = 'background:var(--grey);border-radius:14px;padding:10px;margin-bottom:10px';
    d.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 0.7fr;gap:6px;margin-bottom:8px">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Type</div>
          <div style="font-size:9px;color:var(--muted);margin-bottom:3px">e.g. Shade</div>
          <input class="fi var-label-inp" value="${v.label||''}" placeholder="e.g. Shade" style="font-size:13px;padding:10px;width:100%">
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Value</div>
          <div style="font-size:9px;color:var(--muted);margin-bottom:3px">e.g. Pink</div>
          <input class="fi var-name-inp" value="${v.name}" placeholder="e.g. Pink" style="font-size:13px;padding:10px;width:100%">
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Size</div>
          <div style="font-size:9px;color:var(--muted);margin-bottom:3px">e.g. 30ml</div>
          <input class="fi var-size-inp" value="${v.size||''}" placeholder="e.g. 30ml" style="font-size:13px;padding:10px;width:100%">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--amber);text-transform:uppercase;margin-bottom:3px">💲 Piece price override</div>
          <input class="fi var-price-piece-inp" type="number" step="0.01" placeholder="Leave blank = default" value="${v.pricePiece||''}" style="font-size:12px;padding:8px;width:100%">
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--amber);text-transform:uppercase;margin-bottom:3px">💲 Dozen price override</div>
          <input class="fi var-price-dozen-inp" type="number" step="0.01" placeholder="Leave blank = default" value="${v.priceDozen||''}" style="font-size:12px;padding:8px;width:100%">
        </div>
      </div>
      <div style="margin-bottom:8px">
        <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:3px">📦 Variant Barcode (optional)</div>
        <input class="fi var-barcode-inp" value="${v.barcode||''}" placeholder="Scan or type barcode" style="font-size:12px;padding:8px;width:100%">
      </div>
      <div style="display:grid;grid-template-columns:1fr 44px 44px;gap:8px;align-items:center">
        <div>
          <div class="ep-qty-lbl" style="font-size:10px;font-weight:700;color:var(--rose);text-transform:uppercase;margin-bottom:4px">${epQtyLbl}</div>
          ${epStore==='both'
            ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
                <input class="fi ep-qty-ra" type="number" value="${v.ra||0}" placeholder="RA" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--amber)">
                <input class="fi ep-qty-fl" type="number" value="${v.flora||0}" placeholder="🌸" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--rose-light)">
               </div>`
            : `<input class="fi ep-qty-single" type="number" value="${epStore==='flora' ? (v.flora||0) : (v.ra||0)}" style="font-size:16px;font-weight:700;text-align:center;padding:10px;width:100%;border-color:var(--rose-light)">`
          }
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;text-align:center">🎨</div>
          <input type="hidden" class="variant-color-input" value="${(v.colorHex && v.colorHex!=='#ede6e8') ? v.colorHex : '#ede6e8'}">
          <button type="button" class="vcolor-btn" onclick="openVColorPicker(this)" style="width:44px;height:44px;border-radius:50%;background:${(v.colorHex && v.colorHex!=='#ede6e8') ? v.colorHex : '#ede6e8'};border:2px solid var(--grey2);cursor:pointer;display:block;transition:transform 0.1s;box-shadow:0 2px 8px rgba(0,0,0,0.12)" title="Pick color"></button>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;text-align:center">📷</div>
          <div style="position:relative;width:44px;height:44px">
            <input type="file" accept="image/*" id="${uid}" style="display:none" onchange="varPhotoSet(this,'${uid}-img','${uid}-wrap')">
            <div id="${uid}-wrap" style="${hasVPhoto?'display:block':'display:none'};position:relative">
              <img id="${uid}-img" src="${hasVPhoto?v.photo:''}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;cursor:pointer" onclick="document.getElementById('${uid}').click()">
              <button onclick="varPhotoClear('${uid}')" style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:var(--red);color:white;border:none;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
            </div>
            <button id="${uid}-btn" onclick="document.getElementById('${uid}').click()" style="width:44px;height:44px;border-radius:10px;background:var(--white);border:1.5px dashed var(--muted);cursor:pointer;font-size:16px;display:${hasVPhoto?'none':'flex'};align-items:center;justify-content:center">📷</button>
          </div>
        </div>
      </div>`;
    vc.appendChild(d);
    attachVariantLongPress(d);
  });

  const isRealVariants = p.variants.length > 1 || (p.variants.length === 1 && p.variants[0].name && p.variants[0].name !== 'Standard' && p.variants[0].name !== '');
  const epToggleEl  = document.getElementById('ep-variants-toggle');
  const epToggleLbl = document.getElementById('ep-variants-toggle-lbl');
  const epSimpleBlk = document.getElementById('ep-simple-qty-block');
  const epVarBlk    = document.getElementById('ep-variants-block');
  if(isRealVariants){
    epToggleEl.classList.add('active');
    epToggleLbl.textContent = 'Has variants';
    epToggleLbl.style.color = 'var(--rose)';
    epSimpleBlk.style.display = 'none';
    epVarBlk.style.display = 'block';
  } else {
    epToggleEl.classList.remove('active');
    epToggleLbl.textContent = 'No variants';
    epToggleLbl.style.color = 'var(--muted)';
    epSimpleBlk.style.display = 'block';
    epVarBlk.style.display = 'none';
    const sv = p.variants[0]||{ra:0,flora:0};
    updateEpSimpleQtyLayout();
    setTimeout(()=>{
      const epStore = document.getElementById('ep-store').value;
      if(epStore==='both'){
        const raInp = document.getElementById('ep-simple-qty-ra');
        const flInp = document.getElementById('ep-simple-qty-fl');
        if(raInp) raInp.value = sv.ra||0;
        if(flInp) flInp.value = sv.flora||0;
      } else {
        const qInp = document.getElementById('ep-simple-qty');
        if(qInp) qInp.value = (epStore==='flora' ? sv.flora : sv.ra)||0;
      }
    }, 0);
  }

  epUpdatePriceFields();
  _epBadge = p.badge||'';
  epSetBadge(_epBadge||'none');

  const smContainer = document.getElementById('ep-sm-toggles');
  smContainer.innerHTML = '';
  const store = p.store||'ra';
  const isRA = store==='ra'||store==='both';
  const isFlora = store==='flora'||store==='both';
  if(isRA) smContainer.innerHTML += `<div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:13px;font-weight:500;color:var(--ink-light)">📷 Instagram (RA)</div><div id="ep-toggle-ig-ra" onclick="epToggleSM(this)" class="set-toggle${p.postedIG?' active':''}"><div class="set-toggle-knob"></div></div></div>`;
  if(isFlora) smContainer.innerHTML += `<div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:13px;font-weight:500;color:var(--ink-light)">📷 Instagram (Flora)</div><div id="ep-toggle-ig-flora" onclick="epToggleSM(this)" class="set-toggle${p.postedIGFlora?' active':''}"><div class="set-toggle-knob"></div></div></div>`;
  if(isFlora) smContainer.innerHTML += `<div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:13px;font-weight:500;color:var(--ink-light)">🌐 Website (Flora)</div><div id="ep-toggle-web-flora" onclick="epToggleSM(this)" class="set-toggle${p.onWebsite?' active':''}"><div class="set-toggle-knob"></div></div></div>`;
  document.getElementById('ep-sm-block').style.display = (isRA||isFlora) ? 'block' : 'none';
  showModal('m-edit-product');
}

function epUpdatePriceFields(){
  updateEpSimpleQtyLayout();
  const store = document.getElementById('ep-store').value;
  document.getElementById('ep-ra-price-block').style.display = (store==='flora') ? 'none' : 'block';
  document.getElementById('ep-flora-price-block').style.display = (store==='ra') ? 'none' : 'block';
  const qtyLbl = store==='flora' ? '🌸 Qty' : store==='ra' ? '🏪 Qty' : '📦 Qty';
  document.querySelectorAll('#ep-variants .ep-var-row').forEach(row=>{
    const qtyDiv = row.querySelector('.ep-qty-lbl')?.parentElement;
    if(!qtyDiv) return;
    const existing = qtyDiv.querySelector('.ep-qty-single, .ep-qty-ra');
    if(!existing) return;
    if(store==='both' && existing.classList.contains('ep-qty-single')){
      const val = existing.value||'0';
      qtyDiv.innerHTML = `<div class="ep-qty-lbl" style="font-size:10px;font-weight:700;color:var(--rose);text-transform:uppercase;margin-bottom:4px">${qtyLbl}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
          <input class="fi ep-qty-ra" type="number" value="${val}" placeholder="RA" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--amber)">
          <input class="fi ep-qty-fl" type="number" value="0" placeholder="🌸" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--rose-light)">
        </div>`;
    } else if(store!=='both' && existing.classList.contains('ep-qty-ra')){
      const raVal = qtyDiv.querySelector('.ep-qty-ra')?.value||'0';
      const flVal = qtyDiv.querySelector('.ep-qty-fl')?.value||'0';
      const val = store==='flora' ? flVal : raVal;
      qtyDiv.innerHTML = `<div class="ep-qty-lbl" style="font-size:10px;font-weight:700;color:var(--rose);text-transform:uppercase;margin-bottom:4px">${qtyLbl}</div>
        <input class="fi ep-qty-single" type="number" value="${val}" style="font-size:16px;font-weight:700;text-align:center;padding:10px;width:100%;border-color:var(--rose-light)">`;
    } else {
      const lbl = qtyDiv.querySelector('.ep-qty-lbl');
      if(lbl) lbl.textContent = qtyLbl;
    }
  });
}

function epPhotoChoice(){
  let sheet = document.getElementById('ep-photo-choice-sheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.id = 'ep-photo-choice-sheet';
    sheet.style.cssText='position:fixed;inset:0;z-index:1200;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(44,26,31,0.45)';
    sheet.onclick = e=>{ if(e.target===sheet) sheet.style.display='none'; };
    sheet.innerHTML = `
      <div style="background:var(--white);border-radius:20px 20px 0 0;padding:16px 18px 36px">
        <div style="width:36px;height:4px;background:var(--grey2);border-radius:2px;margin:0 auto 14px"></div>
        <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:12px">Add Product Photo</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button onclick="document.getElementById('ep-photo-choice-sheet').style.display='none';document.getElementById('ep-photo-input').click()" style="background:var(--rose-pale);border:none;border-radius:14px;padding:18px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
            <span style="font-size:28px">🖼️</span>
            <span style="font-size:13px;font-weight:700;color:var(--ink)">Gallery</span>
            <span style="font-size:11px;color:var(--muted)">Pick from phone</span>
          </button>
          <button onclick="document.getElementById('ep-photo-choice-sheet').style.display='none';document.getElementById('ep-photo-camera').click()" style="background:var(--rose-pale);border:none;border-radius:14px;padding:18px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
            <span style="font-size:28px">📷</span>
            <span style="font-size:13px;font-weight:700;color:var(--ink)">Camera</span>
            <span style="font-size:11px;color:var(--muted)">Take a photo</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(sheet);
  }
  sheet.style.display='flex';
}

function epSetPhoto(input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _epPhotoData = e.target.result;
    document.getElementById('ep-photo-img').src = _epPhotoData;
    document.getElementById('ep-photo-wrap').style.display='block';
  };
  reader.readAsDataURL(file);
}

function epClearPhoto(){
  _epPhotoData = '';
  document.getElementById('ep-photo-wrap').style.display='none';
}

function addEpVariantRow(){
  const vc = document.getElementById('ep-variants');
  const uid = 'vp-ep-'+Date.now()+Math.random().toString(36).slice(2,6);
  const store = document.getElementById('ep-store').value;
  const qtyLbl = store==='flora' ? '🌸 Qty' : store==='ra' ? '🏪 Qty' : '📦 Qty';
  const d = document.createElement('div');
  d.className = 'variant-input-row ep-var-row';
  d.dataset.vid = '';
  d.style = 'background:var(--grey);border-radius:14px;padding:10px;margin-bottom:10px';
  d.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 0.7fr;gap:6px;margin-bottom:8px">
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Label</div>
        <input class="fi var-label-inp" placeholder="e.g. Shade" style="font-size:13px;padding:10px;width:100%">
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Name</div>
        <input class="fi var-name-inp" placeholder="e.g. Pink" style="font-size:13px;padding:10px;width:100%">
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Size</div><div style="font-size:9px;color:var(--muted);margin-bottom:4px">optional</div>
        <input class="fi var-size-inp" placeholder="e.g. 30ml" style="font-size:13px;padding:10px;width:100%">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
      <div>
        <div style="font-size:9px;font-weight:700;color:var(--amber);text-transform:uppercase;margin-bottom:3px">💲 Piece price override</div>
        <input class="fi var-price-piece-inp" type="number" step="0.01" placeholder="Leave blank = default" style="font-size:12px;padding:8px;width:100%">
      </div>
      <div>
        <div style="font-size:9px;font-weight:700;color:var(--amber);text-transform:uppercase;margin-bottom:3px">💲 Dozen price override</div>
        <input class="fi var-price-dozen-inp" type="number" step="0.01" placeholder="Leave blank = default" style="font-size:12px;padding:8px;width:100%">
      </div>
    </div>
    <div style="margin-bottom:8px">
      <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:3px">📦 Variant Barcode (optional)</div>
      <input class="fi var-barcode-inp" placeholder="Scan or type barcode" style="font-size:12px;padding:8px;width:100%">
    </div>
    <div style="display:grid;grid-template-columns:1fr 44px 44px;gap:8px;align-items:center">
      <div>
        <div class="ep-qty-lbl" style="font-size:10px;font-weight:700;color:var(--rose);text-transform:uppercase;margin-bottom:4px">${qtyLbl}</div>
        ${store==='both'
          ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
               <input class="fi ep-qty-ra" type="number" placeholder="🏪" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--amber)">
               <input class="fi ep-qty-fl" type="number" placeholder="🌸" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--rose-light)">
             </div>`
          : `<input class="fi ep-qty-single" type="number" placeholder="0" style="font-size:16px;font-weight:700;text-align:center;padding:10px;width:100%;border-color:var(--rose-light)">`
        }
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;text-align:center">🎨</div>
        <input type="hidden" class="variant-color-input" value="#ede6e8">
        <button type="button" class="vcolor-btn" onclick="openVColorPicker(this)" style="width:44px;height:44px;border-radius:50%;background:#ede6e8;border:2px solid var(--grey2);cursor:pointer;display:block;transition:transform 0.1s;box-shadow:0 2px 8px rgba(0,0,0,0.12)" title="Pick color"></button>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;text-align:center">📷</div>
        <div style="position:relative;width:44px;height:44px">
          <input type="file" accept="image/*" id="${uid}" style="display:none" onchange="varPhotoSet(this,'${uid}-img','${uid}-wrap')">
          <div id="${uid}-wrap" style="display:none;position:relative">
            <img id="${uid}-img" style="width:44px;height:44px;border-radius:10px;object-fit:cover;cursor:pointer" onclick="document.getElementById('${uid}').click()">
            <button onclick="varPhotoClear('${uid}')" style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:var(--red);color:white;border:none;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
          </div>
          <button id="${uid}-btn" onclick="document.getElementById('${uid}').click()" style="width:44px;height:44px;border-radius:10px;background:var(--white);border:1.5px dashed var(--muted);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">📷</button>
        </div>
      </div>
    </div>`;
  vc.appendChild(d);
}

function epToggleSM(el){ el.classList.toggle('active'); }

function saveEditProduct(){
  if(!_editingProductId) return;
  const p = products.find(x=>x.id===_editingProductId);
  if(!p){ showToast('Product not found','err'); return; }
  const name = document.getElementById('ep-name').value.trim();
  if(!name){ showToast('Enter a product name','err'); return; }

  p.name = name;
  p.emoji = document.getElementById('ep-emoji').value||'📦';
  p.category = document.getElementById('ep-cat').value || 'other';
  p.store = document.getElementById('ep-store').value;
  p.reorderAt = parseInt(document.getElementById('ep-reorder').value,10)||10;
  p.barcode = document.getElementById('ep-barcode').value.trim()||'';
  p.costSource = parseFloat(document.getElementById('ep-cost-source').value)||0;
  p.cost = parseFloat(document.getElementById('ep-cost').value)||0;
  p.shipmentId = document.getElementById('ep-shipment').value||'';
  p.collectionId = document.getElementById('ep-collection')?.value||p.collectionId||'';
  p.priceRAPiece = parseFloat(document.getElementById('ep-price-ra-piece').value)||0;
  const dozenVal = document.getElementById('ep-price-ra-dozen').value;
  p.priceRADozen = dozenVal ? parseFloat(dozenVal)||0 : parseFloat((p.priceRAPiece*12*0.85).toFixed(2));
  p.priceFlora = parseFloat(document.getElementById('ep-price-flora').value)||0;
  p.priceRA = p.priceRAPiece;
  p.price = p.priceRAPiece||p.priceFlora;
  p.description = (document.getElementById('ep-description')?.value||'').trim();
  const epStandName  = (document.getElementById('ep-stand-name')?.value||'').trim();
  const epStandQty   = parseInt(document.getElementById('ep-stand-qty')?.value,10)||0;
  const epStandPrice = parseFloat(document.getElementById('ep-stand-price')?.value)||0;
  p.standUnit = epStandName && epStandQty ? { name: epStandName, qty: epStandQty, price: epStandPrice } : null;
  p.photo = _epPhotoData||'';
  p.badge = _epBadge||'';
  const igRA = document.getElementById('ep-toggle-ig-ra');
  const igFlora = document.getElementById('ep-toggle-ig-flora');
  const webFlora = document.getElementById('ep-toggle-web-flora');
  if(igRA) p.postedIG = igRA.classList.contains('active');
  if(igFlora) p.postedIGFlora = igFlora.classList.contains('active');
  if(webFlora) p.onWebsite = webFlora.classList.contains('active');

  const epHasVariants = document.getElementById('ep-variants-toggle').classList.contains('active');
  const updatedVariants = [];
  const epSaveStore = document.getElementById('ep-store').value;
  const epIsFlora = epSaveStore === 'flora';
  if(!epHasVariants){
    let raQty = 0, floraQty = 0;
    if(epSaveStore === 'both'){
      raQty    = parseInt(document.getElementById('ep-simple-qty-ra')?.value,10)||0;
      floraQty = parseInt(document.getElementById('ep-simple-qty-fl')?.value,10)||0;
    } else {
      const qty = parseInt(document.getElementById('ep-simple-qty')?.value,10)||0;
      raQty    = epIsFlora ? 0 : qty;
      floraQty = epIsFlora ? qty : 0;
    }
    const existingId = p.variants?.[0]?.id || ('v-ep-'+Date.now());
    updatedVariants.push({id:existingId, name:'Standard', label:'', size:'', colorHex:'', ra:raQty, flora:floraQty, photo:''});
  } else {
    const rows = document.querySelectorAll('.ep-var-row');
    rows.forEach((row, i)=>{
      const vid = row.dataset.vid || ('v-ep-'+Date.now()+i);
      const rawC = row.querySelector('.variant-color-input')?.value || '#ede6e8';
      const hasC = rawC && rawC !== '#ede6e8' && rawC !== '#f4a0b0';
      const vpImg = row.querySelector('img');
      const vpPhoto = (vpImg && vpImg.src && vpImg.src.startsWith('data:')) ? vpImg.src : '';
      let raQty, floraQty;
      if(epSaveStore === 'both'){
        raQty    = parseInt(row.querySelector('.ep-qty-ra')?.value,10)||0;
        floraQty = parseInt(row.querySelector('.ep-qty-fl')?.value,10)||0;
      } else {
        const singleQty = parseInt(row.querySelector('.ep-qty-single')?.value,10)||0;
        raQty    = epIsFlora ? 0 : singleQty;
        floraQty = epIsFlora ? singleQty : 0;
      }
      updatedVariants.push({
        id: vid,
        label: (row.querySelector('.var-label-inp')?.value||'').trim(),
        name:  (row.querySelector('.var-name-inp')?.value||'').trim()||'Standard',
        size:  (row.querySelector('.var-size-inp')?.value||'').trim(),
        colorHex: hasC ? rawC : '',
        ra: raQty, flora: floraQty, photo: vpPhoto,
        pricePiece: parseFloat(row.querySelector('.var-price-piece-inp')?.value)||0,
        priceDozen: parseFloat(row.querySelector('.var-price-dozen-inp')?.value)||0,
        barcode: (row.querySelector('.var-barcode-inp')?.value||'').trim()
      });
    });
    if(updatedVariants.length===0) updatedVariants.push({id:'v-ep-'+Date.now(), name:'Standard', size:'', colorHex:'', ra:0, flora:0});
  }
  p.variants = updatedVariants;

  if(p.shipmentId){
    const linkedShip = shipments.find(s=>s.id===p.shipmentId);
    if(linkedShip && linkedShip.status!=='arrived'){
      p.variants.forEach(v=>{ v.orderedQty=v.ra||v.flora||v.orderedQty||0; v.ra=0; v.flora=0; });
    }
  }

  closeModal('m-edit-product');
  saveProducts();
  renderInventory(); if(typeof renderCatalog==='function') renderCatalog(); initDashboard();
  showToast(p.emoji+' '+p.name+' updated! ✅');
}

function deleteProduct(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  appConfirm('Delete Product', `Delete "${p.name}"? This cannot be undone.`, '🗑️ Delete', ()=>{
    products.splice(products.indexOf(p), 1);
    saveProducts();
    renderInventory(); if(typeof renderCatalog==='function') renderCatalog(); initDashboard();
    showToast('Product deleted 🗑️');
  });
}

function openUpdateQty(pid, vid){
  _updatingProductId = pid; _updatingVariantId = vid;
  const p = products.find(x=>x.id===pid);
  const v = p?.variants.find(x=>x.id===vid) || p?.variants[0];
  if(!p||!v) return;
  _updatingVariantId = v.id;
  document.getElementById('upd-title').textContent = p.emoji+' '+p.name+' — '+v.name;
  const showRA    = p.store !== 'flora';
  const showFlora = p.store !== 'ra';
  document.getElementById('upd-body').innerHTML = `
    <div class="frow" style="margin-top:10px">
      ${showRA    ? `<div class="fg"><label class="fl">🏪 RA Stock</label><input class="fi" type="number" id="upd-ra" value="${v.ra||0}"></div>` : '<input type="hidden" id="upd-ra" value="'+v.ra+'">'}
      ${showFlora ? `<div class="fg"><label class="fl">🌸 Flora Stock</label><input class="fi" type="number" id="upd-fl" value="${v.flora||0}"></div>` : '<input type="hidden" id="upd-fl" value="'+v.flora+'">'}
    </div>`;
  showModal('m-update-qty');
}

function saveQtyUpdate(){
  if(!_updatingProductId) return;
  const p = products.find(x=>x.id===_updatingProductId);
  const v = p?.variants.find(x=>x.id===_updatingVariantId);
  if(!p||!v) return;
  v.ra = parseInt(document.getElementById('upd-ra').value,10)||0;
  v.flora = parseInt(document.getElementById('upd-fl').value,10)||0;
  closeModal('m-update-qty');
  saveProducts();
  renderInventory();
  initDashboard();
  showToast('Stock updated! ✅');
}

// ── Add Product ──

function npSetBadge(val){
  _npBadge = val === 'none' ? '' : val;
  ['none','bestseller','new'].forEach(b=>{
    const btn = document.getElementById('np-badge-'+b);
    if(!btn) return;
    const active = (b === val) || (b === 'none' && !val);
    btn.style.border = active ? '2px solid var(--rose)' : '2px solid var(--grey2)';
    btn.style.background = active ? 'var(--rose-soft)' : 'var(--white)';
    btn.style.color = active ? 'var(--rose)' : 'var(--muted)';
  });
}

function epSetBadge(val){
  _epBadge = val === 'none' ? '' : val;
  ['none','bestseller','new'].forEach(b=>{
    const btn = document.getElementById('ep-badge-'+b);
    if(!btn) return;
    const active = (b === val) || (b === 'none' && !val);
    btn.style.border = active ? '2px solid var(--rose)' : '2px solid var(--grey2)';
    btn.style.background = active ? 'var(--rose-soft)' : 'var(--white)';
    btn.style.color = active ? 'var(--rose)' : 'var(--muted)';
  });
}

function npPhotoChoice(){
  let sheet = document.getElementById('np-photo-choice-sheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.id = 'np-photo-choice-sheet';
    sheet.style.cssText='position:fixed;inset:0;z-index:1200;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(44,26,31,0.45)';
    sheet.onclick = e=>{ if(e.target===sheet) sheet.style.display='none'; };
    sheet.innerHTML = `
      <div style="background:var(--white);border-radius:20px 20px 0 0;padding:16px 18px 36px">
        <div style="width:36px;height:4px;background:var(--grey2);border-radius:2px;margin:0 auto 16px"></div>
        <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:12px">Add Product Photo</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button onclick="document.getElementById('np-photo-choice-sheet').style.display='none';document.getElementById('np-photo-input').click()" style="background:var(--rose-pale);border:none;border-radius:14px;padding:18px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
            <span style="font-size:28px">🖼️</span>
            <span style="font-size:13px;font-weight:700;color:var(--ink)">Gallery</span>
            <span style="font-size:11px;color:var(--muted)">Pick from phone</span>
          </button>
          <button onclick="document.getElementById('np-photo-choice-sheet').style.display='none';document.getElementById('np-photo-camera').click()" style="background:var(--rose-pale);border:none;border-radius:14px;padding:18px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
            <span style="font-size:28px">📷</span>
            <span style="font-size:13px;font-weight:700;color:var(--ink)">Camera</span>
            <span style="font-size:11px;color:var(--muted)">Take a photo</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(sheet);
  }
  sheet.style.display='flex';
}

function npSetPhoto(input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _npPhotoData = e.target.result;
    document.getElementById('np-photo-img').src = e.target.result;
    document.getElementById('np-photo-wrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function npClearPhoto(){
  _npPhotoData = '';
  document.getElementById('np-photo-wrap').style.display = 'none';
  const inp = document.getElementById('np-photo-input');
  if(inp) inp.value = '';
  const cam = document.getElementById('np-photo-camera');
  if(cam) cam.value = '';
}

function npCalcDozen(){
  const hint = document.getElementById('np-dozen-hint');
  const dozenInp = document.getElementById('np-price-ra-dozen');
  const dozenVal = parseFloat(dozenInp.value);
  if(dozenVal > 0){
    const total = (dozenVal * 12).toFixed(2);
    hint.textContent = '💡 $'+dozenVal.toFixed(2)+' × 12 = $'+total+' per dozen';
  } else {
    hint.textContent = '';
  }
}

function npToggleVariants(){
  const toggle = document.getElementById('np-variants-toggle');
  const lbl    = document.getElementById('np-variants-toggle-lbl');
  const simple = document.getElementById('np-simple-qty-block');
  const block  = document.getElementById('np-variants-block');
  const isOn   = toggle.classList.toggle('active');
  lbl.textContent = isOn ? 'Has variants' : 'No variants';
  lbl.style.color  = isOn ? 'var(--rose)' : 'var(--muted)';
  simple.style.display = isOn ? 'none' : 'block';
  block.style.display  = isOn ? 'block' : 'none';
  if(isOn) initVariantLongPresses();
  updateNpSimpleQtyLayout();
}

function epToggleVariants(){
  const toggle = document.getElementById('ep-variants-toggle');
  const lbl    = document.getElementById('ep-variants-toggle-lbl');
  const simple = document.getElementById('ep-simple-qty-block');
  const block  = document.getElementById('ep-variants-block');
  const isOn   = toggle.classList.toggle('active');
  lbl.textContent = isOn ? 'Has variants' : 'No variants';
  lbl.style.color  = isOn ? 'var(--rose)' : 'var(--muted)';
  simple.style.display = isOn ? 'none' : 'block';
  block.style.display  = isOn ? 'block' : 'none';
  updateEpSimpleQtyLayout();
}

function updateNpSimpleQtyLayout(){
  const store   = document.getElementById('np-store').value;
  const lbl     = document.getElementById('np-simple-qty-lbl');
  const wrapper = document.getElementById('np-simple-qty-inputs');
  if(!wrapper) return;
  const qtyLbl  = store==='flora' ? '🌸 Qty' : store==='ra' ? '🏪 Qty' : '📦 Qty';
  if(lbl) lbl.textContent = qtyLbl;
  if(store==='both'){
    wrapper.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--amber);margin-bottom:4px">🏪 RA Qty</div>
        <input class="fi" id="np-simple-qty-ra" type="number" min="0" placeholder="0" style="font-size:18px;font-weight:700;text-align:center;padding:10px;width:100%;border-color:var(--amber)">
      </div>
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--rose);margin-bottom:4px">🌸 Flora Qty</div>
        <input class="fi" id="np-simple-qty-fl" type="number" min="0" placeholder="0" style="font-size:18px;font-weight:700;text-align:center;padding:10px;width:100%;border-color:var(--rose-light)">
      </div>
    </div>`;
  } else {
    wrapper.innerHTML = `<input class="fi" id="np-simple-qty" type="number" min="0" placeholder="0" style="font-size:20px;font-weight:700;text-align:center;padding:12px;width:100%;border-color:var(--rose-light)">`;
  }
}

function updateEpSimpleQtyLayout(){
  const store   = document.getElementById('ep-store').value;
  const lbl     = document.getElementById('ep-simple-qty-lbl');
  const wrapper = document.getElementById('ep-simple-qty-inputs');
  if(!wrapper) return;
  const qtyLbl  = store==='flora' ? '🌸 Qty' : store==='ra' ? '🏪 Qty' : '📦 Qty';
  if(lbl) lbl.textContent = qtyLbl;
  if(store==='both'){
    wrapper.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--amber);margin-bottom:4px">🏪 RA Qty</div>
        <input class="fi" id="ep-simple-qty-ra" type="number" min="0" placeholder="0" style="font-size:18px;font-weight:700;text-align:center;padding:10px;width:100%;border-color:var(--amber)">
      </div>
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--rose);margin-bottom:4px">🌸 Flora Qty</div>
        <input class="fi" id="ep-simple-qty-fl" type="number" min="0" placeholder="0" style="font-size:18px;font-weight:700;text-align:center;padding:10px;width:100%;border-color:var(--rose-light)">
      </div>
    </div>`;
  } else {
    wrapper.innerHTML = `<input class="fi" id="ep-simple-qty" type="number" min="0" placeholder="0" style="font-size:20px;font-weight:700;text-align:center;padding:12px;width:100%;border-color:var(--rose-light)">`;
  }
}

function updatePriceFields(){
  updateNpSimpleQtyLayout();
  const store = document.getElementById('np-store').value;
  const raBlock = document.getElementById('np-ra-price-block');
  const floraBlock = document.getElementById('np-flora-price-block');
  if(raBlock) raBlock.style.display = (store==='flora') ? 'none' : 'block';
  if(floraBlock) floraBlock.style.display = (store==='ra') ? 'none' : 'block';
  const qtyLbl = store==='flora' ? '🌸 Qty' : store==='ra' ? '🏪 Qty' : '📦 Qty';
  document.querySelectorAll('.np-qty-lbl').forEach(el => el.textContent = qtyLbl);
  document.querySelectorAll('#np-variants .variant-input-row').forEach(row=>{
    const qtyDiv = row.querySelector('.np-qty-lbl')?.parentElement;
    if(!qtyDiv) return;
    const existing = qtyDiv.querySelector('.np-qty-single, .np-qty-ra');
    if(!existing) return;
    if(store==='both' && existing.classList.contains('np-qty-single')){
      const val = existing.value||'0';
      qtyDiv.innerHTML = `<div class="np-qty-lbl" style="font-size:10px;font-weight:700;color:var(--rose);text-transform:uppercase;margin-bottom:4px">${qtyLbl}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
          <input class="fi np-qty-ra" type="number" min="0" placeholder="🏪" value="${val}" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--amber)">
          <input class="fi np-qty-fl" type="number" min="0" placeholder="🌸" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--rose-light)">
        </div>`;
    } else if(store!=='both' && existing.classList.contains('np-qty-ra')){
      qtyDiv.innerHTML = `<div class="np-qty-lbl" style="font-size:10px;font-weight:700;color:var(--rose);text-transform:uppercase;margin-bottom:4px">${qtyLbl}</div>
        <input class="fi np-qty-single" type="number" min="0" placeholder="0" style="font-size:16px;font-weight:700;text-align:center;padding:10px;width:100%;border-color:var(--rose-light)">`;
    } else {
      qtyDiv.querySelector('.np-qty-lbl').textContent = qtyLbl;
    }
  });
}

function addVariantRow(){
  const uid = 'vp-'+Date.now()+Math.random().toString(36).slice(2,6);
  const store = document.getElementById('np-store').value;
  const qtyLbl = store==='flora' ? '🌸 Qty' : store==='ra' ? '🏪 Qty' : '📦 Qty';
  const d = document.createElement('div');
  d.className='variant-input-row';
  d.style.cssText='background:var(--grey);border-radius:14px;padding:10px;margin-bottom:10px;transition:background 0.2s';
  d.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 0.7fr;gap:6px;margin-bottom:8px">
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Type</div>
        <div style="font-size:9px;color:var(--muted);margin-bottom:3px">e.g. Shade</div>
        <input class="fi var-label-inp" placeholder="e.g. Shade" style="font-size:13px;padding:10px;width:100%">
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Value</div>
        <div style="font-size:9px;color:var(--muted);margin-bottom:3px">e.g. Pink</div>
        <input class="fi var-name-inp" placeholder="e.g. Pink" style="font-size:13px;padding:10px;width:100%">
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Size</div>
        <div style="font-size:9px;color:var(--muted);margin-bottom:3px">e.g. 30ml</div>
        <input class="fi var-size-inp" placeholder="e.g. 30ml" style="font-size:13px;padding:10px;width:100%">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
      <div>
        <div style="font-size:9px;font-weight:700;color:var(--amber);text-transform:uppercase;margin-bottom:3px">💲 Piece price override</div>
        <input class="fi var-price-piece-inp" type="number" step="0.01" placeholder="Leave blank = default" style="font-size:12px;padding:8px;width:100%">
      </div>
      <div>
        <div style="font-size:9px;font-weight:700;color:var(--amber);text-transform:uppercase;margin-bottom:3px">💲 Dozen price override</div>
        <input class="fi var-price-dozen-inp" type="number" step="0.01" placeholder="Leave blank = default" style="font-size:12px;padding:8px;width:100%">
      </div>
    </div>
    <div style="margin-bottom:8px">
      <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:3px">📦 Variant Barcode (optional)</div>
      <input class="fi var-barcode-inp" placeholder="Scan or type barcode" style="font-size:12px;padding:8px;width:100%">
    </div>
    <div style="display:grid;grid-template-columns:1fr 44px 44px;gap:8px;align-items:center">
      <div>
        <div class="np-qty-lbl" style="font-size:10px;font-weight:700;color:var(--rose);text-transform:uppercase;margin-bottom:4px">${qtyLbl}</div>
        ${store==='both'
          ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
               <input class="fi np-qty-ra" type="number" min="0" placeholder="🏪" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--amber)">
               <input class="fi np-qty-fl" type="number" min="0" placeholder="🌸" style="font-size:13px;font-weight:700;text-align:center;padding:8px;border-color:var(--rose-light)">
             </div>`
          : `<input class="fi np-qty-single" type="number" min="0" placeholder="0" style="font-size:16px;font-weight:700;text-align:center;padding:10px;width:100%;border-color:var(--rose-light)">`
        }
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;text-align:center">🎨</div>
        <input type="hidden" class="variant-color-input" value="#ede6e8">
        <button type="button" class="vcolor-btn" onclick="openVColorPicker(this)" style="width:44px;height:44px;border-radius:50%;background:#ede6e8;border:2px solid var(--grey2);cursor:pointer;display:block;transition:transform 0.1s;box-shadow:0 2px 8px rgba(0,0,0,0.12)" title="Pick color"></button>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;text-align:center">📷</div>
        <div style="position:relative;width:44px;height:44px">
          <input type="file" accept="image/*" id="${uid}" style="display:none" onchange="varPhotoSet(this,'${uid}-img','${uid}-wrap')">
          <input type="file" accept="image/*" capture="environment" id="${uid}-cam" style="display:none" onchange="varPhotoSet(this,'${uid}-img','${uid}-wrap')">
          <div id="${uid}-wrap" style="display:none;position:relative">
            <img id="${uid}-img" style="width:44px;height:44px;border-radius:10px;object-fit:cover;cursor:pointer" onclick="varPhotoChoice('${uid}')">
            <button onclick="varPhotoClear('${uid}')" style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:var(--red);color:white;border:none;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
          </div>
          <button id="${uid}-btn" onclick="varPhotoChoice('${uid}')" style="width:44px;height:44px;border-radius:10px;background:var(--white);border:1.5px dashed var(--muted);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">📷</button>
        </div>
      </div>
    </div>`;
  attachVariantLongPress(d);
  document.getElementById('np-variants').appendChild(d);
}

function varPhotoChoice(uid){
  let sheet = document.getElementById('var-photo-choice-sheet-'+uid);
  if(!sheet){
    sheet = document.createElement('div');
    sheet.id = 'var-photo-choice-sheet-'+uid;
    sheet.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(44,26,31,0.5);display:flex;align-items:flex-end;justify-content:center';
    sheet.onclick = e => { if(e.target===sheet) sheet.style.display='none'; };
    sheet.innerHTML = `<div style="background:var(--white);border-radius:24px 24px 0 0;padding:20px 20px 36px;width:100%;max-width:480px">
      <div style="width:36px;height:4px;background:var(--grey2);border-radius:2px;margin:0 auto 14px"></div>
      <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:var(--ink);margin-bottom:14px">Add Variant Photo</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <button onclick="document.getElementById('var-photo-choice-sheet-${uid}').style.display='none';document.getElementById('${uid}').click()" style="background:var(--rose-pale);border:none;border-radius:14px;padding:18px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
          <span style="font-size:28px">🖼️</span>
          <span style="font-size:13px;font-weight:700;color:var(--ink)">Gallery</span>
          <span style="font-size:11px;color:var(--muted)">Pick from phone</span>
        </button>
        <button onclick="document.getElementById('var-photo-choice-sheet-${uid}').style.display='none';document.getElementById('${uid}-cam').click()" style="background:var(--rose-pale);border:none;border-radius:14px;padding:18px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
          <span style="font-size:28px">📷</span>
          <span style="font-size:13px;font-weight:700;color:var(--ink)">Camera</span>
          <span style="font-size:11px;color:var(--muted)">Take a photo</span>
        </button>
      </div>
    </div>`;
    document.body.appendChild(sheet);
  }
  sheet.style.display='flex';
}

function varPhotoSet(input, imgId, wrapId){
  const file = input.files[0]; if(!file) return;
  const uid = input.id.replace(/-cam$/, '');
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById(imgId).src = e.target.result;
    document.getElementById(wrapId).style.display = 'block';
    const btn = document.getElementById(uid+'-btn');
    if(btn) btn.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function varPhotoClear(uid){
  document.getElementById(uid).value = '';
  document.getElementById(uid+'-wrap').style.display = 'none';
  document.getElementById(uid+'-btn').style.display = 'flex';
}

function confirmDeleteVariant(row){
  const container = row.closest('#np-variants, #ep-variants');
  const selector = container?.id === 'ep-variants' ? '#ep-variants .variant-input-row' : '#np-variants .variant-input-row';
  const all = document.querySelectorAll(selector);
  if(all.length <= 1){ showToast('Need at least one variant','err'); return; }
  appConfirm('Delete Variant', 'Are you sure you want to remove this variant?', 'Delete', () => {
    row.style.background = 'var(--red-soft)';
    setTimeout(() => row.remove(), 200);
    showToast('Variant removed ✕');
  });
}

function attachVariantLongPress(row){
  let timer = null;
  let pressing = false;
  const HOLD_MS = 700;
  const interactiveTags = new Set(['INPUT','SELECT','BUTTON','TEXTAREA','LABEL']);
  function isInteractive(el){ let n=el; while(n&&n!==row){ if(interactiveTags.has(n.tagName)) return true; n=n.parentElement; } return false; }
  const resetBg = () => { row.style.transition='background 0.25s'; row.style.background='var(--grey)'; row.style.outline=''; };
  const start = (e) => {
    if(isInteractive(e.target)) return;
    pressing = true;
    row.style.transition = 'background 0.5s, outline 0.1s';
    row.style.background = '#fdeaec';
    row.style.outline = '2px solid var(--red)';
    timer = setTimeout(() => {
      if(!pressing) return;
      pressing = false;
      resetBg();
      confirmDeleteVariant(row);
    }, HOLD_MS);
  };
  const cancel = () => { if(!pressing) return; pressing=false; clearTimeout(timer); resetBg(); };
  row.addEventListener('touchstart', start, {passive:true});
  row.addEventListener('touchend', cancel);
  row.addEventListener('touchmove', cancel);
  row.addEventListener('mousedown', start);
  row.addEventListener('mouseup', cancel);
  row.addEventListener('mouseleave', cancel);
}

function initVariantLongPresses(){
  document.querySelectorAll('#np-variants .variant-input-row').forEach(r => attachVariantLongPress(r));
}

function openAddProduct(){
  _npPhotoData = '';
  _npBadge = '';
  const wrap = document.getElementById('np-photo-wrap');
  if(wrap) wrap.style.display = 'none';
  const inp = document.getElementById('np-photo-input');
  if(inp) inp.value='';
  ['np-name','np-barcode','np-cost-source','np-cost','np-price-ra-piece','np-price-ra-dozen','np-price-flora'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('np-emoji').value = '📦';
  document.getElementById('np-store').value = 'ra';
  ['none','bestseller','new'].forEach(b=>{
    const btn=document.getElementById('np-badge-'+b);
    if(btn){ btn.style.border='2px solid var(--grey2)'; btn.style.background='var(--white)'; btn.style.color='var(--muted)'; }
  });
  const noneBtn = document.getElementById('np-badge-none');
  if(noneBtn){ noneBtn.style.border='2px solid var(--rose)'; noneBtn.style.background='var(--rose-soft)'; noneBtn.style.color='var(--rose)'; }
  const vc = document.getElementById('np-variants');
  if(vc){
    const rows = vc.querySelectorAll('.variant-input-row');
    rows.forEach((row, i) => { if(i > 0) row.remove(); });
    const first = vc.querySelector('.variant-input-row');
    if(first){
      first.querySelectorAll('input[type="text"],input:not([type]),input[type="number"]').forEach(el=>{
        el.value = el.type==='number' ? '0' : '';
      });
      const colorInp = first.querySelector('.variant-color-input');
      if(colorInp){ colorInp.value = '#ede6e8'; const btn=first.querySelector('.vcolor-btn'); if(btn) btn.style.background='#ede6e8'; }
      varPhotoClear('vp-default');
    }
  }
  const npToggleEl  = document.getElementById('np-variants-toggle');
  const npToggleLbl = document.getElementById('np-variants-toggle-lbl');
  const npSimpleBlk = document.getElementById('np-simple-qty-block');
  const npVarBlk    = document.getElementById('np-variants-block');
  if(npToggleEl) npToggleEl.classList.remove('active');
  if(npToggleLbl){ npToggleLbl.textContent='No variants'; npToggleLbl.style.color='var(--muted)'; }
  if(npSimpleBlk) npSimpleBlk.style.display='block';
  if(npVarBlk) npVarBlk.style.display='none';
  updatePriceFields();
  const hint = document.getElementById('np-dozen-hint');
  if(hint) hint.textContent='';
  const sel = document.getElementById('np-shipment');
  if(sel){ sel.innerHTML = '<option value="">— No shipment —</option>' + shipments.map(s=>`<option value="${s.id}">${s.name}${s.num?' ('+s.num+')':''}</option>`).join('');
  if(invFilter && invFilter.startsWith('ship-')){ sel.value = invFilter.replace('ship-',''); } }
  const colSel = document.getElementById('np-collection');
  if(colSel) colSel.innerHTML = '<option value="">— None —</option>' +
    collections.map(c=>`<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
  showModal('m-add-product');
  setCatChipValue('np-cat','lips');
  const reorderInp = document.getElementById('np-reorder');
  if(reorderInp) reorderInp.value = '10';
  setTimeout(initVariantLongPresses, 50);
}

// ── Session helpers ──

function populateSessShipSelect(){
  const sel = document.getElementById('sess-ship-select');
  if(!sel) return;
  sel.innerHTML = '<option value="">— or type a custom name below —</option>' +
    shipments.map(s=>`<option value="${s.id}">${s.name}${s.num?' · '+s.num:''}</option>`).join('');
}

function onSessShipSelect(sid){
  const nameInp = document.getElementById('sess-shipment-name');
  if(!nameInp) return;
  if(sid){ const s = shipments.find(x=>x.id===sid); if(s) nameInp.value = s.name; }
  else { nameInp.value = ''; }
}

function onSessNameInput(){
  const sel = document.getElementById('sess-ship-select');
  if(sel) sel.value = '';
}

function saveNewProduct(){
  const name = document.getElementById('np-name').value.trim();
  if(!name){ showToast('Enter a product name','err'); return; }
  const npStore = document.getElementById('np-store').value;
  const isFlora = npStore === 'flora';
  const hasVariants = document.getElementById('np-variants-toggle').classList.contains('active');
  const variants = [];
  if(!hasVariants){
    let raQty = 0, floraQty = 0;
    if(npStore === 'both'){
      raQty    = parseInt(document.getElementById('np-simple-qty-ra')?.value,10)||0;
      floraQty = parseInt(document.getElementById('np-simple-qty-fl')?.value,10)||0;
    } else {
      const qty = parseInt(document.getElementById('np-simple-qty')?.value,10)||0;
      raQty    = isFlora ? 0 : qty;
      floraQty = isFlora ? qty : 0;
    }
    variants.push({id:'v-new-'+Date.now(), name:'Standard', label:'', size:'', colorHex:'', ra:raQty, flora:floraQty, photo:''});
  } else {
    const variantRows = document.querySelectorAll('#np-variants .variant-input-row');
    variantRows.forEach((row,i)=>{
      const vlabel = (row.querySelector('.var-label-inp')?.value||'').trim();
      const vname  = (row.querySelector('.var-name-inp')?.value||'').trim()||'Standard';
      const vsize  = (row.querySelector('.var-size-inp')?.value||'').trim();
      const rawColor = row.querySelector('.variant-color-input')?.value || '#ede6e8';
      const hasColor = rawColor && rawColor !== '#ede6e8' && rawColor !== '#f4a0b0';
      const vpImg = row.querySelector('img');
      const vpPhoto = (vpImg && vpImg.src && vpImg.src.startsWith('data:')) ? vpImg.src : '';
      let raQty, floraQty;
      if(npStore === 'both'){
        raQty    = parseInt(row.querySelector('.np-qty-ra')?.value,10)||0;
        floraQty = parseInt(row.querySelector('.np-qty-fl')?.value,10)||0;
      } else {
        const qty = parseInt(row.querySelector('.np-qty-single')?.value,10)||0;
        raQty    = isFlora ? 0 : qty;
        floraQty = isFlora ? qty : 0;
      }
      variants.push({id:'v-new-'+Date.now()+'-'+i, label:vlabel, name:vname, size:vsize, colorHex: hasColor ? rawColor : '', ra: raQty, flora: floraQty, photo: vpPhoto,
        pricePiece: parseFloat(row.querySelector('.var-price-piece-inp')?.value)||0,
        priceDozen: parseFloat(row.querySelector('.var-price-dozen-inp')?.value)||0,
        barcode: (row.querySelector('.var-barcode-inp')?.value||'').trim()
      });
    });
    if(variants.length===0) variants.push({id:'v-new-'+Date.now(), name:'Standard', size:'', colorHex:'', ra:0, flora:0});
  }
  const store = document.getElementById('np-store').value;
  const priceRAPiece  = parseFloat(document.getElementById('np-price-ra-piece')?.value)||0;
  const dozenInp = document.getElementById('np-price-ra-dozen');
  const priceRADozen  = dozenInp?.value ? parseFloat(dozenInp.value)||0 : (priceRAPiece ? parseFloat((priceRAPiece*12*0.85).toFixed(2)) : 0);
  const priceFlora    = parseFloat(document.getElementById('np-price-flora')?.value)||0;
  const standName  = (document.getElementById('np-stand-name')?.value||'').trim();
  const standQty   = parseInt(document.getElementById('np-stand-qty')?.value,10)||0;
  const standPrice = parseFloat(document.getElementById('np-stand-price')?.value)||0;
  const p = {
    id:'p-'+Date.now(),
    name, emoji:document.getElementById('np-emoji').value||'📦',
    category: document.getElementById('np-cat').value || 'other',
    store,
    shipmentId:document.getElementById('np-shipment').value||'',
    collectionId:document.getElementById('np-collection').value||'',
    costSource:parseFloat(document.getElementById('np-cost-source').value)||0,
    cost:parseFloat(document.getElementById('np-cost').value)||0,
    priceRAPiece, priceRADozen, priceFlora,
    priceRA: priceRAPiece,
    price: priceRAPiece||priceFlora,
    description: (document.getElementById('np-description')?.value||'').trim(),
    standUnit: standName && standQty ? { name: standName, qty: standQty, price: standPrice } : null,
    reorderAt: parseInt(document.getElementById('np-reorder')?.value,10)||10,
    badge: _npBadge || '',
    photo: _npPhotoData||'',
    barcode: document.getElementById('np-barcode').value.trim()||'',
    variants
  };
  _npPhotoData = '';
  if(p.shipmentId){
    const linkedShip = shipments.find(s=>s.id===p.shipmentId);
    if(linkedShip && linkedShip.status!=='arrived'){
      p.variants.forEach(v=>{ v.orderedQty=v.ra||v.flora||0; v.ra=0; v.flora=0; });
    }
  }
  products.push(p);
  closeModal('m-add-product');
  saveProducts();
  renderInventory(); if(typeof renderCatalog==='function') renderCatalog(); initDashboard();
  showToast(p.emoji+' '+p.name+' added!');
}
