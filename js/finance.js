// ═══════════════════════════════════════════════════
// FINANCE.JS — P&L, charts, finance page rendering
// ═══════════════════════════════════════════════════

function setFinCostBy(by){
  finCostBy = by;
  const etaBtn   = document.getElementById('fin-cost-eta-btn');
  const orderBtn = document.getElementById('fin-cost-order-btn');
  if(etaBtn){   etaBtn.style.background   = by==='eta'   ? 'var(--rose)' : 'transparent'; etaBtn.style.color   = by==='eta'   ? 'white' : 'var(--muted)'; }
  if(orderBtn){ orderBtn.style.background = by==='order' ? 'var(--rose)' : 'transparent'; orderBtn.style.color = by==='order' ? 'white' : 'var(--muted)'; }
  renderFinance();
}

function setFinPeriod(p, el){
  finPeriod = p;
  document.querySelectorAll('.fin-period').forEach(x=>x.classList.remove('sel'));
  el.classList.add('sel');
  const customRange = document.getElementById('fin-custom-range');
  if(customRange) customRange.style.display = p==='custom' ? 'block' : 'none';
  if(p==='custom'){
    // set defaults if empty
    const fromEl = document.getElementById('fin-date-from');
    const toEl = document.getElementById('fin-date-to');
    if(fromEl && !fromEl.value){
      const d = new Date(); d.setDate(1);
      fromEl.value = d.toISOString().slice(0,10);
    }
    if(toEl && !toEl.value) toEl.value = new Date().toISOString().slice(0,10);
    finCustomFrom = document.getElementById('fin-date-from')?.value||'';
    finCustomTo   = document.getElementById('fin-date-to')?.value||'';
  }
  renderFinance();
}
function setFinTab(tab){
  ['products','shipments','insights'].forEach(t=>{
    const el = document.getElementById('fin-tab-'+t);
    const btn = document.getElementById('fst-'+t);
    if(el) el.style.display = t===tab ? 'block' : 'none';
    if(btn){ btn.classList.toggle('active', t===tab); }
  });
}

function setFinStore(s, el){
  finStore = s;
  document.querySelectorAll('#fin-tabs .tab').forEach(x=>x.classList.remove('active'));
  el.classList.add('active');
  renderFinance();
}
function finInPeriod(dateStr, tsMs){
  if(finPeriod === 'all') return true;
  const now = new Date();
  let d = dateStr ? new Date(dateStr+'T12:00:00') : tsMs ? new Date(tsMs) : null;
  if(!d || isNaN(d)) return finPeriod === 'all';
  if(finPeriod === 'month') return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
  if(finPeriod === 'year')  return d.getFullYear()===now.getFullYear();
  if(finPeriod === 'custom'){
    const from = finCustomFrom ? new Date(finCustomFrom+'T00:00:00') : null;
    const to   = finCustomTo   ? new Date(finCustomTo+'T23:59:59')   : null;
    if(from && d < from) return false;
    if(to   && d > to)   return false;
    return true;
  }
  return true;
}
function toggleFinShip(sid){
  if(_finOpen.has(sid)) _finOpen.delete(sid); else _finOpen.add(sid);
  const body = document.getElementById('fsb-'+sid);
  const chev = document.getElementById('fsc-'+sid);
  if(body){ body.style.display = _finOpen.has(sid) ? 'block' : 'none'; }
  if(chev){ chev.style.transform = _finOpen.has(sid) ? 'rotate(90deg)' : 'rotate(0deg)'; }
}

function getShipPreBlossom(sid){
  // Returns manually entered pre-Blossom collected amount for a shipment
  try { return parseFloat(JSON.parse(localStorage.getItem('biz_preblossom')||'{}')[sid]||0)||0; } catch(e){ return 0; }
}
function setShipPreBlossom(sid, val){
  try {
    const d = JSON.parse(localStorage.getItem('biz_preblossom')||'{}');
    d[sid] = parseFloat(val)||0;
    localStorage.setItem('biz_preblossom', JSON.stringify(d));
  } catch(e){}
}
function getShipManualRecovered(sid){
  try { return JSON.parse(localStorage.getItem('biz_manualrecovered')||'{}')[sid]===true; } catch(e){ return false; }
}
function setShipManualRecovered(sid, val){
  try {
    const d = JSON.parse(localStorage.getItem('biz_manualrecovered')||'{}');
    d[sid] = val;
    localStorage.setItem('biz_manualrecovered', JSON.stringify(d));
  } catch(e){}
}

function calcShipPL(s){
  const fmtD = n => '$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const shipProds = products.filter(p => p.shipmentId === s.id);
  const prodIds   = new Set(shipProds.map(p=>p.id));
  const cost      = s.cost || 0;
  const preBlossom = getShipPreBlossom(s.id);
  const manualRecovered = getShipManualRecovered(s.id);

  // From invoices in system
  let collectedSystem = 0, outstanding = 0, totalInvoiced = 0;
  const debtors = {};

  invoices.forEach(inv => {
    if(inv.status === 'cancelled') return;
    const relItems = (inv.items||[]).filter(it => prodIds.has(it.productId||it.pid));
    if(!relItems.length) return;
    const itemsTotal = relItems.reduce((s,it)=> s+(it.total||(it.qty||1)*(it.price||0)), 0);
    totalInvoiced += itemsTotal;
    if(inv.status === 'paid'){ collectedSystem += itemsTotal; }
    else if(inv.status === 'partial'){
      const frac = (inv.paidAmt||0)/(inv.total||1);
      collectedSystem += itemsTotal * frac;
      outstanding     += itemsTotal * (1-frac);
      const k = inv.customer||'Unknown';
      debtors[k] = (debtors[k]||0) + itemsTotal*(1-frac);
    } else if(inv.status === 'unpaid'||inv.status === 'shipped'){
      outstanding += itemsTotal;
      const k = inv.customer||'Unknown';
      debtors[k] = (debtors[k]||0) + itemsTotal;
    }
  });

  const collected    = collectedSystem + preBlossom;
  const isRecovered  = manualRecovered || collected >= cost;
  const recoveryPct  = cost > 0 ? Math.min(100, Math.round((collected/cost)*100)) : 100;

  // Unsold stock
  let unsoldUnits = 0, unsoldCostLocked = 0, unsoldPotential = 0;
  shipProds.forEach(p => {
    (p.variants||[]).forEach(v => {
      const qty = (v.ra||0)+(v.flora||0);
      if(qty <= 0) return;
      unsoldUnits      += qty;
      unsoldCostLocked += qty*(p.cost||0);
      const sp = (p.store==='flora')?(p.priceFlora||p.price||0):(p.priceRAPiece||p.price||0);
      unsoldPotential  += qty*sp;
    });
  });

  return { cost, preBlossom, collected, collectedSystem, outstanding, totalInvoiced,
           isRecovered, recoveryPct, unsoldUnits, unsoldCostLocked, unsoldPotential,
           debtors, fmtD, manualRecovered };
}

// ── Main shipment finance renderer ──
function _renderShipFinanceCard(s){
  const pl = calcShipPL(s);
  const { cost, preBlossom, collected, collectedSystem, outstanding, isRecovered,
          recoveryPct, unsoldUnits, unsoldCostLocked, unsoldPotential, debtors, fmtD, manualRecovered } = pl;

  const statusColor = isRecovered ? 'var(--green)' : recoveryPct>=60 ? 'var(--amber)' : 'var(--red)';
  const statusBg    = isRecovered ? 'var(--green-soft)' : recoveryPct>=60 ? 'var(--amber-soft)' : 'var(--red-soft)';
  const statusLabel = isRecovered ? '✅ Capital Recovered' : recoveryPct>=60 ? `⏳ ${recoveryPct}% Recovered` : `🔴 ${recoveryPct}% Recovered`;
  const isOpen = _finOpen.has(s.id);

  const debtorEntries = Object.entries(debtors);

  return `<div style="background:var(--white);border-radius:16px;margin-bottom:12px;box-shadow:var(--shadow);border:1.5px solid var(--grey2);overflow:hidden">

    <!-- Header -->
    <div onclick="toggleFinShip('${s.id}')" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name||s.num||'Shipment'}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${s.eta?'📅 ETA '+s.eta+' · ':''}💰 Cost ${fmtD(cost)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span style="background:${statusBg};color:${statusColor};border-radius:50px;padding:3px 10px;font-size:10px;font-weight:700;white-space:nowrap">${statusLabel}</span>
      </div>
      <div id="fsc-${s.id}" style="font-size:18px;color:var(--muted);transition:transform 0.2s;flex-shrink:0;transform:${isOpen?'rotate(90deg)':'rotate(0deg)'}">›</div>
    </div>

    <!-- Recovery bar -->
    <div style="padding:0 16px 14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:11px;color:var(--muted)">Capital recovery</span>
        <span style="font-size:11px;font-weight:700;color:${statusColor}">${fmtD(collected)} / ${fmtD(cost)}</span>
      </div>
      <div style="height:8px;background:var(--grey);border-radius:8px;overflow:hidden">
        <div style="height:100%;width:${recoveryPct}%;background:${statusColor};border-radius:8px;transition:width 0.5s"></div>
      </div>
    </div>

    <!-- Expanded body -->
    <div id="fsb-${s.id}" style="display:${isOpen?'block':'none'};border-top:1px solid var(--grey2)">

      <!-- Summary rows -->
      <div style="padding:14px 16px;display:flex;flex-direction:column;gap:0">
        <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--grey2)">
          <span style="font-size:13px;color:var(--muted)">💰 Shipment cost</span>
          <span style="font-size:13px;font-weight:700;color:var(--ink)">${fmtD(cost)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--grey2)">
          <span style="font-size:13px;color:var(--muted)">✅ Collected (in app)</span>
          <span style="font-size:13px;font-weight:700;color:var(--green)">${fmtD(collectedSystem)}</span>
        </div>
        ${preBlossom>0?`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--grey2)">
          <span style="font-size:13px;color:var(--muted)">📋 Collected (before app)</span>
          <span style="font-size:13px;font-weight:700;color:var(--green)">${fmtD(preBlossom)}</span>
        </div>`:''}
        <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--grey2)">
          <span style="font-size:13px;color:var(--muted)">⏳ Outstanding</span>
          <span style="font-size:13px;font-weight:700;color:${outstanding>0?'var(--amber)':'var(--muted)'}">${fmtD(outstanding)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:9px 0">
          <span style="font-size:13px;font-weight:700;color:var(--ink)">= Total collected</span>
          <span style="font-size:14px;font-weight:800;color:${isRecovered?'var(--green)':'var(--ink)'}">${fmtD(collected)}</span>
        </div>
      </div>

      <!-- Unsold stock -->
      ${(()=>{
        if(unsoldUnits<=0) return '';
        const bg = isRecovered ? 'var(--green-soft)' : 'var(--rose-pale)';
        const titleColor = isRecovered ? 'var(--green)' : 'var(--ink)';
        const title = isRecovered ? '🎉 Remaining stock = pure profit!' : '📦 Unsold stock';
        const midLabel = isRecovered ? 'Pure profit' : 'Cost locked';
        const midColor = isRecovered ? 'var(--green)' : 'var(--red)';
        const midVal = fmtD(isRecovered ? unsoldPotential : unsoldCostLocked);
        return `<div style="margin:0 16px 14px;background:${bg};border-radius:12px;padding:12px">
          <div style="font-size:11px;font-weight:700;color:${titleColor};margin-bottom:8px">${title}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div style="background:white;border-radius:8px;padding:8px;text-align:center">
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:3px">Units</div>
              <div style="font-size:15px;font-weight:800;color:var(--ink)">${unsoldUnits}</div>
            </div>
            <div style="background:white;border-radius:8px;padding:8px;text-align:center">
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:3px">${midLabel}</div>
              <div style="font-size:15px;font-weight:800;color:${midColor}">${midVal}</div>
            </div>
            <div style="background:white;border-radius:8px;padding:8px;text-align:center">
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:3px">Potential</div>
              <div style="font-size:15px;font-weight:800;color:var(--blue,#5b8dee)">${fmtD(unsoldPotential)}</div>
            </div>
          </div>
        </div>`;
      })()}

      <!-- Who owes -->
      ${debtorEntries.length?`<div style="margin:0 16px 14px">
        <div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">⚠️ Outstanding from customers</div>
        ${debtorEntries.map(([n,a])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--grey2)"><span style="font-size:13px;color:var(--ink)">${n}</span><span style="font-size:13px;font-weight:700;color:var(--red)">${fmtD(a)}</span></div>`).join('')}
      </div>`:''}

      <!-- Pre-Blossom entry + Manual override -->
      <div style="margin:0 16px 14px;background:var(--grey);border-radius:12px;padding:12px">
        <div style="font-size:11px;font-weight:700;color:var(--ink);margin-bottom:10px">🕐 Pre-app adjustments</div>
        <div style="margin-bottom:10px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">How much did you collect BEFORE using Blossom?</div>
          <div style="display:flex;gap:8px">
            <input type="number" id="pre-blossom-${s.id}" value="${preBlossom||''}" placeholder="e.g. 250"
              style="flex:1;padding:9px 12px;border-radius:10px;border:1.5px solid var(--grey2);font-size:14px;font-weight:600;background:var(--white);color:var(--ink);font-family:inherit">
            <button onclick="savePreBlossom('${s.id}')" style="background:var(--rose);color:white;border:none;border-radius:10px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Save</button>
          </div>
        </div>
        ${!isRecovered||manualRecovered?`<div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:11px;color:var(--muted)">Override: mark as fully recovered</div>
          <button onclick="toggleManualRecovered('${s.id}',${manualRecovered})" style="background:${manualRecovered?'var(--green)':'var(--grey2)'};color:${manualRecovered?'white':'var(--muted)'};border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">
            ${manualRecovered?'✅ Recovered':'Mark recovered'}
          </button>
        </div>`:''}
      </div>

    </div>
  </div>`;
}

function savePreBlossom(sid){
  const inp = document.getElementById('pre-blossom-'+sid);
  if(!inp) return;
  setShipPreBlossom(sid, inp.value);
  showToast('Saved ✅');
  renderFinance();
}

function toggleManualRecovered(sid, current){
  setShipManualRecovered(sid, !current);
  renderFinance();
}

function getCapitalRecoveryStatus(){
  return shipments.filter(s=>s.status==='arrived').map(s=>{
    const pl = calcShipPL(s);
    return { ship:s, ...pl };
  });
}

function renderProfitPerShipment(){ /* merged into main shipment list */ }
function renderCapitalRecoveryBanner(){ /* merged into main shipment list */ }


// ═══════════════════════════════════════════════════
// FEATURE: BUNDLE POPULARITY
// ═══════════════════════════════════════════════════

function renderBundlePopularity(){
  const el = document.getElementById('fin-bundle-pop');
  if(!el) return;
  if(!bundles.length){ el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">No bundles yet</div>'; return; }

  // Count bundle appearances in Flora orders
  const countMap = {};
  bundles.forEach(b=>{ countMap[b.id]=0; });
  floraOrders.forEach(o=>{
    if(o.bundleId && countMap[o.bundleId]!==undefined) countMap[o.bundleId]++;
    // Also check order notes/items for bundle name
    (o.items||[]).forEach(it=>{
      const match = bundles.find(b=>b.name&&it.productName&&it.productName.toLowerCase().includes(b.name.toLowerCase()));
      if(match) countMap[match.id]=(countMap[match.id]||0)+0.5; // partial match
    });
  });

  const sorted = bundles.map(b=>({ b, count:Math.round(countMap[b.id]||0) }))
    .sort((a,b)=>b.count-a.count);
  const maxCount = Math.max(...sorted.map(x=>x.count), 1);

  el.innerHTML = sorted.map(({b, count}, i)=>{
    const medal = i===0&&count>0?'🥇':i===1&&count>0?'🥈':i===2&&count>0?'🥉':'';
    const pct = Math.round((count/maxCount)*100);
    const profit = (b.sellPrice||0) - ((b.cost||0)+(b.pkgCost||0));
    return `<div style="padding:10px 0;border-bottom:1px solid var(--grey2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-size:18px">${medal||b.emoji||'🎁'}</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--ink)">${b.name}</div>
            <div style="font-size:10px;color:var(--muted)">Profit per sale: <span style="color:var(--green);font-weight:700">$${profit.toFixed(2)}</span></div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:15px;font-weight:700;color:var(--rose)">${count}</div>
          <div style="font-size:9px;color:var(--muted)">orders</div>
        </div>
      </div>
      <div style="height:4px;background:var(--grey);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--rose-light),var(--rose));border-radius:4px;transition:width 0.4s"></div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// FEATURE: OCCASION CALENDAR 🌸
// ═══════════════════════════════════════════════════

const FLORA_OCCASIONS = [
  { name:"Valentine's Day",    emoji:'💕', month:2,  day:14 },
  { name:"Mother's Day",       emoji:'🌸', month:5,  day:11 }, // 2nd Sunday May approx
  { name:"International Women's Day", emoji:'👑', month:3, day:8 },
  { name:"Eid Al-Fitr",        emoji:'🌙', month:3,  day:31 }, // approximate
  { name:"Eid Al-Adha",        emoji:'🕌', month:6,  day:7  }, // approximate
  { name:"Christmas",          emoji:'🎄', month:12, day:25 },
  { name:"New Year's Eve",     emoji:'🎆', month:12, day:31 },
  { name:"New Year's Day",     emoji:'🎉', month:1,  day:1  },
  { name:"Lebanese Independence", emoji:'🇱🇧', month:11, day:22 },
  { name:"Baby Shower Season", emoji:'🍼', month:4,  day:1  },
];

function renderOccasionCalendar(){
  const el = document.getElementById('cal-occasions-section');
  if(!el) return;
  const today = new Date();
  const upcoming = FLORA_OCCASIONS.map(o=>{
    let date = new Date(today.getFullYear(), o.month-1, o.day);
    if(date < today) date = new Date(today.getFullYear()+1, o.month-1, o.day);
    const daysLeft = Math.ceil((date-today)/(1000*60*60*24));
    return { ...o, date, daysLeft };
  }).filter(o=>o.daysLeft<=60).sort((a,b)=>a.daysLeft-b.daysLeft);

  if(!upcoming.length){ el.innerHTML=''; return; }

  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#fdf2f8,#fce7f3);border-radius:18px;padding:16px;border:1.5px solid rgba(232,116,138,0.2)">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--rose);margin-bottom:12px">🌸 Upcoming Flora Occasions</div>
      ${upcoming.map(o=>{
        const urgent = o.daysLeft<=7;
        const soon   = o.daysLeft<=14;
        const color  = urgent?'var(--red)':soon?'var(--amber)':'var(--rose)';
        const bg     = urgent?'var(--red-soft)':soon?'var(--amber-soft)':'var(--rose-pale)';
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:white;border-radius:12px;margin-bottom:8px;border:1px solid rgba(232,116,138,0.1)">
          <div style="font-size:24px">${o.emoji}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:var(--ink)">${o.name}</div>
            <div style="font-size:11px;color:var(--muted)">${o.date.toLocaleDateString('en',{month:'long',day:'numeric'})}</div>
          </div>
          <div style="text-align:right">
            <div style="background:${bg};color:${color};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700">${o.daysLeft===0?'Today!':o.daysLeft===1?'Tomorrow!':o.daysLeft+' days'}</div>
            ${urgent?`<div style="font-size:9px;color:var(--red);margin-top:2px;text-align:center">Prepare now!</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════
// FEATURE: MORNING SALES SUMMARY
// ═══════════════════════════════════════════════════

function checkMorningSummary(){
  const lastShown = localStorage.getItem('biz_morning_summary_date');
  const today = new Date().toISOString().split('T')[0];
  const h = new Date().getHours();
  if(lastShown === today) return; // already shown today
  if(h < 7 || h > 12) return; // only show morning 7am-12pm

  // Calculate yesterday's sales
  const yesterday = new Date(Date.now()-86400000).toISOString().split('T')[0];
  const yInvoices = invoices.filter(i=>i.date===yesterday && i.status!=='cancelled');
  const yRevenue  = yInvoices.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0);
  const yOrders   = floraOrders.filter(o=>new Date(o.createdAt).toISOString().split('T')[0]===yesterday);

  // This month totals
  const now2 = new Date();
  const isThisMonth = d=>{ try{ const dt=new Date(d); return dt.getFullYear()===now2.getFullYear()&&dt.getMonth()===now2.getMonth(); }catch(e){ return false; } };
  const monthRev = invoices.filter(i=>(i.status==='paid'||i.status==='partial')&&isThisMonth(i.date)).reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0);
  const pendingInvCount = invoices.filter(i=>i.status==='unpaid'||i.status==='partial'||i.status==='shipped').length;
  const totalDebt = customers.reduce((s,c)=>s+(c.debt||0),0);

  // Only show if there's something interesting
  if(yRevenue===0 && yOrders.length===0 && pendingInvCount===0) return;

  localStorage.setItem('biz_morning_summary_date', today);

  const msg = document.createElement('div');
  msg.id = 'morning-summary';
  msg.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#1a1a2e,#16213e);padding:16px 18px 20px;animation:slideDown 0.4s ease';
  msg.innerHTML = `
    <style>@keyframes slideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}</style>
    <div style="display:flex;align-items:flex-start;justify-content:space-between">
      <div>
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">☀️ Good morning${(BIZ_DEFAULTS&&BIZ_DEFAULTS.ra&&BIZ_DEFAULTS.ra.owner)?', '+BIZ_DEFAULTS.ra.owner:''}!</div>
        <div style="color:white;font-size:13px;margin-bottom:8px">
          ${yRevenue>0?`<div style="margin-bottom:3px">💰 Yesterday: <span style="color:#4ade80;font-weight:700">$${yRevenue.toFixed(0)}</span> collected</div>`:''}
          ${yOrders.length>0?`<div style="margin-bottom:3px">🌸 ${yOrders.length} Flora order${yOrders.length>1?'s':''} yesterday</div>`:''}
          <div style="margin-bottom:3px">📊 This month: <span style="color:#60a5fa;font-weight:700">$${monthRev.toFixed(0)}</span></div>
          ${pendingInvCount>0?`<div style="color:#fbbf24">⏳ ${pendingInvCount} pending invoice${pendingInvCount>1?'s':''} · $${totalDebt.toFixed(0)} owed</div>`:''}
        </div>
      </div>
      <button onclick="document.getElementById('morning-summary').remove()" style="background:rgba(255,255,255,0.1);border:none;color:white;width:28px;height:28px;border-radius:50%;font-size:14px;cursor:pointer;flex-shrink:0">✕</button>
    </div>
    <div style="height:2px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:8px">
      <div style="height:100%;width:100%;background:linear-gradient(90deg,#4ade80,#60a5fa);border-radius:2px"></div>
    </div>`;
  document.body.appendChild(msg);
  setTimeout(()=>{ const m=document.getElementById('morning-summary'); if(m) m.remove(); }, 8000);
}

// ═══════════════════════════════════════════════════
// CAPITAL RECOVERY IN POTENTIAL PROFIT CARD
// ═══════════════════════════════════════════════════

function renderCapitalRecoveryBanner(){
  const card = document.getElementById('fin-potential-card');
  if(!card) return;
  const existing = document.getElementById('fin-cap-recovery');
  if(existing) existing.remove();

  const statuses = getCapitalRecoveryStatus();
  if(!statuses.length) return;
  const recovered = statuses.filter(s=>s.recovered);
  const notYet    = statuses.filter(s=>!s.recovered);

  if(!recovered.length) return;

  // Total pure profit potential from recovered shipments
  const totalPurePotRA  = recovered.reduce((s,r)=>s+r.potRA, 0);
  const totalPurePotSrc = recovered.reduce((s,r)=>s+r.potSrc, 0);

  const banner = document.createElement('div');
  banner.id = 'fin-cap-recovery';
  banner.style.cssText = 'background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);border-radius:12px;padding:10px 14px;margin-top:10px';
  banner.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:#4ade80;margin-bottom:4px">🎉 Capital Recovered on ${recovered.length} shipment${recovered.length>1?'s':''}!</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7)">Remaining stock = <span style="color:#4ade80;font-weight:700">pure profit</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
      <div style="background:rgba(255,255,255,0.06);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase">Sell at RA</div>
        <div style="font-size:14px;font-weight:700;color:#4ade80">+$${totalPurePotRA.toFixed(0)}</div>
      </div>
      <div style="background:rgba(255,255,255,0.06);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase">Clearance</div>
        <div style="font-size:14px;font-weight:700;color:#60a5fa">+$${totalPurePotSrc.toFixed(0)}</div>
      </div>
    </div>
    ${notYet.length>0?`<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:6px">${notYet.length} more shipment${notYet.length>1?'s':''} still recovering capital</div>`:''}
  `;
  card.appendChild(banner);
}

// ═══════════════════════════════════════════════════
// MAIN FINANCE RENDERER
// ═══════════════════════════════════════════════════
function renderFinance(){
  // Always ensure a tab is active
  const prodTab = document.getElementById('fin-tab-products');
  const shipTab = document.getElementById('fin-tab-shipments');
  const noTabActive = !prodTab || prodTab.style.display === 'none' && (!shipTab || shipTab.style.display === 'none');
  if(noTabActive || !prodTab) setFinTab('products');
  now = new Date();
  if(finPeriod === 'custom'){
    finCustomFrom = document.getElementById('fin-date-from')?.value||'';
    finCustomTo   = document.getElementById('fin-date-to')?.value||'';
  }
  loadExpenses();
  const fmtD = n => '$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Revenue
  const raRevenue = invoices
    .filter(i=>(finStore==='all'||finStore==='ra')&&i.store==='ra'&&(i.status==='paid'||i.status==='partial')&&finInPeriod(i.date))
    .reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0);
  const floraRevenue = floraOrders
    .filter(o=>(finStore==='all'||finStore==='flora')&&o.status==='delivered'&&finInPeriod(null,o.createdAt))
    .reduce((s,o)=>s+(o.total||0),0);
  const floraInvRevenue = invoices
    .filter(i=>(finStore==='all'||finStore==='flora')&&i.store==='flora'&&(i.status==='paid'||i.status==='partial')&&finInPeriod(i.date))
    .reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0);
  const totalRevenue = raRevenue+floraRevenue+floraInvRevenue;

  const totalCosts = shipments
    .filter(s=>(finStore==='all'||s.forStore===finStore)&&finInPeriod(finCostBy==='order'?(s.orderDate||s.eta):s.eta))
    .reduce((s,sh)=>s+(sh.cost||0),0);
  const suppliesConsumedCost = finPeriod==='all'?supplies.filter(s=>finStore==='all'||s.store===finStore||s.store==='both').reduce((s,sup)=>s+(sup.consumedCost||0),0):0;
  const expensesCost = expenses.filter(e=>(finStore==='all'||e.store===finStore||e.store==='both')&&finInPeriod(e.date)).reduce((s,e)=>s+(e.amount||0),0);
  const totalCostsAll = totalCosts+suppliesConsumedCost+expensesCost;
  const lossesTotal = losses.filter(l=>finInPeriod(l.date)).reduce((s,l)=>s+(l.amount||0),0);
  const totalProfit = totalRevenue-totalCostsAll-lossesTotal;
  const marginPct = totalRevenue>0?Math.round((totalProfit/totalRevenue)*100):0;
  const outstanding = invoices
    .filter(i=>(finStore==='all'||i.store===finStore)&&(i.status==='unpaid'||i.status==='partial'||i.status==='shipped')&&finInPeriod(i.date))
    .reduce((s,i)=>s+((i.total||0)-(i.paidAmt||0)),0);

  // Tiles
  document.getElementById('fin-revenue').textContent = fmtD(totalRevenue);
  document.getElementById('fin-costs').textContent   = fmtD(totalCostsAll);
  const profEl = document.getElementById('fin-profit');
  profEl.textContent = fmtD(Math.abs(totalProfit));
  profEl.style.color = totalProfit>=0?'var(--green)':'var(--red)';
  document.getElementById('fin-outstanding').textContent = fmtD(outstanding);
  const finLossEl = document.getElementById('fin-losses');
  if(finLossEl){ finLossEl.textContent=fmtD(lossesTotal); finLossEl.style.color=lossesTotal>0?'var(--red)':'var(--muted)'; }

  // Margin bar
  const pct = Math.max(0,Math.min(100,marginPct));
  document.getElementById('fin-margin-pct').textContent = marginPct+'%';
  document.getElementById('fin-margin-pct').style.color = marginPct>=0?'var(--green)':'var(--red)';
  document.getElementById('fin-margin-bar').style.width = pct+'%';
  document.getElementById('fin-margin-bar').style.background = marginPct<0?'var(--red)':'linear-gradient(90deg,#4caf7d,#2ecc71)';

  // Revenue breakdown
  const breakEl = document.getElementById('fin-breakdown');
  if(breakEl){
    if(finStore==='all'){
      const grand=(raRevenue+floraRevenue+floraInvRevenue)||1;
      const raPct=Math.round(raRevenue/grand*100);
      const flPct=Math.round((floraRevenue+floraInvRevenue)/grand*100);
      breakEl.innerHTML=`
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:13px;font-weight:600;color:var(--ink)">🏪 RA Wholesale</span>
            <span style="font-size:13px;font-weight:700;color:var(--rose)">${fmtD(raRevenue)} <span style="font-size:10px;color:var(--muted);font-weight:400">${raPct}%</span></span>
          </div>
          <div class="fin-bar-wrap"><div class="fin-bar" style="width:${raPct}%;background:var(--rose)"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:13px;font-weight:600;color:var(--ink)">🌸 Flora Retail</span>
            <span style="font-size:13px;font-weight:700;color:var(--purple)">${fmtD(floraRevenue+floraInvRevenue)} <span style="font-size:10px;color:var(--muted);font-weight:400">${flPct}%</span></span>
          </div>
          <div class="fin-bar-wrap"><div class="fin-bar" style="width:${flPct}%;background:var(--purple)"></div></div>
        </div>`;
    } else {
      breakEl.innerHTML=`<div style="font-size:13px;color:var(--muted);text-align:center;padding:6px 0">Showing ${finStore==='ra'?'🏪 RA':'🌸 Flora'} only</div>`;
    }
  }

  // ── Shipments tab — new clean renderer ──
  const shipListEl = document.getElementById('fin-ship-list');
  if(shipListEl){
    const relShips = shipments.filter(s=>finStore==='all'||s.forStore===finStore);
    shipListEl.innerHTML = relShips.length
      ? relShips.map(s=>_renderShipFinanceCard(s)).join('')
      : '<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px">No shipments yet</div>';
  }

  // ── Potential profit on current stock ──
  let potRA=0,potSrc=0,totalUnitsLeft=0,realizedTotal=0;
  products.filter(p=>!isProductInTransit(p)&&(finStore==='all'||(p.store===finStore||p.store==='both'))).forEach(p=>{
    const u=getTotalQty(p);
    totalUnitsLeft+=u;
    potRA +=u*(p.priceRAPiece||p.priceFlora||p.price||0)-(u*(p.cost||0));
    potSrc+=u*(p.cost||0);
  });
  realizedTotal=totalRevenue;
  const potRAEl=document.getElementById('fin-potential-ra');
  const potSrcEl=document.getElementById('fin-potential-src');
  const stockEl=document.getElementById('fin-stock-units');
  const realEl=document.getElementById('fin-realized-total');
  if(potRAEl) potRAEl.textContent=fmtD(potRA);
  if(potSrcEl) potSrcEl.textContent=fmtD(potSrc);
  if(stockEl) stockEl.textContent=totalUnitsLeft+' units';
  if(realEl) realEl.textContent=fmtD(realizedTotal);

  // Only render active tab sub-sections for speed
  const activeTab = document.querySelector('.fin-stab.active')?.id?.replace('fst-','') || 'products';
  renderFinChart();
  if(activeTab === 'products'){
    renderBestSellers();
    renderReorderSuggestions();
    renderBundlePopularity();
  }
  if(activeTab === 'insights'){
    renderLossesBreakdown();
  }
}
