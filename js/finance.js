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

function calcShipPL(s){
  const fmtD = n => '$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const shipProds = products.filter(p => p.shipmentId === s.id);
  const prodIds   = new Set(shipProds.map(p=>p.id));
  const cost      = s.cost || 0;

  // Categorise invoice items by status
  let collected = 0, outstanding = 0, totalInvoiced = 0;
  const debtors = {}; // customer → amount owed

  invoices.forEach(inv => {
    if(inv.status === 'cancelled') return; // cancelled invoices don't count
    const relItems = (inv.items||[]).filter(it => prodIds.has(it.productId));
    if(!relItems.length) return;
    const itemsTotal = relItems.reduce((s,it)=> s+(it.total||(it.qty||1)*(it.price||0)), 0);
    totalInvoiced += itemsTotal;

    if(inv.status === 'paid'){
      collected += itemsTotal;
    } else if(inv.status === 'partial'){
      const fraction  = (inv.paidAmt||0) / (inv.total||1);
      const colAmt    = itemsTotal * fraction;
      const owedAmt   = itemsTotal * (1 - fraction);
      collected   += colAmt;
      outstanding += owedAmt;
      if(owedAmt > 0){
        const k = inv.customer||'Unknown';
        debtors[k] = (debtors[k]||0) + owedAmt;
      }
    } else if(inv.status === 'unpaid' || inv.status === 'shipped'){
      outstanding += itemsTotal;
      const k = inv.customer||'Unknown';
      debtors[k] = (debtors[k]||0) + itemsTotal;
    }
  });

  // Unsold stock
  let unsoldUnits = 0, unsoldCost = 0, unsoldPotential = 0;
  shipProds.forEach(p => {
    (p.variants||[]).forEach(v => {
      const qty = (v.ra||0) + (v.flora||0);
      if(qty <= 0) return;
      unsoldUnits    += qty;
      unsoldCost     += qty * (p.cost||0);
      const sellPrice = p.store==='flora' ? (p.priceFlora||p.price||0) : (p.priceRAPiece||p.price||0);
      unsoldPotential += qty * sellPrice;
    });
  });

  const profit       = collected - cost;
  const recoveryPct  = cost > 0 ? Math.min(100, Math.round((collected/cost)*100)) : 100;
  const canRecover   = (collected + unsoldPotential) >= cost;
  const margin       = collected > 0 ? Math.round((profit/collected)*100) : 0;

  return { cost, collected, outstanding, totalInvoiced, profit, recoveryPct, canRecover,
           unsoldUnits, unsoldCost, unsoldPotential, margin, debtors, fmtD };
}

function renderFinance(){
  // Init tab state if not set
  const hasActiveTab = document.getElementById('fin-tab-products')?.style.display !== '';
  if(!document.getElementById('fin-tab-shipments') || document.getElementById('fin-tab-shipments').style.display === '') setFinTab('products');
  now = new Date(); // always fresh
  // Update custom date range vars FIRST before any finInPeriod calls
  if(finPeriod === 'custom'){
    finCustomFrom = document.getElementById('fin-date-from')?.value||'';
    finCustomTo   = document.getElementById('fin-date-to')?.value||'';
  }
  // Load latest expenses before any cost calculations
  loadExpenses();
  const fmtD = n => '$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  // ── Top-level stats (period + store filtered) ──
  const raRevenue = invoices
    .filter(i => (finStore==='all'||finStore==='ra') && i.store==='ra'
              && (i.status==='paid'||i.status==='partial') && finInPeriod(i.date))
    .reduce((s,i)=> s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)), 0);

  const floraRevenue = floraOrders
    .filter(o => (finStore==='all'||finStore==='flora') && o.status==='delivered' && finInPeriod(null,o.createdAt))
    .reduce((s,o)=> s+(o.total||0), 0);

  const floraInvRevenue = invoices
    .filter(i => (finStore==='all'||finStore==='flora') && i.store==='flora'
              && (i.status==='paid'||i.status==='partial') && finInPeriod(i.date))
    .reduce((s,i)=> s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)), 0);

  const totalRevenue  = raRevenue + floraRevenue + floraInvRevenue;
  const totalCosts = shipments
    .filter(s => (finStore==='all' || s.forStore===finStore) &&
      finInPeriod(finCostBy==='order' ? (s.orderDate||s.eta) : s.eta))
    .reduce((s,sh) => s+(sh.cost||0), 0);
  const suppliesConsumedCost = finPeriod==='all' ? supplies.filter(s=>finStore==='all'||s.store===finStore||s.store==='both').reduce((s,sup)=>s+(sup.consumedCost||0),0) : 0;
  const expensesCost = expenses.filter(e=>(finStore==='all'||e.store===finStore||e.store==='both') && finInPeriod(e.date)).reduce((s,e)=>s+(e.amount||0),0);
  const totalCostsAll = totalCosts + suppliesConsumedCost + expensesCost;
  const lossesTotal   = losses.filter(l=>finInPeriod(l.date)).reduce((s,l)=>s+(l.amount||0),0);
  const totalProfit   = totalRevenue - totalCostsAll - lossesTotal;
  const marginPct     = totalRevenue > 0 ? Math.round((totalProfit/totalRevenue)*100) : 0;
  const outstanding   = invoices
    .filter(i=>(finStore==='all'||i.store===finStore)&&(i.status==='unpaid'||i.status==='partial'||i.status==='shipped')&&finInPeriod(i.date))
    .reduce((s,i)=>s+((i.total||0)-(i.paidAmt||0)),0);

  // ── Tiles ──
  document.getElementById('fin-revenue').textContent = fmtD(totalRevenue);
  document.getElementById('fin-costs').textContent   = fmtD(totalCostsAll);
  // Supplies breakdown sub-label if any consumed
  const costsEl = document.getElementById('fin-costs');
  if(suppliesConsumedCost>0 && costsEl){
    let sub = costsEl.nextElementSibling;
    if(!sub || !sub.classList.contains('fin-costs-sub')){
      sub = document.createElement('div');
      sub.className = 'fin-costs-sub';
      sub.style.cssText = 'font-size:10px;color:var(--muted);margin-top:2px';
      costsEl.parentNode.insertBefore(sub, costsEl.nextSibling);
    }
    sub.textContent = `🎀 incl. $${suppliesConsumedCost.toFixed(2)} packaging`;
  }
  const profEl = document.getElementById('fin-profit');
  profEl.textContent = fmtD(Math.abs(totalProfit));
  profEl.style.color = totalProfit>=0?'var(--green)':'var(--red)';
  document.getElementById('fin-outstanding').textContent = fmtD(outstanding);
  const finLossEl = document.getElementById('fin-losses');
  if(finLossEl){ finLossEl.textContent = fmtD(lossesTotal); finLossEl.style.color = lossesTotal>0?'var(--red)':'var(--muted)'; }

  // ── Margin bar ──
  const pct = Math.max(0,Math.min(100,marginPct));
  document.getElementById('fin-margin-pct').textContent  = marginPct+'%';
  document.getElementById('fin-margin-pct').style.color  = marginPct>=0?'var(--green)':'var(--red)';
  document.getElementById('fin-margin-bar').style.width  = pct+'%';
  document.getElementById('fin-margin-bar').style.background = marginPct<0?'var(--red)':'linear-gradient(90deg,#4caf7d,#2ecc71)';

  // ── Breakdown ──
  const breakEl = document.getElementById('fin-breakdown');
  if(finStore==='all'){
    const grand = (raRevenue+floraRevenue+floraInvRevenue)||1;
    const raPct = Math.round(raRevenue/grand*100);
    const flPct = Math.round((floraRevenue+floraInvRevenue)/grand*100);
    breakEl.innerHTML = `
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
    breakEl.innerHTML = `<div style="font-size:13px;color:var(--muted);text-align:center;padding:6px 0">Showing ${finStore==='ra'?'🏪 RA':'🌸 Flora'} only</div>`;
  }

  // ── Per-Shipment P&L cards ──
  const shipListEl = document.getElementById('fin-ship-list');
  const relShips   = shipments.filter(s => finStore==='all' || s.forStore===finStore);
  if(!relShips.length){
    shipListEl.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px 0">No shipments yet</div>';
    return;
  }

  shipListEl.innerHTML = relShips.map(s=>{
    const pl = calcShipPL(s);
    const { cost, collected, outstanding: owed, totalInvoiced, profit, recoveryPct,
            canRecover, unsoldUnits, unsoldCost, unsoldPotential, margin, debtors } = pl;
    const { fmtD: fd } = pl;

    const profitCol  = profit>=0 ? 'var(--green)' : 'var(--red)';
    const profitBcls = profit>=0 ? 'bg' : 'br';
    const isOpen     = _finOpen.has(s.id);

    // Status indicator
    let statusIcon = '⏳';
    if(profit > 0)            statusIcon = '✅';
    if(profit < 0 && !canRecover) statusIcon = '🔴';

    // Recovery bar color
    const recCol = recoveryPct >= 100 ? 'var(--green)' : recoveryPct >= 60 ? 'var(--amber)' : 'var(--red)';

    // Debtors list
    const debtorEntries = Object.entries(debtors);
    const debtorsHtml = debtorEntries.length ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--grey2)">
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--red);margin-bottom:8px">⚠️ Who Owes You</div>
        ${debtorEntries.map(([name,amt])=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--grey2)">
            <div style="font-size:13px;font-weight:600;color:var(--ink)">${name}</div>
            <div style="font-size:13px;font-weight:700;color:var(--red)">${fd(amt)}</div>
          </div>`).join('')}
      </div>` : '';

    // Unsold stock section
    const unsoldHtml = unsoldUnits > 0 ? `
      <div style="margin-top:10px;padding:10px 12px;background:var(--amber-soft);border-radius:10px">
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--amber);margin-bottom:6px">📦 Unsold Stock</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span style="color:var(--ink-light)">Units remaining</span>
          <span style="font-weight:700;color:var(--ink)">${unsoldUnits}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span style="color:var(--ink-light)">Cost locked in stock</span>
          <span style="font-weight:700;color:var(--red)">${fd(unsoldCost)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px">
          <span style="color:var(--ink-light)">Potential if sold</span>
          <span style="font-weight:700;color:var(--green)">${fd(unsoldPotential)}</span>
        </div>
      </div>
      <div style="margin-top:8px;padding:8px 12px;background:${canRecover?'var(--green-soft)':'var(--red-soft)'};border-radius:10px;font-size:12px;font-weight:600;color:${canRecover?'var(--green)':'var(--red)'}">
        ${canRecover ? '✅ Can still recover cost if stock sells' : '🔴 Cannot break even even if all stock sells'}
      </div>` : `<div style="margin-top:8px;font-size:12px;color:var(--muted);text-align:center">📦 All stock sold</div>`;

    return `
      <div style="background:var(--white);border-radius:14px;margin-bottom:10px;box-shadow:var(--shadow);border:1px solid rgba(232,116,138,0.07);overflow:hidden">
        <!-- Header -->
        <div onclick="toggleFinShip('${s.id}')" style="display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer">
          <div style="font-size:20px">${statusIcon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name||s.num||'Shipment'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:1px">Cost ${fd(cost)}${s.eta?' · ETA '+s.eta:''}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:${profitCol}">${profit>=0?'+':''}${fd(profit)}</div>
            <span class="b ${profitBcls}" style="font-size:10px">${margin}%</span>
          </div>
          <div id="fsc-${s.id}" style="font-size:18px;color:var(--muted);transition:transform 0.2s;flex-shrink:0;transform:${isOpen?'rotate(90deg)':'rotate(0deg)'}">›</div>
        </div>

        <!-- Recovery bar always visible -->
        <div style="padding:0 16px 12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">Cost recovered</span>
            <span style="font-size:10px;font-weight:700;color:${recCol}">${recoveryPct}%</span>
          </div>
          <div class="fin-bar-wrap"><div class="fin-bar" style="width:${recoveryPct}%;background:${recCol}"></div></div>
        </div>

        <!-- Expanded body -->
        <div id="fsb-${s.id}" style="display:${isOpen?'block':'none'};padding:0 16px 16px;border-top:1px solid var(--grey2)">
          <div style="margin-top:12px">
            <!-- Row: Total Invoiced -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--grey2)">
              <span style="font-size:13px;color:var(--ink-light)">📋 Total Invoiced</span>
              <span style="font-size:13px;font-weight:700;color:var(--ink)">${fd(totalInvoiced)}</span>
            </div>
            <!-- Row: Collected -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--grey2)">
              <span style="font-size:13px;color:var(--ink-light)">✅ Collected</span>
              <span style="font-size:13px;font-weight:700;color:var(--green)">${fd(collected)}</span>
            </div>
            <!-- Row: Outstanding -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--grey2)">
              <span style="font-size:13px;color:var(--ink-light)">⏳ Outstanding</span>
              <span style="font-size:13px;font-weight:700;color:${owed>0?'var(--red)':'var(--muted)'}">${fd(owed)}</span>
            </div>
            <!-- Row: Shipment Cost -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--grey2)">
              <span style="font-size:13px;color:var(--ink-light)">💸 Arrival Cost</span>
              <span style="font-size:13px;font-weight:700;color:var(--ink)">${fd(cost)}</span>
            </div>
            <!-- Row: Net Profit -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;margin-top:2px">
              <span style="font-size:14px;font-weight:700;color:var(--ink)">🏆 Net Profit</span>
              <span style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:${profitCol}">${profit>=0?'+':''}${fd(profit)}</span>
            </div>
          </div>
          ${unsoldHtml}
          ${debtorsHtml}
        </div>
      </div>`;
  }).join('');

  // ── Revenue chart by month ──
  renderFinChart();
  // ── Best sellers ──
  renderBestSellers();
  // ── Reorder suggestions ──
  renderReorderSuggestions();
  // ── Profit per product ──
  renderProfitPerProduct();
  // ── Cash flow ──
  renderCashFlow();
  // ── Shipment comparison ──
  renderShipmentComparison();
  renderLossesBreakdown();
  renderProfitPerShipment();
  renderBundlePopularity();
  renderCapitalRecoveryBanner();
}

function renderFinChart(){
  const el = document.getElementById('fin-chart');
  if(!el) return;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const data = [];
  for(let i=5; i>=0; i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const yr = d.getFullYear(), mo = d.getMonth();
    const rev = invoices
      .filter(i=>{ const id=new Date(i.date+'T12:00:00'); return id.getFullYear()===yr && id.getMonth()===mo && (i.status==='paid'||i.status==='partial') && i.status!=='cancelled'; })
      .reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0)
      + floraOrders
      .filter(o=>{ const od=new Date(o.createdAt); return od.getFullYear()===yr && od.getMonth()===mo && o.status==='delivered'; })
      .reduce((s,o)=>s+(o.total||0),0);
    data.push({ label: months[mo], value: rev });
  }
  const max = Math.max(...data.map(d=>d.value), 1);
  el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:6px;height:100px;padding-bottom:20px;position:relative">
    ${data.map(d=>{
      const h = Math.max(4, Math.round((d.value/max)*80));
      const isCurrentMonth = d.label === months[now.getMonth()];
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="font-size:9px;color:var(--muted);font-weight:600">$${d.value>999?(d.value/1000).toFixed(1)+'k':Math.round(d.value)}</div>
        <div style="width:100%;height:${h}px;background:${isCurrentMonth?'var(--rose)':'var(--rose-soft)'};border-radius:6px 6px 0 0;transition:height 0.3s"></div>
        <div style="font-size:9px;color:var(--muted);font-weight:600;margin-top:2px">${d.label}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderBestSellers(){
  const el = document.getElementById('fin-bestsellers');
  if(!el) return;
  const salesMap = {};
  invoices.filter(i=>(i.status==='paid'||i.status==='partial') && finInPeriod(i.date)).forEach(inv=>{
    (inv.items||[]).forEach(it=>{
      const pid = it.productId||it.pid;
      if(!pid) return;
      if(!salesMap[pid]) salesMap[pid] = {revenue:0, qty:0};
      salesMap[pid].revenue += it.total||(it.qty||1)*(it.price||0);
      salesMap[pid].qty += it.qty||1;
    });
  });
  floraOrders.filter(o=>o.status==='delivered' && finInPeriod(null, o.createdAt)).forEach(o=>{
    (o.items||[]).forEach(it=>{
      const pid = it.productId;
      if(!pid) return;
      if(!salesMap[pid]) salesMap[pid] = {revenue:0, qty:0};
      salesMap[pid].revenue += (it.qty||0)*(it.price||0);
      salesMap[pid].qty += it.qty||1;
    });
  });
  const top = Object.entries(salesMap)
    .sort((a,b)=>b[1].revenue-a[1].revenue)
    .slice(0,5);
  if(!top.length){ el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:8px 0">No sales data yet</div>'; return; }
  const maxRev = top[0][1].revenue||1;
  el.innerHTML = top.map(([pid,data],i)=>{
    const p = products.find(x=>x.id===pid);
    const name = p ? p.emoji+' '+p.name : '📦 Unknown';
    const pct = Math.round((data.revenue/maxRev)*100);
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <div style="font-size:13px;font-weight:600;color:var(--ink)">${medal} ${name}</div>
        <div style="font-size:12px;font-weight:700;color:var(--rose)">$${data.revenue.toFixed(0)}</div>
      </div>
      <div style="background:var(--grey2);border-radius:4px;height:6px">
        <div style="width:${pct}%;height:6px;background:var(--rose);border-radius:4px;transition:width 0.4s"></div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${data.qty} units sold</div>
    </div>`;
  }).join('');
}

function renderReorderSuggestions(){
  const el = document.getElementById('fin-reorder');
  if(!el) return;
  // Calculate sales velocity per product from last 30 days
  const thirtyDaysAgo = new Date(Date.now()-30*86400000).toISOString().split('T')[0];
  const salesMap = {};
  invoices.filter(i=>i.status!=='cancelled'&&(i.date||'')>=thirtyDaysAgo).forEach(inv=>{
    (inv.items||[]).forEach(it=>{
      const pid = it.productId||it.pid;
      if(!pid) return;
      salesMap[pid] = (salesMap[pid]||0)+(it.qty||1);
    });
  });
  const suggestions = products
    .filter(p=>{
      if(isProductInTransit(p)) return false;
      if(finStore==='ra' && p.store==='flora') return false;
      if(finStore==='flora' && p.store==='ra') return false;
      const totalQty = (p.variants||[]).reduce((s,v)=>s+(v.ra||0)+(v.flora||0),0);
      const sold30 = salesMap[p.id]||0;
      const daysLeft = sold30>0 ? Math.round(totalQty/(sold30/30)) : null;
      return daysLeft!==null && daysLeft<=30;
    })
    .map(p=>{
      const totalQty = (p.variants||[]).reduce((s,v)=>s+(v.ra||0)+(v.flora||0),0);
      const sold30 = salesMap[p.id]||0;
      const daysLeft = Math.round(totalQty/(sold30/30));
      return {p, totalQty, sold30, daysLeft};
    })
    .sort((a,b)=>a.daysLeft-b.daysLeft)
    .slice(0,5);

  if(!suggestions.length){
    el.innerHTML='<div style="color:var(--green);font-size:13px;text-align:center;padding:8px 0">✅ Stock levels look good!</div>';
    return;
  }
  el.innerHTML = suggestions.map(({p,totalQty,sold30,daysLeft})=>{
    const urgency = daysLeft<=7?'var(--red)':daysLeft<=14?'var(--amber)':'var(--blue)';
    const urgencyBg = daysLeft<=7?'var(--red-soft)':daysLeft<=14?'var(--amber-soft)':'var(--blue-soft)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--grey2)">
      <div style="font-size:24px;flex-shrink:0">${p.emoji||'📦'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${totalQty} left · ${sold30} sold/month</div>
      </div>
      <div style="background:${urgencyBg};color:${urgency};border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0">~${daysLeft}d left</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// FEATURE 6: PROFIT PER PRODUCT
// ═══════════════════════════════════════════════════
let _ppView = 'ra'; // 'ra' | 'src'

function setPPView(v){
  _ppView = v;
  const raBtn  = document.getElementById('ppv-btn-ra');
  const srcBtn = document.getElementById('ppv-btn-src');
  if(raBtn){  raBtn.style.background  = v==='ra'  ? 'var(--rose)'  : 'var(--white)'; raBtn.style.color  = v==='ra'  ? 'white' : 'var(--muted)'; raBtn.style.borderColor  = v==='ra'  ? 'var(--rose)'  : 'var(--grey2)'; }
  if(srcBtn){ srcBtn.style.background = v==='src' ? '#2563eb' : 'var(--white)'; srcBtn.style.color = v==='src' ? 'white' : 'var(--muted)'; srcBtn.style.borderColor = v==='src' ? '#2563eb' : 'var(--grey2)'; }
  renderProfitPerProduct();
}

function renderProfitPerProduct(){
  const el = document.getElementById('fin-profit-products');
  if(!el) return;

  // ── Realized sales map ──────────────────────────────
  const salesMap = {};
  invoices.filter(i=>(i.status==='paid'||i.status==='partial') && finInPeriod(i.date)).forEach(inv=>{
    (inv.items||[]).forEach(it=>{
      const pid = it.productId||it.pid;
      if(!pid) return;
      if(!salesMap[pid]) salesMap[pid]={revenue:0, qty:0};
      salesMap[pid].revenue += it.total||(it.qty||1)*(it.price||0);
      salesMap[pid].qty     += it.qty||1;
    });
  });

  // ── Potential from current stock ────────────────────
  const allProds = products.filter(p=> p.priceRAPiece || p.priceFlora || p.cost);

  // Pre-compute which shipments have recovered capital
  const recoveredShips = new Set(
    shipments.filter(s=>s.status==='arrived').filter(s=>{
      const pl = calcShipPL(s);
      return pl.collected >= pl.cost;
    }).map(s=>s.id)
  );

  const items = allProds.map(p=>{
    const totalStock   = getTotalQty(p);
    const sold         = salesMap[p.id] || {revenue:0, qty:0};
    const raPrice      = p.priceRAPiece || p.priceFlora || 0;
    const srcPrice     = p.cost || 0; // "src" = arrival cost for clearance scenario
    const arrCost      = p.cost || 0;
    // If shipment capital is recovered → cost = $0, everything is profit
    const capitalRecovered = p.shipmentId && recoveredShips.has(p.shipmentId);
    const effectiveUnitCost = capitalRecovered ? 0 : arrCost;

    const stockCost       = totalStock * effectiveUnitCost;
    const potentialRA     = (totalStock * raPrice)  - stockCost;
    const potentialSrc    = (totalStock * srcPrice) - stockCost;
    const potRevRA        = totalStock * raPrice;
    const potRevSrc       = totalStock * srcPrice;
    const realizedProfit  = sold.revenue - (arrCost * sold.qty);

    return { p, totalStock, sold, raPrice, srcPrice, arrCost, stockCost,
             potentialRA, potentialSrc, potRevRA, potRevSrc, realizedProfit, capitalRecovered };
  }).filter(x=> x.totalStock > 0 || x.sold.qty > 0)
    .sort((a,b)=> (_ppView==='ra' ? b.potentialRA - a.potentialRA : b.potentialSrc - a.potentialSrc));

  // ── Summary totals ───────────────────────────────────
  const totalPotRA  = allProds.reduce((s,p)=>{
    const u = getTotalQty(p);
    const cap = p.shipmentId && recoveredShips.has(p.shipmentId);
    return s + u*(p.priceRAPiece||p.priceFlora||0) - (cap?0:u*(p.cost||0));
  }, 0);
  const totalPotSrc = allProds.reduce((s,p)=>{
    const u = getTotalQty(p);
    const cap = p.shipmentId && recoveredShips.has(p.shipmentId);
    // At arrival cost: revenue = u × arrCost, cost = 0 if recovered else u × arrCost → profit = 0 or u × arrCost
    return s + (cap ? u*(p.cost||0) : 0);
  }, 0);
  const totalRealized = Object.entries(salesMap).reduce((s,[pid,d])=>{
    const p = products.find(x=>x.id===pid);
    return s + d.revenue - (p?.cost||0)*d.qty;
  }, 0);
  const totalUnits  = products.filter(p=>!isProductInTransit(p)).reduce((s,p)=>s+getTotalQty(p),0);

  const raEl  = document.getElementById('fin-potential-ra');
  const srcEl = document.getElementById('fin-potential-src');
  const realEl= document.getElementById('fin-realized-total');
  const unitEl= document.getElementById('fin-stock-units');
  if(raEl){   raEl.textContent  = '$'+totalPotRA.toFixed(0);  }
  if(srcEl){  srcEl.textContent = '$'+totalPotSrc.toFixed(0); }
  // Update subtitles
  const raSubEl  = document.getElementById('fin-potential-ra-sub');
  const srcSubEl = document.getElementById('fin-potential-src-sub');
  if(raSubEl)  raSubEl.textContent  = 'profit after cost';
  if(srcSubEl) srcSubEl.textContent = 'sell at arrival cost';
  if(realEl) realEl.textContent = '$'+totalRealized.toFixed(0);
  if(unitEl) unitEl.textContent = totalUnits+' units';

  if(!items.length){ el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">No products with pricing yet</div>'; return; }

  el.innerHTML = items.map(({p, totalStock, sold, raPrice, srcPrice, arrCost, stockCost, potentialRA, potentialSrc, potRevRA, potRevSrc, realizedProfit, capitalRecovered})=>{
    const profit     = _ppView==='ra' ? potentialRA  : potentialSrc;
    const revenue    = _ppView==='ra' ? potRevRA     : potRevSrc;
    const priceUsed  = _ppView==='ra' ? raPrice      : srcPrice;
    const profitColor = profit >= 0 ? (_ppView==='ra' ? '#059669' : '#2563eb') : 'var(--red)';
    const profitBg    = profit >= 0 ? (_ppView==='ra' ? '#d1fae5' : '#dbeafe') : 'var(--red-soft)';
    const realColor   = realizedProfit >= 0 ? 'var(--green)' : 'var(--red)';
    const maxProfit   = Math.max(Math.abs(potentialRA), 1);
    const barPct      = Math.min(100, Math.round((Math.abs(profit)/maxProfit)*100));

    return `<div style="padding:12px 0;border-bottom:1px solid var(--grey2)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:20px;flex-shrink:0">${p.emoji||'📦'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:1px">
            📦 ${totalStock} in stock${sold.qty>0?` · ✅ ${sold.qty} sold`:''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:15px;font-weight:700;color:${profitColor}">$${profit.toFixed(0)}</div>
          <div style="font-size:9px;font-weight:600;color:var(--muted)">profit</div>
        </div>
      </div>
      ${/* Revenue / Cost / Profit breakdown */''}
      ${totalStock > 0 ? `
      ${capitalRecovered ? `<div style="background:#d1fae5;border-radius:8px;padding:5px 10px;margin-bottom:6px;display:flex;align-items:center;gap:6px"><span style="font-size:12px">🎉</span><span style="font-size:11px;font-weight:700;color:#059669">Capital recovered — every sale is pure profit!</span></div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px">
        <div style="background:var(--grey);border-radius:8px;padding:6px;text-align:center">
          <div style="font-size:9px;color:var(--muted);font-weight:600">Revenue</div>
          <div style="font-size:12px;font-weight:700;color:var(--ink)">$${revenue.toFixed(0)}</div>
          <div style="font-size:8px;color:var(--muted)">@ $${priceUsed.toFixed(2)}</div>
        </div>
        <div style="background:${capitalRecovered?'var(--green-soft)':'var(--red-soft)'};border-radius:8px;padding:6px;text-align:center">
          <div style="font-size:9px;color:${capitalRecovered?'var(--green)':'var(--red)'};font-weight:600">Cost</div>
          <div style="font-size:12px;font-weight:700;color:${capitalRecovered?'var(--green)':'var(--red)'}"><span style="text-decoration:${capitalRecovered?'line-through':'none'};opacity:${capitalRecovered?0.5:1}">$${(totalStock*arrCost).toFixed(0)}</span>${capitalRecovered?' $0':''}</div>
          <div style="font-size:8px;color:var(--muted)">${capitalRecovered?'recovered ✅':'@ $'+arrCost.toFixed(2)}</div>
        </div>
        <div style="background:${profitBg};border-radius:8px;padding:6px;text-align:center">
          <div style="font-size:9px;color:${profitColor};font-weight:600">Profit</div>
          <div style="font-size:12px;font-weight:700;color:${profitColor}">$${profit.toFixed(0)}</div>
          <div style="font-size:8px;color:var(--muted)">${revenue>0?Math.round((profit/revenue)*100)+'% margin':'-'}</div>
        </div>
      </div>` : ''}
      <div style="height:4px;background:var(--grey);border-radius:4px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${barPct}%;background:${_ppView==='ra'?'linear-gradient(90deg,#4ade80,#059669)':'linear-gradient(90deg,#60a5fa,#2563eb)'};border-radius:4px;transition:width 0.4s"></div>
      </div>
      ${sold.qty > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;background:var(--grey);border-radius:8px;padding:5px 10px">
        <div style="font-size:10px;color:var(--muted)">✅ Realized profit (${sold.qty} sold)</div>
        <div style="font-size:11px;font-weight:700;color:${realColor}">$${realizedProfit.toFixed(0)}</div>
      </div>` : ''}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// FEATURE 7: CASH FLOW WEEKLY
// ═══════════════════════════════════════════════════
function renderCashFlow(){
  const el = document.getElementById('fin-cashflow');
  if(!el) return;
  // Last 4 weeks
  const weeks = [];
  for(let i=3; i>=0; i--){
    const end = new Date(Date.now() - i*7*86400000);
    const start = new Date(end - 6*86400000);
    const startStr = start.toISOString().slice(0,10);
    const endStr = end.toISOString().slice(0,10);
    const inflow = invoices
      .filter(inv=>inv.status!=='cancelled' && (inv.date||'')>=startStr && (inv.date||'')<=endStr && (inv.status==='paid'||inv.status==='partial'))
      .reduce((s,inv)=>s+(inv.status==='paid'?(inv.total||0):(inv.paidAmt||0)),0)
      + floraOrders.filter(o=>{ const d=new Date(o.createdAt).toISOString().slice(0,10); return d>=startStr&&d<=endStr&&o.status==='delivered'; }).reduce((s,o)=>s+(o.total||0),0);
    const outflow = expenses.filter(e=>(e.date||'')>=startStr&&(e.date||'')<=endStr).reduce((s,e)=>s+(e.amount||0),0);
    weeks.push({ label:`${start.toLocaleDateString('en',{month:'short',day:'numeric'})}`, inflow, outflow, net:inflow-outflow });
  }
  el.innerHTML = weeks.map(w=>{
    const col = w.net>=0?'var(--green)':'var(--red)';
    return `<div style="background:var(--grey);border-radius:12px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:700;color:var(--ink)">${w.label}</div>
        <div style="font-size:14px;font-weight:700;color:${col}">${w.net>=0?'+':''}$${w.net.toFixed(0)}</div>
      </div>
      <div style="display:flex;gap:12px">
        <div style="font-size:11px;color:var(--green)">↑ $${w.inflow.toFixed(0)}</div>
        <div style="font-size:11px;color:var(--red)">↓ $${w.outflow.toFixed(0)}</div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// FEATURE 8: SHIPMENT COMPARISON
// ═══════════════════════════════════════════════════
function renderShipmentComparison(){
  const el = document.getElementById('fin-ship-comparison');
  if(!el) return;
  const arrived = shipments.filter(s=>s.status==='arrived').slice(-5);
  if(arrived.length<2){ el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:8px">Need at least 2 arrived shipments</div>'; return; }
  const data = arrived.map(s=>{
    const pl = calcShipPL(s);
    return {s, profit:pl.profit, cost:s.cost||0, margin:pl.margin||0, collected:pl.collected};
  }).sort((a,b)=>b.margin-a.margin);
  el.innerHTML = data.map((d,i)=>{
    const col = d.profit>=0?'var(--green)':'var(--red)';
    const medal = i===0?'🥇':i===1?'🥈':'';
    return `<div style="padding:10px 0;border-bottom:1px solid var(--grey2)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:13px;font-weight:700;color:var(--ink)">${medal} ${d.s.name}</div>
        <div style="font-size:13px;font-weight:700;color:${col}">${d.margin}% margin</div>
      </div>
      <div style="display:flex;gap:12px;margin-top:4px">
        <div style="font-size:11px;color:var(--muted)">Cost: $${d.cost.toFixed(0)}</div>
        <div style="font-size:11px;color:var(--green)">Collected: $${d.collected.toFixed(0)}</div>
        <div style="font-size:11px;color:${col}">Profit: $${d.profit.toFixed(0)}</div>
      </div>
    </div>`;
  }).join('');
}

function renderLossesBreakdown(){
  const el = document.getElementById('fin-losses-breakdown');
  const card = document.getElementById('fin-losses-card');
  if(!el) return;
  const filtered = losses.filter(l=>finInPeriod(l.date));
  if(!filtered.length){
    if(card) card.style.display='none';
    return;
  }
  if(card) card.style.display='block';
  const total = filtered.reduce((s,l)=>s+(l.amount||0),0);
  // By type
  const byType = {shortage:0, refund_expired:0, bad_debt:0};
  filtered.forEach(l=>{ if(byType[l.type]!==undefined) byType[l.type]+=(l.amount||0); });
  // By shipment
  const byShip = {};
  filtered.filter(l=>l.shipmentName).forEach(l=>{
    const k = l.shipmentName;
    byShip[k] = (byShip[k]||0)+(l.amount||0);
  });
  // By customer (bad debt)
  const byCustomer = {};
  filtered.filter(l=>l.type==='bad_debt'&&l.customerName).forEach(l=>{
    byCustomer[l.customerName] = (byCustomer[l.customerName]||0)+(l.amount||0);
  });

  const typeRows = [
    byType.shortage>0    ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--grey2)"><span style="font-size:13px">📦 Shortage losses</span><span style="font-weight:700;color:var(--red)">$${byType.shortage.toFixed(2)}</span></div>` : '',
    byType.refund_expired>0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--grey2)"><span style="font-size:13px">🔄 Expired refunds</span><span style="font-weight:700;color:var(--red)">$${byType.refund_expired.toFixed(2)}</span></div>` : '',
    byType.bad_debt>0    ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--grey2)"><span style="font-size:13px">🚫 Bad debt write-offs</span><span style="font-weight:700;color:var(--red)">$${byType.bad_debt.toFixed(2)}</span></div>` : '',
  ].filter(Boolean).join('');

  const shipRows = Object.entries(byShip).sort((a,b)=>b[1]-a[1]).map(([name,amt])=>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--grey2)">
      <span style="font-size:12px;color:var(--ink)">🚢 ${name}</span>
      <span style="font-size:12px;font-weight:700;color:var(--red)">$${amt.toFixed(2)}</span>
    </div>`
  ).join('');

  const custRows = Object.entries(byCustomer).sort((a,b)=>b[1]-a[1]).map(([name,amt])=>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--grey2)">
      <span style="font-size:12px;color:var(--ink)">👤 ${name}</span>
      <span style="font-size:12px;font-weight:700;color:var(--red)">$${amt.toFixed(2)}</span>
    </div>`
  ).join('');

  // Individual loss entries (last 10)
  const entries = filtered.slice(-10).reverse().map(l=>{
    const typeIcon = l.type==='shortage'?'📦':l.type==='refund_expired'?'🔄':'🚫';
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--grey2)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--ink)">${typeIcon} ${l.note||'-'}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px">${l.date}${l.shipmentName?' · '+l.shipmentName:''}</div>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--red);flex-shrink:0;margin-left:8px">$${(l.amount||0).toFixed(2)}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <!-- Total -->
    <div style="background:var(--red-soft);border-radius:12px;padding:12px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--red)">Total Losses</div>
      <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--red)">$${total.toFixed(2)}</div>
    </div>
    <!-- By Type -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);margin-bottom:6px">By Type</div>
    <div style="margin-bottom:14px">${typeRows||'<div style="font-size:12px;color:var(--muted)">No data</div>'}</div>
    ${shipRows ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);margin-bottom:6px">By Shipment</div><div style="margin-bottom:14px">${shipRows}</div>` : ''}
    ${custRows ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);margin-bottom:6px">By Customer</div><div style="margin-bottom:14px">${custRows}</div>` : ''}
    <!-- Log -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);margin-bottom:6px">Loss Log</div>
    <div>${entries||'<div style="font-size:12px;color:var(--muted)">No entries</div>'}</div>
  `;
}

// ═══════════════════════════════════════════════════
// FEATURE: CAPITAL RECOVERY + PROFIT PER SHIPMENT
// ═══════════════════════════════════════════════════

function getCapitalRecoveryStatus(){
  return shipments.filter(s=>s.status==='arrived').map(s=>{
    const pl = calcShipPL(s);
    const recovered = pl.collected >= pl.cost;
    const shipProds = products.filter(p=>p.shipmentId===s.id);
    let potRA=0, potSrc=0;
    shipProds.forEach(p=>{
      const units = getTotalQty(p);
      // If capital recovered → cost = $0, every sale is pure profit
      const effectiveCost = recovered ? 0 : units*(p.cost||0);
      potRA  += units*(p.priceRAPiece||p.priceFlora||0) - effectiveCost;
      potSrc += units*(p.cost||0) - effectiveCost; // at arrival cost price
    });
    return { ship:s, cost:pl.cost, collected:pl.collected, recovered,
             recoveryPct:pl.recoveryPct, potRA, potSrc, outstanding:pl.outstanding };
  });
}

function renderProfitPerShipment(){
  const el = document.getElementById('fin-ship-profit');
  if(!el) return;
  const arrived = shipments.filter(s=>s.status==='arrived');
  if(!arrived.length){ el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0">No arrived shipments yet</div>'; return; }
  const data = arrived.map(s=>{
    const pl = calcShipPL(s);
    const shipProds = products.filter(p=>p.shipmentId===s.id);
    let potRA=0, unsoldUnits=0;
    shipProds.forEach(p=>{ const u=getTotalQty(p); potRA+=u*(p.priceRAPiece||p.priceFlora||0); unsoldUnits+=u; });
    return { s, ...pl, potRA, unsoldUnits };
  }).sort((a,b)=>b.collected-a.collected);

  el.innerHTML = data.map(d=>{
    const pct = Math.min(100, d.recoveryPct);
    const recovered = d.collected >= d.cost;
    const barColor = recovered ? 'linear-gradient(90deg,#4ade80,#059669)' : pct>=50 ? 'linear-gradient(90deg,#fbbf24,#f59e0b)' : 'linear-gradient(90deg,#f87171,#ef4444)';
    const badge = recovered
      ? `<span style="background:#d1fae5;color:#059669;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">✅ Capital Recovered</span>`
      : `<span style="background:#fef3c7;color:#b45309;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">${pct}% recovered</span>`;
    return `<div style="padding:12px 0;border-bottom:1px solid var(--grey2)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--ink)">${d.s.name}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:1px">${d.s.eta||''}</div>
        </div>
        ${badge}
      </div>
      <div style="height:6px;background:var(--grey);border-radius:6px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px;transition:width 0.5s"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
        <div style="background:var(--grey);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;font-weight:700">Cost</div>
          <div style="font-size:13px;font-weight:700;color:var(--ink)">$${(d.cost||0).toFixed(0)}</div>
        </div>
        <div style="background:var(--green-soft);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:9px;color:var(--green);text-transform:uppercase;font-weight:700">Collected</div>
          <div style="font-size:13px;font-weight:700;color:var(--green)">$${(d.collected||0).toFixed(0)}</div>
        </div>
        <div style="background:${d.potRA>0?'#eff6ff':'var(--grey)'};border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:9px;color:#2563eb;text-transform:uppercase;font-weight:700">Potential</div>
          <div style="font-size:13px;font-weight:700;color:#2563eb">$${(d.potRA||0).toFixed(0)}</div>
        </div>
      </div>
      ${d.outstanding>0?`<div style="font-size:11px;color:var(--amber);margin-top:6px">⏳ $${d.outstanding.toFixed(0)} still outstanding</div>`:''}
      ${recovered&&d.potRA>0?`<div style="font-size:11px;color:#059669;margin-top:4px;font-weight:600">🎉 Remaining ${d.unsoldUnits} units = pure profit potential</div>`:''}
    </div>`;
  }).join('');
}

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
  { name:"Mother's Day 🇱🇧",   emoji:'🌸', month:3,  day:21 }, // Lebanon: March 21
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
