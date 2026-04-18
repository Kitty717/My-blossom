// ═══════════════════════════════════════════════════
// SHIPMENTS  (js/shipments.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, inventory.js, dashboard.js
// ═══════════════════════════════════════════════════

function renderShipments(){
  const list = shipFilter==='all' ? shipments : shipments.filter(s=>s.status===shipFilter);
  const el = document.getElementById('ship-list');
  if(!el) return;
  if(!list.length){ el.innerHTML='<div style="color:var(--muted);text-align:center;padding:30px 0;font-size:14px">No shipments yet</div>'; return; }
  const STATUS_LABEL = {ordered:'⏳ Ordered', onway:'🚢 On way', arrived:'✅ Arrived'};
  const STATUS_CLS   = {ordered:'ba', onway:'bb', arrived:'bg'};
  const FOR_LABEL    = {ra:'🏪 RA', flora:'🌸 Flora', both:'🏪🌸 Both'};
  el.innerHTML = list.map(s=>{
    const prodCount = products.filter(p=>p.shipmentId===s.id).length;
    const eta = s.eta ? new Date(s.eta+'T12:00:00').toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const forLabel = FOR_LABEL[s.forStore||'ra'];
    return `<div class="ship-card ${s.status}">
      <div class="ship-card-icon" onclick="openShipmentDetail('${s.id}')">${s.status==='arrived'?'✅':s.status==='onway'?'🚢':'⏳'}</div>
      <div class="ship-card-info" onclick="openShipmentDetail('${s.id}')">
        <div class="ship-card-name">${s.name}${s.num?' · '+s.num:''}</div>
        <div class="ship-card-meta">${s.supplier?s.supplier+' · ':''}📅 ${eta}${prodCount?' · 📦 '+prodCount+' products':''} · ${forLabel}</div>
      </div>
      <div class="ship-card-right">
        <span class="b ${STATUS_CLS[s.status]}">${STATUS_LABEL[s.status]}</span>
        ${s.pendingRefunds?.length?`<span style="font-size:10px;font-weight:700;color:var(--amber);background:var(--amber-soft);padding:2px 6px;border-radius:6px">🔄 ${s.pendingRefunds.length} refund pending</span>`:''}
        ${s.cost?`<span style="font-size:13px;font-weight:700;color:var(--ink)">$${s.cost.toLocaleString()}</span>`:''}
        <div style="display:flex;gap:5px;margin-top:4px">
          <button class="icon-btn icon-btn-s" onclick="openEditShipment('${s.id}')" title="Edit">✏️</button>
          <button class="icon-btn icon-btn-g" onclick="deleteShipment('${s.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openShipmentDetail(sid){
  const s = shipments.find(x=>x.id===sid);
  if(!s) return;
  const STATUS_LABEL = {ordered:'⏳ Ordered', onway:'🚢 On way', arrived:'✅ Arrived'};
  const STATUS_CLS   = {ordered:'ba', onway:'bb', arrived:'bg'};
  const eta = s.eta ? new Date(s.eta+'T12:00:00').toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'}) : '—';
  const prodCount = products.filter(p=>p.shipmentId===sid).length;
  document.getElementById('sd-title').textContent = '🚢 '+s.name;
  document.getElementById('sd-body').innerHTML = `
    <div style="margin-bottom:12px"><span class="b ${STATUS_CLS[s.status]}">${STATUS_LABEL[s.status]}</span></div>
    <div class="card" style="margin-bottom:12px">
      ${s.supplier?`<div class="lr"><div class="lif"><div class="ln">🏭 ${s.supplier}</div></div></div>`:''}
      ${s.num?`<div class="lr"><div class="lif"><div class="ln">📋 ${s.num}</div></div></div>`:''}
      <div class="lr"><div class="lif"><div class="ln">📅 ETA: ${eta}</div></div></div>
      ${s.cost?`<div class="lr"><div class="lif"><div class="ln">💵 $${s.cost.toLocaleString()}</div></div></div>`:''}
      <div class="lr"><div class="lif"><div class="ln">📦 ${prodCount} product${prodCount!==1?'s':''} linked</div></div></div>
    </div>
    ${s.shortLoss>0?`<div style="background:var(--red-soft);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:13px;color:var(--red);font-weight:600">💸 Loss from shortage: $${s.shortLoss.toFixed(2)}</div>`:''}
    ${(s.pendingRefunds||[]).length?`<div style="background:var(--amber-soft);border-radius:12px;padding:10px 12px;margin-bottom:10px">
      <div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:6px">🔄 Pending Refunds from Supplier</div>
      ${s.pendingRefunds.map(r=>{const od=r.deadline&&r.deadline<new Date().toISOString().split('T')[0];return `<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.06)"><div><div style="font-weight:600">${r.name} × ${r.qty} — <span style="color:var(--green)">$${r.cost.toFixed(2)}</span></div>${r.deadline?`<div style="font-size:10px;color:${od?'var(--red)':'var(--muted)'}">Due: ${r.deadline}${od?' ⚠️ OVERDUE':''}</div>`:''}</div><button onclick="convertRefundToLoss('${s.id}','${r.id}')" style="background:var(--red-soft);color:var(--red);border:1px solid var(--red);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;margin-left:8px">💸 Loss</button></div>`;}).join('')}
      <button onclick="markRefundReceived('${s.id}')" style="width:100%;margin-top:8px;padding:8px;background:var(--green);color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✅ Mark Refund Received</button>
    </div>`:''}
    `;
  document.getElementById('sd-foot').innerHTML = `
    <button class="btn btn-p" onclick="closeModal('m-ship-detail');goToShipmentProducts('${sid}')">📦 View Products</button>
    ${s.status!=='arrived'?`<button class="btn btn-green" onclick="markShipArrived('${sid}')">✅ Mark Arrived</button>`:''}
    <button class="btn btn-g" onclick="closeModal('m-ship-detail')">Close</button>`;
  showModal('m-ship-detail');
}

function markShipArrived(sid){
  const s = shipments.find(x=>x.id===sid);
  if(!s) return;
  // Mark shipment arrived
  s.status = 'arrived';
  s.checklistDone = false;
  // Set pendingConfirm on all linked product variants so they appear in inventory
  const linked = products.filter(p=>p.shipmentId===sid);
  linked.forEach(p=>{
    p.variants.forEach(v=>{
      v.pendingConfirm = true;
      v.orderedQty = v.orderedQty || v.ra || v.flora || 0;
      // Keep stock at 0 until confirmed
      v.ra = 0; v.flora = 0;
    });
  });
  saveShipments(); saveProducts();
  closeModal('m-ship-detail');
  renderShipments();
  if(typeof renderInventory==='function') renderInventory();
  if(typeof initDashboard==='function') initDashboard();
  showToast('✅ Arrived! Go to Stock Count to confirm quantities 📦');
  // Navigate to Stock Count page
  setTimeout(()=>{
    if(typeof showPage==='function') showPage('stockcount');
    if(typeof setNav==='function') setNav('more');
    if(typeof renderCount==='function') renderCount();
    else if(typeof renderStockCount==='function') renderStockCount();
  }, 800);
}

function markRefundReceived(sid){
  const s = shipments.find(x=>x.id===sid);
  if(!s) return;
  const total = (s.pendingRefunds||[]).reduce((sum,r)=>sum+r.cost,0);
  s.pendingRefunds = [];
  saveShipments();
  closeModal('m-ship-detail');
  renderShipments();
  showToast(`✅ Refund of $${total.toFixed(2)} marked as received!`);
}

function applyShipmentStock(s){
  const linked = products.filter(p => p.shipmentId === s.id);
  if(!linked.length) return;
  const forStore = s.forStore || 'ra';
  linked.forEach(p => {
    p.variants.forEach(v => {
      const incoming = v.incomingQty || 0;
      if(incoming <= 0) return;
      if(forStore === 'ra') v.ra = (v.ra||0) + incoming;
      if(forStore === 'flora') v.flora = (v.flora||0) + incoming;
    });
  });
  renderInventory();
  initDashboard();
}

function openEditShipment(sid){
  const s = shipments.find(x=>x.id===sid);
  if(!s) return;
  document.getElementById('es-id').value = sid;
  document.getElementById('es-name').value = s.name||'';
  document.getElementById('es-num').value = s.num||'';
  document.getElementById('es-supplier').value = s.supplier||'';
  document.getElementById('es-eta').value = s.eta||'';
  document.getElementById('es-cost').value = s.cost||'';
  document.getElementById('es-status').value = s.status||'ordered';
  document.getElementById('es-for').value = s.forStore||'ra';
  closeModal('m-ship-detail');
  showModal('m-edit-ship');
}

function saveEditShipment(){
  const sid = document.getElementById('es-id').value;
  const s = shipments.find(x=>x.id===sid);
  if(!s) return;
  const name = document.getElementById('es-name').value.trim();
  if(!name){ showToast('Enter a shipment name','err'); return; }
  const wasArrived = s.status === 'arrived';
  s.name     = name;
  s.num      = document.getElementById('es-num').value.trim();
  s.supplier = document.getElementById('es-supplier').value.trim();
  s.forStore = document.getElementById('es-for').value || 'ra';
  s.eta      = document.getElementById('es-eta').value;
  s.cost     = parseFloat(document.getElementById('es-cost').value)||0;
  s.status   = document.getElementById('es-status').value;
  // If just marked arrived via edit, no stock change needed (products already have correct qty)
  saveShipments();
  closeModal('m-edit-ship');
  renderShipments();
  rebuildInvTabs();
  initDashboard();
  showToast('🚢 Shipment updated!');
}

function deleteShipment(sid){
  const s = shipments.find(x=>x.id===sid);
  if(!s) return;
  appConfirm('Delete Shipment', `Delete "${s.name}"? This cannot be undone.`, '🗑️ Delete', ()=>{
    shipments = shipments.filter(x=>x.id!==sid);
    products.forEach(p=>{
      if(p.shipmentId===sid){
        p.shipmentId='';
        // Restore orderedQty back to stock so product isn't invisible
        if(isProductInTransit({...p, shipmentId:sid})){
          const forStore = s.forStore || 'ra';
          p.variants.forEach(v=>{
            const qty = v.orderedQty||0;
            if(forStore==='flora') v.flora=(v.flora||0)+qty;
            else v.ra=(v.ra||0)+qty;
          });
        }
      }
    });
    saveShipments(); saveProducts();
    renderShipments(); renderInventory();
    rebuildInvTabs();
    initDashboard();
    showToast('Shipment deleted');
  });
}

function goToShipmentProducts(sid){
  const s = shipments.find(x=>x.id===sid);
  if(!s) return;
  invFilter = 'ship-'+sid;
  showPage('products');
  renderInventory();
  rebuildInvTabs();
  // activate the right tab
  setTimeout(()=>{
    const tabs = document.querySelectorAll('#inv-tabs .tab');
    tabs.forEach(t=>{ if(t.dataset.sid===sid) t.classList.add('active'); else t.classList.remove('active'); });
  }, 50);
}

function saveNewShipment(){
  const name = document.getElementById('ns-name').value.trim();
  if(!name){ showToast('Enter a shipment name','err'); return; }
  const s = {
    id: 's-'+Date.now(),
    name,
    num: document.getElementById('ns-num').value.trim(),
    supplier: document.getElementById('ns-supplier').value.trim(),
    forStore: document.getElementById('ns-for').value || 'ra',
    eta: document.getElementById('ns-eta').value,
    cost: parseFloat(document.getElementById('ns-cost').value)||0,
    status: document.getElementById('ns-status').value,
    orderDate: new Date().toISOString().slice(0,10),
  };
  shipments.push(s);
  saveShipments();
  closeModal('m-new-ship');
  renderShipments();
  rebuildInvTabs();
  initDashboard();
  showToast('🚢 '+name+' added!');
  ['ns-name','ns-num','ns-supplier','ns-eta','ns-cost'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
}

// ── shareShipmentWA ──
function shareShipmentWA(text){
  window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
}

// ── Pending Arrivals ──
function renderPendingArrivals(){
  const el = document.getElementById('inv-pending-arrivals');
  if(!el) return;
  const pending = products.filter(p=>p.variants.some(v=>v.pendingConfirm));
  if(!pending.length){ el.innerHTML=''; return; }
  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5);border:1.5px solid var(--amber);border-radius:16px;padding:14px 16px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--amber);margin-bottom:10px">⏳ Confirm Arrival Quantities (${pending.length})</div>
      ${pending.map(p=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(245,158,11,0.2);cursor:pointer" onclick="openConfirmArrival('${p.id}')">
          <div style="font-size:22px">${p.emoji}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:var(--ink)">${p.name}</div>
            <div style="font-size:11px;color:var(--muted)">${p.variants.filter(v=>v.pendingConfirm).map(v=>`${v.name!=='Standard'?v.name:'Standard'}: ${v.orderedQty} ordered`).join(' · ')}</div>
          </div>
          <span style="font-size:13px;font-weight:700;color:var(--amber)">Confirm ›</span>
        </div>`).join('')}
    </div>`;
}

// ── Arrival Checklist (ship-level) ──
let _checklistShipId = null;
let _checklistItems = []; // [{pid, vid, name, emoji, ordered, received, shortage, resolution}]

function openShipChecklist(sid){
  const s = shipments.find(x=>x.id===sid);
  if(!s) return;
  _checklistShipId = sid;
  const linked = products.filter(p=>p.shipmentId===sid);
  if(!linked.length){
    appConfirm('No Products', 'No products linked to this shipment. Mark as arrived anyway?', '✅ Mark Arrived', ()=>{
      s.status='arrived'; saveShipments(); closeModal('m-ship-detail'); renderShipments(); initDashboard(); showToast('✅ Shipment arrived!');
    });
    return;
  }
  _checklistItems = [];
  linked.forEach(p=>{
    p.variants.forEach(v=>{
      const ordered = v.orderedQty||v.ra||v.flora||0;
      _checklistItems.push({pid:p.id, vid:v.id, name:p.name, emoji:p.emoji||'📦',
        varName:v.name!=='Standard'?v.name:'', ordered, received:ordered, shortage:0, resolution:null, confirmed:null});
    });
  });
  renderChecklistBody();
  closeModal('m-ship-detail');
  showModal('m-ship-checklist');
}

function renderChecklistBody(){
  const el = document.getElementById('ship-checklist-body');
  if(!el) return;
  el.innerHTML = _checklistItems.map((it,i)=>{
    const confirmed = it.confirmed; // true=yes, false=no, null=pending
    return `
    <div style="background:var(--grey);border-radius:14px;padding:12px;margin-bottom:10px">
      <!-- Product header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-size:24px">${it.emoji}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;color:var(--ink)">${it.name}${it.varName?' · <span style="color:var(--muted);font-weight:400">'+it.varName+'</span>':''}</div>
          <div style="font-size:12px;color:var(--muted)">You ordered <strong>${it.ordered}</strong> units — all arrived?</div>
        </div>
      </div>
      ${confirmed===null||confirmed===undefined ? `
        <!-- Step 1: Yes / No -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button onclick="checklistAnswer(${i},true)" style="padding:10px;border-radius:10px;border:2px solid var(--green);background:var(--green-soft);font-size:13px;font-weight:700;color:var(--green);cursor:pointer">✅ Yes, all arrived</button>
          <button onclick="checklistAnswer(${i},false)" style="padding:10px;border-radius:10px;border:2px solid var(--red);background:var(--red-soft);font-size:13px;font-weight:700;color:var(--red);cursor:pointer">✗ No, some missing</button>
        </div>
      ` : confirmed===true ? `
        <!-- Confirmed full -->
        <div style="display:flex;align-items:center;gap:8px;background:var(--green-soft);border-radius:10px;padding:8px 12px">
          <span style="font-size:18px">✅</span>
          <span style="font-size:13px;font-weight:700;color:var(--green)">${it.ordered} units confirmed</span>
          <button onclick="checklistAnswer(${i},null)" style="margin-left:auto;background:transparent;border:none;font-size:11px;color:var(--muted);cursor:pointer;text-decoration:underline">change</button>
        </div>
      ` : `
        <!-- Step 2: How many arrived + Loss/Refund -->
        <div style="background:white;border-radius:10px;padding:10px;border:1.5px solid var(--red-light,#fca5a5)">
          <div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:6px">How many actually arrived?</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <input class="fi" type="number" value="${it.received}" min="0" max="${it.ordered}" style="font-size:16px;font-weight:700;text-align:center;width:80px"
              oninput="updateChecklistItem(${i},this.value)">
            <span style="font-size:12px;color:var(--muted)">of ${it.ordered} ordered</span>
            <button onclick="checklistAnswer(${i},null)" style="margin-left:auto;background:transparent;border:none;font-size:11px;color:var(--muted);cursor:pointer;text-decoration:underline">back</button>
          </div>
          ${it.shortage>0 ? `
            <div style="font-size:11px;color:var(--red);font-weight:700;margin-bottom:6px">⚠️ ${it.shortage} unit${it.shortage>1?'s':''} missing — what to do?</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <button onclick="setChecklistResolution(${i},'loss')" style="padding:8px;border-radius:8px;border:2px solid ${it.resolution==='loss'?'var(--red)':'var(--grey2)'};background:${it.resolution==='loss'?'var(--red-soft)':'var(--white)'};font-size:12px;font-weight:700;cursor:pointer;color:${it.resolution==='loss'?'var(--red)':'var(--muted)'}">💸 Write as Loss</button>
              <button onclick="setChecklistResolution(${i},'refund')" style="padding:8px;border-radius:8px;border:2px solid ${it.resolution==='refund'?'var(--green)':'var(--grey2)'};background:${it.resolution==='refund'?'var(--green-soft)':'var(--white)'};font-size:12px;font-weight:700;cursor:pointer;color:${it.resolution==='refund'?'var(--green)':'var(--muted)'}">🔄 Expect Refund</button>
            </div>
            ${it.resolution ? `<div style="font-size:10px;color:var(--muted);margin-top:4px;text-align:center">${it.resolution==='refund'?'⏰ Supplier has 30 days to refund':'💸 Will be logged as loss'}</div>` : ''}
          ` : it.received>0 ? `<div style="font-size:12px;color:var(--green);font-weight:600">✅ ${it.received} units confirmed</div>` : ''}
        </div>
      `}
    </div>`;
  }).join('');
}

function checklistAnswer(i, answer){
  _checklistItems[i].confirmed = answer;
  if(answer===true){
    // Full quantity confirmed
    _checklistItems[i].received = _checklistItems[i].ordered;
    _checklistItems[i].shortage = 0;
    _checklistItems[i].resolution = null;
  } else if(answer===false){
    // Reset received to 0 so user fills in actual qty
    _checklistItems[i].received = 0;
    _checklistItems[i].shortage = _checklistItems[i].ordered;
    _checklistItems[i].resolution = null;
  } else {
    // Back to pending
    _checklistItems[i].received = _checklistItems[i].ordered;
    _checklistItems[i].shortage = 0;
    _checklistItems[i].resolution = null;
  }
  renderChecklistBody();
}

function updateChecklistItem(i, val){
  const received = Math.min(Math.max(0, parseInt(val,10)||0), _checklistItems[i].ordered);
  _checklistItems[i].received = received;
  _checklistItems[i].shortage = Math.max(0, _checklistItems[i].ordered - received);
  if(_checklistItems[i].shortage===0) _checklistItems[i].resolution=null;
  renderChecklistBody();
}

function setChecklistResolution(i, res){
  _checklistItems[i].resolution = res;
  renderChecklistBody();
}

function openConfirmArrival(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  const pending = p.variants.filter(v=>v.pendingConfirm);
  if(!pending.length) return;
  // Build modal content
  const ship = shipments.find(s=>s.id===p.shipmentId);
  let html = `<div style="font-size:13px;color:var(--muted);margin-bottom:14px">Shipment: <strong>${ship?.name||'Unknown'}</strong> · Unit cost: <strong>$${(p.cost||0).toFixed(2)}</strong></div>`;
  pending.forEach((v,i)=>{
    const vid = p.id+'-'+v.id+'-confirm';
    html += `<div id="cfa-${vid}" style="background:var(--grey);border-radius:14px;padding:12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-size:22px">${p.emoji}</div>
        <div>
          <div style="font-size:14px;font-weight:700">${p.name}${v.name&&v.name!=='Standard'?' · <span style="color:var(--muted);font-weight:400">'+v.name+'</span>':''}</div>
          <div style="font-size:12px;color:var(--muted)">You ordered <strong>${v.orderedQty}</strong> units</div>
        </div>
      </div>
      <div id="cfa-step-${vid}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button onclick="cfaAnswer('${p.id}','${v.id}',true)" style="padding:10px;border-radius:10px;border:2px solid var(--green);background:var(--green-soft);font-size:13px;font-weight:700;color:var(--green);cursor:pointer">✅ Yes, all arrived</button>
          <button onclick="cfaAnswer('${p.id}','${v.id}',false)" style="padding:10px;border-radius:10px;border:2px solid var(--red);background:var(--red-soft);font-size:13px;font-weight:700;color:var(--red);cursor:pointer">✗ No, some missing</button>
        </div>
      </div>
    </div>`;
  });
  // Use a bottom sheet
  const existing = document.getElementById('m-confirm-arrival');
  if(existing) existing.remove();
  const sheet = document.createElement('div');
  sheet.id = 'm-confirm-arrival';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(44,26,31,0.45);display:flex;flex-direction:column;justify-content:flex-end';
  sheet.innerHTML = `<div style="background:var(--white);border-radius:24px 24px 0 0;padding:20px 18px 36px;max-height:85dvh;overflow-y:auto">
    <div style="width:40px;height:4px;background:var(--grey2);border-radius:4px;margin:0 auto 16px"></div>
    <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:4px">📦 Confirm Arrival</div>
    <div id="cfa-content">${html}</div>
    <button onclick="document.getElementById('m-confirm-arrival').remove()" style="width:100%;padding:12px;background:var(--grey);border:none;border-radius:12px;font-size:14px;font-weight:600;color:var(--muted);cursor:pointer;margin-top:8px">Close</button>
  </div>`;
  sheet.onclick = e=>{ if(e.target===sheet) sheet.remove(); };
  document.body.appendChild(sheet);
  // Store pid for later
  sheet._pid = pid;
}

function cfaAnswer(pid, vid, allArrived){
  const p = products.find(x=>x.id===pid);
  const v = p?.variants.find(x=>x.id===vid);
  if(!p||!v) return;
  const cfaId = pid+'-'+vid+'-confirm';
  const stepEl = document.getElementById('cfa-step-'+cfaId);
  if(!stepEl) return;
  if(allArrived){
    // Apply full ordered qty
    const store = p.store||'ra';
    if(store==='flora') v.flora=(v.orderedQty||0);
    else if(store==='both'){ v.ra=(v.orderedQty||0); v.flora=(v.orderedQty||0); }
    else v.ra=(v.orderedQty||0);
    v.pendingConfirm = false;
    stepEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:var(--green-soft);border-radius:10px;padding:8px 12px"><span style="font-size:18px">✅</span><span style="font-size:13px;font-weight:700;color:var(--green)">${v.orderedQty} units added to inventory</span></div>`;
    saveShipments(); saveProducts(); renderInventory(); checkAllConfirmed(pid);
  } else {
    // Show qty input
    stepEl.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:6px">How many actually arrived?</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <input id="cfa-qty-${vid}" class="fi" type="number" value="0" min="0" max="${v.orderedQty}" style="font-size:16px;font-weight:700;text-align:center;width:80px" oninput="cfaUpdateShortage('${pid}','${vid}')">
        <span style="font-size:12px;color:var(--muted)">of ${v.orderedQty} ordered</span>
      </div>
      <div id="cfa-shortage-${vid}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
        <button id="cfa-loss-${vid}" onclick="cfaResolve('${pid}','${vid}','loss')" style="padding:8px;border-radius:8px;border:2px solid var(--grey2);background:var(--white);font-size:12px;font-weight:700;cursor:pointer;color:var(--muted)">💸 Write as Loss</button>
        <button id="cfa-refund-${vid}" onclick="cfaResolve('${pid}','${vid}','refund')" style="padding:8px;border-radius:8px;border:2px solid var(--grey2);background:var(--white);font-size:12px;font-weight:700;cursor:pointer;color:var(--muted)">🔄 Expect Refund</button>
      </div>
      <button onclick="cfaConfirmShortage('${pid}','${vid}')" style="width:100%;margin-top:10px;padding:10px;background:var(--rose);color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">✅ Confirm</button>`;
  }
}

let _cfaResolution = {}; // {vid: 'loss'|'refund'}

function cfaUpdateShortage(pid, vid){
  const p = products.find(x=>x.id===pid);
  const v = p?.variants.find(x=>x.id===vid);
  if(!v) return;
  const received = parseInt(document.getElementById('cfa-qty-'+vid)?.value,10)||0;
  const shortage = Math.max(0, (v.orderedQty||0) - received);
  const el = document.getElementById('cfa-shortage-'+vid);
  if(el) el.innerHTML = shortage>0 ? `<div style="font-size:11px;color:var(--red);font-weight:700">⚠️ ${shortage} unit${shortage>1?'s':''} missing</div>` : `<div style="font-size:11px;color:var(--green);font-weight:700">✅ All accounted for</div>`;
}

function cfaResolve(pid, vid, res){
  _cfaResolution[vid] = res;
  const lossBtn = document.getElementById('cfa-loss-'+vid);
  const refBtn = document.getElementById('cfa-refund-'+vid);
  if(lossBtn){ lossBtn.style.borderColor=res==='loss'?'var(--red)':'var(--grey2)'; lossBtn.style.background=res==='loss'?'var(--red-soft)':'var(--white)'; lossBtn.style.color=res==='loss'?'var(--red)':'var(--muted)'; }
  if(refBtn){ refBtn.style.borderColor=res==='refund'?'var(--green)':'var(--grey2)'; refBtn.style.background=res==='refund'?'var(--green-soft)':'var(--white)'; refBtn.style.color=res==='refund'?'var(--green)':'var(--muted)'; }
}

function cfaConfirmShortage(pid, vid){
  const p = products.find(x=>x.id===pid);
  const v = p?.variants.find(x=>x.id===vid);
  if(!p||!v) return;
  const received = parseInt(document.getElementById('cfa-qty-'+vid)?.value,10)||0;
  const shortage = Math.max(0, (v.orderedQty||0) - received);
  if(shortage>0 && !_cfaResolution[vid]){ showToast('Choose Loss or Refund for the shortage','err'); return; }
  // Apply received qty — use shipment's target store
  const shipForStore = (shipments.find(s=>s.id===p.shipmentId))?.forStore || p.store || 'ra';
  if(shipForStore==='flora') v.flora=received;
  else v.ra=received;
  v.pendingConfirm = false;
  // Handle shortage
  if(shortage>0){
    const ship = shipments.find(s=>s.id===p.shipmentId);
    // Use product's arrival cost (p.cost) per unit — not shipment total cost
    const unitCost = p.cost || 0;
    const cost = parseFloat((unitCost * shortage).toFixed(2));
    const today = new Date().toISOString().split('T')[0];
    if(_cfaResolution[vid]==='loss'){
      losses.push({ id:'loss-'+Date.now()+Math.random().toString(36).slice(2,6), type:'shortage', amount:cost, date:today,
        note:`${p.emoji} ${p.name}${v.name&&v.name!=='Standard'?' ('+v.name+')':''} — ${shortage} missing`, shipmentId:p.shipmentId, shipmentName:ship?.name });
      showToast('💸 '+shortage+' units logged as loss');
    } else {
      const deadline = new Date(Date.now()+30*86400000).toISOString().split('T')[0];
      if(ship){ ship.pendingRefunds = ship.pendingRefunds||[]; ship.pendingRefunds.push({ id:'ref-'+Date.now()+Math.random().toString(36).slice(2,6), name:p.name+(v.name&&v.name!=='Standard'?' ('+v.name+')':''), qty:shortage, cost, deadline, received:false }); }
      showToast('🔄 Refund expected by '+deadline);
    }
  } else { showToast('✅ '+received+' units added to inventory'); }
  delete _cfaResolution[vid];
  saveShipments(); saveProducts(); renderInventory(); checkAllConfirmed(pid);
  // Update modal
  const cfaId = pid+'-'+vid+'-confirm';
  const stepEl = document.getElementById('cfa-step-'+cfaId);
  if(stepEl) stepEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:var(--green-soft);border-radius:10px;padding:8px 12px"><span style="font-size:18px">✅</span><span style="font-size:13px;font-weight:700;color:var(--green)">Done — ${received} units confirmed</span></div>`;
}

function checkAllConfirmed(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  const stillPending = p.variants.some(v=>v.pendingConfirm);
  renderPendingArrivals();
  if(!stillPending){
    setTimeout(()=>{ const sh=document.getElementById('m-confirm-arrival'); if(sh) sh.remove(); initDashboard(); },800);
  }
}

function confirmShipChecklist(){
  const unconfirmed = _checklistItems.filter(it=>it.confirmed===null||it.confirmed===undefined);
  if(unconfirmed.length){ showToast('Confirm all '+unconfirmed.length+' item'+(unconfirmed.length>1?'s':'')+' first', 'err'); return; }
  const unresolved = _checklistItems.filter(it=>it.shortage>0 && !it.resolution);
  if(unresolved.length){ showToast(`Choose Loss or Refund for ${unresolved.length} shortage${unresolved.length>1?'s':''}`, 'err'); return; }
  const s = shipments.find(x=>x.id===_checklistShipId);
  if(!s) return;
  let lossTotal = 0, refundItems = [];
  const today = new Date().toISOString().split('T')[0];
  const deadline = new Date(Date.now()+30*86400000).toISOString().split('T')[0];
  _checklistItems.forEach(it=>{
    const p = products.find(x=>x.id===it.pid);
    const v = p?.variants.find(x=>x.id===it.vid);
    if(!v) return;
    const forStore = s.forStore || p.store || 'ra';
    if(forStore==='flora') v.flora=(v.flora||0)+it.received;
    else v.ra=(v.ra||0)+it.received;
    if(it.shortage>0){
      // Use product's arrival cost per unit (p.cost), not shipment total
      const unitCost = p?.cost || 0;
      const cost = parseFloat((unitCost * it.shortage).toFixed(2));
      if(it.resolution==='loss'){
        lossTotal += cost;
        losses.push({ id:'loss-'+Date.now()+Math.random().toString(36).slice(2,6), type:'shortage', amount:cost, date:today,
          note:`${it.emoji} ${it.name}${it.varName?' ('+it.varName+')':''} — ${it.shortage} unit${it.shortage>1?'s':''} missing`, shipmentId:s.id, shipmentName:s.name });
      } else if(it.resolution==='refund'){
        refundItems.push({ id:'ref-'+Date.now()+Math.random().toString(36).slice(2,6), name:it.name+(it.varName?' ('+it.varName+')':''), qty:it.shortage, cost, deadline, received:false });
      }
    }
  });
  s.status='arrived'; s.checklistDone=true;
  if(lossTotal>0) s.shortLoss=(s.shortLoss||0)+lossTotal;
  if(refundItems.length){ s.pendingRefunds=refundItems; showToast(`✅ Arrived! 🔄 ${refundItems.length} refund(s) pending — due ${deadline}`); }
  else if(lossTotal>0){ showToast(`✅ Arrived! 💸 $${lossTotal.toFixed(2)} logged as loss`); }
  else { showToast('✅ Shipment verified & added to inventory!'); }
  saveShipments(); saveProducts(); saveLosses(); closeModal('m-ship-checklist'); renderShipments(); renderInventory(); initDashboard();
}

function convertRefundToLoss(sid, refId){
  const s = shipments.find(x=>x.id===sid);
  if(!s) return;
  const ref = (s.pendingRefunds||[]).find(r=>r.id===refId);
  if(!ref) return;
  appConfirm('Convert to Loss','Supplier won\'t refund? Log $'+ref.cost.toFixed(2)+' as a loss?','💸 Convert',()=>{
    losses.push({ id:'loss-'+Date.now()+Math.random().toString(36).slice(2,6), type:'refund_expired', amount:ref.cost,
      date:new Date().toISOString().split('T')[0], note:`Refund not received: ${ref.name} × ${ref.qty}`, shipmentId:s.id, shipmentName:s.name });
    s.pendingRefunds=(s.pendingRefunds||[]).filter(r=>r.id!==refId);
    saveShipments(); saveLosses(); renderShipments(); initDashboard(); showToast('💸 Logged as loss');
  });
}

function autoExpireRefunds(){
  const today = new Date().toISOString().split('T')[0];
  let expired=0;
  shipments.forEach(s=>{
    if(!(s.pendingRefunds||[]).length) return;
    s.pendingRefunds.filter(r=>!r.received&&r.deadline&&r.deadline<today).forEach(r=>{
      losses.push({ id:'loss-'+Date.now()+Math.random().toString(36).slice(2,6), type:'refund_expired', amount:r.cost,
        date:today, note:`Refund expired: ${r.name} × ${r.qty}`, shipmentId:s.id, shipmentName:s.name });
      expired++;
    });
    s.pendingRefunds=s.pendingRefunds.filter(r=>r.received||!r.deadline||r.deadline>=today);
  });
  if(expired>0){ saveShipments(); saveLosses(); if(typeof initDashboard==='function') initDashboard(); }
}
