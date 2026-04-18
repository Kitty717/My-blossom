// ═══════════════════════════════════════════════════
// SUPPLIES  (js/supplies.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, dashboard.js
// ═══════════════════════════════════════════════════

// SUPPLIES
// ═══════════════════════════════════════════════════
var supplyFilter = typeof supplyFilter !== 'undefined' ? supplyFilter : 'all';

function renderSupplies(){
  const el = document.getElementById('supplies-list');
  if(!el) return;
  const list = supplies.filter(s=>{
    if(supplyFilter==='flora') return s.store==='flora'||s.store==='both';
    if(supplyFilter==='ra')    return s.store==='ra'||s.store==='both';
    if(supplyFilter==='low')   return (s.stock||0)<=(s.reorderAt||10);
    return true;
  });
  if(!list.length){
    el.innerHTML=`<div style="text-align:center;padding:50px 20px;color:var(--muted)"><div style="font-size:48px;margin-bottom:12px">🎀</div><div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">No supplies yet</div><div style="font-size:13px">Tap <b>+ Add</b> to add gift boxes, ribbon, tissue paper...</div></div>`;
    return;
  }
  el.innerHTML = list.map(s=>{
    const isLow = (s.stock||0)<=(s.reorderAt||10);
    const storeTag = s.store==='both' ? '<span class="b bb" style="font-size:10px">🏪🌸 Both</span>'
      : s.store==='ra' ? '<span class="b ba" style="font-size:10px">🏪 RA</span>'
      : '<span class="b brose" style="font-size:10px">🌸 Flora</span>';
    return `<div class="card" style="margin-bottom:10px;padding:14px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px" onclick="openEditSupply('${s.id}')" style="cursor:pointer">
        <div style="font-size:28px;flex-shrink:0">${s.emoji||'🎀'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--ink)">${s.name}</div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">
            ${storeTag}
            <span class="b ${isLow?'br':'bg'}" style="font-size:10px">${isLow?'⚠️ ':''}${s.stock||0} left</span>
            <span style="font-size:11px;color:var(--muted)">$${(s.cost||0).toFixed(2)}/unit</span>
          </div>
          ${isLow?`<div style="margin-top:5px;font-size:11px;color:var(--amber);font-weight:600">⚠️ Low — reorder at ${s.reorderAt||10}</div>`:''}
        </div>
      </div>
      <div style="display:flex;gap:8px;border-top:1px solid var(--grey2);padding-top:10px">
        <button onclick="adjustSupplyStock('${s.id}',-1)" style="flex:1;height:36px;border-radius:10px;background:var(--red-soft);color:var(--red);border:none;cursor:pointer;font-size:18px;font-weight:700">−</button>
        <div style="flex:2;height:36px;border-radius:10px;background:var(--grey);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:var(--ink)">${s.stock||0}</div>
        <button onclick="adjustSupplyStock('${s.id}',1)" style="flex:1;height:36px;border-radius:10px;background:var(--green-soft);color:var(--green);border:none;cursor:pointer;font-size:18px;font-weight:700">+</button>
        <button onclick="openEditSupply('${s.id}')" style="flex:1;height:36px;border-radius:10px;background:var(--rose-soft);color:var(--rose);border:none;cursor:pointer;font-size:14px">✏️</button>
        <button onclick="deleteSupply('${s.id}')" style="flex:1;height:36px;border-radius:10px;background:var(--grey);color:var(--muted);border:none;cursor:pointer;font-size:14px">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function openAddSupply(){
  document.getElementById('supply-edit-id').value = '';
  document.getElementById('supply-modal-title').textContent = '🎀 Add Supply';
  document.getElementById('supply-emoji').value = '🎀';
  document.getElementById('supply-name').value = '';
  document.getElementById('supply-store').value = 'flora';
  document.getElementById('supply-cost').value = '';
  document.getElementById('supply-stock').value = '';
  document.getElementById('supply-reorder').value = '10';
  showModal('m-supply');
}

function openEditSupply(sid){
  const s = supplies.find(x=>x.id===sid);
  if(!s) return;
  document.getElementById('supply-edit-id').value = sid;
  document.getElementById('supply-modal-title').textContent = '✏️ Edit Supply';
  document.getElementById('supply-emoji').value = s.emoji||'🎀';
  document.getElementById('supply-name').value = s.name||'';
  document.getElementById('supply-store').value = s.store||'flora';
  document.getElementById('supply-cost').value = (s.cost||0).toFixed(2);
  document.getElementById('supply-stock').value = s.stock||0;
  document.getElementById('supply-reorder').value = s.reorderAt||10;
  showModal('m-supply');
}

function saveSupply(){
  const name = document.getElementById('supply-name').value.trim();
  if(!name){ showToast('Enter a supply name','err'); return; }
  const editId = document.getElementById('supply-edit-id').value;
  const data = {
    name,
    emoji:    document.getElementById('supply-emoji').value.trim()||'🎀',
    store:    document.getElementById('supply-store').value,
    cost:     parseFloat(document.getElementById('supply-cost').value)||0,
    stock:    parseInt(document.getElementById('supply-stock').value,10)||0,
    reorderAt:parseInt(document.getElementById('supply-reorder').value,10)||10,
  };
  if(editId){
    const s = supplies.find(x=>x.id===editId);
    if(s) Object.assign(s, data);
  } else {
    supplies.push({id:'sup-'+Date.now(), ...data});
  }
  saveSupplies();
  closeModal('m-supply');
  renderSupplies();
  showToast(editId ? 'Supply updated' : '🎀 Supply added!');
}

function deleteSupply(sid){
  const s = supplies.find(x=>x.id===sid);
  if(!s) return;
  appConfirm('Delete Supply',`Delete "${s.name}"?`,'🗑️ Delete',()=>{
    supplies = supplies.filter(x=>x.id!==sid);
    saveSupplies(); renderSupplies(); closeModal('m-supply');
    showToast('Supply deleted');
  });
}

function adjustSupplyStock(sid, delta){
  const s = supplies.find(x=>x.id===sid);
  if(!s) return;
  s.stock = Math.max(0,(s.stock||0)+delta);
  saveSupplies(); renderSupplies();
}

// ── Bundle supply picker state ──
let bundleSupplies = []; // [{sid, qty}]

function renderBundleSupplies(){
  const el = document.getElementById('bnd-supplies');
  if(!el) return;
  if(!bundleSupplies.length){
    el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 0 4px">No supplies added yet</div>';
    calcBundle(); return;
  }
  el.innerHTML = bundleSupplies.map((item,idx)=>{
    const s = supplies.find(x=>x.id===item.sid);
    if(!s) return '';
    return `<div style="display:flex;align-items:center;gap:8px;background:var(--grey);border-radius:10px;padding:8px 10px;margin-bottom:6px">
      <span style="font-size:18px">${s.emoji||'🎀'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--ink)">${s.name}</div>
        <div style="font-size:11px;color:var(--muted)">$${(s.cost||0).toFixed(2)}/unit · ${s.stock||0} in stock</div>
      </div>
      <input type="number" value="${item.qty}" min="1" style="width:48px;padding:4px 6px;border:1.5px solid var(--grey2);border-radius:8px;font-size:13px;font-weight:700;text-align:center;font-family:inherit;color:var(--ink);background:var(--white);outline:none" onchange="bundleSupplies[${idx}].qty=Math.max(1,parseInt(this.value,10)||1);calcBundle()">
      <button onclick="bundleSupplies.splice(${idx},1);renderBundleSupplies()" style="background:var(--red-soft);color:var(--red);border:none;border-radius:8px;padding:5px 8px;cursor:pointer;font-size:12px">✕</button>
    </div>`;
  }).join('');
  calcBundle();
}

function addBundleSupply(){
  const floraSups = supplies.filter(s=>s.store==='flora'||s.store==='both');
  if(!floraSups.length){ showToast('No supplies yet — add some in Supplies first','err'); return; }
  // Show a quick picker sheet
  const existing = document.getElementById('supply-picker-sheet');
  if(existing) existing.remove();
  const sheet = document.createElement('div');
  sheet.id = 'supply-picker-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(44,26,31,0.45);display:flex;flex-direction:column;justify-content:flex-end;backdrop-filter:blur(2px);animation:fu 0.2s ease';
  sheet.innerHTML = `
    <div style="background:var(--white);border-radius:24px 24px 0 0;padding:18px 16px 36px;max-height:70dvh;overflow-y:auto">
      <div style="width:40px;height:4px;background:var(--grey2);border-radius:4px;margin:0 auto 14px"></div>
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;margin-bottom:12px;color:var(--ink)">🎀 Pick a Supply</div>
      ${floraSups.map(s=>`
        <div onclick="pickBundleSupply('${s.id}')" style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--grey);border-radius:12px;margin-bottom:8px;cursor:pointer">
          <span style="font-size:22px">${s.emoji||'🎀'}</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:var(--ink)">${s.name}</div>
            <div style="font-size:11px;color:var(--muted)">$${(s.cost||0).toFixed(2)}/unit · ${s.stock||0} in stock</div>
          </div>
          <span style="font-size:18px;color:var(--rose)">›</span>
        </div>`).join('')}
    </div>`;
  sheet.addEventListener('click',e=>{ if(e.target===sheet) sheet.remove(); });
  document.body.appendChild(sheet);
}

function pickBundleSupply(sid){
  document.getElementById('supply-picker-sheet')?.remove();
  const already = bundleSupplies.find(x=>x.sid===sid);
  if(already){ already.qty++; }
  else { bundleSupplies.push({sid, qty:1}); }
  renderBundleSupplies();
}

// ── Reduce supply stock when bundle is fulfilled ──
function reduceSupplyStock(bndSupplies){
  if(!bndSupplies||!bndSupplies.length) return;
  bndSupplies.forEach(item=>{
    const s = supplies.find(x=>x.id===item.sid);
    if(s){
      const qty = Math.min(item.qty||1, s.stock||0);
      const cost = qty * (s.cost||0);
      s.stock = Math.max(0,(s.stock||0)-(item.qty||1));
      s.consumedCost = (s.consumedCost||0) + cost;
    }
  });
  saveSupplies();
  if(document.getElementById('page-supplies')?.classList.contains('active')) renderSupplies();
}
