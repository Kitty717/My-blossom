// ═══════════════════════════════════════════════════
// STOCK COUNT + QR + SCANNER  (js/stockcount.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, inventory.js
// ═══════════════════════════════════════════════════

function saveInvSession(){
  _idbPut('invSession', invSession || null).catch(e=>console.warn('saveInvSession error',e));
}
function loadInvSession(){
  if(invSession) return;
  // loaded async at startup via _loadInvSessionAsync
}
async function _loadInvSessionAsync(){
  try {
    let val = await _idbGet('invSession');
    if(val === undefined || val === null){
      const raw = localStorage.getItem('invSession');
      val = raw ? JSON.parse(raw) : null;
    }
    invSession = val;
  } catch(e){ invSession = null; }
}
function getInvHistory(){
  return window._scHistoryCache || [];
}
function saveInvHistory(hist){
  window._scHistoryCache = hist;
  _idbPut('scHistory', hist).catch(e=>console.warn('saveInvHistory error',e));
}

// ── State for log sheet ──
let _scLogPid = null;
let _scLogMode = 'replace'; // 'replace' | 'add'

// ── Build shipment tabs for count page ──
function scBuildTabs(){
  const shipIds = [...new Set(products.map(p=>p.shipmentId).filter(Boolean))];
  const tabs = [{id:'all', label:'All'}];
  shipIds.forEach(sid=>{
    const s = shipments.find(x=>x.id===sid);
    // only show arrived shipments
    if(s && s.status === 'arrived') tabs.push({id:sid, label:s.name});
  });
  return tabs;
}

let _scTabFilter = 'all';
let _scSearch = '';
let _scSelectMode = false;
let _scSelected = new Set(); // pids selected for deletion

// renderPendingArrivals → js/shipments.js

function renderCount(){
  loadInvSession();
  renderPendingArrivals();
  const container = document.getElementById('inv-count-container');
  if(!container) return;

  const phIdle   = document.getElementById('inv-count-ph-idle');
  const phActive = document.getElementById('inv-count-ph-active');

  if(!invSession){
    if(phIdle)   phIdle.style.display   = 'flex';
    if(phActive) phActive.style.display = 'none';
    container.innerHTML = '';
    renderInvHistory();
    return;
  }

  // ── ACTIVE SESSION ──
  if(phIdle)   phIdle.style.display   = 'none';
  if(phActive) phActive.style.display = 'flex';

  // only count products from arrived shipments (or no shipment) for progress
  const countableProducts = products.filter(p=>{
    if(p.shipmentId){
      const ship = shipments.find(s=>s.id===p.shipmentId);
      return ship && ship.status === 'arrived';
    }
    return true;
  });

  const loggedPids = new Set(
    countableProducts.filter(p=>p.variants.some(v=>
      invSession.counts[p.id+'-'+v.id+'-ra'] !== undefined ||
      invSession.counts[p.id+'-'+v.id+'-flora'] !== undefined
    )).map(p=>p.id)
  );
  const subEl = document.getElementById('inv-session-sub');
  if(subEl) subEl.textContent = loggedPids.size + ' of ' + countableProducts.length + ' logged';

  const pct = countableProducts.length ? Math.round(loggedPids.size / countableProducts.length * 100) : 0;

  // build tabs
  const tabs = scBuildTabs();

  // filter products — hide those linked to non-arrived shipments
  const q = _scSearch.toLowerCase();
  let list = products.filter(p=>{
    // if linked to a shipment that hasn't arrived, hide it
    if(p.shipmentId){
      const ship = shipments.find(s=>s.id===p.shipmentId);
      if(ship && ship.status !== 'arrived') return false;
    }
    if(_scTabFilter !== 'all' && p.shipmentId !== _scTabFilter) return false;
    if(q && !p.name.toLowerCase().includes(q) &&
       !p.variants.some(v=>v.name.toLowerCase().includes(q))) return false;
    return true;
  });

  const tabsHtml = `<div class="tabs" style="margin-bottom:12px">
    ${tabs.map(t=>`<div class="tab${_scTabFilter===t.id?' active':''}" onclick="_scTabFilter='${t.id}';renderCount()">${t.label}</div>`).join('')}
  </div>`;

  const rowsHtml = list.length ? list.map(p=>{
    const ship = p.shipmentId ? shipments.find(s=>s.id===p.shipmentId) : null;
    const shipPill = ship
      ? `<span class="sc-ship-pill">${ship.name}</span>`
      : `<span class="sc-ship-pill none">No Shipment</span>`;
    const isLogged = p.variants.some(v=>invSession.counts[p.id+'-'+v.id+'-ra']!==undefined || invSession.counts[p.id+'-'+v.id+'-flora']!==undefined);
    const isLocked = invSession.locked && invSession.locked[p.id];
    const totalCurrent = getTotalQty(p);
    const isSelected = _scSelected.has(p.id);

    // build logged summary
    let loggedSummary = '';
    if(isLogged){
      const loggedVars = p.variants.filter(v=>invSession.counts[p.id+'-'+v.id+'-ra']!==undefined || invSession.counts[p.id+'-'+v.id+'-flora']!==undefined);
      const loggedTotal = loggedVars.reduce((s,v)=>{
        return s + (invSession.counts[p.id+'-'+v.id+'-ra']||0) + (invSession.counts[p.id+'-'+v.id+'-flora']||0);
      }, 0);
      loggedSummary = `<span class="sc-logged-val">${loggedTotal} logged</span>`;
    }

    const thumb = p.photo
      ? `<div class="sc-thumb"><img src="${p.photo}"></div>`
      : `<div class="sc-thumb">${p.emoji}</div>`;

    // select mode checkbox (only for logged products)
    const checkbox = (_scSelectMode && isLogged) ? `
      <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${isSelected?'var(--rose)':'var(--grey2)'};background:${isSelected?'var(--rose)':'white'};display:flex;align-items:center;justify-content:center;font-size:11px;color:white;flex-shrink:0;margin-right:2px">
        ${isSelected?'✓':''}
      </div>` : '';

    const rowClick = (_scSelectMode && isLogged)
      ? `scToggleSelectCount('${p.id}')`
      : (!_scSelectMode ? `scOpenLog('${p.id}')` : '');

    return `<div class="sc-prod-row${isLogged?' logged':''}${isLocked?' locked':''}${isSelected?' selected':''}"
      onclick="${rowClick}"
      ontouchstart="scLpStart('${p.id}',${isLogged})"
      ontouchend="scLpEnd()"
      ontouchmove="scLpEnd()"
      style="${isSelected?'background:var(--rose-pale);border-left:3px solid var(--rose)':''}">
      ${checkbox}
      ${thumb}
      <div class="sc-prod-info">
        <div class="sc-prod-name">${p.name}</div>
        <div class="sc-prod-meta">
          <span>${(p.variants.length>1||(p.variants.length===1&&p.variants[0].name&&p.variants[0].name!=='Standard'&&p.variants[0].name!=='')) ? p.variants.length+' variant'+(p.variants.length>1?'s':'') : 'No variants'} · ${totalCurrent} in stock</span>
          ${shipPill}
        </div>
      </div>
      <div class="sc-prod-right">
        ${isLocked ? '<span class="sc-lock-icon">🔒</span>' : ''}
        ${loggedSummary}
        ${!_scSelectMode ? '<span class="sc-chevron">›</span>' : ''}
      </div>
    </div>`;
  }).join('') : `<div style="padding:28px 16px;text-align:center;color:var(--muted);font-size:13px">No products found</div>`;

  // count logged products for select all button
  const loggedCount = [...loggedPids].length;

  // Update the permanent FAB (don't render it inline)
  const scFab = document.getElementById('sc-count-fab');
  if(scFab){
    if(_scSelectMode){
      scFab.style.display = 'flex';
      requestAnimationFrame(()=>{ scFab.style.transform = 'translateY(0)'; });
      document.getElementById('sc-fab-count').textContent = _scSelected.size + ' selected';
      document.getElementById('sc-fab-all').textContent = 'All (' + loggedCount + ')';
      const delBtn = document.getElementById('sc-fab-del');
      if(delBtn){ delBtn.style.opacity = _scSelected.size===0?'0.4':'1'; delBtn.style.pointerEvents = _scSelected.size===0?'none':'auto'; }
    } else {
      scFab.style.transform = 'translateY(100%)';
      setTimeout(()=>{ scFab.style.display = 'none'; }, 220);
    }
  }

  container.innerHTML = `
    <div class="sc-count-banner">
      <div class="sc-count-banner-label">${new Date(invSession.date).toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>
      <div class="sc-count-banner-name">${invSession.label}</div>
      <div class="sc-count-pbar-bg"><div class="sc-count-pbar-fill" style="width:${pct}%"></div></div>
      <div class="sc-count-pbar-label">${loggedPids.size} of ${countableProducts.length} products · ${pct}%</div>
    </div>
    <div class="sc-toolbar">
      <div class="sc-search">
        <span style="color:var(--muted);font-size:15px">🔍</span>
        <input placeholder="Search product..." value="${_scSearch}"
          oninput="_scSearch=this.value;renderCount()" autocomplete="off">
        ${_scSearch?`<button onclick="_scSearch='';renderCount()" style="background:none;border:none;color:var(--muted);font-size:17px;cursor:pointer;padding:0 2px">✕</button>`:''}
      </div>
      ${loggedCount>0 && !_scSelectMode ? `<button onclick="scEnterSelectMode()" class="sc-scan-btn" title="Select to delete" style="font-size:13px;font-weight:700;width:auto;padding:0 12px;color:var(--rose)">Select</button>` : ''}
    </div>
    ${tabsHtml}
    <div class="sc-prod-list">${rowsHtml}</div>
  `;
}

// ── Open log sheet for a product ──
function scOpenLog(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  _scLogPid = pid;
  _scLogMode = 'replace';

  document.getElementById('sc-log-title').textContent = p.emoji + ' ' + p.name;
  const ship = p.shipmentId ? shipments.find(s=>s.id===p.shipmentId) : null;
  document.getElementById('sc-log-subtitle').textContent = ship ? '📦 ' + ship.name : 'No Shipment';

  // stock info
  const totalStock = getTotalQty(p);
  const loggedVars = p.variants.filter(v=>invSession && (invSession.counts[p.id+'-'+v.id+'-ra']!==undefined || invSession.counts[p.id+'-'+v.id+'-flora']!==undefined));
  const alreadyLogged = loggedVars.length > 0;
  document.getElementById('sc-log-stock-info').innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Current Stock</div><div style="font-size:16px;font-weight:700;color:var(--ink)">${totalStock} units</div></div>
      ${alreadyLogged ? `<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Already Logged</div><div style="font-size:16px;font-weight:700;color:var(--green)">${loggedVars.map(v=>{
        const ra = invSession.counts[p.id+'-'+v.id+'-ra'];
        const fl = invSession.counts[p.id+'-'+v.id+'-flora'];
        const parts = [];
        if(ra !== undefined) parts.push('🏪'+ra);
        if(fl !== undefined) parts.push('🌸'+fl);
        return v.name+': '+parts.join(' ');
      }).join(', ')}</div></div>` : ''}
    </div>`;

  // mode buttons
  scSetMode('replace');

  // Determine which stock box(es) to show based on product's store setting
  // Both or RA only → show only RA (RA is the warehouse; Flora pulls from RA)
  // Flora only → show only Flora
  const showRA = p.store !== 'flora';
  const showFlora = p.store === 'flora' || p.store === 'both';

  // build variant rows
  document.getElementById('sc-log-variants').innerHTML = p.variants.map(v=>{
    const _scHex = v.colorHex||'';
    const _scValidColor = _scHex && _scHex!=='#ede6e8' && _scHex!=='#f4a0b0' && _scHex!=='#000000' && _scHex!=='#1c1c1c';
    const dot = _scValidColor ? `<span class="sc-sheet-vdot" style="background:${_scHex}"></span>` : '';
    const existingRa = invSession?.counts[p.id+'-'+v.id+'-ra'];
    const existingFl = invSession?.counts[p.id+'-'+v.id+'-flora'];
    const raCol = showRA ? `
      <div class="sc-sheet-col">
        <div class="sc-sheet-col-lbl">${p.store==='both'?'🏪 RA':'Qty'}</div>
        <input class="sc-num-inp" type="number" min="0"
          id="scv-ra-${v.id}" placeholder="—"
          value=""
          oninput="this.classList.toggle('filled',this.value!=='')">
        <div style="font-size:9px;color:var(--muted);margin-top:2px">now: ${v.ra}${existingRa!==undefined?' · last: '+existingRa:''}</div>
      </div>` : '';
    const flCol = showFlora ? `
      <div class="sc-sheet-col">
        <div class="sc-sheet-col-lbl">${p.store==='both'?'🌸 Flora':'Qty'}</div>
        <input class="sc-num-inp" type="number" min="0"
          id="scv-fl-${v.id}" placeholder="—"
          value=""
          oninput="this.classList.toggle('filled',this.value!=='')">
        <div style="font-size:9px;color:var(--muted);margin-top:2px">now: ${v.flora}${existingFl!==undefined?' · last: '+existingFl:''}</div>
      </div>` : '';
    // grid: if both visible, use two cols; else one
    const gridStyle = (showRA && showFlora) ? 'grid-template-columns:1fr 90px 90px' : 'grid-template-columns:1fr 100px';
    const vPhoto = v.photo || '';
    const vThumb = vPhoto ? `<img src="${vPhoto}" style="width:36px;height:36px;border-radius:9px;object-fit:cover;flex-shrink:0;margin-right:6px">` : '';
    return `<div class="sc-sheet-variant" style="${gridStyle}">
      <div class="sc-sheet-vname">${vThumb}${dot}${fmtVariant(v)}</div>
      ${raCol}${flCol}
    </div>`;
  }).join('');

  showModal('m-sc-log');
}

function scSetMode(mode){ _scLogMode = mode; }

function scLogConfirm(){
  // First validate that at least one value is entered
  const p = products.find(x=>x.id===_scLogPid);
  if(!p||!invSession) return;
  let hasValue = false;
  const showRA = p.store !== 'flora';
  const showFlora = p.store === 'flora' || p.store === 'both';
  p.variants.forEach(v=>{
    if(showRA){ const inp = document.getElementById('scv-ra-'+v.id); if(inp && inp.value!=='') hasValue=true; }
    if(showFlora){ const inp = document.getElementById('scv-fl-'+v.id); if(inp && inp.value!=='') hasValue=true; }
  });
  if(!hasValue){ showToast('Enter at least one quantity','err'); return; }

  // Build summary text
  const lines = [];
  p.variants.forEach(v=>{
    if(showRA){ const inp = document.getElementById('scv-ra-'+v.id); if(inp && inp.value!=='') lines.push(`${fmtVariant(v)}: <strong>${inp.value}</strong> units`); }
    if(showFlora){ const inp = document.getElementById('scv-fl-'+v.id); if(inp && inp.value!=='') lines.push(`${fmtVariant(v)}: <strong>${inp.value}</strong> units`); }
  });
  document.getElementById('sc-confirm-title').textContent = p.emoji + ' ' + p.name;
  document.getElementById('sc-confirm-summary').innerHTML = lines.join('<br>');
  showModal('m-sc-confirm');
}

function scLogSave(mode){
  const p = products.find(x=>x.id===_scLogPid);
  if(!p||!invSession) return;
  _scLogMode = mode;
  const showRA = p.store !== 'flora';
  const showFlora = p.store === 'flora' || p.store === 'both';
  let saved = 0;
  p.variants.forEach(v=>{
    const raInp = showRA ? document.getElementById('scv-ra-'+v.id) : null;
    const flInp = showFlora ? document.getElementById('scv-fl-'+v.id) : null;
    const raVal = raInp && raInp.value !== '' ? parseInt(raInp.value,10) : null;
    const flVal = flInp && flInp.value !== '' ? parseInt(flInp.value,10) : null;

    if(raVal !== null && !isNaN(raVal)){
      if(mode === 'add'){
        const existing = invSession.counts[p.id+'-'+v.id+'-ra'] || 0;
        invSession.counts[p.id+'-'+v.id+'-ra'] = existing + raVal;
      } else {
        invSession.counts[p.id+'-'+v.id+'-ra'] = raVal;
      }
      saved++;
    }
    if(flVal !== null && !isNaN(flVal)){
      if(mode === 'add'){
        const existing = invSession.counts[p.id+'-'+v.id+'-flora'] || 0;
        invSession.counts[p.id+'-'+v.id+'-flora'] = existing + flVal;
      } else {
        invSession.counts[p.id+'-'+v.id+'-flora'] = flVal;
      }
      saved++;
    }
  });

  if(!saved){ showToast('Enter at least one quantity', 'err'); return; }

  if(mode === 'replace'){
    if(!invSession.locked) invSession.locked = {};
    invSession.locked[p.id] = true;
  }

  saveInvSession();
  closeModal('m-sc-confirm');
  closeModal('m-sc-log');
  renderCount();
  const modeLabel = mode === 'replace' ? '✓ Saved' : '＋ Added';
  showToast(modeLabel + ' — ' + p.name);
}

function scStartScan(){
  scanMode = 'update';
  document.getElementById('scan-mode-label').textContent = 'Scan to Update Stock';
  document.getElementById('scan-overlay').classList.add('active');
  document.getElementById('scan-status').textContent = 'Starting camera...';
  document.getElementById('scan-manual-form').style.display = 'none';
  startCamera();
}

function finishInvCount(){
  if(!invSession){ showToast('No active session','err'); return; }
  const counted = Object.keys(invSession.counts).length;
  if(!counted){ showToast('Nothing logged yet','err'); return; }
  scBuildReport();
  showModal('m-inv-report');
}

function scBuildReport(){
  // Group products by shipment
  const shipGroups = {};
  const noShip = [];
  let totalLogged=0, totalMatch=0, totalDiff=0, totalSkipped=0;

  products.forEach(p=>{
    const hasCount = p.variants.some(v=>
      invSession.counts[p.id+'-'+v.id+'-ra']!==undefined ||
      invSession.counts[p.id+'-'+v.id+'-flora']!==undefined
    );
    if(!hasCount){ totalSkipped++; return; }
    if(p.shipmentId){
      if(!shipGroups[p.shipmentId]) shipGroups[p.shipmentId]=[];
      shipGroups[p.shipmentId].push(p);
    } else { noShip.push(p); }
  });

  const renderGroup = prods => prods.map(p=>{
    return p.variants.filter(v=>
      invSession.counts[p.id+'-'+v.id+'-ra']!==undefined ||
      invSession.counts[p.id+'-'+v.id+'-flora']!==undefined
    ).map(v=>{
      const counted = invSession.counts[p.id+'-'+v.id+'-ra'] ?? invSession.counts[p.id+'-'+v.id+'-flora'];
      const currentStock = p.store==='flora' ? (v.flora||0) : (v.ra||0);
      const diff = counted - currentStock;
      totalLogged++;
      if(diff===0) totalMatch++; else totalDiff++;
      const diffColor = diff===0?'var(--green)':diff>0?'var(--blue)':'var(--red)';
      const diffStr = diff===0?'✓':(diff>0?'+'+diff:''+diff);
      const diffBg = diff===0?'var(--green-soft)':diff>0?'var(--blue-soft)':'var(--red-soft)';
      const thumb = p.photo
        ? `<div class="sc-rpt-thumb"><img src="${p.photo}"></div>`
        : `<div class="sc-rpt-thumb">${p.emoji}</div>`;
      return `<div class="sc-rpt-row">
        ${thumb}
        <div class="sc-rpt-info">
          <div class="sc-rpt-name">${p.name}</div>
          <div class="sc-rpt-var">${fmtVariant(v)}</div>
        </div>
        <div class="sc-rpt-nums">
          <div style="display:flex;align-items:center;gap:5px;justify-content:flex-end">
            <span style="font-size:11px;color:var(--muted)">${currentStock}</span>
            <span style="font-size:10px;color:var(--muted)">→</span>
            <span class="sc-rpt-new" style="color:${diff===0?'var(--green)':'var(--ink)'}">${counted}</span>
          </div>
          <div><span class="sc-rpt-diff" style="background:${diffBg};color:${diffColor}">${diffStr}</span></div>
        </div>
      </div>`;
    }).join('');
  }).join('');

  const renderSection = (sid, prods) => {
    const html = renderGroup(prods);
    if(!html) return '';
    const title = sid ? (shipments.find(s=>s.id===sid)?.name||'Unknown Shipment') : 'No Shipment';
    return `<div style="margin-bottom:16px">
      <div class="sc-rpt-ship-hd">${title}</div>
      <div style="background:var(--white);border-radius:12px;padding:0 14px;box-shadow:var(--shadow)">${html}</div>
    </div>`;
  };

  const shipHtml = Object.keys(shipGroups).map(sid=>renderSection(sid, shipGroups[sid])).join('');
  const noShipHtml = noShip.length ? renderSection(null, noShip) : '';
  const skippedHtml = totalSkipped > 0
    ? `<div class="sc-rpt-skipped">⚠️ ${totalSkipped} product${totalSkipped>1?'s':''} not counted</div>`
    : '';

  document.getElementById('inv-report-body').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:18px">
      <div style="flex:1;background:var(--blush);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--ink)">${totalLogged}</div>
        <div style="font-size:10px;color:var(--muted)">entries</div>
      </div>
      <div style="flex:1;background:var(--green-soft);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--green)">${totalMatch}</div>
        <div style="font-size:10px;color:var(--muted)">matched ✓</div>
      </div>
      <div style="flex:1;background:var(--red-soft);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--red)">${totalDiff}</div>
        <div style="font-size:10px;color:var(--muted)">different</div>
      </div>
    </div>
    ${shipHtml}${noShipHtml}${skippedHtml}`;
}

function scApplyAndSave(){
  if(!invSession) return;
  // Apply counts to actual product stock
  products.forEach(p=>{
    p.variants.forEach(v=>{
      const raVal = invSession.counts[p.id+'-'+v.id+'-ra'];
      const flVal = invSession.counts[p.id+'-'+v.id+'-flora'];
      // For replace-mode locked products use the count; for add-mode (not locked) add on top
      const isLocked = invSession.locked && invSession.locked[p.id];
      if(raVal !== undefined){
        v.ra = isLocked ? raVal : v.ra + raVal;
      }
      if(flVal !== undefined){
        v.flora = isLocked ? flVal : v.flora + flVal;
      }
    });
  });
  saveProducts();
  // Save to history
  const hist = getInvHistory();
  const snap = {};
  products.forEach(p=>p.variants.forEach(v=>{
    snap[p.id+'-'+v.id+'-ra'] = v.ra;
    snap[p.id+'-'+v.id+'-flora'] = v.flora;
  }));
  hist.push({
    num: invSession.num,
    label: invSession.label,
    date: invSession.date,
    counts: {...invSession.counts},
    locked: {...(invSession.locked||{})},
    snapshot: snap
  });
  saveInvHistory(hist);
  invSession = null;
  localStorage.removeItem('invSession');
  _scSearch = '';
  _scTabFilter = 'all';
  closeModal('m-inv-report');
  renderCount();
  renderInventory();
  initDashboard();
  showToast('✅ Count applied & saved to history!');
}

function confirmDiscardSession(){
  appConfirm('Discard Count', 'All logged data will be lost. Are you sure?', '🗑️ Discard', ()=>{
    invSession = null;
    localStorage.removeItem('invSession');
    _scSearch = '';
    _scTabFilter = 'all';
    _scSelectMode = false;
    _scSelected.clear();
    renderCount();
    showToast('Count discarded');
  });
}

// ── Count session select mode ──
function scEnterSelectMode(){
  _scSelectMode = true;
  _scSelected.clear();
  renderCount();
}

function scExitSelectMode(){
  _scSelectMode = false;
  _scSelected.clear();
  renderCount();
}

function scToggleSelectCount(pid){
  if(_scSelected.has(pid)) _scSelected.delete(pid);
  else _scSelected.add(pid);
  renderCount();
}

function scSelectAll(){
  if(!invSession) return;
  const loggedPids = products
    .filter(p=>p.variants.some(v=>
      invSession.counts[p.id+'-'+v.id+'-ra']!==undefined ||
      invSession.counts[p.id+'-'+v.id+'-flora']!==undefined
    ))
    .map(p=>p.id);
  if(loggedPids.every(pid=>_scSelected.has(pid))){
    _scSelected.clear();
  } else {
    loggedPids.forEach(pid=>_scSelected.add(pid));
  }
  renderCount();
}

function scDeleteSelected(){
  if(!invSession || _scSelected.size===0) return;
  const n = _scSelected.size;
  appConfirm('Delete Logged Entries', `Remove ${n} product${n>1?'s':''} from this count? Their quantities stay as they are.`, '🗑️ Delete', ()=>{
    _scSelected.forEach(pid=>{
      const p = products.find(x=>x.id===pid);
      if(!p) return;
      p.variants.forEach(v=>{
        delete invSession.counts[p.id+'-'+v.id+'-ra'];
        delete invSession.counts[p.id+'-'+v.id+'-flora'];
      });
      if(invSession.locked) delete invSession.locked[pid];
    });
    saveInvSession();
    _scSelected.clear();
    _scSelectMode = false;
    renderCount();
    showToast(`Removed ${n} entr${n>1?'ies':'y'} from count`);
  });
}

// ── Long press to enter select mode on logged rows ──
let _scLpTimer = null;
function scLpStart(pid, isLogged){
  if(!isLogged) return;
  _scLpTimer = setTimeout(()=>{
    if(!_scSelectMode){ _scSelectMode = true; _scSelected.clear(); }
    _scSelected.add(pid);
    renderCount();
  }, 500);
}
function scLpEnd(){ clearTimeout(_scLpTimer); _scLpTimer = null; }

function renderInvHistory(){
  const hc = document.getElementById('inv-history-container');
  if(!hc) return;
  const hist = getInvHistory();
  if(!hist.length){ hc.innerHTML=''; return; }

  hc.innerHTML = `<div class="sess-hist-section">
    <div class="sess-hist-title">
      <span>📋 Past Counts</span>
    </div>
    <div class="sc-prod-list">
      ${hist.slice().reverse().map((s,ri)=>{
        const i = hist.length-1-ri;
        const d = new Date(s.date).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'});
        const t = new Date(s.date).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
        const varCount = Object.keys(s.counts).filter(k=>k.endsWith('-ra')).length;
        const diffs = countDiffs(s);
        const diffBadge = diffs > 0
          ? `<span class="sc-hist-badge" style="background:var(--red-soft);color:var(--red)">${diffs} diff</span>`
          : `<span class="sc-hist-badge" style="background:var(--green-soft);color:var(--green)">All matched</span>`;
        return `<div class="sc-hist-row" style="flex-direction:column;align-items:stretch;gap:8px" onclick="showSessDetail(${i})">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="sc-hist-num">#${s.num}</div>
            <div class="sc-hist-info">
              <div class="sc-hist-name">${s.label}</div>
              <div class="sc-hist-sub">${d} · ${t} · ${varCount} items</div>
            </div>
            ${diffBadge}
          </div>
          <div style="display:flex;gap:8px;padding-left:38px">
            <button onclick="event.stopPropagation();editPastCount(${i})" style="background:var(--blue-soft);color:var(--blue);border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer">✏️ Edit</button>
            <button onclick="event.stopPropagation();deleteInvHistory(${i})" style="background:var(--grey);color:var(--muted);border:none;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer">🗑️</button>
            <span style="margin-left:auto;color:var(--muted);font-size:13px;align-self:center">View ›</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

let _sessDetailIdx = null;
let _sessDetailTab = 'all';

function showSessDetail(idx){
  _sessDetailIdx = idx;
  _sessDetailTab = 'all';
  _renderSessDetail();
}

function _renderSessDetail(){
  const idx = _sessDetailIdx;
  const hist = getInvHistory();
  const s = hist[idx];
  if(!s) return;
  const d = new Date(s.date).toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  const t = new Date(s.date).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
  document.getElementById('sess-detail-title').textContent = s.label;
  document.getElementById('sess-detail-sub').textContent = '📅 '+d+' · '+t;

  // Build shipment groups from counted products
  const shipGroups = {};
  const noShip = [];
  products.forEach(p=>{
    const has = p.variants.some(v=>s.counts[p.id+'-'+v.id+'-ra']!==undefined || s.counts[p.id+'-'+v.id+'-flora']!==undefined);
    if(!has) return;
    if(p.shipmentId){ if(!shipGroups[p.shipmentId]) shipGroups[p.shipmentId]=[]; shipGroups[p.shipmentId].push(p); }
    else noShip.push(p);
  });

  // Tabs
  const allShipIds = Object.keys(shipGroups);
  const tabsEl = document.getElementById('sess-detail-tabs');
  const tabList = [{id:'all',label:'🗂 All'}];
  allShipIds.forEach(sid=>{ const ship=shipments.find(x=>x.id===sid); tabList.push({id:sid,label:'📦 '+(ship?.name||'Shipment')}); });
  if(noShip.length) tabList.push({id:'_none',label:'📌 Other'});
  tabsEl.innerHTML = tabList.map(tab=>`<div onclick="setSessDetailTab('${tab.id}')" style="padding:7px 14px;border-radius:50px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all 0.15s;${_sessDetailTab===tab.id?'background:var(--rose);color:white':'background:var(--grey);color:var(--ink-light)'}">${tab.label}</div>`).join('');

  // Filter
  let filteredGroups={}, filteredNoShip=[];
  if(_sessDetailTab==='all'){ filteredGroups={...shipGroups}; filteredNoShip=[...noShip]; }
  else if(_sessDetailTab==='_none'){ filteredNoShip=[...noShip]; }
  else { if(shipGroups[_sessDetailTab]) filteredGroups[_sessDetailTab]=shipGroups[_sessDetailTab]; }

  // Visible variants
  const allVisibleVars=[];
  Object.values(filteredGroups).forEach(prods=>prods.forEach(p=>p.variants.filter(v=>s.counts[p.id+'-'+v.id+'-ra']!==undefined||s.counts[p.id+'-'+v.id+'-flora']!==undefined).forEach(v=>allVisibleVars.push({p,v}))));
  filteredNoShip.forEach(p=>p.variants.filter(v=>s.counts[p.id+'-'+v.id+'-ra']!==undefined||s.counts[p.id+'-'+v.id+'-flora']!==undefined).forEach(v=>allVisibleVars.push({p,v})));

  const snap=s.snapshot||{};

  // ── BUSINESS INTELLIGENCE ──
  // Products visible in current filter
  const visiblePids = [...new Set(allVisibleVars.map(({p})=>p.id))];
  const visibleProds = products.filter(p=>visiblePids.includes(p.id));

  // Invoices containing these products (exclude cancelled)
  const relInvs = (invoices||[]).filter(inv=>inv.status!=='cancelled'&&inv.items&&inv.items.some(it=>visiblePids.includes(it.productId)));

  // Revenue by product
  const prodRevMap={};
  const prodQtyMap={};
  relInvs.forEach(inv=>{
    (inv.items||[]).filter(it=>visiblePids.includes(it.productId)).forEach(it=>{
      prodRevMap[it.productId]=(prodRevMap[it.productId]||0)+(it.total||0);
      prodQtyMap[it.productId]=(prodQtyMap[it.productId]||0)+(it.qty||0);
    });
  });

  // Revenue by month
  const monthMap={};
  relInvs.forEach(inv=>{
    if(!inv.date) return;
    const mo=inv.date.slice(0,7);
    const rev=(inv.items||[]).filter(it=>visiblePids.includes(it.productId)).reduce((s,it)=>s+(it.total||0),0);
    monthMap[mo]=(monthMap[mo]||0)+rev;
  });
  const monthEntries=Object.entries(monthMap).sort((a,b)=>b[1]-a[1]);
  const bestMonth=monthEntries[0];
  const bestMonthLabel=bestMonth?new Date(bestMonth[0]+'-15').toLocaleDateString('en',{month:'long',year:'numeric'}):null;

  // Total revenue
  const totalRev=Object.values(prodRevMap).reduce((s,v)=>s+v,0);

  // Shipment cost (only meaningful for single shipment tab)
  const focusSid = (_sessDetailTab!=='all'&&_sessDetailTab!=='_none') ? _sessDetailTab : null;
  const focusShip = focusSid ? shipments.find(x=>x.id===focusSid) : null;
  const shipCost = focusShip?.cost||0;
  const roi = shipCost>0 ? ((totalRev-shipCost)/shipCost*100) : null;

  // Top products by qty sold
  const topProds = Object.entries(prodQtyMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([pid,qty])=>{
    const p=products.find(x=>x.id===pid)||{};
    return {name:p.name||pid,emoji:p.emoji||'📦',qty,rev:prodRevMap[pid]||0};
  });

  // Sell-through: (expected - counted) / expected
  const totExp=allVisibleVars.reduce((sum,{p,v})=>sum+(snap[p.id+'-'+v.id+'-ra']??v.ra)+(snap[p.id+'-'+v.id+'-flora']??v.flora),0);
  const totCnt=allVisibleVars.reduce((sum,{p,v})=>sum+(s.counts[p.id+'-'+v.id+'-ra']??0)+(s.counts[p.id+'-'+v.id+'-flora']??0),0);
  const sold=Math.max(0,totExp-totCnt);
  const sellThrough=totExp>0?Math.round(sold/totExp*100):0;

  // Accuracy
  const diffCount=allVisibleVars.filter(({p,v})=>{
    const cnt=(s.counts[p.id+'-'+v.id+'-ra']??0)+(s.counts[p.id+'-'+v.id+'-flora']??0);
    const exp=(snap[p.id+'-'+v.id+'-ra']??v.ra)+(snap[p.id+'-'+v.id+'-flora']??v.flora);
    return cnt!==exp;
  }).length;
  const accuracy=allVisibleVars.length?Math.round((allVisibleVars.length-diffCount)/allVisibleVars.length*100):100;
  const accColor=accuracy>=90?'var(--green)':accuracy>=70?'var(--amber)':'var(--red)';

  // Health verdict
  const isGood = sellThrough>=50 && accuracy>=80 && (roi===null||roi>=0);
  const verdict = isGood
    ? {emoji:'🎉',text:'This shipment went well!',color:'var(--green)',bg:'var(--green-soft)'}
    : sellThrough>=30
    ? {emoji:'📈',text:'Decent performance — room to grow',color:'var(--amber)',bg:'var(--amber-soft)'}
    : {emoji:'⚠️',text:'Low sell-through — review pricing',color:'var(--red)',bg:'var(--red-soft)'};

  // Monthly mini-bars
  const maxMonthRev=monthEntries.length?monthEntries[0][1]:1;
  const monthBars=monthEntries.slice(0,6).map(([mo,rev])=>{
    const lbl=new Date(mo+'-15').toLocaleDateString('en',{month:'short'});
    const pct=Math.round(rev/maxMonthRev*100);
    const isBest=mo===bestMonth?.[0];
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
      <div style="font-size:10px;font-weight:700;color:${isBest?'var(--rose)':'var(--muted)'}">$${rev>=1000?(rev/1000).toFixed(1)+'k':rev.toFixed(0)}</div>
      <div style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:50px">
        <div style="width:80%;border-radius:4px 4px 0 0;background:${isBest?'var(--rose)':'var(--grey2)'};height:${pct}%;min-height:4px;transition:height 0.4s"></div>
      </div>
      <div style="font-size:9px;color:var(--muted);font-weight:600">${lbl}</div>
    </div>`;
  }).join('');

  // Top products list
  const topProdsHtml=topProds.map((p,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;${i<topProds.length-1?'border-bottom:1px solid var(--grey2)':''}">
      <div style="width:22px;height:22px;border-radius:50%;background:var(--rose-soft);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</div>
      <div style="font-size:12px;flex:1;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.emoji} ${p.name}</div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:var(--ink)">${p.qty} sold</div>
        <div style="font-size:10px;color:var(--green)">$${p.rev.toFixed(0)}</div>
      </div>
    </div>`).join('');

  // Stats grid
  const statsGrid=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="background:var(--grey);border-radius:10px;padding:10px">
        <div style="font-size:18px;font-weight:800;color:var(--green)">$${totalRev.toFixed(0)}</div>
        <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Total Revenue</div>
      </div>
      <div style="background:var(--grey);border-radius:10px;padding:10px">
        <div style="font-size:18px;font-weight:800;color:var(--rose)">${sellThrough}%</div>
        <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Sell-Through</div>
      </div>
      <div style="background:var(--grey);border-radius:10px;padding:10px">
        <div style="font-size:18px;font-weight:800;color:${accColor}">${accuracy}%</div>
        <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Count Accuracy</div>
      </div>
      ${roi!==null?`<div style="background:var(--grey);border-radius:10px;padding:10px">
        <div style="font-size:18px;font-weight:800;color:${roi>=0?'var(--green)':'var(--red)'}">${roi>=0?'+':''}${roi.toFixed(0)}%</div>
        <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">ROI</div>
      </div>`:`<div style="background:var(--grey);border-radius:10px;padding:10px">
        <div style="font-size:18px;font-weight:800;color:var(--ink)">${sold}</div>
        <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Units Sold</div>
      </div>`}
    </div>`;

  // WhatsApp message builder
  const waLines=[
    '📦 *Shipment Report: '+(focusShip?.name||s.label)+'*',
    '📅 Count: '+d,
    '━━━━━━━━━━━━━━',
    '💰 Revenue: $'+totalRev.toFixed(0),
    '📊 Sell-Through: '+sellThrough+'%',
    '🎯 Count Accuracy: '+accuracy+'%',
    roi!==null?'📈 ROI: '+(roi>=0?'+':'')+roi.toFixed(0)+'%':'',
    bestMonth?'🏆 Best Month: '+bestMonthLabel+' ($'+bestMonth[1].toFixed(0)+')':'',
    '━━━━━━━━━━━━━━',
    topProds.length?'🔥 Top Products:':'',
    ...topProds.slice(0,3).map((p,i)=>(i===0?'🥇':i===1?'🥈':'🥉')+' '+p.name+' — '+p.qty+' sold ($'+p.rev.toFixed(0)+')'),
    '━━━━━━━━━━━━━━',
    verdict.emoji+' '+verdict.text,
  ].filter(Boolean).join('\n');

  document.getElementById('sess-detail-chart').innerHTML = `
    <div style="background:${verdict.bg};border-radius:14px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
      <span style="font-size:24px">${verdict.emoji}</span>
      <div>
        <div style="font-size:14px;font-weight:700;color:${verdict.color}">${verdict.text}</div>
        ${focusShip?`<div style="font-size:11px;color:var(--ink-light);margin-top:2px">📦 ${focusShip.name}${focusShip.num?' · '+focusShip.num:''}</div>`:''}
      </div>
    </div>
    <div style="background:var(--white);border-radius:14px;padding:14px;box-shadow:var(--shadow);border:1px solid rgba(232,116,138,0.07);margin-bottom:12px">
      ${statsGrid}
      ${bestMonth?`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">📅 Monthly Revenue</div>
      <div style="display:flex;gap:4px;align-items:flex-end;margin-bottom:4px">${monthBars}</div>
      <div style="font-size:10px;color:var(--muted);text-align:center">🏆 Best: ${bestMonthLabel} · $${bestMonth[1].toFixed(0)}</div>`:'<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0">No sales data yet for these products</div>'}
    </div>
    ${topProds.length?`<div style="background:var(--white);border-radius:14px;padding:14px;box-shadow:var(--shadow);border:1px solid rgba(232,116,138,0.07);margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">🔥 Most In-Demand Products</div>
      ${topProdsHtml}
    </div>`:''}
    <div style="background:var(--white);border-radius:14px;padding:14px;box-shadow:var(--shadow);border:1px solid rgba(232,116,138,0.07);margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">📊 Count Breakdown</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div style="text-align:center;background:var(--grey);border-radius:10px;padding:10px 6px">
          <div style="font-size:18px;font-weight:800;color:var(--ink)">${totCnt}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Counted</div>
        </div>
        <div style="text-align:center;background:var(--grey);border-radius:10px;padding:10px 6px">
          <div style="font-size:18px;font-weight:800;color:${diffCount>0?'var(--red)':'var(--green)'}">${diffCount}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Diffs</div>
        </div>
        <div style="text-align:center;background:var(--grey);border-radius:10px;padding:10px 6px">
          <div style="font-size:18px;font-weight:800;color:${accColor}">${accuracy}%</div>
          <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Accuracy</div>
        </div>
      </div>
    </div>
    <button onclick="shareShipmentWA(${JSON.stringify(waLines).replace(/"/g,'&quot;')})" style="width:100%;background:#25D366;color:white;border:none;border-radius:50px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Share on WhatsApp
    </button>`;

  // ── PRODUCT LIST ──
  const renderVariant=(p,v)=>{
    const counted=(s.counts[p.id+'-'+v.id+'-ra']??0)+(s.counts[p.id+'-'+v.id+'-flora']??0);
    const expected=(snap[p.id+'-'+v.id+'-ra']??v.ra)+(snap[p.id+'-'+v.id+'-flora']??v.flora);
    const diff=counted-expected;
    const diffColor=diff===0?'var(--green)':diff>0?'var(--blue)':'var(--red)';
    const diffStr=diff===0?'✓':(diff>0?'+'+diff:''+diff);
    const diffBg=diff===0?'var(--green-soft)':diff>0?'var(--blue-soft)':'var(--red-soft)';
    const thumb=p.photo?`<div class="sc-rpt-thumb"><img src="${p.photo}"></div>`:`<div class="sc-rpt-thumb">${p.emoji}</div>`;
    return `<div class="sc-rpt-row">${thumb}<div class="sc-rpt-info"><div class="sc-rpt-name">${p.name}</div><div class="sc-rpt-var">${fmtVariant(v)}</div></div><div class="sc-rpt-nums"><div style="display:flex;align-items:center;gap:5px;justify-content:flex-end"><span style="font-size:11px;color:var(--muted)">${expected}</span><span style="font-size:10px;color:var(--muted)">→</span><span class="sc-rpt-new" style="color:${diff===0?'var(--green)':'var(--ink)'}">${counted}</span></div><div><span class="sc-rpt-diff" style="background:${diffBg};color:${diffColor}">${diffStr}</span></div></div></div>`;
  };
  const renderGroup=prods=>prods.map(p=>p.variants.filter(v=>s.counts[p.id+'-'+v.id+'-ra']!==undefined||s.counts[p.id+'-'+v.id+'-flora']!==undefined).map(v=>renderVariant(p,v)).join('')).join('');
  const renderSection=(sid,prods)=>{
    const html=renderGroup(prods); if(!html) return '';
    const title=sid?(shipments.find(x=>x.id===sid)?.name||'Unknown'):'Other';
    return `<div style="margin-bottom:14px"><div class="sc-rpt-ship-hd">${title}</div><div style="background:var(--white);border-radius:12px;padding:0 14px;box-shadow:var(--shadow)">${html}</div></div>`;
  };
  const shipHtml=Object.keys(filteredGroups).map(sid=>renderSection(sid,filteredGroups[sid])).join('');
  const noShipHtml=filteredNoShip.length?renderSection(null,filteredNoShip):'';
  document.getElementById('sess-detail-body').innerHTML=shipHtml+noShipHtml;

  showModal('m-sess-detail');
}

// shareShipmentWA → js/shipments.js

function setSessDetailTab(tabId){
  _sessDetailTab = tabId;
  _renderSessDetail();
}

function editPastCount(idx){
  if(invSession){
    appConfirm('Replace Active Count','You have an active count session. Loading this past count will discard unsaved changes. Continue?','⚠️ Replace',()=>_doEditPastCount(idx));
  } else { _doEditPastCount(idx); }
}

function _doEditPastCount(idx){
  const hist = getInvHistory();
  const s = hist[idx];
  if(!s) return;
  // Restore as active session
  invSession = {
    id: s.id||('edit-'+Date.now()),
    num: s.num,
    label: s.label + ' (edited)',
    date: s.date,
    counts: {...s.counts},
    locked: {...(s.locked||{})},
    _editIdx: idx
  };
  saveInvSession();
  // Remove from history so it doesn't duplicate; will re-save on finish
  hist.splice(idx,1);
  saveInvHistory(hist);
  showToast('Count loaded for editing ✓');
  closeModal('m-sess-detail');
  showPage('products');
  renderCount();
}

function deleteInvHistory(idx){
  appConfirm('Delete Count', 'Remove this count from history?', '🗑️ Delete', ()=>{
    const hist = getInvHistory();
    hist.splice(idx,1);
    saveInvHistory(hist);
    renderInvHistory();
    showToast('Count deleted');
  });
}

function countDiffs(sess){
  let c=0;
  products.forEach(p=>p.variants.forEach(v=>{
    const ra = sess.counts[p.id+'-'+v.id+'-ra'];
    const snap = sess.snapshot||{};
    const snapRa = snap[p.id+'-'+v.id+'-ra']??v.ra;
    if(ra!==undefined && ra!==snapRa) c++;
  }));
  return c;
}

function openStartSessionModal(){
  populateSessShipSelect();
  document.getElementById('sess-shipment-name').value = '';
  const sel = document.getElementById('sess-ship-select');
  if(sel) sel.value = '';
  // Pre-fill with today's date as default name
  const today = new Date().toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric'});
  document.getElementById('sess-shipment-name').placeholder = 'Count — ' + today;
  showModal('m-start-session');
}

function confirmStartSession(){
  const inp = document.getElementById('sess-shipment-name');
  const name = inp.value.trim() || inp.placeholder || '';
  const linkedShipId = document.getElementById('sess-ship-select').value;
  const finalName = name || (linkedShipId ? shipments.find(x=>x.id===linkedShipId)?.name : '');
  if(!finalName){ showToast('Enter a name for this count','err'); return; }
  const hist = getInvHistory();
  invSession = {
    num: hist.length ? Math.max(...hist.map(h=>h.num||0)) + 1 : 1,
    label: finalName,
    linkedShipId: linkedShipId||'',
    date: new Date().toISOString(),
    counts: {},
    locked: {}
  };
  saveInvSession();
  _scSearch = '';
  _scTabFilter = linkedShipId || 'all';
  closeModal('m-start-session');
  renderCount();
  showToast('🔢 ' + finalName + ' — start counting!');
}

// ═══════════════════════════════════════════════════

function showQR(pid){
  const p=products.find(x=>x.id===pid);
  if(!p) return;
  _qrCurrentPid = pid;
  document.getElementById('qr-modal-title').textContent = p.emoji+' '+p.name;

  if(p.barcode){
    document.getElementById('qr-state-generate').style.display='none';
    document.getElementById('qr-state-barcode').style.display='block';
    document.getElementById('qr-barcode-display').textContent = p.barcode;
  } else {
    document.getElementById('qr-state-generate').style.display='block';
    document.getElementById('qr-state-barcode').style.display='none';
    // Reset to pre-generate state
    document.getElementById('qr-pre-generate').style.display='block';
    document.getElementById('qr-post-generate').style.display='none';
    document.getElementById('qr-canvas-wrap').innerHTML='';
  }
  showModal('m-qr');
}

let _qrCurrentPid = null;

function generateQRLabel(){
  const p = products.find(x=>x.id===_qrCurrentPid);
  if(!p) return;
  const sku='BLM-'+p.id.toUpperCase();
  const wrap=document.getElementById('qr-canvas-wrap');
  wrap.innerHTML='';
  document.getElementById('qr-sku-label').textContent=sku+' · '+p.name;
  new QRCode(wrap,{text:sku+'|'+p.name,width:200,height:200,colorDark:'#2c1a1f',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
  document.getElementById('qr-pre-generate').style.display='none';
  document.getElementById('qr-post-generate').style.display='block';
}

function printProductLabel(){
  const label = document.getElementById('qr-sku-label').textContent;
  const canvas = document.querySelector('#qr-canvas-wrap canvas');
  if(!canvas) return;
  const imgData = canvas.toDataURL('image/png');
  const w = window.open('','_blank','width=400,height=300');
  if(!w){ showToast('Allow popups to print label','err'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Label</title>
  <style>
    body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;font-family:monospace}
    .label{border:2px dashed #ccc;border-radius:12px;padding:20px 28px;text-align:center;display:inline-block}
    .label img{width:160px;height:160px;display:block;margin:0 auto 10px}
    .label .sku{font-size:13px;font-weight:700;letter-spacing:1px;color:#2c1a1f}
    @media print{body{margin:0}.label{border:none;padding:10px}}
  </style></head><body>
  <div class="label">
    <img src="${imgData}">
    <div class="sku">${label}</div>
  </div>
  <script>window.onload=()=>{window.print();}<\/script>

</body></html>`);
  w.document.close();
}

// ═══════════════════════════════════════════════════
// SCANNER
// ═══════════════════════════════════════════════════
function startScan(mode){
  scanMode=mode;
  const label = (mode==='np-barcode-fill'||mode==='ep-barcode-fill') ? 'Scan Product Barcode' : mode==='add' ? 'Scan to Add Product' : mode==='import' ? 'Scan to Import Product' : (mode==='inv-add'||mode==='inv-add-flora') ? 'Scan to Add to Invoice' : 'Scan to Update Stock';
  document.getElementById('scan-mode-label').textContent=label;
  document.getElementById('scan-overlay').classList.add('active');
  document.getElementById('scan-status').textContent='Starting camera...';
  document.getElementById('scan-manual-form').style.display='none';
  startCamera();
}

async function startCamera(){
  stopCamera(); // stop any existing stream first
  try {
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    currentScanStream=stream;
    const vid=document.getElementById('scan-video');
    vid.srcObject=stream;
    vid.play();
    document.getElementById('scan-status').textContent='Ready — point at barcode or QR';
    startBarcodeDetect();
  } catch(e){
    document.getElementById('scan-status').textContent='Camera unavailable';
    document.getElementById('scan-manual-form').style.display='flex';
  }
}

function startBarcodeDetect(){
  if('BarcodeDetector' in window){
    barcodeDetector=new BarcodeDetector({formats:['qr_code','ean_13','code_128']});
    scanFrame();
  } else {
    document.getElementById('scan-status').textContent='Auto-scan unavailable — use manual';
    document.getElementById('scan-manual-form').style.display='flex';
  }
}

function scanFrame(){
  if(!currentScanStream) return;
  const vid=document.getElementById('scan-video');
  if(vid.readyState===vid.HAVE_ENOUGH_DATA){
    barcodeDetector.detect(vid).then(codes=>{
      if(codes.length>0){
        handleScan(codes[0].rawValue);
        return;
      }
    }).catch(()=>{});
  }
  if(currentScanStream) setTimeout(scanFrame,300);
}

function handleScan(code){
  document.getElementById('scan-status').textContent='Found: '+code;
  stopCamera();

  // Barcode fill modes — just populate the input field, don't navigate
  if(scanMode==='np-barcode-fill'){
    setTimeout(()=>{
      document.getElementById('scan-overlay').classList.remove('active');
      const inp = document.getElementById('np-barcode');
      if(inp){ inp.value=code; showToast('Barcode captured ✅'); }
    },400);
    return;
  }
  if(scanMode==='ep-barcode-fill'){
    setTimeout(()=>{
      document.getElementById('scan-overlay').classList.remove('active');
      const inp = document.getElementById('ep-barcode');
      if(inp){ inp.value=code; showToast('Barcode captured ✅'); }
    },400);
    return;
  }

  // Stock update / invcount / import modes — find product by BLM QR, barcode field, or name
  const pid=code.split('|')[0].replace(/^BLM-/i,'').toLowerCase();
  const p=products.find(x=>
    x.id===pid ||
    x.id.toLowerCase()===pid ||
    x.name.toLowerCase()===code.toLowerCase() ||
    (x.barcode && x.barcode===code)
  );
  setTimeout(()=>{
    document.getElementById('scan-overlay').classList.remove('active');
    if(scanMode==='import'){
      if(p){
        showToast('Product found: '+p.emoji+' '+p.name);
        openEditProduct(p.id);
      } else {
        // Open the add form first, fill barcode immediately
        openAddProduct();
        setTimeout(()=>{ const inp=document.getElementById('np-barcode'); if(inp) inp.value=code; }, 200);
        // Then look up online
        showToast('🔍 Looking up product online…');
        lookupBarcode(code).then(result=>{
          if(result.found){
            if(result.name){
              const nameInp = document.getElementById('np-name');
              if(nameInp && !nameInp.value) nameInp.value = result.name;
            }
            if(result.image){
              // Load image as base64 to store it
              fetch(result.image)
                .then(r=>r.blob())
                .then(blob=>{
                  const reader = new FileReader();
                  reader.onload = e=>{
                    const src = e.target.result;
                    const imgEl = document.getElementById('np-photo-img');
                    const wrap  = document.getElementById('np-photo-wrap');
                    if(imgEl && wrap){ imgEl.src=src; wrap.style.display='block'; _npPhotoData=src; }
                  };
                  reader.readAsDataURL(blob);
                }).catch(()=>{});
            }
            showToast('✅ Product info found! Check & complete the form.');
          } else {
            showToast('⚠️ Product not found online — fill details manually.','err');
          }
        });
      }
      return;
    }
    if(scanMode==='inv-add'){
      if(p){
        _ppickStore = document.getElementById('inv-store')?.value || 'ra';
        showToast(p.emoji+' '+p.name+' added to invoice ✅');
        ppickAddItem(p.id, p.variants[0]?.id||'', true);
      } else {
        showToast('Product not found: '+code,'err');
      }
      return;
    }
    if(scanMode==='inv-add-flora'){
      if(p){
        showToast(p.emoji+' '+p.name+' added to order ✅');
        fpPickItem(p.id, p.variants[0]?.id||'');
      } else {
        showToast('Product not found: '+code,'err');
      }
      return;
    }
    if(p){
      showToast('Found: '+p.emoji+' '+p.name);
      if(scanMode==='invcount'){
        showPage('inventory'); setNav('more');
        invCountFilter = p.name.toLowerCase();
        renderCount();
        setTimeout(()=>{
          const inp = document.getElementById('inv-count-search-input');
          if(inp) inp.value = p.name;
        }, 100);
      } else {
        setTimeout(()=>openUpdateQty(p.id, p.variants[0]?.id||''), 250);
      }
    } else {
      showToast('Product not found: '+code,'err');
    }
  },400);
}

function stopScan(){
  stopCamera();
  document.getElementById('scan-overlay').classList.remove('active');
}

function stopCamera(){
  if(currentScanStream){ currentScanStream.getTracks().forEach(t=>t.stop()); currentScanStream=null; }
}

function toggleManualScan(){
  const f=document.getElementById('scan-manual-form');
  f.style.display=f.style.display==='flex'?'none':'flex';
}

function manualScanLookup(){
  const q=document.getElementById('scan-manual-inp').value.trim().toLowerCase();
  if(!q) return;
  const p=products.find(x=>x.id.toLowerCase().includes(q)||x.name.toLowerCase().includes(q)||x.variants.some(v=>v.id.toLowerCase().includes(q)||v.name.toLowerCase().includes(q)));
  if(p){ handleScan(p.name); }
  else { document.getElementById('scan-status').textContent='Not found: '+q; showToast('Product not found','err'); }
}

async function lookupBarcode(barcode){
  // Try Open Beauty Facts (cosmetics) first, then Open Food Facts as fallback
  const apis = [
    'https://world.openbeautyfacts.org/api/v0/product/'+barcode+'.json',
    'https://world.openfoodfacts.org/api/v0/product/'+barcode+'.json'
  ];
  for(const url of apis){
    try{
      const res = await fetch(url);
      const data = await res.json();
      if(data.status===1 && data.product){
        const pr = data.product;
        const name  = pr.product_name || pr.product_name_en || '';
        const brand = pr.brands || '';
        const image = pr.image_front_url || pr.image_url || '';
        const fullName = (brand && name && !name.toLowerCase().includes(brand.toLowerCase()))
          ? brand+' '+name : name;
        if(fullName || image) return { name: fullName.trim(), image, found: true };
      }
    } catch(e){}
  }
  return { found: false };
}

