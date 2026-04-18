// ═══════════════════════════════════════════════════
// DASHBOARD  (js/dashboard.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, inventory.js
// ═══════════════════════════════════════════════════

function initDashboard(){
  now = new Date(); // always fresh
  loadExpenses(); // ensure expenses are fresh for cost calculations
  const h = now.getHours();
  const gr = h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  document.getElementById('dash-greet').textContent = gr + '!';

  // Start live clock if not already running
  if(!window._clockInterval){
    window._clockInterval = setInterval(()=>{
      const el = document.getElementById('dash-live-clock');
      if(!el){ clearInterval(window._clockInterval); window._clockInterval=null; return; }
      const n = new Date();
      const raw = n.getHours();
      const hh = String(raw % 12 || 12);
      const mm = String(n.getMinutes()).padStart(2,'0');
      const ss = String(n.getSeconds()).padStart(2,'0');
      const ampm = raw >= 12 ? 'PM' : 'AM';
      el.textContent = `${hh}:${mm}:${ss} ${ampm}`;
    }, 1000);
  }
  // Also update immediately
  const clkEl = document.getElementById('dash-live-clock');
  if(clkEl){ const n=new Date(); const rh=n.getHours(); clkEl.textContent=`${rh%12||12}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')} ${rh>=12?'PM':'AM'}`; }

  // Date line
  const dateLine = now.toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'});
  const dlEl = document.getElementById('dash-date-line');
  if(dlEl) dlEl.textContent = dateLine;

  // Backup reminder — show if never backed up or >7 days ago
  const banner = document.getElementById('dash-backup-banner');
  const sub = document.getElementById('dash-backup-sub');
  if(banner){
    const last = parseInt(localStorage.getItem('biz_lastBackup')||'0',10);
    const daysSince = last ? Math.floor((Date.now()-last)/86400000) : null;
    const show = !last || daysSince >= 7;
    banner.style.display = show ? 'flex' : 'none';
    if(sub){
      if(!last) sub.textContent = 'You\'ve never exported a backup — tap to save your data';
      else sub.textContent = daysSince + ' day' + (daysSince===1?'':'s') + ' since your last backup';
    }
  }

  // Products — exclude in-transit
  const visibleProds = products.filter(p=>!isProductInTransit(p));
  const total = visibleProds.length;
  const low = visibleProds.filter(p=>getTotalQty(p)<(p.reorderAt||10)).length;
  const inTransitCount = products.length - visibleProds.length;
  document.getElementById('dash-prod-count').textContent = total;
  document.getElementById('dash-low-count').innerHTML = low>0 ? '<span class="b br">'+low+' low stock</span>' : inTransitCount>0 ? '<span class="b bb">'+inTransitCount+' 🚢 coming</span>' : '<span class="b bg">All good</span>';

  // Reminders
  const overdue = reminders.filter(r=>!r.done && r.date < new Date().toISOString().split('T')[0]).length;
  const pending = reminders.filter(r=>!r.done).length;
  const smartCount = (typeof getSmartAlerts==='function') ? getSmartAlerts().length : 0;
  const totalAlerts = pending + smartCount;
  document.getElementById('dash-rem-count').textContent = totalAlerts || '0';
  document.getElementById('dash-overdue').innerHTML = (overdue>0||smartCount>0) ? '<span class="b br">'+(overdue+smartCount)+' urgent</span>' : '<span class="b bg">All clear</span>';
  if(overdue>0||smartCount>0) document.getElementById('sidebar-notif-dot').style.display='block';
  else document.getElementById('sidebar-notif-dot').style.display='none';

  // Shipments
  const activeShips = shipments.filter(s=>s.status==='onway'||s.status==='ordered'||s.status==='arrived');
  const dashShipCount = document.getElementById('dash-ship-count');
  const dashShipSub = document.getElementById('dash-ship-sub');
  if(dashShipCount) dashShipCount.textContent = activeShips.length;
  const recentArrived = activeShips.filter(s=>s.status==='arrived').length;
  const inTransit = activeShips.filter(s=>s.status==='onway'||s.status==='ordered').length;
  if(dashShipSub) dashShipSub.innerHTML = recentArrived > 0 ? '<span class="b bg">'+recentArrived+' arrived</span>' : inTransit > 0 ? '<span class="b bb">'+inTransit+' active</span>' : '<span class="b bm">None active</span>';

  // Invoices
  const invTotal = (typeof invoices!=='undefined') ? invoices.length : 0;
  const invUnpaid = (typeof invoices!=='undefined') ? invoices.filter(i=>i.status==='unpaid'||i.status==='partial'||i.status==='shipped').length : 0;
  const dashInvCount = document.getElementById('dash-inv-count');
  const dashInvSub = document.getElementById('dash-inv-sub');
  if(dashInvCount) dashInvCount.textContent = invTotal;
  if(dashInvSub) dashInvSub.innerHTML = invUnpaid > 0 ? '<span class="b ba">'+invUnpaid+' unpaid</span>' : '<span class="b bg">All settled</span>';

  // Money owed — real from customers
  const debtCustomers = (typeof customers!=='undefined') ? customers.filter(c=>c.debt>0) : [];
  const totalDebt = debtCustomers.reduce((s,c)=>s+(c.debt||0),0);
  const debtTotalEl = document.getElementById('dash-debt-total');
  const debtSubEl = document.getElementById('dash-debt-sub');
  if(debtTotalEl) debtTotalEl.textContent = '$'+totalDebt.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:2});
  if(debtSubEl) debtSubEl.textContent = debtCustomers.length > 0 ? debtCustomers.length+' customer'+(debtCustomers.length>1?'s':'')+' with balance' : 'No outstanding debt';

  // Reorder alert
  const needReorder = products.filter(p=>!isProductInTransit(p)&&getTotalQty(p)<(p.reorderAt||10));
  const sec = document.getElementById('dash-reorder-section');
  const reorderDismissed = getReorderDismissed();
  const visibleNeedReorder = needReorder.filter(p=>{
    const d = reorderDismissed[p.id];
    if(!d) return true;
    if(d.startsWith('snooze:')) return Date.now() > parseInt(d.split(':')[1],10);
    return getTotalQty(p) !== parseInt(d,10);
  });
  if(visibleNeedReorder.length>0){
    sec.innerHTML = '<div class="dash-section-label" style="color:var(--red)">⚠️ Needs Reorder</div>' +
      '<div style="margin-bottom:16px">' +
      visibleNeedReorder.slice(0,3).map(p=>`
        <div class="reorder-card" style="margin-bottom:8px">
          <div style="font-size:26px">${p.emoji}</div>
          <div class="reorder-info"><div class="reorder-name">${p.name}</div><div class="reorder-sub">Total: ${getTotalQty(p)} remaining · threshold: ${p.reorderAt}</div></div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            <button onclick="snoozeReorder('${p.id}',${getTotalQty(p)})" style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap">😴 Snooze</button>
            <button onclick="dismissReorder('${p.id}',${getTotalQty(p)})" style="background:var(--red);color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap">✕ Dismiss</button>
          </div>
        </div>`).join('') +
      '</div>';
  } else {
    sec.innerHTML = '';
  }

  // Shipment preview
  const dashShipEl = document.getElementById('dash-shipments-preview');
  if(dashShipEl){
    const previewShips = shipments
      .filter(s=>s.status==='onway'||s.status==='ordered'||s.status==='arrived')
      .sort((a,b)=>(a.eta||'9999').localeCompare(b.eta||'9999'))
      .slice(0,2);
    if(!previewShips.length){
      dashShipEl.innerHTML = '<div style="background:var(--white);border-radius:14px;padding:16px;text-align:center;color:var(--muted);font-size:13px;box-shadow:var(--shadow)">No active shipments 🚢</div>';
    } else {
      const STATUS_CLS = {ordered:'ba', onway:'bb', arrived:'bg'};
      const STATUS_LBL = {ordered:'⏳ Ordered', onway:'🚢 On way', arrived:'✅ Arrived'};
      dashShipEl.innerHTML = previewShips.map(s=>{
        const prodCount = products.filter(p=>p.shipmentId===s.id).length;
        const etaDate = s.eta ? new Date(s.eta+'T12:00:00') : null;
        const daysLeft = etaDate ? Math.ceil((etaDate - now)/(1000*60*60*24)) : null;
        const etaStr = etaDate ? etaDate.toLocaleDateString('en',{month:'short',day:'numeric'}) : '—';
        let pct = 0;
        if(s.status==='arrived'){ pct = 100; }
        else if(s.status==='onway' && daysLeft!==null){ pct = Math.min(100, Math.max(10, Math.round((1 - daysLeft/30)*100))); }
        else if(s.status==='ordered') { pct = 5; }
        const daysLabel = daysLeft===null ? '' : daysLeft<0 ? `<span style="color:var(--red);font-weight:700">Overdue ${Math.abs(daysLeft)}d</span>` : daysLeft===0 ? `<span style="color:var(--amber);font-weight:700">Arriving today</span>` : `<span>${daysLeft}d to go</span>`;
        return `<div class="sc" onclick="openShipmentDetail('${s.id}')">
          <div class="sc-top">
            <div><div class="sc-name">${s.name}${s.num?' · '+s.num:''}</div><div class="sc-sup">${s.supplier||'—'}</div></div>
            <span class="b ${STATUS_CLS[s.status]}">${STATUS_LBL[s.status]}</span>
          </div>
          <div class="sc-meta">
            <span>📅 ${etaStr}</span>
            ${prodCount?`<span>📦 ${prodCount} products</span>`:''}
            ${s.cost?`<span>💵 $${s.cost.toLocaleString()}</span>`:''}
            ${daysLabel?`<span>${daysLabel}</span>`:''}
          </div>
          <div class="pbar" style="margin-top:8px"><div class="pfill" style="width:${pct}%"></div></div>
        </div>`;
      }).join('');
    }
  }

  // Todo preview
  const today = new Date().toISOString().slice(0,10);
  const activeTodos = todos.filter(t=>!t.done).slice(0,3);
  const overdueTodos = todos.filter(t=>!t.done && t.due && t.due < today).length;
  const dueTodayTodos = todos.filter(t=>!t.done && t.due && t.due === today).length;
  // Update dashboard section header badge
  const todoBadgeEl = document.getElementById('dash-todo-badge');
  if(todoBadgeEl){
    if(overdueTodos>0) todoBadgeEl.innerHTML = `<span class="b br" style="font-size:11px">⚠️ ${overdueTodos} overdue</span>`;
    else if(dueTodayTodos>0) todoBadgeEl.innerHTML = `<span class="b ba" style="font-size:11px">📅 ${dueTodayTodos} due today</span>`;
    else todoBadgeEl.innerHTML = '';
  }
  document.getElementById('dash-todo-preview').innerHTML = activeTodos.length ?
    activeTodos.map(t=>`<div class="todo-row" data-id="${t.id}" draggable="true" ondragstart="todoDragStart(event)" ondragover="todoDragOver(event)" ondrop="todoDrop(event)" ondragend="todoDragEnd(event)" ontouchstart="todoTouchStart(event)" ontouchmove="todoTouchMove(event)" ontouchend="todoTouchEnd(event)" style="margin-bottom:0;box-shadow:none;border-radius:0;border:none;border-bottom:1px solid var(--grey2);padding:10px 0"><div class="prio-bar" style="background:${PRIO_COLORS[t.prio]};border-radius:3px;width:3px;min-height:20px;align-self:stretch;flex-shrink:0"></div><div class="todo-cb${t.done?' checked':''}" onclick="toggleTodo('${t.id}')">${t.done?'✓':''}</div><div class="todo-body"><div class="todo-text${t.due&&t.due<today?' overdue':''}">${t.text}</div>${t.due&&t.due<=today?`<div class="todo-meta"><span class="todo-due ${t.due<today?'overdue':'today'}">${t.due<today?'⚠️ Overdue':'📅 Today'}</span></div>`:''}</div><div class="todo-drag-handle" style="padding:0 6px;color:var(--muted);font-size:16px;cursor:grab;user-select:none">≡</div></div>`).join('') :
    '<div style="color:var(--muted);font-size:13px;padding:10px 0">Nothing pending! 🎉</div>';

  // ── Finance snapshot (this month) ──
  const fmtD = n => '$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});
  const isThisMonth = d => { try { const dt=new Date(d); return dt.getFullYear()===now.getFullYear()&&dt.getMonth()===now.getMonth(); } catch(e){ return false; } };
  const raRev = (typeof invoices!=='undefined') ? invoices.filter(i=>i.store==='ra'&&(i.status==='paid'||i.status==='partial')&&isThisMonth(i.date)).reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0) : 0;
  const floraRev = (typeof floraOrders!=='undefined') ? floraOrders.filter(o=>o.status==='delivered'&&isThisMonth(o.createdAt)).reduce((s,o)=>s+(o.total||0),0) : 0;
  const floraInvRev = (typeof invoices!=='undefined') ? invoices.filter(i=>i.store==='flora'&&(i.status==='paid'||i.status==='partial')&&isThisMonth(i.date)).reduce((s,i)=>s+(i.status==='paid'?(i.total||0):(i.paidAmt||0)),0) : 0;
  const dashTotalRev = raRev + floraRev + floraInvRev;
  const dashCosts = (typeof shipments!=='undefined') ? shipments.filter(sh=>isThisMonth(sh.eta)).reduce((s,sh)=>s+(sh.cost||0),0) : 0;
  // dashSupCost excluded: consumedCost has no date so it can't be filtered to this month
  const dashExpCost = expenses.filter(e=>isThisMonth(e.date)).reduce((s,e)=>s+(e.amount||0),0);
  const dashTotalCosts = dashCosts + dashExpCost;
  const dashLosses = losses.filter(l=>isThisMonth(l.date)).reduce((s,l)=>s+(l.amount||0),0);
  const dashProfit = dashTotalRev - dashTotalCosts - dashLosses;
  // Losses card
  const lossCard = document.getElementById('dash-losses-card');
  if(lossCard){
    if(dashLosses>0){
      lossCard.style.display='block';
      document.getElementById('dash-losses-total').textContent='$'+dashLosses.toFixed(2);
      const ls=losses.filter(l=>isThisMonth(l.date));
      const parts=[];
      const sh=ls.filter(l=>l.type==='shortage').reduce((s,l)=>s+l.amount,0);
      const re=ls.filter(l=>l.type==='refund_expired').reduce((s,l)=>s+l.amount,0);
      const bd=ls.filter(l=>l.type==='bad_debt').reduce((s,l)=>s+l.amount,0);
      if(sh>0) parts.push(`📦 $${sh.toFixed(2)}`);
      if(re>0) parts.push(`🔄 $${re.toFixed(2)}`);
      if(bd>0) parts.push(`🚫 $${bd.toFixed(2)}`);
      document.getElementById('dash-losses-breakdown').textContent=parts.join(' · ');
    } else { lossCard.style.display='none'; }
  }
  const dashFinRevEl = document.getElementById('dash-fin-revenue');
  const dashFinCostEl = document.getElementById('dash-fin-costs');
  const dashFinProfEl = document.getElementById('dash-fin-profit');
  if(dashFinRevEl) dashFinRevEl.textContent = fmtD(dashTotalRev);
  if(dashFinCostEl) dashFinCostEl.textContent = fmtD(dashTotalCosts);
  if(dashFinProfEl){ dashFinProfEl.textContent = fmtD(Math.abs(dashProfit)); dashFinProfEl.style.color = dashProfit>=0?'var(--green)':'var(--red)'; }

  // ── RA Wholesale snapshot ──
  const wsInvoiced = (typeof invoices!=='undefined') ? invoices.filter(i=>i.store==='ra'&&i.status!=='cancelled').reduce((s,i)=>s+(i.total||0),0) : 0;
  const wsOwed = (typeof invoices!=='undefined') ? invoices.filter(i=>i.store==='ra'&&(i.status==='unpaid'||i.status==='partial'||i.status==='shipped')).reduce((s,i)=>s+((i.total||0)-(i.paidAmt||0)),0) : 0;
  const wsInvCount = (typeof invoices!=='undefined') ? invoices.filter(i=>i.store==='ra'&&i.status!=='cancelled').length : 0;
  const dashWsEl = document.getElementById('dash-ws-invoiced');
  const dashWsSubEl = document.getElementById('dash-ws-sub');
  if(dashWsEl) dashWsEl.textContent = fmtD(wsInvoiced);
  if(dashWsSubEl) dashWsSubEl.innerHTML = wsOwed>0 ? `<span class="b ba">${fmtD(wsOwed)} owed</span>` : `<span class="b bg">${wsInvCount} invoices</span>`;

  // ── Flora snapshot ──
  const floraPending = (typeof floraOrders!=='undefined') ? floraOrders.filter(o=>o.status==='processing'||o.status==='shipped').length : 0;
  const floraTotal = (typeof floraOrders!=='undefined') ? floraOrders.filter(o=>o.status!=='cancelled').length : 0;
  const dashFloraEl = document.getElementById('dash-flora-orders');
  const dashFloraSubEl = document.getElementById('dash-flora-sub');
  if(dashFloraEl) dashFloraEl.textContent = floraTotal;
  if(dashFloraSubEl) dashFloraSubEl.innerHTML = floraPending>0 ? `<span class="b bb">${floraPending} pending</span>` : `<span class="b bm">orders total</span>`;

  // ── Inventory (total units across all products) ──
  const visibleInvProds = (typeof products!=='undefined') ? products.filter(p=>!isProductInTransit(p)) : [];
  const totalUnits = visibleInvProds.reduce((s,p)=>s+getTotalQty(p),0);
  const lowItems = visibleInvProds.filter(p=>getTotalQty(p)<(p.reorderAt||10)).length;
  const dashInvTotEl = document.getElementById('dash-inv-total');
  const dashInvLblEl = document.getElementById('dash-inv-label');
  if(dashInvTotEl) dashInvTotEl.textContent = totalUnits.toLocaleString();
  if(dashInvLblEl) dashInvLblEl.innerHTML = lowItems>0 ? `<span class="b br">${lowItems} low</span>` : `<span class="b bg">All stocked</span>`;

  // ── Supplies ──
  const supTotal = (typeof supplies!=='undefined') ? supplies.length : 0;
  const supLow = (typeof supplies!=='undefined') ? supplies.filter(s=>(s.stock||0)<=(s.reorderAt||10)).length : 0;
  const dashSupEl = document.getElementById('dash-sup-count');
  const dashSupLblEl = document.getElementById('dash-sup-label');
  if(dashSupEl) dashSupEl.textContent = supTotal;
  if(dashSupLblEl) dashSupLblEl.innerHTML = supLow>0 ? `<span class="b ba">${supLow} low</span>` : `<span class="b bg">All good</span>`;

  // ── Bundles ──
  const bundleCount = (typeof bundles!=='undefined') ? bundles.length : 0;
  const dashBundleEl = document.getElementById('dash-bundle-count');
  const dashBundleLblEl = document.getElementById('dash-bundle-label');
  if(dashBundleEl) dashBundleEl.textContent = bundleCount;
  if(dashBundleLblEl) dashBundleLblEl.innerHTML = bundleCount>0 ? `<span class="b brose">active</span>` : `<span class="b bm">none yet</span>`;

  // ── Customers tile ──
  const custCount = (typeof customers!=='undefined') ? customers.filter(c=>!c.blacklisted).length : 0;
  const custDebt  = (typeof customers!=='undefined') ? customers.filter(c=>c.debt>0).length : 0;
  const dashCustEl = document.getElementById('dash-cust-count');
  const dashCustBadge = document.getElementById('dash-cust-badge');
  if(dashCustEl) dashCustEl.textContent = custCount;
  if(dashCustBadge) dashCustBadge.innerHTML = custDebt>0 ? `<span class="b ba">${custDebt} owe</span>` : `<span class="b bg">all clear</span>`;

  // ── Smart Alerts row ──
  const alertRow = document.getElementById('dash-smart-alerts-row');
  const alertTitle = document.getElementById('dash-alert-title');
  const alertSub = document.getElementById('dash-alert-sub');
  if(alertRow && typeof getSmartAlerts==='function'){
    const dismissed = typeof getSADismissed==='function' ? getSADismissed() : {};
    const alerts = getSmartAlerts().filter(a=>{
      const sig = dismissed[a.title];
      if(!sig) return true;
      if(sig.startsWith('snooze:')) return Date.now() > parseInt(sig.split(':')[1],10);
      return sig !== a.sub;
    });
    if(alerts.length>0){
      alertRow.style.display='block';
      if(alertTitle) alertTitle.textContent = alerts.length+' Smart Alert'+(alerts.length>1?'s':'');
      if(alertSub) alertSub.textContent = alerts[0].title+(alerts.length>1?' + '+(alerts.length-1)+' more':'');
    } else {
      alertRow.style.display='none';
    }
  }

  // ── Catalog (products in catalog/collections) ──
  const catCount = (typeof products!=='undefined') ? products.length : 0;
  const collCount = (typeof collections!=='undefined') ? collections.length : 0;
  const dashCatEl = document.getElementById('dash-cat-count');
  const dashCatLblEl = document.getElementById('dash-cat-label');
  if(dashCatEl) dashCatEl.textContent = catCount;
  if(dashCatLblEl) dashCatLblEl.innerHTML = collCount>0 ? `<span class="b bb">${collCount} collections</span>` : `<span class="b bm">no collections</span>`;

  // ── Next calendar event ──
  const calSec = document.getElementById('dash-calendar-section');
  if(calSec && typeof calEvents!=='undefined' && calEvents.length>0){
    const todayStr = now.toISOString().split('T')[0];
    const upcoming = calEvents.filter(e=>e.date>=todayStr).sort((a,b)=>a.date.localeCompare(b.date));
    if(upcoming.length>0){
      const next = upcoming[0];
      const nextDate = new Date(next.date+'T12:00:00');
      const diffDays = Math.ceil((nextDate-now)/(1000*60*60*24));
      const dateLabel = diffDays===0?'Today':diffDays===1?'Tomorrow':nextDate.toLocaleDateString('en',{month:'short',day:'numeric'});
      const urgentColor = diffDays<=1?'var(--red)':diffDays<=3?'var(--amber)':'var(--blue)';
      calSec.innerHTML = `<div class="dash-section-label" style="margin-top:4px">📅 Calendar</div><div onclick="showPage('calendar');setNav('more');renderCalendar()" class="dash-cal-card">
        <div class="dash-cal-icon">📅</div>
        <div class="dash-cal-info">
          <div class="dash-cal-sub">Next Event</div>
          <div class="dash-cal-title">${next.title||'Event'}</div>
        </div>
        <div class="dash-cal-right">
          <div class="dash-cal-date" style="color:${urgentColor}">${dateLabel}</div>
          <div class="dash-cal-count">${upcoming.length} upcoming</div>
        </div>
      </div>`;
    } else {
      calSec.innerHTML = '';
    }
  } else if(calSec){
    calSec.innerHTML = '';
  }
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

  // ── CUSTOMERS & DEBT ─────────────────────────────
  const overdueCustomers = customers.filter(c => !c.blacklisted && c.debt > 0);
  if(overdueCustomers.length){
    const total = overdueCustomers.reduce((s,c)=>s+(c.debt||0),0);
    alerts.push({icon:'💰', color:'amber', title:'Customers with unpaid debt', sub:overdueCustomers.length+' customer'+(overdueCustomers.length>1?'s':'')+' · $'+total.toFixed(2)+' total', count:overdueCustomers.length, page:'customers', filter:'debt'});
  }

  const highDebtCusts = customers.filter(c => !c.blacklisted && (c.debt||0) >= alertThresholds.debt);
  if(highDebtCusts.length){
    alerts.push({icon:'🚨', color:'red', title:'High debt customers', sub:highDebtCusts.map(c=>c.name+' ($'+c.debt.toFixed(2)+')').slice(0,2).join(', ')+(highDebtCusts.length>2?' +more':''), count:highDebtCusts.length, page:'customers', filter:'debt'});
  }

  const blackDebt = customers.filter(c => c.blacklisted && (c.writtenOff||0)>0);
  if(blackDebt.length){
    const total = blackDebt.reduce((s,c)=>s+(c.writtenOff||0),0);
    alerts.push({icon:'🚫', color:'red', title:'Blacklisted customers still owe', sub:blackDebt.length+' customer'+(blackDebt.length>1?'s':'')+' · $'+total.toFixed(2)+' written off', count:blackDebt.length, page:'customers', filter:'blacklist'});
  }

  const inactiveCutoff = new Date(today); inactiveCutoff.setDate(inactiveCutoff.getDate() - alertThresholds.inactive);
  const inactiveCutoffStr = inactiveCutoff.toISOString().split('T')[0];
  const inactiveCusts = customers.filter(c => !c.blacklisted && c.lastOrderDate && c.lastOrderDate < inactiveCutoffStr);
  if(inactiveCusts.length){
    alerts.push({icon:'😴', color:'purple', title:'Inactive customers', sub:inactiveCusts.length+' haven\'t ordered in '+alertThresholds.inactive+'+ days', count:inactiveCusts.length, page:'customers', filter:'all'});
  }

  // ── SHIPMENTS ─────────────────────────────────────
  const lateShips = shipments.filter(s => (s.status==='onway'||s.status==='ordered') && s.eta && s.eta < todayStr);
  if(lateShips.length){
    alerts.push({icon:'🚢', color:'red', title:'Shipments past arrival date', sub:lateShips.map(s=>s.name).slice(0,2).join(', ')+(lateShips.length>2?' +more':''), count:lateShips.length, page:'shipments'});
  }

  const noEtaShips = shipments.filter(s => (s.status==='onway'||s.status==='ordered') && !s.eta);
  if(noEtaShips.length){
    alerts.push({icon:'📅', color:'amber', title:'Active shipments with no ETA', sub:noEtaShips.map(s=>s.name).slice(0,2).join(', ')+(noEtaShips.length>2?' +more':''), count:noEtaShips.length, page:'shipments'});
  }

  // ── INVENTORY ─────────────────────────────────────
  const zeroStock = products.filter(p => !isProductInTransit(p) && getTotalQty(p)===0);
  if(zeroStock.length){
    alerts.push({icon:'❌', color:'red', title:'Out of stock products', sub:zeroStock.map(p=>p.name).slice(0,3).join(', ')+(zeroStock.length>3?' +more':''), count:zeroStock.length, page:'products'});
  }

  const lowStock = products.filter(p => { if(isProductInTransit(p)) return false; const q=getTotalQty(p); return q>0 && q<=alertThresholds.lowStock; });
  if(lowStock.length){
    alerts.push({icon:'⚠️', color:'amber', title:'Low stock products', sub:lowStock.map(p=>p.name+' ('+getTotalQty(p)+')').slice(0,2).join(', ')+(lowStock.length>2?' +more':''), count:lowStock.length, page:'products', filter:'low'});
  }

  const noRAPrice = products.filter(p => !isProductInTransit(p) && (p.store==='ra'||p.store==='both') && !p.priceRAPiece);
  if(noRAPrice.length){
    alerts.push({icon:'🏪', color:'amber', title:'RA products missing price', sub:noRAPrice.map(p=>p.name).slice(0,2).join(', ')+(noRAPrice.length>2?' +more':''), count:noRAPrice.length, page:'products', filter:'ra'});
  }

  const noFloraPrice = products.filter(p => !isProductInTransit(p) && (p.store==='flora'||p.store==='both') && !p.priceFlora);
  if(noFloraPrice.length){
    alerts.push({icon:'🌸', color:'rose', title:'Flora products missing price', sub:noFloraPrice.map(p=>p.name).slice(0,2).join(', ')+(noFloraPrice.length>2?' +more':''), count:noFloraPrice.length, page:'products', filter:'flora'});
  }

  // ── INVOICES ─────────────────────────────────────
  const invCutoff = new Date(today); invCutoff.setDate(invCutoff.getDate() - alertThresholds.invoice);
  const invCutoffStr = invCutoff.toISOString().split('T')[0];
  const overdueInvs = (invoices||[]).filter(i => (i.status==='unpaid'||i.status==='shipped'||i.status==='partial') && i.date < invCutoffStr);
  if(overdueInvs.length){
    const total = overdueInvs.reduce((s,i)=>s+(i.total||0),0);
    alerts.push({icon:'🧾', color:'red', title:'Overdue unpaid invoices', sub:overdueInvs.length+' invoice'+(overdueInvs.length>1?'s':'')+' · $'+total.toFixed(2)+' total', count:overdueInvs.length, page:'invoices'});
  }

  const pastDueInvs = (invoices||[]).filter(i => (i.status==='unpaid'||i.status==='partial'||i.status==='shipped') && i.dueDate && i.dueDate < todayStr);
  if(pastDueInvs.length){
    alerts.push({icon:'📆', color:'red', title:'Invoices past due date', sub:pastDueInvs.length+' invoice'+(pastDueInvs.length>1?'s':'')+' past their due date', count:pastDueInvs.length, page:'invoices'});
  }

  const partialInvs = (invoices||[]).filter(i => i.status==='partial');
  if(partialInvs.length){
    const total = partialInvs.reduce((s,i)=>s+(i.total||0)-(i.paidAmt||0),0);
    alerts.push({icon:'💸', color:'amber', title:'Partially paid invoices', sub:partialInvs.length+' invoice'+(partialInvs.length>1?'s':'')+' · $'+total.toFixed(2)+' remaining', count:partialInvs.length, page:'invoices'});
  }

  // ── SUPPLIES (PACKAGING) ──────────────────────────
  const lowSupplies = supplies.filter(s => (s.stock||0) > 0 && (s.stock||0) <= (s.reorderAt||10));
  if(lowSupplies.length){
    alerts.push({icon:'📦', color:'amber', title:'Packaging & supplies low', sub:lowSupplies.map(s=>s.name+' ('+s.stock+' left)').slice(0,2).join(', ')+(lowSupplies.length>2?' +more':''), count:lowSupplies.length, page:'supplies'});
  }

  const zeroSupplies = supplies.filter(s => (s.stock||0)===0);
  if(zeroSupplies.length){
    alerts.push({icon:'🚫', color:'red', title:'Supplies completely out of stock', sub:zeroSupplies.map(s=>s.name).slice(0,2).join(', ')+(zeroSupplies.length>2?' +more':''), count:zeroSupplies.length, page:'supplies'});
  }

  // ── FLORA ORDERS ──────────────────────────────────
  const processingOrders = floraOrders.filter(o => o.status==='processing');
  if(processingOrders.length){
    alerts.push({icon:'⏳', color:'amber', title:'Flora orders still processing', sub:processingOrders.length+' order'+(processingOrders.length>1?'s':'')+' waiting to be shipped', count:processingOrders.length, page:'flora'});
  }

  const shippedOrders = floraOrders.filter(o => o.status==='shipped');
  if(shippedOrders.length){
    alerts.push({icon:'🚚', color:'blue', title:'Flora orders shipped — awaiting delivery', sub:shippedOrders.length+' order'+(shippedOrders.length>1?'s':'')+' on the way', count:shippedOrders.length, page:'flora'});
  }

  // ── TODOS ─────────────────────────────────────────
  const urgentTodos = todos.filter(t => !t.done && t.prio==='high');
  if(urgentTodos.length){
    alerts.push({icon:'🔴', color:'red', title:'Urgent to-do items', sub:urgentTodos.map(t=>t.text).slice(0,2).join(', ')+(urgentTodos.length>2?' +more':''), count:urgentTodos.length, page:'todo'});
  }

  const pendingTodos = todos.filter(t => !t.done && t.prio!=='high');
  if(pendingTodos.length){
    alerts.push({icon:'✅', color:'green', title:'Pending to-do items', sub:pendingTodos.length+' task'+(pendingTodos.length>1?'s':'')+' waiting', count:pendingTodos.length, page:'todo'});
  }

  // ── CALENDAR ──────────────────────────────────────
  const todayEvents = calEvents.filter(e => e.date===todayStr);
  if(todayEvents.length){
    alerts.push({icon:'📅', color:'rose', title:'Events today', sub:todayEvents.map(e=>e.title).slice(0,2).join(', ')+(todayEvents.length>2?' +more':''), count:todayEvents.length, page:'calendar'});
  }

  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowEvents = calEvents.filter(e => e.date===tomorrowStr);
  if(tomorrowEvents.length){
    alerts.push({icon:'🗓️', color:'purple', title:'Events tomorrow', sub:tomorrowEvents.map(e=>e.title).slice(0,2).join(', ')+(tomorrowEvents.length>2?' +more':''), count:tomorrowEvents.length, page:'calendar'});
  }

  // ── CUSTOM REMINDERS ──────────────────────────────
  const overdueRems = reminders.filter(r => !r.done && r.date < todayStr);
  if(overdueRems.length){
    alerts.push({icon:'🔔', color:'red', title:'Overdue reminders', sub:overdueRems.map(r=>r.title).slice(0,2).join(', ')+(overdueRems.length>2?' +more':''), count:overdueRems.length, page:'reminders'});
  }

  const todayRems = reminders.filter(r => !r.done && r.date===todayStr);
  if(todayRems.length){
    alerts.push({icon:'🔔', color:'amber', title:'Reminders due today', sub:todayRems.map(r=>r.title).slice(0,2).join(', ')+(todayRems.length>2?' +more':''), count:todayRems.length, page:'reminders'});
  }

  // ── SOCIAL MEDIA ─────────────────────────────────
  // IG/Website alerts — only for products added in last 14 days to avoid noise
  const cutoff14 = Date.now() - 14*86400000;
  const newProds = products.filter(p => !isProductInTransit(p) && (p.createdAt||0) > cutoff14);
  const notIGRA = newProds.filter(p => (p.store==='ra'||p.store==='both') && !p.postedIG);
  if(notIGRA.length){
    alerts.push({icon:'📷', color:'rose', title:'New RA products not on Instagram', sub:notIGRA.map(p=>p.name).slice(0,2).join(', ')+(notIGRA.length>2?' +more':''), count:notIGRA.length, page:'products', filter:'ra'});
  }
  const notIGFlora = newProds.filter(p => (p.store==='flora'||p.store==='both') && !p.postedIGFlora);
  if(notIGFlora.length){
    alerts.push({icon:'📷', color:'rose', title:'New Flora products not on Instagram', sub:notIGFlora.map(p=>p.name).slice(0,2).join(', ')+(notIGFlora.length>2?' +more':''), count:notIGFlora.length, page:'products', filter:'flora'});
  }
  const notWeb = newProds.filter(p => (p.store==='flora'||p.store==='both') && !p.onWebsite);
  if(notWeb.length){
    alerts.push({icon:'🌐', color:'blue', title:'New Flora products not on website', sub:notWeb.map(p=>p.name).slice(0,2).join(', ')+(notWeb.length>2?' +more':''), count:notWeb.length, page:'products', filter:'flora'});
  }

  // ── EXPIRING REFUNDS ─────────────────────────────
  const soon = new Date(); soon.setDate(soon.getDate()+7);
  const soonStr = soon.toISOString().split('T')[0];
  const expiringRefunds = [];
  shipments.forEach(s=>(s.pendingRefunds||[]).filter(r=>!r.received&&r.deadline&&r.deadline<=soonStr&&r.deadline>=todayStr).forEach(r=>expiringRefunds.push({ship:s.name,name:r.name,deadline:r.deadline})));
  if(expiringRefunds.length){
    alerts.push({icon:'⏰',color:'amber',title:'Refunds expiring soon',sub:expiringRefunds.map(r=>`${r.name} — due ${r.deadline}`).slice(0,2).join(', ')+(expiringRefunds.length>2?' +more':''),count:expiringRefunds.length,page:'shipments'});
  }
  const overdueRefunds = [];
  shipments.forEach(s=>(s.pendingRefunds||[]).filter(r=>!r.received&&r.deadline&&r.deadline<todayStr).forEach(r=>overdueRefunds.push(r)));
  if(overdueRefunds.length){
    alerts.push({icon:'💸',color:'red',title:'Overdue refunds from supplier',sub:`${overdueRefunds.length} refund${overdueRefunds.length>1?'s':''} past deadline — convert to loss?`,count:overdueRefunds.length,page:'shipments'});
  }

  return alerts;
}

function renderSmartAlerts(){
  loadAlertThresholds();
  const el = document.getElementById('smart-alerts-list');
  if(!el) return;
  const alerts = getSmartAlerts();
  const dismissed = getSADismissed();
  // Filter out dismissed alerts whose signature hasn't changed
  const visible = alerts.filter(a => {
    const sig = dismissed[a.title];
    if(!sig) return true;
    if(sig.startsWith('snooze:')){
      const expiry = parseInt(sig.split(':')[1],10);
      return Date.now() > expiry; // show again after snooze expires
    }
    return sig !== a.sub; // data changed → show again
  });
  if(!visible.length){
    el.innerHTML = `<div class="sa-all-good"><div class="sa-all-good-icon">🎉</div><div class="sa-all-good-title">All good!</div><div class="sa-all-good-sub">No alerts right now. Your business is on track.</div></div>`;
    return;
  }
  el.innerHTML = visible.map(a=>`
    <div class="sa-swipe-wrap" id="saw-${encodeURIComponent(a.title)}">
      <div class="sa-swipe-actions">
        <button class="sa-swipe-snooze" onclick="snoozeSA('${encodeURIComponent(a.title)}','${encodeURIComponent(a.sub)}')">
          <span style="font-size:16px">😴</span>Snooze<span style="font-size:9px">3 days</span>
        </button>
        <button class="sa-swipe-dismiss" onclick="dismissSA('${encodeURIComponent(a.title)}','${encodeURIComponent(a.sub)}')">
          <span style="font-size:16px">✕</span>Dismiss
        </button>
      </div>
      <div class="sa-swipe-card" id="sac-${encodeURIComponent(a.title)}"
        onclick="saCardTap('${a.page}','${a.filter||''}')"
        ontouchstart="saSwipeStart(event,'${encodeURIComponent(a.title)}')"
        ontouchmove="saSwipeMove(event,'${encodeURIComponent(a.title)}')"
        ontouchend="saSwipeEnd(event,'${encodeURIComponent(a.title)}','${encodeURIComponent(a.sub)}')">
        <div class="sa-card-inner">
          <div class="sa-icon-wrap ${a.color}">${a.icon}</div>
          <div class="sa-body">
            <div class="sa-title">${a.title}</div>
            <div class="sa-sub">${a.sub}</div>
          </div>
          <span class="sa-badge ${a.color}">${a.count}</span>
        </div>
      </div>
    </div>`).join('');
}

function getSADismissed(){
  try { return JSON.parse(localStorage.getItem('biz_sa_dismissed')||'{}'); } catch(e){ return {}; }
}

function getReorderDismissed(){
  try { return JSON.parse(localStorage.getItem('biz_reorder_dismissed')||'{}'); } catch(e){ return {}; }
}
function dismissReorder(pid, qty){
  const d = getReorderDismissed();
  d[pid] = String(qty);
  localStorage.setItem('biz_reorder_dismissed', JSON.stringify(d));
  renderInventory(); initDashboard();
  showToast('Dismissed ✓');
}
function snoozeReorder(pid, qty){
  const d = getReorderDismissed();
  d[pid] = 'snooze:' + (Date.now() + 3*86400000);
  localStorage.setItem('biz_reorder_dismissed', JSON.stringify(d));
  renderInventory(); initDashboard();
  showToast('Snoozed 3 days 😴');
}
let _roSwipeStartX=0, _roSwipeX=0, _roSwipeMoved=false;
function reorderSwipeStart(e,pid){ _roSwipeStartX=e.touches[0].clientX; _roSwipeX=0; _roSwipeMoved=false; }
function reorderSwipeMove(e,pid){
  const dx=e.touches[0].clientX-_roSwipeStartX;
  if(dx>0) return;
  _roSwipeX=dx; _roSwipeMoved=Math.abs(dx)>10;
  const card=document.getElementById('roc-'+pid);
  if(card){ card.style.transition='none'; card.style.transform=`translateX(${Math.max(dx,-120)}px)`; if(_roSwipeMoved) e.preventDefault(); }
}
function reorderSwipeEnd(e,pid,qty){
  const card=document.getElementById('roc-'+pid);
  if(!card) return;
  if(!_roSwipeMoved){ card.style.transition='transform 0.25s'; card.style.transform='translateX(0)'; return; }
  if(Math.abs(_roSwipeX)>80){ card.style.transition='transform 0.25s'; card.style.transform='translateX(-120px)'; }
  else { card.style.transition='transform 0.25s'; card.style.transform='translateX(0)'; }
}

function dismissSA(titleEnc, subEnc){
  const title = decodeURIComponent(titleEnc);
  const sub   = decodeURIComponent(subEnc);
  const d = getSADismissed();
  d[title] = sub;
  localStorage.setItem('biz_sa_dismissed', JSON.stringify(d));
  // Animate out
  const wrap = document.getElementById('saw-'+titleEnc);
  if(wrap){ wrap.style.transition='all 0.3s'; wrap.style.opacity='0'; wrap.style.maxHeight='0'; wrap.style.marginBottom='0'; setTimeout(()=>{ renderSmartAlerts(); initDashboard(); },300); }
  else { renderSmartAlerts(); initDashboard(); }
  showToast('Alert dismissed ✓');
}

function snoozeSA(titleEnc, subEnc){
  const title = decodeURIComponent(titleEnc);
  const d = getSADismissed();
  // Snooze = dismiss with expiry 3 days from now
  d[title] = 'snooze:' + (Date.now() + 3*86400000);
  localStorage.setItem('biz_sa_dismissed', JSON.stringify(d));
  const wrap = document.getElementById('saw-'+titleEnc);
  if(wrap){ wrap.style.transition='all 0.3s'; wrap.style.opacity='0'; wrap.style.maxHeight='0'; wrap.style.marginBottom='0'; setTimeout(()=>{ renderSmartAlerts(); initDashboard(); },300); }
  else { renderSmartAlerts(); initDashboard(); }
  showToast('Snoozed for 3 days 😴');
}

// Swipe state
let _saSwipeStartX = 0, _saSwipeX = 0, _saSwipeMoved = false;
const SA_SWIPE_THRESHOLD = 80;

function saSwipeStart(e, titleEnc){
  _saSwipeStartX = e.touches[0].clientX;
  _saSwipeX = 0;
  _saSwipeMoved = false;
}

function saSwipeMove(e, titleEnc){
  const dx = e.touches[0].clientX - _saSwipeStartX;
  if(dx > 0) return; // only left swipe
  _saSwipeX = dx;
  _saSwipeMoved = Math.abs(dx) > 10;
  const card = document.getElementById('sac-'+titleEnc);
  if(card){
    const move = Math.max(dx, -140);
    card.style.transition = 'none';
    card.style.transform = `translateX(${move}px)`;
    if(_saSwipeMoved) e.preventDefault();
  }
}

function saSwipeEnd(e, titleEnc, subEnc){
  const card = document.getElementById('sac-'+titleEnc);
  if(!card) return;
  if(!_saSwipeMoved){
    // It was a tap - navigate
    card.style.transition = 'transform 0.25s';
    card.style.transform = 'translateX(0)';
    return;
  }
  if(Math.abs(_saSwipeX) > SA_SWIPE_THRESHOLD){
    // Swiped far enough - keep open showing buttons
    card.style.transition = 'transform 0.25s';
    card.style.transform = 'translateX(-140px)';
  } else {
    // Snap back
    card.style.transition = 'transform 0.25s';
    card.style.transform = 'translateX(0)';
  }
}

function saCardTap(page, filter){
  showPage(page); setNav(page);
  if(page==='products' && filter){ invFilter=filter; renderInventory(); rebuildInvTabs(); }
  if(page==='customers' && filter){ custFilter=filter; renderCustomers(); const tabs=document.querySelectorAll('#cust-tabs .tab'); tabs.forEach(t=>{ if(t.getAttribute('onclick')&&t.getAttribute('onclick').includes("'"+filter+"'")) t.classList.add('active'); else t.classList.remove('active'); }); }
  if(page==='supplies'){ renderSupplies(); }
  if(page==='flora'){ renderFloraPage(); renderFloraOrders(); }
  if(page==='todo'){ renderTodos(); }
  if(page==='calendar'){ renderCalendar(); }
  if(page==='invoices'){ renderInvoices(); }
}
