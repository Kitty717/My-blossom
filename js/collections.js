// ═══════════════════════════════════════════════════
// COLLECTIONS  (js/collections.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, inventory.js
// ═══════════════════════════════════════════════════

const COL_EMOJIS = ['💄','✨','🧴','💇','💅','📦','👗','👟','🧦','🩴','👜','💍','🕯️','🧺','🎁','🌸','🧸','🍃','🏠','🍫','☕','🧼','🛁','🎀','🪴','💊','🧃','🌿','🎨','🛍️','🧲','🔑'];
let _colEditId = null;
let _colCurrentId = null;
let _colAssignTmp = new Set();

function renderCollections(){
  const list = document.getElementById('col-list');
  if(!list) return;
  if(!collections.length){
    list.innerHTML = `<div class="col-empty">
      <div class="col-empty-i">🗃️</div>
      <div class="col-empty-t">No collections yet</div>
      <div class="col-empty-s">Create your first collection to group products — Makeup, Skincare, Wear, anything you sell 🌸</div>
      <button class="btn btn-p" style="margin-top:20px" onclick="openAddCollection(null)">+ Create Collection</button>
    </div>`;
    return;
  }
  const uncat = products.filter(p=>!p.collectionId||!collections.find(c=>c.id===p.collectionId)).length;
  let html = '<div class="col-grid">';
  collections.forEach(c=>{
    const count = products.filter(p=>p.collectionId===c.id).length;
    html += `<div class="col-card" onclick="openCollectionDetail('${c.id}')" oncontextmenu="event.preventDefault();colContextMenu('${c.id}')">
      <button class="col-card-menu" onclick="event.stopPropagation();colContextMenu('${c.id}')">⋯</button>
      <span class="col-card-emoji">${c.emoji}</span>
      <div class="col-card-name">${c.name}</div>
      <span class="col-card-count">${count} ${count===1?'product':'products'}</span>
    </div>`;
  });
  if(uncat>0){
    html += `<div class="col-card col-card-uncategorized" onclick="openCollectionDetail('__uncat__')">
      <span class="col-card-emoji">📋</span>
      <div class="col-card-name">Uncategorized</div>
      <span class="col-card-count" style="background:var(--grey);color:var(--muted)">${uncat} ${uncat===1?'product':'products'}</span>
    </div>`;
  }
  html += '</div>';
  list.innerHTML = html;
}

function openCollectionDetail(colId){
  _colCurrentId = colId;
  const heroWrap = document.getElementById('col-detail-hero-wrap');
  const editBtn  = document.getElementById('col-detail-edit-btn');
  if(colId==='__uncat__'){
    heroWrap.innerHTML = `<div class="col-detail-hero">
      <div class="col-detail-emoji">📋</div>
      <div class="col-detail-info">
        <div class="col-detail-name">Uncategorized</div>
        <div class="col-detail-count">Products with no collection</div>
      </div>
    </div>`;
    if(editBtn) editBtn.style.display='none';
  } else {
    const c = collections.find(x=>x.id===colId);
    if(!c) return;
    const count = products.filter(p=>p.collectionId===c.id).length;
    heroWrap.innerHTML = `<div class="col-detail-hero">
      <div class="col-detail-emoji">${c.emoji}</div>
      <div class="col-detail-info">
        <div class="col-detail-name">${c.name}</div>
        <div class="col-detail-count">${count} ${count===1?'product':'products'}</div>
      </div>
    </div>`;
    if(editBtn) editBtn.style.display='';
  }
  renderCollectionDetail();
  showPage('collection-detail'); setNav('more');
}

function renderCollectionDetail(){
  const wrap = document.getElementById('col-detail-products');
  if(!wrap) return;
  const list = _colCurrentId==='__uncat__'
    ? products.filter(p=>!p.collectionId||!collections.find(c=>c.id===p.collectionId))
    : products.filter(p=>p.collectionId===_colCurrentId);
  if(!list.length){
    wrap.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--muted)">
      <div style="font-size:36px;margin-bottom:10px">📦</div>
      <div style="font-size:14px;font-weight:600;color:var(--ink);margin-bottom:6px">No products yet</div>
      <div style="font-size:13px">Tap <b>+ Assign</b> to add products to this collection</div>
    </div>`;
    return;
  }
  wrap.innerHTML = '<div class="col-prod-grid">'+list.map(p=>{
    const totalQty = getTotalQty(p);
    const isLow = totalQty < (p.reorderAt||10);
    // variant photo strip — up to 4 variants with photos
    const varPhotos = p.variants.filter(v=>v.photo && v.photo.startsWith('data:')).slice(0,4);
    const photoStrip = varPhotos.length
      ? `<div style="display:flex;gap:3px;margin-bottom:5px;justify-content:center;flex-wrap:wrap">
          ${varPhotos.map(v=>`<img src="${v.photo}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;border:1.5px solid var(--white)">`).join('')}
         </div>`
      : p.photo
        ? `<img src="${p.photo}" style="width:100%;height:52px;object-fit:cover;border-radius:8px;margin-bottom:5px">`
        : `<div class="col-prod-card-emoji">${p.emoji}</div>`;
    return `<div class="col-prod-card" onclick="openColProductInfo('${p.id}')">
      ${photoStrip}
      <div class="col-prod-card-name">${p.name}</div>
      <span class="col-prod-card-badge ${isLow?'br':'bg'}">${totalQty}</span>
    </div>`;
  }).join('')+'</div>';
}

function openColProductInfo(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  document.getElementById('cpi-title').textContent = p.emoji+' '+p.name;
  const totalQty = getTotalQty(p);
  const isLow = totalQty < (p.reorderAt||10);
  // Price lines
  let priceHtml = '';
  if(p.priceRAPiece) priceHtml += `<div class="lr"><div class="lif"><div class="ln">🏪 RA Wholesale</div></div><div class="lamt">$${p.priceRAPiece.toFixed(2)}<span style="font-size:11px;color:var(--muted);font-weight:400">/pc</span>${p.priceRADozen?'<br><span style="font-size:12px;color:var(--muted)">$'+p.priceRADozen.toFixed(2)+'/dozen</span>':''}${p.standUnit&&p.standUnit.qty&&p.standUnit.price?'<br><span style="font-size:12px;color:var(--muted)">'+p.standUnit.name+' $'+p.standUnit.price.toFixed(2)+'('+p.standUnit.qty+'pc)</span>':''}</div></div>`;
  if(p.priceFlora)   priceHtml += `<div class="lr"><div class="lif"><div class="ln">🌸 Flora Retail</div></div><div class="lamt">$${p.priceFlora.toFixed(2)}</div></div>`;
  if(!priceHtml)     priceHtml = `<div style="color:var(--muted);font-size:13px;padding:8px 0">No price set</div>`;
  // Variants
  const varHtml = p.variants.map(v=>{
    const qty = (v.ra||0)+(v.flora||0);
    const colors = v.colorHex&&v.colorHex!=='#ede6e8'?`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${v.colorHex};border:1px solid rgba(0,0,0,0.1);margin-right:4px;vertical-align:middle"></span>`:'';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--grey2)">
      <div style="font-size:13px;color:var(--ink)">${colors}${v.name}${v.size?' · <span style="color:var(--muted)">${v.size}</span>':''}</div>
      <span class="b ${qty<1?'br':qty<5?'ba':'bg'}" style="font-size:10px">${qty} units</span>
    </div>`;
  }).join('');
  document.getElementById('cpi-body').innerHTML = `
    <!-- Stock overview -->
    <div style="background:var(--rose-pale);border-radius:14px;padding:14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Total Stock</div>
        <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:var(--ink)">${totalQty} <span style="font-size:13px;font-weight:400;color:var(--muted)">units</span></div>
      </div>
      <span class="b ${isLow?'br':'bg'}" style="font-size:12px">${isLow?'⚠️ Low stock':'✅ In stock'}</span>
    </div>
    <!-- Prices -->
    <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Pricing</div>
    <div style="margin-bottom:16px">${priceHtml}</div>
    <!-- Variants -->
    <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Variants</div>
    <div style="margin-bottom:4px">${varHtml}</div>`;
  showModal('m-col-product-info');
}

function openAddCollection(id){
  _colEditId = id;
  const col = id ? collections.find(c=>c.id===id) : null;
  document.getElementById('col-modal-title').textContent = id ? '✏️ Edit Collection' : '🗃️ New Collection';
  document.getElementById('col-modal-name').value = col ? col.name : '';
  const defaultEmoji = col ? col.emoji : '📦';
  document.getElementById('col-modal-emoji-preview').textContent = defaultEmoji;
  // Build emoji grid
  const grid = document.getElementById('col-emoji-grid');
  grid.innerHTML = COL_EMOJIS.map(e=>`<div class="col-emoji-opt${e===defaultEmoji?' selected':''}" onclick="colPickEmoji(this,'${e}')">${e}</div>`).join('');
  showModal('m-add-collection');
}

function openEditCurrentCollection(){
  if(_colCurrentId && _colCurrentId!=='__uncat__') openAddCollection(_colCurrentId);
}

function colPickEmoji(el, emoji){
  document.querySelectorAll('.col-emoji-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('col-modal-emoji-preview').textContent = emoji;
}

function saveCollection(){
  const name = document.getElementById('col-modal-name').value.trim();
  if(!name){ showToast('Please enter a name','err'); return; }
  const emoji = document.getElementById('col-modal-emoji-preview').textContent.trim()||'📦';
  if(_colEditId){
    const c = collections.find(x=>x.id===_colEditId);
    if(c){ c.name=name; c.emoji=emoji; }
  } else {
    collections.push({id:'col-'+Date.now(), name, emoji, createdAt:Date.now()});
  }
  saveCollections();
  closeModal('m-add-collection');
  showToast(_colEditId ? 'Collection updated 🌸' : 'Collection created 🌸');
  renderCollections();
  if(_colEditId && _colCurrentId===_colEditId) openCollectionDetail(_colEditId);
}

function colContextMenu(colId){
  const c = collections.find(x=>x.id===colId);
  if(!c) return;
  showColActions(colId, c);
}

function showColActions(colId, c){
  // Remove existing action sheet if any
  const existing = document.getElementById('col-action-sheet');
  if(existing) existing.remove();
  const sheet = document.createElement('div');
  sheet.id = 'col-action-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:900;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(44,26,31,0.45);animation:fu 0.18s ease';
  sheet.innerHTML = `<div style="background:var(--white);border-radius:24px 24px 0 0;padding:20px 16px 36px">
    <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:var(--ink);margin-bottom:16px;text-align:center">${c.emoji} ${c.name}</div>
    <button onclick="closeColActions();setTimeout(()=>openAddCollection('${colId}'),150)" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:none;background:var(--grey);border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;color:var(--ink);margin-bottom:10px;font-family:inherit">✏️ Edit Collection</button>
    <button onclick="closeColActions();setTimeout(()=>deleteCollection('${colId}'),150)" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:none;background:var(--red-soft);border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;color:var(--red);font-family:inherit">🗑️ Delete Collection</button>
    <button onclick="closeColActions()" style="width:100%;padding:13px;margin-top:6px;border:none;background:var(--grey2);border-radius:12px;cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);font-family:inherit">Cancel</button>
  </div>`;
  sheet.addEventListener('click', e=>{ if(e.target===sheet) closeColActions(); });
  document.body.appendChild(sheet);
}

function closeColActions(){
  const s = document.getElementById('col-action-sheet');
  if(s) s.remove();
}

function deleteCollection(colId){
  const c = collections.find(x=>x.id===colId);
  if(!c) return;
  appConfirm('Delete Collection', `Delete "${c.emoji} ${c.name}"? Products will become uncategorized.`, '🗑️ Delete', ()=>{
    collections = collections.filter(x=>x.id!==colId);
    products.forEach(p=>{ if(p.collectionId===colId) p.collectionId=''; });
    saveCollections();
    showToast('Collection deleted');
    showPage('collections'); setNav('more');
    renderCollections();
  });
}

function openAssignProducts(){
  if(!_colCurrentId || _colCurrentId==='__uncat__'){
    showToast('Cannot assign to uncategorized','err'); return;
  }
  _colAssignTmp = new Set(products.filter(p=>p.collectionId===_colCurrentId).map(p=>p.id));
  const list = document.getElementById('col-assign-list');
  list.innerHTML = products.length ? products.map(p=>`
    <div class="col-assign-row" onclick="colAssignToggle('${p.id}',this)">
      <div class="col-assign-emoji">${p.emoji}</div>
      <div class="col-assign-name">${p.name}</div>
      <div class="col-assign-check${_colAssignTmp.has(p.id)?' checked':''}" id="col-ac-${p.id}">${_colAssignTmp.has(p.id)?'✓':''}</div>
    </div>`).join('') :
    '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No products yet — add some first</div>';
  showModal('m-assign-products');
}

function colAssignToggle(pid, row){
  const check = row.querySelector('.col-assign-check');
  if(_colAssignTmp.has(pid)){
    _colAssignTmp.delete(pid);
    check.classList.remove('checked');
    check.textContent='';
  } else {
    _colAssignTmp.add(pid);
    check.classList.add('checked');
    check.textContent='✓';
  }
}

function saveAssignProducts(){
  products.forEach(p=>{
    if(_colAssignTmp.has(p.id)) p.collectionId=_colCurrentId;
    else if(p.collectionId===_colCurrentId) p.collectionId='';
  });
  saveCollections();
  closeModal('m-assign-products');
  showToast('Products updated 🌸');
  renderCollectionDetail();
  openCollectionDetail(_colCurrentId);
}
