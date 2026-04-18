// ═══════════════════════════════════════════════════
// FINANCE.JS — Full rebuild with new design
// ═══════════════════════════════════════════════════

// _finOpen lives in data.js — do not redeclare here

// ── Controls ──
function setFinCostBy(by){
  finCostBy = by;
  const e = document.getElementById('fin-cost-eta-btn');
  const o = document.getElementById('fin-cost-order-btn');
  if(e){ e.style.background = by==='eta' ? 'var(--rose)' : 'transparent'; e.style.color = by==='eta' ? 'white' : 'var(--muted)'; }
  if(o){ o.style.background = by==='order' ? 'var(--rose)' : 'transparent'; o.style.color = by==='order' ? 'white' : 'var(--muted)'; }
  renderFinance();
}

function setFinPeriod(p, el){
  finPeriod = p;
  document.querySelectorAll('.fin-period').forEach(x=>x.classList.remove('sel'));
  el.classList.add('sel');
  const cr = document.getElementById('fin-custom-range');
  if(cr) cr.style.display = p==='custom' ? 'block' : 'none';
  if(p==='custom'){
    const f=document.getElementById('fin-date-from'), t=document.getElementById('fin-date-to');
    if(f&&!f.value){ const d=new Date(); d.setDate(1); f.value=d.toISOString().slice(0,10); }
    if(t&&!t.value) t.value=new Date().toISOString().slice(0,10);
    finCustomFrom=f?.value||''; finCustomTo=t?.value||'';
  }
  renderFinance();
}

function setFinStore(s, el){
  finStore = s;
  document.querySelectorAll('#fin-tabs .tab').forEach(x=>x.classList.remove('active'));
  el.classList.add('active');
  renderFinance();
}

function finInPeriod(dateStr, tsMs){
  if(finPeriod==='all') return true;
  const now2=new Date();
  let d = dateStr ? new Date(dateStr+'T12:00:00') : tsMs ? new Date(tsMs) : null;
  if(!d||isNaN(d)) return finPeriod==='all';
  if(finPeriod==='month') return d.getFullYear()===now2.getFullYear()&&d.getMonth()===now2.getMonth();
  if(finPeriod==='year')  return d.getFullYear()===now2.getFullYear();
  if(finPeriod==='custom'){
    const from=finCustomFrom?new Date(finCustomFrom+'T00:00:00'):null;
    const to=finCustomTo?new Date(finCustomTo+'T23:59:59'):null;
    if(from&&d<from) return false;
    if(to&&d>to) return false;
    return true;
  }
  return true;
}

function toggleFinShip(sid){
  if(_finOpen.has(sid)) _finOpen.delete(sid); else _finOpen.add(sid);
  const body=document.getElementById('fsb-'+sid);
  const chev=document.getElementById('fsc-'+sid);
  if(body) body.style.display=_finOpen.has(sid)?'block':'none';
  if(chev) chev.style.transform=_finOpen.has(sid)?'rotate(90deg)':'rotate(0deg)';
}

// ── Shipment P&L calculator ──
function calcShipPL(s){
  const shipProds=products.filter(p=>p.shipmentId===s.id);
  const prodIds=new Set(shipProds.map(p=>p.id));
  const cost=s.cost||0;
  let collected=0, outstanding=0, totalInvoiced=0;
  const debtors={};
  invoices.forEach(inv=>{
    if(inv.status==='cancelled') return;
    const relItems=(inv.items||[]).filter(it=>prodIds.has(it.productId));
    if(!relItems.length) return;
    const itemsTotal=relItems.reduce((s,it)=>s+(it.total||(it.qty||1)*(it.price||0)),0);
    totalInvoiced+=itemsTotal;
    if(inv.status==='paid'){ collected+=itemsTotal; }
    else if(inv.status==='partial'){
      const frac=(inv.paidAmt||0)/(inv.total||1);
      collected+=itemsTotal*frac; outstanding+=itemsTotal*(1-frac);
      if(itemsTotal*(1-frac)>0){ const k=inv.customer||'Unknown'; debtors[k]=(debtors[k]||0)+itemsTotal*(1-frac); }
    } else if(inv.status==='unpaid'||inv.status==='shipped'){
      outstanding+=itemsTotal;
      const k=inv.customer||'Unknown'; debtors[k]=(debtors[k]||0)+itemsTotal;
    }
  });
  let unsoldUnits=0, unsoldPotential=0;
  shipProds.forEach(p=>{
    (p.variants||[]).forEach(v=>{
      const qty=(v.ra||0)+(v.flora||0); if(qty<=0) return;
      unsoldUnits+=qty;
      unsoldPotential+=qty*(p.store==='flora'?(p.priceFlora||p.price||0):(p.priceRAPiece||p.price||0));
    });
  });
  const profit=collected-cost;
  const recoveryPct=cost>0?Math.min(100,Math.round((collected/cost)*100)):100;
  const canRecover=(collected+unsoldPotential)>=cost;
  const margin=collected>0?Math.round((profit/collected)*100):0;
  return {cost,collected,outstanding,totalInvoiced,profit,recoveryPct,canRecover,unsoldUnits,unsoldPotential,margin,debtors};
}

// ── Main render ──
function renderFinance(){
  // Default to overview tab on first load
  const overviewEl=document.getElementById('fin-tab-overview');
  if(overviewEl && overviewEl.style.display==='') setFinTab('overview');

  now=new Date();
  if(finPeriod==='custom'){
    finCustomFrom=document.getElementById('fin-date-from')?.value||'';
    finCustomTo=document.getElementById('fin-date-to')?.value||'';
  }
  loadExpenses();

  const fmt0 = n=>'$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});
  const fmt2 = n=>'$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Revenue
  const raRev = invoices.filter(i=>(finStore==='all'||finStore==='ra')&&i.store==='ra'&&(i.status==='paid'||i.status==='partial')&&finInPeriod(i.date)).reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0);
  const floraRev = floraOrders.filter(o=>(finStore==='all'||finStore==='flora')&&o.status==='delivered'&&finInPeriod(null,o.createdAt)).reduce((s,o)=>s+(o.total||0),0);
  const floraInvRev = invoices.filter(i=>(finStore==='all'||finStore==='flora')&&i.store==='flora'&&(i.status==='paid'||i.status==='partial')&&finInPeriod(i.date)).reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0);
  const totalRev = raRev+floraRev+floraInvRev;

  // Costs
  const shipCosts = shipments.filter(s=>(finStore==='all'||s.forStore===finStore)&&finInPeriod(finCostBy==='order'?(s.orderDate||s.eta):s.eta)).reduce((s,sh)=>s+(sh.cost||0),0);
  const expCosts  = expenses.filter(e=>(finStore==='all'||e.store===finStore||e.store==='both')&&finInPeriod(e.date)).reduce((s,e)=>s+(e.amount||0),0);
  const totalCosts = shipCosts+expCosts;

  // Losses
  const lossTotal = losses.filter(l=>finInPeriod(l.date)).reduce((s,l)=>s+(l.amount||0),0);
  const lossByType = {shortage:0,bad_debt:0,refund_expired:0};
  losses.filter(l=>finInPeriod(l.date)).forEach(l=>{ if(lossByType[l.type]!==undefined) lossByType[l.type]+=(l.amount||0); });

  // Profit
  const profit = totalRev-totalCosts-lossTotal;
  const marginPct = totalRev>0?Math.round((profit/totalRev)*100):0;

  // Outstanding
  const outstanding = invoices.filter(i=>(finStore==='all'||i.store===finStore)&&(i.status==='unpaid'||i.status==='partial'||i.status==='shipped')&&finInPeriod(i.date)).reduce((s,i)=>s+((i.total||0)-(i.paidAmt||0)),0);

  // Update DOM
  const set = (id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  set('fin-revenue', fmt0(totalRev));
  set('fin-costs',   fmt0(totalCosts));
  set('fin-outstanding', fmt0(outstanding));
  set('fin-losses-total-big', fmt2(lossTotal));
  set('fin-loss-shortage',    fmt2(lossByType.shortage));
  set('fin-loss-baddebt',     fmt2(lossByType.bad_debt));
  set('fin-loss-refund',      fmt2(lossByType.refund_expired));

  const profEl=document.getElementById('fin-profit');
  if(profEl){ profEl.textContent=fmt0(Math.abs(profit)); profEl.style.color=profit>=0?'#4ade80':'#f87171'; }
  const finLossEl=document.getElementById('fin-losses');
  if(finLossEl){ finLossEl.textContent=fmt0(lossTotal); finLossEl.style.color=lossTotal>0?'#fca5a5':'rgba(255,255,255,0.4)'; }

  const mpEl=document.getElementById('fin-margin-pct');
  if(mpEl){ mpEl.textContent=(profit<0?'-':'')+Math.abs(marginPct)+'%'; mpEl.style.color=marginPct>=0?'rgba(255,255,255,0.7)':'#f87171'; }
  const barEl=document.getElementById('fin-margin-bar');
  if(barEl){ barEl.style.width=Math.max(0,Math.min(100,marginPct))+'%'; barEl.style.background=marginPct<0?'#f87171':'linear-gradient(90deg,#4ade80,#22d3ee)'; }

  // Render all sections
  _renderFinChart();
  _renderMonthly();
  _renderBreakdown(raRev,floraRev+floraInvRev,fmt0);
  _renderExpenseBreakdown(fmt0,fmt2);
  _renderDebtSummary(fmt0,fmt2);
  _renderShipCards(fmt0,fmt2);
  _renderStockCard();
  _renderShipComparison();
  _renderBestSellers();
  _renderProfitPerProduct();
  _renderBundles();
  _renderLossLog(fmt2,lossByType,lossTotal);
}

// ── Revenue chart ──
function _renderFinChart(){
  const el=document.getElementById('fin-chart'); if(!el) return;
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now2=new Date(); const data=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now2.getFullYear(),now2.getMonth()-i,1);
    const yr=d.getFullYear(),mo=d.getMonth();
    const rev=invoices.filter(x=>{const dt=new Date(x.date+'T12:00:00');return dt.getFullYear()===yr&&dt.getMonth()===mo&&(x.status==='paid'||x.status==='partial');}).reduce((s,x)=>s+(x.status==='paid'?(x.total||0):(x.paidAmt||0)),0)
      +floraOrders.filter(o=>{const dt=new Date(o.createdAt);return dt.getFullYear()===yr&&dt.getMonth()===mo&&o.status==='delivered';}).reduce((s,o)=>s+(o.total||0),0);
    data.push({label:months[mo],value:rev,isCurrent:i===0});
  }
  const max=Math.max(...data.map(d=>d.value),1);
  el.innerHTML=`<div style="display:flex;align-items:flex-end;gap:6px;height:90px">
    ${data.map(d=>{
      const h=Math.max(4,Math.round((d.value/max)*72));
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="font-size:9px;color:var(--muted);font-weight:600">${d.value>999?(d.value/1000).toFixed(1)+'k':Math.round(d.value)||''}</div>
        <div style="width:100%;height:${h}px;background:${d.isCurrent?'linear-gradient(180deg,#a78bfa,#7c3aed)':'#e9d5ff'};border-radius:6px 6px 0 0;transition:height 0.4s"></div>
        <div style="font-size:9px;color:${d.isCurrent?'var(--ink)':'var(--muted)'};font-weight:${d.isCurrent?700:500}">${d.label}</div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Monthly income vs expenses ──
function _renderMonthly(){
  const el=document.getElementById('fin-monthly-overview'); if(!el) return;
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now2=new Date(); const rows=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now2.getFullYear(),now2.getMonth()-i,1);
    const yr=d.getFullYear(),mo=d.getMonth();
    const inM=ds=>{if(!ds)return false;const dt=new Date(ds+'T12:00:00');return dt.getFullYear()===yr&&dt.getMonth()===mo;};
    const revenue=invoices.filter(x=>inM(x.date)&&(x.status==='paid'||x.status==='partial')).reduce((s,x)=>s+(x.status==='paid'?(x.total||0):(x.paidAmt||0)),0)
      +floraOrders.filter(o=>{const dt=new Date(o.createdAt);return dt.getFullYear()===yr&&dt.getMonth()===mo&&o.status==='delivered';}).reduce((s,o)=>s+(o.total||0),0);
    const costs=shipments.filter(s=>inM(finCostBy==='order'?(s.orderDate||s.eta):s.eta)).reduce((s,sh)=>s+(sh.cost||0),0)
      +expenses.filter(e=>inM(e.date)).reduce((s,e)=>s+(e.amount||0),0);
    const lossAmt=losses.filter(l=>inM(l.date)).reduce((s,l)=>s+(l.amount||0),0);
    const profit=revenue-costs-lossAmt;
    rows.push({label:months[mo]+(yr!==now2.getFullYear()?' '+(yr+'').slice(2):''),revenue,costs,lossAmt,profit,isCurrent:i===0});
  }
  const maxVal=Math.max(...rows.map(r=>Math.max(r.revenue,r.costs)),1);
  el.innerHTML=rows.map(r=>{
    const pCol=r.profit>=0?'#059669':'#dc2626';
    const revW=Math.round((r.revenue/maxVal)*100);
    const cosW=Math.round((r.costs/maxVal)*100);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--grey2);${r.isCurrent?'background:linear-gradient(90deg,rgba(124,58,237,0.04),transparent);border-radius:8px;padding:10px 8px;':''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:${r.isCurrent?800:600};color:${r.isCurrent?'var(--ink)':'var(--ink-light)'}">${r.label}${r.isCurrent?' <span style="font-size:9px;background:#7c3aed;color:white;border-radius:20px;padding:1px 6px;font-weight:700">now</span>':''}</div>
        <div style="font-size:13px;font-weight:700;color:${pCol}">${r.profit>=0?'+':''}$${Math.abs(r.profit).toFixed(0)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="font-size:9px;color:#059669;width:22px;font-weight:700">IN</div>
          <div style="flex:1;height:7px;background:var(--grey2);border-radius:4px"><div style="height:100%;width:${revW}%;background:linear-gradient(90deg,#4ade80,#059669);border-radius:4px;transition:width 0.5s"></div></div>
          <div style="font-size:10px;font-weight:700;color:#059669;width:44px;text-align:right">$${Math.round(r.revenue)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="font-size:9px;color:#dc2626;width:22px;font-weight:700">OUT</div>
          <div style="flex:1;height:7px;background:var(--grey2);border-radius:4px"><div style="height:100%;width:${cosW}%;background:linear-gradient(90deg,#f87171,#dc2626);border-radius:4px;transition:width 0.5s"></div></div>
          <div style="font-size:10px;font-weight:700;color:#dc2626;width:44px;text-align:right">$${Math.round(r.costs)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Revenue breakdown ──
function _renderBreakdown(raRev,floraRev,fmt0){
  const el=document.getElementById('fin-breakdown'); if(!el) return;
  if(finStore!=='all'){ el.innerHTML=`<div style="font-size:13px;color:var(--muted);text-align:center;padding:6px 0">Filtered to ${finStore==='ra'?'🏪 RA':'🌸 Flora'} only</div>`; return; }
  const grand=(raRev+floraRev)||1;
  const raPct=Math.round(raRev/grand*100), flPct=Math.round(floraRev/grand*100);
  el.innerHTML=[
    {label:'🏪 RA Wholesale',val:raRev,pct:raPct,color:'#f43f5e'},
    {label:'🌸 Flora Retail',val:floraRev,pct:flPct,color:'#a855f7'}
  ].map(x=>`<div style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span style="font-size:13px;font-weight:600;color:var(--ink)">${x.label}</span>
      <span style="font-size:13px;font-weight:700;color:${x.color}">${fmt0(x.val)} <span style="font-size:10px;color:var(--muted)">${x.pct}%</span></span>
    </div>
    <div class="fin-bar-wrap"><div class="fin-bar" style="width:${x.pct}%;background:${x.color}"></div></div>
  </div>`).join('');
}

// ── Expense breakdown by category ──
function _renderExpenseBreakdown(fmt0,fmt2){
  const el=document.getElementById('fin-expense-breakdown'); if(!el) return;
  const EXP_CATS={transport:{label:'Transport',icon:'🚗',color:'#0891b2'},packaging:{label:'Packaging',icon:'📦',color:'#7c3aed'},rent:{label:'Rent',icon:'🏠',color:'#059669'},shipping:{label:'Shipping',icon:'✈️',color:'#2563eb'},marketing:{label:'Marketing / Ads',icon:'📱',color:'#db2777'},salary:{label:'Salary',icon:'👤',color:'#d97706'},other:{label:'Other',icon:'📋',color:'#6b7280'}};
  const filtered=expenses.filter(e=>(finStore==='all'||e.store===finStore||e.store==='both')&&finInPeriod(e.date));
  if(!filtered.length){ el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px 0">No expenses in this period</div>'; return; }
  const byCat={};
  filtered.forEach(e=>{ byCat[e.cat]=(byCat[e.cat]||0)+(e.amount||0); });
  const total=filtered.reduce((s,e)=>s+(e.amount||0),0);
  const sorted=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const maxVal=sorted[0]?.[1]||1;
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--grey2)">
    <span style="font-size:13px;font-weight:600;color:var(--ink)">Total Expenses</span>
    <span style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--red)">${fmt2(total)}</span>
  </div>
  ${sorted.map(([cat,amt])=>{
    const c=EXP_CATS[cat]||{label:cat,icon:'📋',color:'#6b7280'};
    const pct=Math.round((amt/maxVal)*100);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--grey2)">
      <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0" style="background:${c.color}20">${c.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:12px;font-weight:600;color:var(--ink)">${c.label}</span>
          <span style="font-size:12px;font-weight:700;color:${c.color}">${fmt0(amt)}</span>
        </div>
        <div style="height:5px;background:var(--grey2);border-radius:5px"><div style="height:100%;width:${pct}%;background:${c.color};border-radius:5px;transition:width 0.4s"></div></div>
      </div>
    </div>`;
  }).join('')}`;
}

// ── Customer debt summary ──
function _renderDebtSummary(fmt0,fmt2){
  const el=document.getElementById('fin-debt-summary'); if(!el) return;
  const debtors=customers.filter(c=>!c.blacklisted&&c.debt>0).sort((a,b)=>b.debt-a.debt);
  const blackDebt=customers.filter(c=>c.blacklisted&&(c.writtenOff||0)>0);
  const totalOwed=debtors.reduce((s,c)=>s+(c.debt||0),0);
  const totalWritten=blackDebt.reduce((s,c)=>s+(c.writtenOff||0),0);
  if(!debtors.length&&!blackDebt.length){ el.innerHTML='<div style="text-align:center;padding:16px 0"><div style="font-size:28px;margin-bottom:6px">🎉</div><div style="font-size:13px;font-weight:600;color:var(--green)">No outstanding debt!</div></div>'; return; }
  el.innerHTML=`
    ${totalOwed>0?`<div style="background:linear-gradient(135deg,#451a03,#78350f);border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:4px">Total Owed to You</div>
      <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#fcd34d">${fmt2(totalOwed)}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px">${debtors.length} customer${debtors.length>1?'s':''}</div>
    </div>`:''}
    ${debtors.slice(0,5).map(c=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--grey2)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--rose-pale);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--rose);flex-shrink:0">${(c.name||'?').charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--ink)">${c.name}</div>
          <div style="font-size:10px;color:var(--muted)">${c.lastOrderDate?'Last order: '+c.lastOrderDate:'No date'}</div>
        </div>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--red)">${fmt2(c.debt)}</div>
    </div>`).join('')}
    ${debtors.length>5?`<div style="font-size:11px;color:var(--muted);text-align:center;padding:8px 0">+${debtors.length-5} more customers</div>`:''}
    ${totalWritten>0?`<div style="margin-top:10px;padding:10px 12px;background:var(--red-soft);border-radius:12px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:12px;font-weight:700;color:var(--red)">🚫 Written Off (Blacklisted)</div><div style="font-size:10px;color:var(--muted);margin-top:2px">${blackDebt.length} customer${blackDebt.length>1?'s':''}</div></div>
      <div style="font-size:14px;font-weight:700;color:var(--red)">${fmt2(totalWritten)}</div>
    </div>`:''}`;
}

// ── "If I sold everything" + per shipment cards ──
function _renderStockCard(){
  const recoveredShips=new Set(shipments.filter(s=>s.status==='arrived').filter(s=>{ const pl=calcShipPL(s); return pl.collected>=pl.cost; }).map(s=>s.id));
  const allProds=products.filter(p=>!isProductInTransit(p));
  let totalPotRA=0,totalPotSrc=0,totalRealized=0,totalUnits=0;
  const salesMap={};
  invoices.filter(i=>i.status==='paid'||i.status==='partial').forEach(inv=>{ (inv.items||[]).forEach(it=>{ const pid=it.productId||it.pid; if(!pid) return; if(!salesMap[pid]) salesMap[pid]={rev:0,qty:0}; salesMap[pid].rev+=it.total||(it.qty||1)*(it.price||0); salesMap[pid].qty+=it.qty||1; }); });
  allProds.forEach(p=>{
    const u=getTotalQty(p); totalUnits+=u;
    const cap=p.shipmentId&&recoveredShips.has(p.shipmentId);
    const eff=cap?0:u*(p.cost||0);
    totalPotRA+=u*(p.priceRAPiece||p.priceFlora||0)-eff;
    totalPotSrc+=u*(p.cost||0)-eff;
  });
  Object.entries(salesMap).forEach(([pid,d])=>{ const p=products.find(x=>x.id===pid); totalRealized+=d.rev-(p?.cost||0)*d.qty; });
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('fin-potential-ra','$'+totalPotRA.toFixed(0));
  set('fin-potential-src','$'+totalPotSrc.toFixed(0));
  set('fin-realized-total','$'+totalRealized.toFixed(0));
  set('fin-stock-units',totalUnits+' units');
}

function _renderShipCards(){
  const el=document.getElementById('fin-ship-list'); if(!el) return;
  const relShips=shipments.filter(s=>finStore==='all'||s.forStore===finStore);
  if(!relShips.length){ el.innerHTML='<div style="background:var(--white);border-radius:18px;padding:24px;text-align:center;color:var(--muted);font-size:13px;box-shadow:var(--shadow);margin-bottom:14px">No shipments yet</div>'; return; }
  el.innerHTML=relShips.map(s=>{
    const {cost,collected,outstanding:owed,totalInvoiced,profit,recoveryPct,canRecover,unsoldUnits,unsoldPotential,margin,debtors}=calcShipPL(s);
    const isOpen=_finOpen.has(s.id);
    const recCol=recoveryPct>=100?'#4ade80':recoveryPct>=60?'#fbbf24':'#f87171';
    const profCol=profit>=0?'#4ade80':'#f87171';
    const statusIcon=profit>0?'✅':profit<0&&!canRecover?'🔴':'⏳';
    const debtorEntries=Object.entries(debtors);
    return `<div style="background:var(--white);border-radius:18px;margin-bottom:12px;box-shadow:var(--shadow);overflow:hidden;border:1.5px solid var(--grey2)">
      <div onclick="toggleFinShip('${s.id}')" style="display:flex;align-items:center;gap:12px;padding:16px;cursor:pointer">
        <div style="font-size:24px">${statusIcon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name||'Shipment'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Cost $${cost.toFixed(0)}${s.eta?' · '+s.eta:''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:${profCol}">${profit>=0?'+':''}$${profit.toFixed(0)}</div>
          <div style="font-size:10px;font-weight:700;color:${recCol}">${recoveryPct}% recovered</div>
        </div>
        <div id="fsc-${s.id}" style="font-size:18px;color:var(--muted);transition:transform 0.2s;flex-shrink:0;transform:${isOpen?'rotate(90deg)':'rotate(0deg)'}">›</div>
      </div>
      <div style="padding:0 16px 12px">
        <div style="height:6px;background:var(--grey);border-radius:6px;overflow:hidden">
          <div style="height:100%;width:${Math.min(100,recoveryPct)}%;background:${recCol};border-radius:6px;transition:width 0.5s"></div>
        </div>
      </div>
      <div id="fsb-${s.id}" style="display:${isOpen?'block':'none'};border-top:1px solid var(--grey2);padding:14px 16px">
        ${[
          ['📋 Invoiced','$'+totalInvoiced.toFixed(0),'var(--ink)'],
          ['✅ Collected','$'+collected.toFixed(0),'#4ade80'],
          ['⏳ Outstanding','$'+owed.toFixed(0),owed>0?'#fbbf24':'var(--muted)'],
          ['💸 Cost','$'+cost.toFixed(0),'var(--ink)'],
          ['🏆 Profit',(profit>=0?'+':'')+'$'+profit.toFixed(0),profCol],
        ].map(([lbl,val,col])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--grey2)">
          <span style="font-size:13px;color:var(--ink-light)">${lbl}</span>
          <span style="font-size:13px;font-weight:700;color:${col}">${val}</span>
        </div>`).join('')}
        ${unsoldUnits>0?`<div style="margin-top:10px;padding:10px 12px;background:${canRecover?'#f0fdf4':'#fef2f2'};border-radius:12px;border:1px solid ${canRecover?'#bbf7d0':'#fecaca'}">
          <div style="font-size:11px;font-weight:700;color:${canRecover?'#059669':'#dc2626'};margin-bottom:6px">${canRecover?'✅ Can recover cost':'🔴 Cannot break even'}</div>
          <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--muted)">${unsoldUnits} units unsold</span><span style="font-weight:700;color:#059669">+$${unsoldPotential.toFixed(0)} potential</span></div>
        </div>`:'<div style="margin-top:8px;font-size:12px;color:var(--muted);text-align:center">📦 All stock sold</div>'}
        ${debtorEntries.length?`<div style="margin-top:10px"><div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px">⚠️ Who Owes You</div>
          ${debtorEntries.map(([n,a])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--grey2)"><span style="font-size:12px;font-weight:600">${n}</span><span style="font-size:12px;font-weight:700;color:var(--red)">$${a.toFixed(0)}</span></div>`).join('')}
        </div>`:''}
      </div>
    </div>`;
  }).join('');
}

function _renderShipComparison(){
  const el=document.getElementById('fin-ship-comparison'); if(!el) return;
  const arrived=shipments.filter(s=>s.status==='arrived').slice(-5);
  if(arrived.length<2){ el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px 0">Need at least 2 arrived shipments to compare</div>'; return; }
  const data=arrived.map(s=>{const pl=calcShipPL(s);return{s,profit:pl.profit,cost:s.cost||0,margin:pl.margin||0,collected:pl.collected};}).sort((a,b)=>b.margin-a.margin);
  const maxMargin=Math.max(...data.map(d=>Math.abs(d.margin)),1);
  el.innerHTML=data.map((d,i)=>{
    const col=d.profit>=0?'#059669':'#dc2626';
    const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    const pct=Math.round((Math.abs(d.margin)/maxMargin)*100);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--grey2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <span style="font-size:13px;font-weight:700;color:var(--ink)">${medal} ${d.s.name}</span>
        <span style="font-size:13px;font-weight:700;color:${col}">${d.margin}% margin</span>
      </div>
      <div style="height:5px;background:var(--grey2);border-radius:5px;margin-bottom:5px"><div style="height:100%;width:${pct}%;background:${d.profit>=0?'linear-gradient(90deg,#4ade80,#059669)':'linear-gradient(90deg,#f87171,#dc2626)'};border-radius:5px;transition:width 0.5s"></div></div>
      <div style="display:flex;gap:12px"><span style="font-size:10px;color:var(--muted)">Cost $${d.cost.toFixed(0)}</span><span style="font-size:10px;color:#059669">In $${d.collected.toFixed(0)}</span><span style="font-size:10px;color:${col}">Profit $${d.profit.toFixed(0)}</span></div>
    </div>`;
  }).join('');
}

// ── Best sellers ──
function _renderBestSellers(){
  const el=document.getElementById('fin-bestsellers'); if(!el) return;
  const sm={};
  invoices.filter(i=>(i.status==='paid'||i.status==='partial')&&finInPeriod(i.date)).forEach(inv=>{ (inv.items||[]).forEach(it=>{ const pid=it.productId||it.pid; if(!pid) return; if(!sm[pid]) sm[pid]={rev:0,qty:0}; sm[pid].rev+=it.total||(it.qty||1)*(it.price||0); sm[pid].qty+=it.qty||1; }); });
  floraOrders.filter(o=>o.status==='delivered'&&finInPeriod(null,o.createdAt)).forEach(o=>{ (o.items||[]).forEach(it=>{ const pid=it.productId; if(!pid) return; if(!sm[pid]) sm[pid]={rev:0,qty:0}; sm[pid].rev+=(it.qty||0)*(it.price||0); sm[pid].qty+=it.qty||1; }); });
  const top=Object.entries(sm).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5);
  if(!top.length){ el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0">No sales data yet</div>'; return; }
  const maxRev=top[0][1].rev||1;
  el.innerHTML=top.map(([pid,d],i)=>{
    const p=products.find(x=>x.id===pid);
    const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    const pct=Math.round((d.rev/maxRev)*100);
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;color:var(--ink)">${medal} ${p?p.emoji+' '+p.name:'Unknown'}</span>
        <span style="font-size:13px;font-weight:700;color:#7c3aed">$${d.rev.toFixed(0)}</span>
      </div>
      <div style="height:6px;background:#f3e8ff;border-radius:4px"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#a78bfa,#7c3aed);border-radius:4px;transition:width 0.4s"></div></div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${d.qty} units sold</div>
    </div>`;
  }).join('');
}

// ── Profit per product ──
function setPPView(v){
  _ppView=v;
  const r=document.getElementById('ppv-btn-ra'),s=document.getElementById('ppv-btn-src');
  if(r){r.style.background=v==='ra'?'var(--rose)':'var(--white)';r.style.color=v==='ra'?'white':'var(--muted)';r.style.borderColor=v==='ra'?'var(--rose)':'var(--grey2)';}
  if(s){s.style.background=v==='src'?'#2563eb':'var(--white)';s.style.color=v==='src'?'white':'var(--muted)';s.style.borderColor=v==='src'?'#2563eb':'var(--grey2)';}
  _renderProfitPerProduct();
}

function _renderProfitPerProduct(){
  const el=document.getElementById('fin-profit-products'); if(!el) return;
  const recoveredShips=new Set(shipments.filter(s=>s.status==='arrived').filter(s=>{const pl=calcShipPL(s);return pl.collected>=pl.cost;}).map(s=>s.id));
  const sm={};
  invoices.filter(i=>(i.status==='paid'||i.status==='partial')&&finInPeriod(i.date)).forEach(inv=>{ (inv.items||[]).forEach(it=>{ const pid=it.productId||it.pid; if(!pid) return; if(!sm[pid]) sm[pid]={rev:0,qty:0}; sm[pid].rev+=it.total||(it.qty||1)*(it.price||0); sm[pid].qty+=it.qty||1; }); });
  const allProds=products.filter(p=>p.priceRAPiece||p.priceFlora||p.cost);
  const items=allProds.map(p=>{
    const u=getTotalQty(p),sold=sm[p.id]||{rev:0,qty:0};
    const raPrice=p.priceRAPiece||p.priceFlora||0,arrCost=p.cost||0;
    const cap=p.shipmentId&&recoveredShips.has(p.shipmentId);
    const eff=cap?0:arrCost;
    const potRA=(u*raPrice)-(u*eff),potSrc=(u*arrCost)-(u*eff);
    const realized=sold.rev-(arrCost*sold.qty);
    return{p,u,sold,raPrice,arrCost,potRA,potSrc,realized,cap};
  }).filter(x=>x.u>0||x.sold.qty>0).sort((a,b)=>(_ppView==='ra'?b.potRA-a.potRA:b.potSrc-a.potSrc));
  if(!items.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">No products with pricing yet</div>';return;}
  el.innerHTML=items.map(({p,u,sold,raPrice,arrCost,potRA,potSrc,realized,cap})=>{
    const profit=_ppView==='ra'?potRA:potSrc;
    const pCol=profit>=0?(_ppView==='ra'?'#059669':'#2563eb'):'#dc2626';
    const rCol=realized>=0?'#059669':'#dc2626';
    return `<div style="padding:12px 0;border-bottom:1px solid var(--grey2)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:20px;flex-shrink:0">${p.emoji||'📦'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:1px">${u} in stock${sold.qty>0?' · '+sold.qty+' sold':''}${cap?' · <span style="color:#059669;font-weight:700">capital ✓</span>':''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:15px;font-weight:700;color:${pCol}">$${profit.toFixed(0)}</div>
          <div style="font-size:9px;color:var(--muted)">potential</div>
        </div>
      </div>
      ${sold.qty>0?`<div style="display:flex;justify-content:space-between;background:var(--grey);border-radius:8px;padding:5px 10px;margin-top:6px">
        <span style="font-size:10px;color:var(--muted)">✅ Realized (${sold.qty} sold)</span>
        <span style="font-size:11px;font-weight:700;color:${rCol}">$${realized.toFixed(0)}</span>
      </div>`:''}
    </div>`;
  }).join('');
}

// ── Bundle popularity ──
function _renderBundles(){
  const el=document.getElementById('fin-bundle-pop'); if(!el) return;
  if(!bundles.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">No bundles yet</div>';return;}
  const cm={};
  bundles.forEach(b=>{cm[b.id]=0;});
  floraOrders.forEach(o=>{if(o.bundleId&&cm[o.bundleId]!==undefined)cm[o.bundleId]++;});
  const sorted=bundles.map(b=>({b,count:cm[b.id]||0})).sort((a,b)=>b.count-a.count);
  const max=Math.max(...sorted.map(x=>x.count),1);
  el.innerHTML=sorted.map(({b,count},i)=>{
    const medal=i===0&&count>0?'🥇':i===1&&count>0?'🥈':i===2&&count>0?'🥉':'';
    const profit=(b.sellPrice||0)-((b.cost||0)+(b.pkgCost||0));
    const pct=Math.round((count/max)*100);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--grey2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-size:18px">${medal||b.emoji||'🎁'}</div>
          <div><div style="font-size:13px;font-weight:700;color:var(--ink)">${b.name}</div>
          <div style="font-size:10px;color:var(--muted)">Profit/sale: <span style="color:#059669;font-weight:700">$${profit.toFixed(2)}</span></div></div>
        </div>
        <div style="text-align:right"><div style="font-size:15px;font-weight:700;color:#7c3aed">${count}</div><div style="font-size:9px;color:var(--muted)">orders</div></div>
      </div>
      <div style="height:4px;background:var(--grey);border-radius:4px"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#c4b5fd,#7c3aed);border-radius:4px;transition:width 0.4s"></div></div>
    </div>`;
  }).join('');
}

// ── Loss log ──
function _renderLossLog(fmt2,lossByType,lossTotal){
  const el=document.getElementById('fin-losses-breakdown'); if(!el) return;
  const card=document.getElementById('fin-losses-card');
  const filtered=losses.filter(l=>finInPeriod(l.date));
  if(!filtered.length){
    if(card) card.style.display='none';
    el.innerHTML='<div style="text-align:center;padding:16px 0"><div style="font-size:28px;margin-bottom:6px">🎉</div><div style="font-size:13px;font-weight:600;color:var(--green)">No losses in this period!</div></div>';
    return;
  }
  if(card) card.style.display='block';
  const entries=filtered.slice().reverse().map(l=>{
    const icon=l.type==='shortage'?'📦':l.type==='bad_debt'?'🚫':'🔄';
    const typeLabel=l.type==='shortage'?'Shortage':l.type==='bad_debt'?'Bad Debt':'Expired Refund';
    const typeColor=l.type==='shortage'?'#f97316':l.type==='bad_debt'?'#dc2626':'#7c3aed';
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--grey2)">
      <div style="width:34px;height:34px;border-radius:10px;background:${typeColor}18;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--ink)">${l.note||typeLabel}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:2px">
          <span style="font-size:9px;font-weight:700;color:${typeColor};background:${typeColor}18;padding:1px 6px;border-radius:20px">${typeLabel}</span>
          <span style="font-size:10px;color:var(--muted)">${l.date}${l.shipmentName?' · '+l.shipmentName:''}</span>
        </div>
      </div>
      <div style="font-size:14px;font-weight:700;color:#dc2626;flex-shrink:0">${fmt2(l.amount||0)}</div>
    </div>`;
  }).join('');
  el.innerHTML=entries||'<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">No entries</div>';
}

// ── Flora occasions (defined in calendar.js — stub here for compat) ──
var FLORA_OCCASIONS = typeof FLORA_OCCASIONS !== 'undefined' ? FLORA_OCCASIONS : [];
function renderOccasionCalendar(){ /* defined in calendar.js */ }

// ── Compat stubs (referenced by other files) ──
function renderFinChart(){ _renderFinChart(); }
function renderBestSellers(){ _renderBestSellers(); }
function renderProfitPerProduct(){ _renderProfitPerProduct(); }
function renderMonthlyOverview(){ _renderMonthly(); }
function renderShipPLCards(){ _renderShipCards(); }
function renderCapitalRecovery(){}
function renderShipmentComparison(){ _renderShipComparison(); }
function renderLossesBreakdown(){ _renderLossLog(n=>'$'+(n||0).toFixed(2),{},{}) }
function renderBundlePopularity(){ _renderBundles(); }
function renderCapitalRecoveryBanner(){}
function renderReorderSuggestions(){}

// ═══════════════════════════════════════════════════
// AD CAMPAIGNS
// ═══════════════════════════════════════════════════

var _campStore = typeof _campStore !== 'undefined' ? _campStore : 'all';
var _campSelectedProds = typeof _campSelectedProds !== 'undefined' ? _campSelectedProds : []; // [{pid, adPrice, qtySold}]

function setFinTab(tab){
  ['overview','shipments','products','losses','ads'].forEach(t=>{
    const el=document.getElementById('fin-tab-'+t);
    const btn=document.getElementById('fst-'+t);
    if(el) el.style.display = t===tab ? 'block' : 'none';
    if(btn) btn.classList.toggle('active', t===tab);
  });
  if(tab==='ads') _renderCampaigns();
}

function openNewCampaign(){
  _campStore='all'; _campSelectedProds=[];
  document.getElementById('campaign-edit-id').value='';
  document.getElementById('campaign-modal-title').textContent='📱 New Campaign';
  document.getElementById('campaign-name').value='';
  document.getElementById('campaign-platform').value='instagram';
  document.getElementById('campaign-budget').value='';
  document.getElementById('campaign-start').value=new Date().toISOString().slice(0,10);
  document.getElementById('campaign-end').value='';
  document.getElementById('campaign-return').value='';
  document.getElementById('campaign-notes').value='';
  _setCampStoreBtn('all');
  _renderCampPicker();
  _renderCampSelected();
  showModal('m-campaign');
}

function openEditCampaign(id){
  const c=adCampaigns.find(x=>x.id===id); if(!c) return;
  _campStore=c.store||'all';
  _campSelectedProds=(c.products||[]).map(p=>({...p}));
  document.getElementById('campaign-edit-id').value=id;
  document.getElementById('campaign-modal-title').textContent='✏️ Edit Campaign';
  document.getElementById('campaign-name').value=c.name||'';
  document.getElementById('campaign-platform').value=c.platform||'instagram';
  document.getElementById('campaign-budget').value=c.budget||'';
  document.getElementById('campaign-start').value=c.startDate||'';
  document.getElementById('campaign-end').value=c.endDate||'';
  document.getElementById('campaign-return').value=c.estimatedReturn||'';
  document.getElementById('campaign-notes').value=c.notes||'';
  _setCampStoreBtn(_campStore);
  _renderCampPicker();
  _renderCampSelected();
  showModal('m-campaign');
}

function setCampStore(store, btn){
  _campStore=store;
  _setCampStoreBtn(store);
  _renderCampPicker();
}

function _setCampStoreBtn(store){
  ['all','ra','flora'].forEach(s=>{
    const b=document.getElementById('cs-btn-'+s);
    if(!b) return;
    const active=s===store;
    b.style.background=active?'var(--rose)':'var(--white)';
    b.style.color=active?'white':'var(--muted)';
    b.style.borderColor=active?'var(--rose)':'var(--grey2)';
  });
}

function _renderCampPicker(){
  const el=document.getElementById('camp-prod-picker'); if(!el) return;
  const selectedIds=new Set(_campSelectedProds.map(p=>p.pid));
  const list=products.filter(p=>{
    if(_campStore==='ra') return p.store==='ra'||p.store==='both';
    if(_campStore==='flora') return p.store==='flora'||p.store==='both';
    return true;
  });
  if(!list.length){ el.innerHTML='<div style="font-size:12px;color:var(--muted)">No products found</div>'; return; }
  el.innerHTML=list.map(p=>{
    const sel=selectedIds.has(p.id);
    return `<div onclick="toggleCampProd('${p.id}')" style="padding:6px 12px;border-radius:20px;border:1.5px solid ${sel?'var(--rose)':'var(--grey2)'};background:${sel?'var(--rose-soft)':'var(--white)'};color:${sel?'var(--rose)':'var(--ink-light)'};font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all 0.15s">
      <span>${p.emoji}</span><span>${p.name}</span>${sel?'<span style="font-weight:700">✓</span>':''}
    </div>`;
  }).join('');
}

function toggleCampProd(pid){
  const idx=_campSelectedProds.findIndex(x=>x.pid===pid);
  if(idx>-1){ _campSelectedProds.splice(idx,1); }
  else {
    const p=products.find(x=>x.id===pid); if(!p) return;
    const defPrice=p.priceRAPiece||p.priceFlora||0;
    _campSelectedProds.push({pid, adPrice:defPrice, qtySold:0});
  }
  _renderCampPicker();
  _renderCampSelected();
}

function _renderCampSelected(){
  const wrap=document.getElementById('camp-prod-selected-wrap');
  const el=document.getElementById('camp-prod-selected');
  if(!wrap||!el) return;
  if(!_campSelectedProds.length){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  el.innerHTML=_campSelectedProds.map((cp,i)=>{
    const p=products.find(x=>x.id===cp.pid); if(!p) return '';
    const arrCost=p.cost||0;
    return `<div style="background:var(--grey);border-radius:14px;padding:12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">${p.emoji}</span>
          <span style="font-size:13px;font-weight:700;color:var(--ink)">${p.name}</span>
        </div>
        <button onclick="_campSelectedProds.splice(${i},1);_renderCampPicker();_renderCampSelected()" style="background:var(--red-soft);color:var(--red);border:none;border-radius:8px;padding:3px 8px;font-size:11px;cursor:pointer">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Ad Price ($)</div>
          <input class="fi" type="number" step="0.01" value="${cp.adPrice||''}" placeholder="${arrCost||'0'}" style="font-size:14px;font-weight:700;padding:8px;text-align:center"
            oninput="_campSelectedProds[${i}].adPrice=parseFloat(this.value)||0;_updateCampCalc()">
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Units Sold</div>
          <input class="fi" type="number" min="0" value="${cp.qtySold||''}" placeholder="0" style="font-size:14px;font-weight:700;padding:8px;text-align:center"
            oninput="_campSelectedProds[${i}].qtySold=parseInt(this.value)||0;_updateCampCalc()">
        </div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px">Arrival cost: $${arrCost.toFixed(2)}/unit</div>
    </div>`;
  }).join('');
  _updateCampCalc();
}

function _updateCampCalc(){
  const budget=parseFloat(document.getElementById('campaign-budget')?.value)||0;
  let totalRev=0, totalCOGS=0;
  _campSelectedProds.forEach(cp=>{
    const p=products.find(x=>x.id===cp.pid); if(!p) return;
    totalRev+=(cp.adPrice||0)*(cp.qtySold||0);
    totalCOGS+=(p.cost||0)*(cp.qtySold||0);
  });
  const profit=totalRev-totalCOGS-budget;
  const roi=budget>0?Math.round(((totalRev-totalCOGS-budget)/budget)*100):0;
  const existing=document.getElementById('camp-calc-preview');
  if(existing) existing.remove();
  if(budget>0||totalRev>0){
    const wrap=document.getElementById('camp-prod-selected-wrap');
    if(!wrap) return;
    const div=document.createElement('div');
    div.id='camp-calc-preview';
    div.style.cssText='background:linear-gradient(135deg,#0f172a,#1e1b4b);border-radius:14px;padding:14px;margin-top:10px';
    div.innerHTML=`<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">📊 Campaign Preview</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div style="background:rgba(255,255,255,0.07);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-bottom:3px">Revenue</div>
          <div style="font-size:15px;font-weight:700;color:#4ade80">$${totalRev.toFixed(0)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.07);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-bottom:3px">COGS</div>
          <div style="font-size:15px;font-weight:700;color:#f87171">$${totalCOGS.toFixed(0)}</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.07);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-bottom:4px">Net Profit (after ad spend $${budget.toFixed(0)})</div>
        <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:${profit>=0?'#4ade80':'#f87171'}">${profit>=0?'+':''}$${profit.toFixed(0)}</div>
        <div style="font-size:11px;color:${roi>=0?'#a78bfa':'#f87171'};margin-top:3px">ROI: ${roi}%</div>
      </div>`;
    wrap.appendChild(div);
  }
}

function saveCampaign(){
  const name=document.getElementById('campaign-name').value.trim();
  if(!name){ showToast('Enter a campaign name','err'); return; }
  const budget=parseFloat(document.getElementById('campaign-budget').value)||0;
  if(!budget){ showToast('Enter the budget spent','err'); return; }

  // Calculate totals
  let totalRev=0, totalCOGS=0;
  _campSelectedProds.forEach(cp=>{
    const p=products.find(x=>x.id===cp.pid); if(!p) return;
    totalRev+=(cp.adPrice||0)*(cp.qtySold||0);
    totalCOGS+=(p.cost||0)*(cp.qtySold||0);
  });
  const estReturn=parseFloat(document.getElementById('campaign-return').value)||totalRev;

  const data={
    name, platform:document.getElementById('campaign-platform').value,
    budget, startDate:document.getElementById('campaign-start').value,
    endDate:document.getElementById('campaign-end').value,
    estimatedReturn:estReturn, notes:document.getElementById('campaign-notes').value.trim(),
    store:_campStore, products:[..._campSelectedProds],
    calcRev:totalRev, calcCOGS:totalCOGS,
    profit:estReturn-totalCOGS-budget,
    roi:budget>0?Math.round(((estReturn-totalCOGS-budget)/budget)*100):0,
    updatedAt:new Date().toISOString().slice(0,10)
  };

  const editId=document.getElementById('campaign-edit-id').value;
  if(editId){
    const idx=adCampaigns.findIndex(x=>x.id===editId);
    if(idx>-1) adCampaigns[idx]={...adCampaigns[idx],...data};
    showToast('Campaign updated ✅');
  } else {
    adCampaigns.push({id:'camp-'+Date.now(),...data});
    showToast('Campaign saved 📱');
  }

  // Auto-log as marketing expense if not already done
  saveAdCampaigns();
  closeModal('m-campaign');
  _renderCampaigns();
}

function deleteCampaign(id){
  appConfirm('Delete Campaign','Delete this campaign? This cannot be undone.','🗑️ Delete',()=>{
    adCampaigns=adCampaigns.filter(x=>x.id!==id);
    saveAdCampaigns(); _renderCampaigns(); showToast('Deleted');
  });
}

function _renderCampaigns(){
  const el=document.getElementById('fin-campaigns-list'); if(!el) return;

  // Update summary
  const totalSpend=adCampaigns.reduce((s,c)=>s+(c.budget||0),0);
  const totalReturn=adCampaigns.reduce((s,c)=>s+(c.estimatedReturn||0),0);
  const totalCOGS=adCampaigns.reduce((s,c)=>s+(c.calcCOGS||0),0);
  const totalProfit=totalReturn-totalCOGS-totalSpend;
  const totalROI=totalSpend>0?Math.round(((totalReturn-totalCOGS-totalSpend)/totalSpend)*100):0;
  const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setEl('ads-total-spend','$'+totalSpend.toFixed(0));
  setEl('ads-total-return','$'+(totalReturn-totalCOGS).toFixed(0));
  setEl('ads-total-roi',totalROI+'%');
  const roiEl=document.getElementById('ads-total-roi');
  if(roiEl) roiEl.style.color=totalROI>=0?'#a78bfa':'#f87171';

  if(!adCampaigns.length){
    el.innerHTML=`<div style="background:var(--white);border-radius:18px;padding:32px;text-align:center;box-shadow:var(--shadow)">
      <div style="font-size:40px;margin-bottom:12px">📱</div>
      <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">No campaigns yet</div>
      <div style="font-size:13px;color:var(--muted)">Track your ad spend and see real ROI</div>
    </div>`;
    return;
  }

  const PLAT_ICON={instagram:'📸',facebook:'👤',tiktok:'🎵',snapchat:'👻',other:'📱'};
  const sorted=[...adCampaigns].sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));

  el.innerHTML = sorted.map(function(c){
    var roiColor = c.roi>=100 ? '#4ade80' : c.roi>=0 ? '#a78bfa' : '#f87171';
    var profitColor = c.profit>=0 ? '#4ade80' : '#f87171';
    var prodList = c.products||[];
    var platIcon = {instagram:'\u{1F4F8}',facebook:'\u{1F464}',tiktok:'\u{1F3B5}',snapchat:'\u{1F47B}',other:'\u{1F4F1}'};
    var icon = platIcon[c.platform] || '\u{1F4F1}';
    var storeLabel = c.store==='ra' ? '\u{1F3EA} RA' : c.store==='flora' ? '\u{1F338} Flora' : 'All';
    var successBadge = c.profit>=0
      ? '<span style="background:#d1fae5;color:#059669;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700">\u2705 Profitable</span>'
      : '<span style="background:#fee2e2;color:#dc2626;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700">\u274C Not profitable</span>';

    var prodsHtml = '';
    if(prodList.length){
      var chips = prodList.map(function(cp){
        var p = products.find(function(x){ return x.id===cp.pid; });
        if(!p) return '';
        return '<div style="background:var(--grey);border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;color:var(--ink)">'+
          p.emoji+' '+p.name+(cp.qtySold>0?' \u00B7 '+cp.qtySold+' sold':'')+
          '</div>';
      }).join('');
      prodsHtml = '<div style="margin-bottom:10px">'+
        '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Featured Products</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:5px">'+chips+'</div></div>';
    }

    var notesHtml = c.notes
      ? '<div style="font-size:11px;color:var(--muted);font-style:italic;padding:8px 10px;background:var(--grey);border-radius:8px;margin-top:8px">\u0022'+c.notes+'\u0022</div>'
      : '';

    return '<div style="background:var(--white);border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:var(--shadow);border:1.5px solid var(--grey2)">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">'+icon+'</div>'+
          '<div>'+
            '<div style="font-size:14px;font-weight:700;color:var(--ink)">'+c.name+'</div>'+
            '<div style="font-size:10px;color:var(--muted)">'+(c.startDate||'')+(c.endDate?' \u2192 '+c.endDate:'')+' \u00B7 '+storeLabel+'</div>'+
          '</div>'+
        '</div>'+
        '<div style="display:flex;gap:6px">'+
          '<button onclick="openEditCampaign(\''+c.id+'\');" style="background:var(--rose-soft);color:var(--rose);border:none;border-radius:8px;padding:5px 8px;font-size:12px;cursor:pointer">\u270F\uFE0F</button>'+
          '<button onclick="deleteCampaign(\''+c.id+'\');" style="background:var(--grey);color:var(--muted);border:none;border-radius:8px;padding:5px 8px;font-size:12px;cursor:pointer">\u{1F5D1}\uFE0F</button>'+
        '</div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">'+
        '<div style="background:var(--red-soft);border-radius:10px;padding:10px;text-align:center">'+
          '<div style="font-size:9px;color:var(--red);font-weight:700;text-transform:uppercase;margin-bottom:3px">Spent</div>'+
          '<div style="font-size:15px;font-weight:700;color:var(--red)">$'+(c.budget||0).toFixed(0)+'</div>'+
        '</div>'+
        '<div style="background:var(--green-soft);border-radius:10px;padding:10px;text-align:center">'+
          '<div style="font-size:9px;color:var(--green);font-weight:700;text-transform:uppercase;margin-bottom:3px">Profit</div>'+
          '<div style="font-size:15px;font-weight:700;color:'+profitColor+'">'+(c.profit>=0?'+':'')+'$'+(c.profit||0).toFixed(0)+'</div>'+
        '</div>'+
        '<div style="background:#f5f3ff;border-radius:10px;padding:10px;text-align:center">'+
          '<div style="font-size:9px;color:#7c3aed;font-weight:700;text-transform:uppercase;margin-bottom:3px">ROI</div>'+
          '<div style="font-size:15px;font-weight:700;color:'+roiColor+'">'+(c.roi||0)+'%</div>'+
        '</div>'+
      '</div>'+
      '<div style="margin-bottom:10px">'+successBadge+'</div>'+
      prodsHtml+
      notesHtml+
    '</div>';
  }).join('');
}
