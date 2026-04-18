// ═══════════════════════════════════════════════════
// DASHBOARD.JS — Clean redesign, not crowded
// Depends on: data.js, utils.js
// ═══════════════════════════════════════════════════

function initDashboard(){
  now = new Date();
  loadExpenses();

  const h = now.getHours();
  const gr = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const greetEl = document.getElementById('dash-greet');
  if(greetEl) greetEl.textContent = gr + '!';

  const dateLine = now.toLocaleDateString('en', {weekday:'long', month:'long', day:'numeric'});
  const dlEl = document.getElementById('dash-date-line');
  if(dlEl) dlEl.textContent = dateLine;

  if(!window._clockInterval){
    window._clockInterval = setInterval(()=>{
      const el = document.getElementById('dash-live-clock');
      if(!el){ clearInterval(window._clockInterval); window._clockInterval = null; return; }
      const n = new Date();
      const rh = n.getHours();
      el.textContent = `${rh%12||12}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')} ${rh>=12?'PM':'AM'}`;
    }, 1000);
  }
  const clkEl = document.getElementById('dash-live-clock');
  if(clkEl){ const rh = now.getHours(); clkEl.textContent = `${rh%12||12}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} ${rh>=12?'PM':'AM'}`; }

  const banner = document.getElementById('dash-backup-banner');
  const sub = document.getElementById('dash-backup-sub');
  if(banner){
    const last = parseInt(localStorage.getItem('biz_lastBackup')||'0', 10);
    const daysSince = last ? Math.floor((Date.now()-last)/86400000) : null;
    const show = !last || daysSince >= 7;
    banner.style.display = show ? 'flex' : 'none';
    if(sub){
      if(!last) sub.textContent = 'Never backed up — tap to save your data';
      else sub.textContent = daysSince + ' day' + (daysSince===1?'':'s') + ' since last backup';
    }
  }

  _renderDashboard();
}

function _renderDashboard(){
  const wrap = document.getElementById('dash-dynamic');
  if(!wrap) return;

  const fmtD = n => '$' + (n||0).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0});
  const isThisMonth = d => { try { const dt=new Date(d); return dt.getFullYear()===now.getFullYear()&&dt.getMonth()===now.getMonth(); } catch(e){ return false; } };

  // Finance
  const raRev = (typeof invoices!=='undefined') ? invoices.filter(i=>i.store==='ra'&&(i.status==='paid'||i.status==='partial')&&isThisMonth(i.date)).reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0) : 0;
  const floraRev = (typeof floraOrders!=='undefined') ? floraOrders.filter(o=>o.status==='delivered'&&isThisMonth(o.createdAt)).reduce((s,o)=>s+(o.total||0),0) : 0;
  const floraInvRev = (typeof invoices!=='undefined') ? invoices.filter(i=>i.store==='flora'&&(i.status==='paid'||i.status==='partial')&&isThisMonth(i.date)).reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0) : 0;
  const totalRev = raRev + floraRev + floraInvRev;
  const totalCosts = (typeof shipments!=='undefined' ? shipments.filter(sh=>isThisMonth(sh.eta)).reduce((s,sh)=>s+(sh.cost||0),0) : 0)
    + expenses.filter(e=>isThisMonth(e.date)).reduce((s,e)=>s+(e.amount||0),0);
  const totalLosses = losses.filter(l=>isThisMonth(l.date)).reduce((s,l)=>s+(l.amount||0),0);
  const profit = totalRev - totalCosts - totalLosses;
  const profitColor = profit >= 0 ? '#4caf7d' : '#ef4444';

  // Debt
  const debtCustomers = (typeof customers!=='undefined') ? customers.filter(c=>c.debt>0) : [];
  const totalDebt = debtCustomers.reduce((s,c)=>s+(c.debt||0), 0);

  // Invoices
  const invUnpaid = (typeof invoices!=='undefined') ? invoices.filter(i=>i.status==='unpaid'||i.status==='partial'||i.status==='shipped').length : 0;
  const invTotal = (typeof invoices!=='undefined') ? invoices.length : 0;

  // Products
  const visProds = (typeof products!=='undefined') ? products.filter(p=>!isProductInTransit(p)) : [];
  const lowThresh = parseInt(localStorage.getItem('biz_lowstock_threshold')||'10');
  const lowCount = visProds.filter(p=>getTotalQty(p)>0&&getTotalQty(p)<lowThresh).length;
  const outCount = visProds.filter(p=>getTotalQty(p)===0).length;

  // Shipments
  const activeShips = (typeof shipments!=='undefined') ? shipments.filter(s=>s.status==='onway'||s.status==='ordered'||s.status==='arrived') : [];
  const arrivedShips = activeShips.filter(s=>s.status==='arrived');
  const inTransitShips = activeShips.filter(s=>s.status==='onway'||s.status==='ordered');

  // Customers
  const custCount = (typeof customers!=='undefined') ? customers.filter(c=>!c.blacklisted).length : 0;

  // Alerts
  const alertCount = (typeof getSmartAlerts==='function') ? getSmartAlerts().length : 0;
  const overdueRems = reminders.filter(r=>!r.done && r.date < now.toISOString().split('T')[0]).length;
  const totalAlerts = alertCount + overdueRems;

  // Flora
  const floraPending = (typeof floraOrders!=='undefined') ? floraOrders.filter(o=>o.status==='processing'||o.status==='shipped').length : 0;

  // Bundles
  const bundleCount = (typeof bundles!=='undefined') ? bundles.length : 0;

  // Todos
  const today = now.toISOString().slice(0,10);
  const activeTodos = todos.filter(t=>!t.done);
  const overdueTodos = activeTodos.filter(t=>t.due && t.due < today);
  const dueTodayTodos = activeTodos.filter(t=>t.due && t.due===today);

  // Shipment preview
  const STATUS_CLS = {ordered:'ba', onway:'bb', arrived:'bg'};
  const STATUS_LBL = {ordered:'⏳ Ordered', onway:'🚢 On way', arrived:'✅ Arrived'};
  const previewShips = (typeof shipments!=='undefined') ? shipments
    .filter(s=>s.status==='onway'||s.status==='ordered'||s.status==='arrived')
    .sort((a,b)=>(a.eta||'9999').localeCompare(b.eta||'9999'))
    .slice(0,2) : [];

  const shipPreviewHtml = previewShips.length ? previewShips.map(s=>{
    const etaDate = s.eta ? new Date(s.eta+'T12:00:00') : null;
    const daysLeft = etaDate ? Math.ceil((etaDate-now)/(1000*60*60*24)) : null;
    const etaStr = etaDate ? etaDate.toLocaleDateString('en',{month:'short',day:'numeric'}) : '—';
    const daysLabel = daysLeft===null ? '' : daysLeft<0 ? `<span style="color:var(--red);font-weight:700;font-size:11px">Overdue</span>` : daysLeft===0 ? `<span style="color:var(--amber);font-weight:700;font-size:11px">Today!</span>` : `<span style="color:var(--muted);font-size:11px">${daysLeft}d left</span>`;
    const prodCount = (typeof products!=='undefined') ? products.filter(p=>p.shipmentId===s.id).length : 0;
    return `<div onclick="openShipmentDetail('${s.id}')" style="background:var(--white);border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow);border:1.5px solid var(--grey2);cursor:pointer">
      <div style="font-size:22px">${s.status==='arrived'?'✅':s.status==='onway'?'🚢':'⏳'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">${prodCount ? prodCount+' products · ' : ''}📅 ${etaStr}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span class="b ${STATUS_CLS[s.status]}" style="font-size:10px">${STATUS_LBL[s.status]}</span>
        ${daysLabel}
      </div>
    </div>`;
  }).join('') : `<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px 0">No active shipments 🚢</div>`;

  // Todo preview
  const pColors = {high:'var(--red)',medium:'var(--amber)',low:'var(--green)',normal:'var(--muted)'};
  const todoPreviewHtml = activeTodos.slice(0,3).length ? activeTodos.slice(0,3).map(t=>{
    const isOverdue = t.due && t.due < today;
    const isDueToday = t.due && t.due===today;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--grey2)">
      <div style="width:3px;min-height:20px;border-radius:3px;background:${pColors[t.prio]||'var(--muted)'};align-self:stretch;flex-shrink:0"></div>
      <div onclick="toggleTodo('${t.id}')" style="width:20px;height:20px;border-radius:6px;border:2px solid var(--grey2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:11px"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;color:${isOverdue?'var(--red)':'var(--ink)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.text}</div>
        ${isOverdue ? `<div style="font-size:10px;color:var(--red);font-weight:700">⚠️ Overdue</div>` : isDueToday ? `<div style="font-size:10px;color:var(--amber);font-weight:700">📅 Due today</div>` : ''}
      </div>
    </div>`;
  }).join('') : `<div style="color:var(--muted);font-size:13px;padding:12px 0;text-align:center">Nothing pending! 🎉</div>`;

  // Calendar
  const todayStr = now.toISOString().split('T')[0];
  const upcomingEvents = (typeof calEvents!=='undefined') ? calEvents.filter(e=>e.date>=todayStr).sort((a,b)=>a.date.localeCompare(b.date)) : [];
  const nextEvent = upcomingEvents[0];
  const calHtml = nextEvent ? (()=>{
    const d = new Date(nextEvent.date+'T12:00:00');
    const diff = Math.ceil((d-now)/(1000*60*60*24));
    const label = diff===0?'Today':diff===1?'Tomorrow':d.toLocaleDateString('en',{month:'short',day:'numeric'});
    const color = diff<=1?'var(--red)':diff<=3?'var(--amber)':'var(--blue)';
    return `<div onclick="showPage('calendar');setNav('more');renderCalendar()" style="background:var(--white);border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow);border:1.5px solid var(--grey2);cursor:pointer;margin-bottom:14px">
      <div style="width:40px;height:40px;background:var(--blue-soft);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📅</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--ink)">${nextEvent.title||'Event'}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">${upcomingEvents.length} upcoming event${upcomingEvents.length!==1?'s':''}</div>
      </div>
      <div style="font-size:12px;font-weight:800;color:${color}">${label}</div>
    </div>`;
  })() : '';

  // RA owed
  const wsOwed = (typeof invoices!=='undefined') ? invoices.filter(i=>i.store==='ra'&&(i.status==='unpaid'||i.status==='partial'||i.status==='shipped')).reduce((s,i)=>s+((i.total||0)-(i.paidAmt||0)),0) : 0;

  wrap.innerHTML = `
    <!-- FINANCE CARD -->
    <div onclick="showPage('finance');setNav('more');renderFinance()" style="background:linear-gradient(135deg,#1a0a10,#2d1020);border-radius:18px;padding:18px;margin-bottom:14px;cursor:pointer;position:relative;overflow:hidden">
      <div style="position:absolute;right:-20px;top:-20px;width:120px;height:120px;background:radial-gradient(circle,rgba(201,144,10,0.18) 0%,transparent 70%);border-radius:50%;pointer-events:none"></div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:12px;position:relative;z-index:1">📊 This Month</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;position:relative;z-index:1">
        <div style="text-align:center">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:5px">Revenue</div>
          <div style="font-size:20px;font-weight:800;color:white" id="dash-fin-revenue">${fmtD(totalRev)}</div>
        </div>
        <div style="text-align:center;border-left:1px solid rgba(255,255,255,0.1);border-right:1px solid rgba(255,255,255,0.1)">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:5px">Costs</div>
          <div style="font-size:20px;font-weight:800;color:rgba(255,255,255,0.65)" id="dash-fin-costs">${fmtD(totalCosts)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:5px">Profit</div>
          <div style="font-size:20px;font-weight:800;color:${profitColor}" id="dash-fin-profit">${fmtD(Math.abs(profit))}${profit<0?' 📉':''}</div>
        </div>
      </div>
      ${totalLosses>0?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1"><span style="font-size:10px;color:rgba(255,255,255,0.4)">💸 Losses this month</span><span style="font-size:12px;font-weight:700;color:rgba(220,38,38,0.9)">${fmtD(totalLosses)}</span></div>`:''}
    </div>

    <!-- DEBT + INVOICES ROW -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div onclick="showPage('customers');setNav('customers');renderCustomers()" style="background:var(--white);border-radius:16px;padding:14px;box-shadow:var(--shadow);border:1.5px solid var(--grey2);cursor:pointer">
        <div style="font-size:18px;margin-bottom:6px">💰</div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:4px">Owed to You</div>
        <div style="font-size:20px;font-weight:800;color:${totalDebt>0?'var(--amber)':'var(--ink)'}" id="dash-debt-total">${fmtD(totalDebt)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px" id="dash-debt-sub">${debtCustomers.length>0?debtCustomers.length+' customer'+(debtCustomers.length>1?'s':''):'All clear ✅'}</div>
      </div>
      <div onclick="showPage('invoices');setNav('more');renderInvoices()" style="background:var(--white);border-radius:16px;padding:14px;box-shadow:var(--shadow);border:1.5px solid var(--grey2);cursor:pointer">
        <div style="font-size:18px;margin-bottom:6px">🧾</div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:4px">Invoices</div>
        <div style="font-size:20px;font-weight:800;color:var(--ink)" id="dash-inv-count">${invTotal}</div>
        <div style="font-size:11px;margin-top:3px" id="dash-inv-sub">${invUnpaid>0?`<span style="color:var(--red);font-weight:700">${invUnpaid} unpaid</span>`:'<span style="color:var(--green)">All settled ✅</span>'}</div>
      </div>
    </div>

    <!-- STORES ROW -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div onclick="showPage('wholesale');setNav('more');renderWholesale()" style="background:linear-gradient(135deg,#fff8ec,#fffdf5);border-radius:16px;padding:14px;box-shadow:var(--shadow);border:1.5px solid rgba(201,144,10,0.2);cursor:pointer">
        <div style="font-size:18px;margin-bottom:6px">🏪</div>
        <div style="font-size:11px;font-weight:700;color:var(--amber);margin-bottom:4px">RA Wholesale</div>
        <div style="font-size:11px">${wsOwed>0?`<span style="color:var(--amber);font-weight:700">${fmtD(wsOwed)} owed</span>`:'<span style="color:var(--green)">All paid</span>'}</div>
      </div>
      <div onclick="showPage('flora');setNav('more');renderFloraPage()" style="background:linear-gradient(135deg,#fff0f8,#fdf5ff);border-radius:16px;padding:14px;box-shadow:var(--shadow);border:1.5px solid rgba(232,116,138,0.2);cursor:pointer">
        <div style="font-size:18px;margin-bottom:6px">🌸</div>
        <div style="font-size:11px;font-weight:700;color:var(--rose);margin-bottom:4px">Flora Gift</div>
        <div style="font-size:11px" id="dash-flora-sub">${floraPending>0?`<span style="color:var(--rose);font-weight:700">${floraPending} pending</span>`:'<span style="color:var(--green)">All good</span>'}</div>
      </div>
    </div>

    <!-- QUICK STATS 4-grid -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
      <div onclick="showPage('products');setNav('products');renderInventory()" style="background:var(--white);border-radius:14px;padding:12px 8px;text-align:center;box-shadow:var(--shadow);border:1.5px solid var(--grey2);cursor:pointer">
        <div style="font-size:20px;margin-bottom:4px">📦</div>
        <div style="font-size:18px;font-weight:800;color:var(--ink)" id="dash-prod-count">${visProds.length}</div>
        <div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Products</div>
        <div style="margin-top:4px" id="dash-low-count">${outCount>0?`<span style="font-size:9px;font-weight:700;color:var(--red)">${outCount} out</span>`:lowCount>0?`<span style="font-size:9px;font-weight:700;color:var(--amber)">${lowCount} low</span>`:'<span style="font-size:9px;color:var(--green)">✓</span>'}</div>
      </div>
      <div onclick="showPage('customers');setNav('customers');renderCustomers()" style="background:var(--white);border-radius:14px;padding:12px 8px;text-align:center;box-shadow:var(--shadow);border:1.5px solid var(--grey2);cursor:pointer">
        <div style="font-size:20px;margin-bottom:4px">👥</div>
        <div style="font-size:18px;font-weight:800;color:var(--ink)" id="dash-cust-count">${custCount}</div>
        <div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Customers</div>
        <div style="margin-top:4px" id="dash-cust-badge">${debtCustomers.length>0?`<span style="font-size:9px;font-weight:700;color:var(--amber)">${debtCustomers.length} owe</span>`:'<span style="font-size:9px;color:var(--green)">✓</span>'}</div>
      </div>
      <div onclick="showPage('shipments');setNav('more');renderShipments()" style="background:var(--white);border-radius:14px;padding:12px 8px;text-align:center;box-shadow:var(--shadow);border:1.5px solid var(--grey2);cursor:pointer">
        <div style="font-size:20px;margin-bottom:4px">🚢</div>
        <div style="font-size:18px;font-weight:800;color:var(--ink)" id="dash-ship-count">${activeShips.length}</div>
        <div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Shipments</div>
        <div style="margin-top:4px" id="dash-ship-sub">${arrivedShips.length>0?`<span style="font-size:9px;font-weight:700;color:var(--green)">${arrivedShips.length} arrived</span>`:inTransitShips.length>0?`<span style="font-size:9px;font-weight:700;color:var(--blue)">${inTransitShips.length} active</span>`:'<span style="font-size:9px;color:var(--muted)">—</span>'}</div>
      </div>
      <div onclick="showPage('reminders');setNav('reminders');renderSmartAlerts();renderReminders()" style="background:var(--white);border-radius:14px;padding:12px 8px;text-align:center;box-shadow:var(--shadow);border:1.5px solid ${totalAlerts>0?'rgba(220,38,38,0.25)':'var(--grey2)'};cursor:pointer">
        <div style="font-size:20px;margin-bottom:4px">🔔</div>
        <div style="font-size:18px;font-weight:800;color:${totalAlerts>0?'var(--red)':'var(--ink)'}" id="dash-rem-count">${totalAlerts||'0'}</div>
        <div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Alerts</div>
        <div style="margin-top:4px" id="dash-overdue">${totalAlerts>0?`<span style="font-size:9px;font-weight:700;color:var(--red)">urgent</span>`:'<span style="font-size:9px;color:var(--green)">✓</span>'}</div>
      </div>
    </div>

    <!-- SHIPMENTS PREVIEW -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">🚢 Active Shipments</div>
      <button onclick="showPage('shipments');setNav('more');renderShipments()" style="background:none;border:none;font-size:12px;font-weight:700;color:var(--rose);cursor:pointer;padding:0">View all ›</button>
    </div>
    <div id="dash-shipments-preview" style="margin-bottom:14px">${shipPreviewHtml}</div>

    <!-- NEXT CALENDAR EVENT -->
    ${calHtml}

    <!-- TO-DO PREVIEW -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">✅ To-Do</div>
        ${overdueTodos.length>0?`<span style="background:var(--red);color:white;border-radius:50px;padding:1px 7px;font-size:10px;font-weight:700">${overdueTodos.length} overdue</span>`:dueTodayTodos.length>0?`<span style="background:var(--amber);color:white;border-radius:50px;padding:1px 7px;font-size:10px;font-weight:700">${dueTodayTodos.length} today</span>`:''}
      </div>
      <button onclick="showPage('todo');setNav('more');renderTodos()" style="background:none;border:none;font-size:12px;font-weight:700;color:var(--rose);cursor:pointer;padding:0">View all ›</button>
    </div>
    <div style="background:var(--white);border-radius:14px;padding:4px 14px;box-shadow:var(--shadow);margin-bottom:14px" id="dash-todo-preview">${todoPreviewHtml}</div>

    <!-- BUNDLES -->
    <div onclick="showPage('bundles');setNav('more');renderBundles()" style="background:var(--white);border-radius:14px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--shadow);border:1.5px solid var(--grey2);cursor:pointer;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:20px">🎁</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--ink)">Bundles</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">${bundleCount>0?bundleCount+' active bundle'+(bundleCount>1?'s':''):'No bundles yet'}</div>
        </div>
      </div>
      <span style="color:var(--muted);font-size:16px">›</span>
    </div>

    <!-- Hidden compat IDs -->
    <span id="dash-inv-total" style="display:none"></span>
    <span id="dash-inv-label" style="display:none"></span>
    <span id="dash-sup-count" style="display:none"></span>
    <span id="dash-sup-label" style="display:none"></span>
    <span id="dash-cat-count" style="display:none"></span>
    <span id="dash-cat-label" style="display:none"></span>
    <span id="dash-ws-invoiced" style="display:none"></span>
    <span id="dash-flora-orders" style="display:none"></span>
    <span id="dash-bundle-count" style="display:none"></span>
    <span id="dash-bundle-label" style="display:none"></span>
    <div id="dash-reorder-section"></div>
    <div id="dash-calendar-section"></div>
  `;
}

// ═══════════════════════════════════════════════════
// SMART ALERTS ENGINE
// ═══════════════════════════════════════════════════
let alertThresholds = {lowStock:5, debt:100, invoice:14, inactive:60};

function loadAlertThresholds(){
  try { const s = localStorage.getItem('biz_alert_thresholds'); if(s) alertThresholds = {...alertThresholds, ...JSON.parse(s)}; } catch(e){}
  const ids = ['lowstock','debt','invoice','inactive'];
  const keys = ['lowStock','debt','invoice','inactive'];
  ids.forEach((id,i)=>{ const el=document.getElementById('sat-'+id); if(el) el.value=alertThresholds[keys[i]]; });
}

function saveAlertThresholds(){
  alertThresholds.lowStock = parseInt(document.getElementById('sat-lowstock').value,10)||5;
  alertThresholds.debt     = parseFloat(document.getElementById('sat-debt').value)||100;
  alertThresholds.invoice  = parseInt(document.getElementById('sat-invoice').value,10)||14;
  alertThresholds.inactive = parseInt(document.getElementById('sat-inactive').value,10)||60;
  localStorage.setItem('biz_alert_thresholds', JSON.stringify(alertThresholds));
  closeModal('m-alert-settings');
  renderSmartAlerts();
  showToast('Thresholds saved ✅');
}

function getSmartAlerts(){
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const alerts = [];
  const overdueCustomers = customers.filter(c => !c.blacklisted && c.debt > 0);
  if(overdueCustomers.length){ const total = overdueCustomers.reduce((s,c)=>s+(c.debt||0),0); alerts.push({icon:'💰', color:'amber', title:'Customers with unpaid debt', sub:overdueCustomers.length+' customer'+(overdueCustomers.length>1?'s':'')+' · $'+total.toFixed(2)+' total', count:overdueCustomers.length, page:'customers', filter:'debt'}); }
  const highDebtCusts = customers.filter(c => !c.blacklisted && (c.debt||0) >= alertThresholds.debt);
  if(highDebtCusts.length){ alerts.push({icon:'🚨', color:'red', title:'High debt customers', sub:highDebtCusts.map(c=>c.name+' ($'+c.debt.toFixed(2)+')').slice(0,2).join(', ')+(highDebtCusts.length>2?' +more':''), count:highDebtCusts.length, page:'customers', filter:'debt'}); }
  const inactiveCutoff = new Date(today); inactiveCutoff.setDate(inactiveCutoff.getDate() - alertThresholds.inactive);
  const inactiveCusts = customers.filter(c => !c.blacklisted && c.lastOrderDate && c.lastOrderDate < inactiveCutoff.toISOString().split('T')[0]);
  if(inactiveCusts.length){ alerts.push({icon:'😴', color:'purple', title:'Inactive customers', sub:inactiveCusts.length+' haven\'t ordered in '+alertThresholds.inactive+'+ days', count:inactiveCusts.length, page:'customers', filter:'all'}); }
  const lateShips = shipments.filter(s => (s.status==='onway'||s.status==='ordered') && s.eta && s.eta < todayStr);
  if(lateShips.length){ alerts.push({icon:'🚢', color:'red', title:'Shipments past arrival date', sub:lateShips.map(s=>s.name).slice(0,2).join(', ')+(lateShips.length>2?' +more':''), count:lateShips.length, page:'shipments'}); }
  const zeroStock = products.filter(p => !isProductInTransit(p) && getTotalQty(p)===0);
  if(zeroStock.length){ alerts.push({icon:'❌', color:'red', title:'Out of stock products', sub:zeroStock.map(p=>p.name).slice(0,3).join(', ')+(zeroStock.length>3?' +more':''), count:zeroStock.length, page:'products'}); }
  const lowStock = products.filter(p => { if(isProductInTransit(p)) return false; const q=getTotalQty(p); return q>0 && q<=alertThresholds.lowStock; });
  if(lowStock.length){ alerts.push({icon:'⚠️', color:'amber', title:'Low stock products', sub:lowStock.map(p=>p.name+' ('+getTotalQty(p)+')').slice(0,2).join(', ')+(lowStock.length>2?' +more':''), count:lowStock.length, page:'products'}); }
  const invCutoff = new Date(today); invCutoff.setDate(invCutoff.getDate() - alertThresholds.invoice);
  const overdueInvs = (invoices||[]).filter(i => (i.status==='unpaid'||i.status==='shipped'||i.status==='partial') && i.date < invCutoff.toISOString().split('T')[0]);
  if(overdueInvs.length){ const total = overdueInvs.reduce((s,i)=>s+(i.total||0),0); alerts.push({icon:'🧾', color:'red', title:'Overdue unpaid invoices', sub:overdueInvs.length+' invoice'+(overdueInvs.length>1?'s':'')+' · $'+total.toFixed(2)+' total', count:overdueInvs.length, page:'invoices'}); }
  const partialInvs = (invoices||[]).filter(i => i.status==='partial');
  if(partialInvs.length){ const total = partialInvs.reduce((s,i)=>s+(i.total||0)-(i.paidAmt||0),0); alerts.push({icon:'💸', color:'amber', title:'Partially paid invoices', sub:partialInvs.length+' invoice'+(partialInvs.length>1?'s':'')+' · $'+total.toFixed(2)+' remaining', count:partialInvs.length, page:'invoices'}); }
  const lowSupplies = supplies.filter(s => (s.stock||0) > 0 && (s.stock||0) <= (s.reorderAt||10));
  if(lowSupplies.length){ alerts.push({icon:'📦', color:'amber', title:'Packaging & supplies low', sub:lowSupplies.map(s=>s.name+' ('+s.stock+' left)').slice(0,2).join(', ')+(lowSupplies.length>2?' +more':''), count:lowSupplies.length, page:'supplies'}); }
  const processingOrders = floraOrders.filter(o => o.status==='processing');
  if(processingOrders.length){ alerts.push({icon:'⏳', color:'amber', title:'Flora orders still processing', sub:processingOrders.length+' order'+(processingOrders.length>1?'s':'')+' waiting to be shipped', count:processingOrders.length, page:'flora'}); }
  const urgentTodos = todos.filter(t => !t.done && t.prio==='high');
  if(urgentTodos.length){ alerts.push({icon:'🔴', color:'red', title:'Urgent to-do items', sub:urgentTodos.map(t=>t.text).slice(0,2).join(', ')+(urgentTodos.length>2?' +more':''), count:urgentTodos.length, page:'todo'}); }
  const todayEvents = calEvents.filter(e => e.date===todayStr);
  if(todayEvents.length){ alerts.push({icon:'📅', color:'rose', title:'Events today', sub:todayEvents.map(e=>e.title).slice(0,2).join(', ')+(todayEvents.length>2?' +more':''), count:todayEvents.length, page:'calendar'}); }
  const overdueRems = reminders.filter(r => !r.done && r.date < todayStr);
  if(overdueRems.length){ alerts.push({icon:'🔔', color:'red', title:'Overdue reminders', sub:overdueRems.map(r=>r.title).slice(0,2).join(', ')+(overdueRems.length>2?' +more':''), count:overdueRems.length, page:'reminders'}); }
  const soon = new Date(); soon.setDate(soon.getDate()+7);
  const soonStr = soon.toISOString().split('T')[0];
  const expiringRefunds = [];
  shipments.forEach(s=>(s.pendingRefunds||[]).filter(r=>!r.received&&r.deadline&&r.deadline<=soonStr&&r.deadline>=todayStr).forEach(r=>expiringRefunds.push({ship:s.name,name:r.name,deadline:r.deadline})));
  if(expiringRefunds.length){ alerts.push({icon:'⏰',color:'amber',title:'Refunds expiring soon',sub:expiringRefunds.map(r=>`${r.name} — due ${r.deadline}`).slice(0,2).join(', ')+(expiringRefunds.length>2?' +more':''),count:expiringRefunds.length,page:'shipments'}); }
  return alerts;
}

function renderSmartAlerts(){
  loadAlertThresholds();
  const el = document.getElementById('smart-alerts-list');
  if(!el) return;
  const alerts = getSmartAlerts();
  const dismissed = getSADismissed();
  const visible = alerts.filter(a => {
    const sig = dismissed[a.title];
    if(!sig) return true;
    if(sig.startsWith('snooze:')) return Date.now() > parseInt(sig.split(':')[1],10);
    return sig !== a.sub;
  });
  if(!visible.length){
    el.innerHTML = `<div class="sa-all-good"><div class="sa-all-good-icon">🎉</div><div class="sa-all-good-title">All good!</div><div class="sa-all-good-sub">No alerts right now. Your business is on track.</div></div>`;
    return;
  }
  el.innerHTML = visible.map(a=>`
    <div class="sa-swipe-wrap" id="saw-${encodeURIComponent(a.title)}">
      <div class="sa-swipe-actions">
        <button class="sa-swipe-snooze" onclick="snoozeSA('${encodeURIComponent(a.title)}','${encodeURIComponent(a.sub)}')"><span style="font-size:16px">😴</span>Snooze<span style="font-size:9px">3 days</span></button>
        <button class="sa-swipe-dismiss" onclick="dismissSA('${encodeURIComponent(a.title)}','${encodeURIComponent(a.sub)}')"><span style="font-size:16px">✕</span>Dismiss</button>
      </div>
      <div class="sa-swipe-card" id="sac-${encodeURIComponent(a.title)}"
        onclick="saCardTap('${a.page}','${a.filter||''}')"
        ontouchstart="saSwipeStart(event,'${encodeURIComponent(a.title)}')"
        ontouchmove="saSwipeMove(event,'${encodeURIComponent(a.title)}')"
        ontouchend="saSwipeEnd(event,'${encodeURIComponent(a.title)}','${encodeURIComponent(a.sub)}')">
        <div class="sa-card-inner">
          <div class="sa-icon-wrap ${a.color}">${a.icon}</div>
          <div class="sa-body"><div class="sa-title">${a.title}</div><div class="sa-sub">${a.sub}</div></div>
          <span class="sa-badge ${a.color}">${a.count}</span>
        </div>
      </div>
    </div>`).join('');
}

function getSADismissed(){ try { return JSON.parse(localStorage.getItem('biz_sa_dismissed')||'{}'); } catch(e){ return {}; } }
function getReorderDismissed(){ try { return JSON.parse(localStorage.getItem('biz_reorder_dismissed')||'{}'); } catch(e){ return {}; } }

function dismissSA(titleEnc, subEnc){
  const d = getSADismissed(); d[decodeURIComponent(titleEnc)] = decodeURIComponent(subEnc);
  localStorage.setItem('biz_sa_dismissed', JSON.stringify(d));
  const wrap = document.getElementById('saw-'+titleEnc);
  if(wrap){ wrap.style.transition='all 0.3s'; wrap.style.opacity='0'; wrap.style.maxHeight='0'; wrap.style.marginBottom='0'; setTimeout(()=>{ renderSmartAlerts(); initDashboard(); },300); }
  else { renderSmartAlerts(); initDashboard(); }
  showToast('Alert dismissed ✓');
}

function snoozeSA(titleEnc, subEnc){
  const d = getSADismissed(); d[decodeURIComponent(titleEnc)] = 'snooze:' + (Date.now() + 3*86400000);
  localStorage.setItem('biz_sa_dismissed', JSON.stringify(d));
  const wrap = document.getElementById('saw-'+titleEnc);
  if(wrap){ wrap.style.transition='all 0.3s'; wrap.style.opacity='0'; wrap.style.maxHeight='0'; wrap.style.marginBottom='0'; setTimeout(()=>{ renderSmartAlerts(); initDashboard(); },300); }
  else { renderSmartAlerts(); initDashboard(); }
  showToast('Snoozed for 3 days 😴');
}

let _saSwipeStartX=0, _saSwipeX=0, _saSwipeMoved=false;
const SA_SWIPE_THRESHOLD=80;
function saSwipeStart(e,t){ _saSwipeStartX=e.touches[0].clientX; _saSwipeX=0; _saSwipeMoved=false; }
function saSwipeMove(e,titleEnc){ const dx=e.touches[0].clientX-_saSwipeStartX; if(dx>0)return; _saSwipeX=dx; _saSwipeMoved=Math.abs(dx)>10; const card=document.getElementById('sac-'+titleEnc); if(card){card.style.transition='none';card.style.transform=`translateX(${Math.max(dx,-140)}px)`;if(_saSwipeMoved)e.preventDefault();} }
function saSwipeEnd(e,titleEnc,subEnc){ const card=document.getElementById('sac-'+titleEnc); if(!card)return; if(!_saSwipeMoved){card.style.transition='transform 0.25s';card.style.transform='translateX(0)';return;} if(Math.abs(_saSwipeX)>SA_SWIPE_THRESHOLD){card.style.transition='transform 0.25s';card.style.transform='translateX(-140px)';}else{card.style.transition='transform 0.25s';card.style.transform='translateX(0)';} }

function saCardTap(page, filter){
  showPage(page); setNav(page);
  if(page==='products'&&filter){invFilter=filter;renderInventory();rebuildInvTabs();}
  if(page==='customers'&&filter){custFilter=filter;renderCustomers();}
  if(page==='supplies'){renderSupplies();}
  if(page==='flora'){renderFloraPage();renderFloraOrders();}
  if(page==='todo'){renderTodos();}
  if(page==='calendar'){renderCalendar();}
  if(page==='invoices'){renderInvoices();}
}
