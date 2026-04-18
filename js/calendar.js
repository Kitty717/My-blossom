// ═══════════════════════════════════════════════════
// TO-DO + CALENDAR  (js/calendar.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, dashboard.js
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// TO-DO
// ═══════════════════════════════════════════════════
var _todoPinned = typeof _todoPinned !== 'undefined' ? _todoPinned : false;
var _todoPrio = typeof _todoPrio !== 'undefined' ? _todoPrio : 'med';
var _todoBulkMode = false;
var _todoBulkSelected = new Set();

// ── Flora Occasions ──
var FLORA_OCCASIONS = typeof FLORA_OCCASIONS !== 'undefined' ? FLORA_OCCASIONS : [
  {name:"Valentine's Day",emoji:'💕',month:2,day:14},
  {name:"Women's Day",emoji:'👑',month:3,day:8},
  {name:"Mother's Day 🇱🇧",emoji:'🌸',month:3,day:21},
  {name:"Easter",emoji:'🌷',month:4,day:20},
  {name:"Lebanese Independence",emoji:'🇱🇧',month:11,day:22},
  {name:"Christmas",emoji:'🎄',month:12,day:25},
  {name:"New Year's Eve",emoji:'🎆',month:12,day:31},
  {name:"New Year's Day",emoji:'🎉',month:1,day:1},
];

function renderOccasionCalendar(){
  const el=document.getElementById('cal-occasions-section'); if(!el) return;
  const today=new Date();
  const upcoming=FLORA_OCCASIONS.map(o=>{
    let date=new Date(today.getFullYear(),o.month-1,o.day);
    if(date<today) date=new Date(today.getFullYear()+1,o.month-1,o.day);
    return{...o,date,daysLeft:Math.ceil((date-today)/(1000*60*60*24))};
  }).filter(o=>o.daysLeft<=60).sort((a,b)=>a.daysLeft-b.daysLeft);
  if(!upcoming.length){el.innerHTML='';return;}
  el.innerHTML=`<div style="background:linear-gradient(135deg,#fdf2f8,#fce7f3);border-radius:18px;padding:16px;border:1.5px solid rgba(232,116,138,0.2);margin-top:14px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--rose);margin-bottom:12px">🌸 Upcoming Flora Occasions</div>
    ${upcoming.map(o=>{
      const u=o.daysLeft<=7,sn=o.daysLeft<=14;
      const col=u?'var(--red)':sn?'var(--amber)':'var(--rose)';
      const bg=u?'var(--red-soft)':sn?'var(--amber-soft)':'var(--rose-pale)';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:white;border-radius:12px;margin-bottom:8px">
        <div style="font-size:22px">${o.emoji}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--ink)">${o.name}</div>
        <div style="font-size:11px;color:var(--muted)">${o.date.toLocaleDateString('en',{month:'long',day:'numeric'})}</div></div>
        <div style="background:${bg};color:${col};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700">${o.daysLeft===0?'Today!':o.daysLeft===1?'Tomorrow!':o.daysLeft+'d'}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function openAddTodo(){
  _todoPinned = false;
  _todoPrio = 'med';
  document.getElementById('todo-inp').value = '';
  document.getElementById('todo-due').value = '';
  document.getElementById('todo-link-type').value = '';
  document.getElementById('todo-link-id').style.display = 'none';
  document.getElementById('todo-link-id').innerHTML = '';
  const pt = document.getElementById('todo-pin-toggle');
  pt.classList.remove('active');
  document.getElementById('todo-pin-lbl').textContent = 'No';
  ['high','med','low'].forEach(p=>{
    const el = document.getElementById('tp-'+p);
    if(el) el.classList.toggle('active', p==='med');
  });
  showModal('m-add-todo');
  setTimeout(()=>document.getElementById('todo-inp').focus(), 300);
}

function selectTodoPrio(p){
  _todoPrio = p;
  ['high','med','low'].forEach(x=>{ const el=document.getElementById('tp-'+x); if(el) el.classList.toggle('active',x===p); });
}

function toggleTodoPin(el){
  _todoPinned = !_todoPinned;
  el.classList.toggle('active', _todoPinned);
  document.getElementById('todo-pin-lbl').textContent = _todoPinned ? 'Yes 📌' : 'No';
}

function updateTodoLinkPicker(){
  const type = document.getElementById('todo-link-type').value;
  const sel = document.getElementById('todo-link-id');
  if(!type){ sel.style.display='none'; sel.innerHTML=''; return; }
  sel.style.display = 'block';
  if(type==='customer'){
    sel.innerHTML = '<option value="">— pick customer —</option>' + customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  } else if(type==='shipment'){
    sel.innerHTML = '<option value="">— pick shipment —</option>' + shipments.map(s=>`<option value="${s.id}">${s.name||s.supplier||'Shipment'}</option>`).join('');
  } else if(type==='invoice'){
    const recent = invoices.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,20);
    sel.innerHTML = '<option value="">— pick invoice —</option>' + recent.map(i=>`<option value="${i.id}">#${i.num||i.id.slice(-4)} · ${i.customer||'?'}</option>`).join('');
  }
}

function createReorderTodo(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  const stableId = 'reorder-'+p.id;
  const exists = todos.find(t=>!t.done && (t.id===stableId || (t.linkId===p.id && t.linkType==='product')));
  if(exists){ showToast('Reorder to-do already exists 📋'); return; }
  const todo = {
    id: stableId,
    text: `Reorder ${p.emoji} ${p.name} — only ${getTotalQty(p)} left`,
    prio: 'high', done: false, pinned: false, due: '',
    linkType: 'product', linkId: p.id, linkLabel: p.name,
    createdAt: Date.now()
  };
  todos.unshift(todo);
  saveTodos(); saveCalEvents();
  renderTodos();
  initDashboard();
  showToast('📋 Added to To-Do list');
}

function saveTodo(){
  const text = document.getElementById('todo-inp').value.trim();
  if(!text){ showToast('Enter a task','err'); return; }
  const due = document.getElementById('todo-due').value;
  const linkType = document.getElementById('todo-link-type').value;
  const linkId = document.getElementById('todo-link-id').value;
  let linkLabel = '';
  if(linkType && linkId){
    if(linkType==='customer'){ const c=customers.find(x=>x.id===linkId); linkLabel=c?c.name:''; }
    else if(linkType==='shipment'){ const s=shipments.find(x=>x.id===linkId); linkLabel=s?(s.name||s.supplier||'Shipment'):''; }
    else if(linkType==='invoice'){ const i=invoices.find(x=>x.id===linkId); linkLabel=i?('#'+(i.num||i.id.slice(-4))+' · '+(i.customer||'')):''; }
  }
  todos.unshift({
    id: 't-'+Date.now(),
    text, prio: _todoPrio,
    done: false,
    pinned: _todoPinned,
    due: due||'',
    linkType: linkType||'',
    linkId: linkId||'',
    linkLabel: linkLabel||''
  });
  closeModal('m-add-todo');
  saveTodos(); saveCalEvents(); renderTodos(); initDashboard();
  showToast('Task added ✅');
}

// Keep old addTodo for backwards compat (called from nowhere now but just in case)
function addTodo(){
  const text=document.getElementById('todo-inp')?document.getElementById('todo-inp').value.trim():'';
  if(!text) return;
  todos.unshift({id:'t-'+Date.now(), text, prio:'med', done:false, pinned:false, due:'', linkType:'', linkId:'', linkLabel:''});
  saveTodos(); saveCalEvents(); renderTodos(); initDashboard();
}

function todoBulkEnter(){
  _todoBulkMode = true;
  _todoBulkSelected = new Set();
  renderTodos();
  _updateBulkBar();
}
function todoBulkExit(){
  _todoBulkMode = false;
  _todoBulkSelected = new Set();
  renderTodos();
  const bar = document.getElementById('todo-bulk-bar');
  if(bar) bar.style.display = 'none';
}
function todoBulkToggle(id){
  if(_todoBulkSelected.has(id)) _todoBulkSelected.delete(id);
  else _todoBulkSelected.add(id);
  // Update checkbox UI
  const cb = document.getElementById('bulk-cb-'+id);
  if(cb) cb.classList.toggle('checked', _todoBulkSelected.has(id));
  _updateBulkBar();
}
function todoBulkSelectAll(){
  const visibleIds = [...document.querySelectorAll('[data-id]')].map(el=>el.dataset.id);
  visibleIds.forEach(id=>_todoBulkSelected.add(id));
  visibleIds.forEach(id=>{ const cb=document.getElementById('bulk-cb-'+id); if(cb) cb.classList.add('checked'); });
  _updateBulkBar();
}
function _updateBulkBar(){
  const n = _todoBulkSelected.size;
  const bar = document.getElementById('todo-bulk-bar');
  const lbl = document.getElementById('todo-bulk-lbl');
  if(bar){ bar.style.display = _todoBulkMode ? 'flex' : 'none'; }
  if(lbl){ lbl.textContent = n > 0 ? `${n} selected` : 'Select tasks'; }
  const delBtn = document.getElementById('todo-bulk-del');
  if(delBtn){ delBtn.disabled = n === 0; delBtn.style.opacity = n===0?'0.4':'1'; }
}
function todoBulkDelete(){
  const n = _todoBulkSelected.size;
  if(!n){ showToast('Select tasks first'); return; }
  appConfirm('Delete Tasks', `Delete ${n} selected task${n>1?'s':''}?`, '🗑️ Delete', ()=>{
    todos = todos.filter(t=>!_todoBulkSelected.has(t.id));
    saveTodos(); renderTodos(); initDashboard();
    todoBulkExit();
    showToast(`${n} task${n>1?'s':''} deleted 🗑️`);
  });
}

function renderTodos(){
  const today = new Date().toISOString().split('T')[0];
  let list = todos;

  if(todoFilter==='today'){
    list = todos.filter(t=>!t.done && (t.due===today || (t.due && t.due < today)));
  } else if(todoFilter==='active'){
    list = todos.filter(t=>!t.done);
  } else if(todoFilter==='done'){
    list = todos.filter(t=>t.done);
  }

  // Sort: pinned first, then by prio, then by due date
  const prioOrder = {high:0, med:1, low:2};
  list = [...list].sort((a,b)=>{
    if(a.pinned && !b.pinned) return -1;
    if(!a.pinned && b.pinned) return 1;
    if((prioOrder[a.prio]||1) !== (prioOrder[b.prio]||1)) return prioOrder[a.prio]-prioOrder[b.prio];
    if(a.due && b.due) return a.due.localeCompare(b.due);
    if(a.due && !b.due) return -1;
    if(!a.due && b.due) return 1;
    return 0;
  });

  // Update summary
  const active = todos.filter(t=>!t.done).length;
  const overdue = todos.filter(t=>!t.done && t.due && t.due < today).length;
  const sumEl = document.getElementById('todo-summary');
  if(sumEl) sumEl.textContent = overdue > 0 ? `${active} active · ${overdue} overdue 🔴` : `${active} active task${active!==1?'s':''}`;

  // Today tab badge
  const todayCount = todos.filter(t=>!t.done && t.due && t.due <= today).length;
  const todayTab = document.getElementById('ttab-today');
  if(todayTab) todayTab.textContent = todayCount > 0 ? `📅 Today (${todayCount})` : '📅 Today';

  const el = document.getElementById('todo-list');
  if(!el) return;

  if(!list.length){
    if(todoFilter==='today'){
      el.innerHTML = `<div class="todo-today-empty"><div class="todo-today-empty-icon">🎉</div><div class="todo-today-empty-t">All clear today!</div><div class="todo-today-empty-s">No overdue or due-today tasks.<br>Enjoy your day 🌸</div></div>`;
    } else {
      el.innerHTML = `<div style="text-align:center;padding:32px 16px;color:var(--muted);font-size:13px">Nothing here 🎉</div>`;
    }
    return;
  }

  el.innerHTML = list.map(t=>{
    const isOverdue = !t.done && t.due && t.due < today;
    const isToday   = !t.done && t.due === today;
    let dueHtml = '';
    if(t.due && !t.done){
      const cls = isOverdue ? 'overdue' : isToday ? 'today' : 'upcoming';
      const label = isOverdue ? `⚠️ Overdue · ${t.due}` : isToday ? `📅 Today` : `📅 ${t.due}`;
      dueHtml = `<span class="todo-due ${cls}">${label}</span>`;
    }
    const linkHtml = t.linkLabel ? `<span class="todo-link-tag">${t.linkType==='customer'?'👤':t.linkType==='shipment'?'🚢':t.linkType==='product'?'📦':'🧾'} ${t.linkLabel}</span>` : '';
    const rowClass = `todo-row${t.done?' done-row':''}${t.pinned&&!t.done?' pinned-row':''}${isOverdue?' overdue-row':''}`;
    const prioColor = PRIO_COLORS[t.prio]||'#ccc';

    return `<div class="${rowClass}" id="trow-${t.id}" draggable="${!_todoBulkMode}" data-id="${t.id}"
      ondragstart="${_todoBulkMode?'':'"todoDragStart(event)"'}"
      ondragover="${_todoBulkMode?'':'todoDragOver(event)'}"
      ondrop="${_todoBulkMode?'':'todoDrop(event)'}"
      ondragend="${_todoBulkMode?'':'todoDragEnd(event)'}"
      ontouchstart="${_todoBulkMode?'':'todoTouchStart(event)'}"
      ontouchmove="${_todoBulkMode?'':'todoTouchMove(event)'}"
      ontouchend="${_todoBulkMode?'':'todoTouchEnd(event)'}"
      onclick="${_todoBulkMode?`todoBulkToggle('${t.id}')`:''}" >
      <div class="prio-bar" style="background:${prioColor}"></div>
      ${_todoBulkMode
        ? `<div class="todo-cb${_todoBulkSelected.has(t.id)?' checked':''}" id="bulk-cb-${t.id}">✓</div>`
        : `<div class="todo-cb${t.done?' checked':''}" onclick="event.stopPropagation();toggleTodo('${t.id}')">${t.done?'✓':''}</div>`
      }
      <div class="todo-body">
        <div class="todo-text${t.done?' done':''}">${t.text}</div>
        ${(dueHtml||linkHtml) ? `<div class="todo-meta">${dueHtml}${linkHtml}</div>` : ''}
      </div>
      ${!_todoBulkMode ? `<div class="todo-actions">
        <button class="todo-pin-btn${t.pinned?' active':''}" onclick="event.stopPropagation();pinTodo('${t.id}')" title="Pin">📌</button>
        ${t.due && !t.done ? `<button class="todo-pin-btn" onclick="event.stopPropagation();quickRemindFromTodo('${t.id}')" title="Set reminder" style="font-size:13px">🔔</button>` : ''}
        <button class="todo-del-btn" onclick="event.stopPropagation();deleteTodo('${t.id}')" title="Delete">✕</button>
        <div class="todo-drag-handle" title="Drag to reorder">≡</div>
      </div>` : ''}
    </div>`;
  }).join('');
  initTodoDrag();
}

// ── Drag-to-reorder (desktop + touch) ──
var _dragId = typeof _dragId !== 'undefined' ? _dragId : null, _dragEl = null;
var _touchDragId = typeof _touchDragId !== 'undefined' ? _touchDragId : null, _touchClone = null, _touchStartY = 0;

function todoDragStart(e){
  _dragId = e.currentTarget.dataset.id;
  _dragEl = e.currentTarget;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(()=>{ if(_dragEl) _dragEl.style.opacity='0.4'; }, 0);
}

function todoDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  if(!target || target.dataset.id === _dragId) return;
  const list = document.getElementById('todo-list');
  const items = [...list.querySelectorAll('[data-id]')];
  const fromIdx = items.findIndex(el=>el.dataset.id===_dragId);
  const toIdx = items.findIndex(el=>el===target);
  if(fromIdx === -1 || toIdx === -1) return;
  target.style.borderTop = toIdx < fromIdx ? '2px solid var(--rose)' : '';
  target.style.borderBottom = toIdx > fromIdx ? '2px solid var(--rose)' : '';
}

function todoDrop(e){
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  if(!targetId || targetId === _dragId) return;
  _reorderTodos(_dragId, targetId);
}

function todoDragEnd(e){
  if(_dragEl){ _dragEl.style.opacity=''; _dragEl=null; }
  document.querySelectorAll('[data-id]').forEach(el=>{ el.style.borderTop=''; el.style.borderBottom=''; });
  _dragId = null;
}

function _reorderTodos(fromId, toId){
  const fromIdx = todos.findIndex(t=>t.id===fromId);
  const toIdx = todos.findIndex(t=>t.id===toId);
  if(fromIdx===-1||toIdx===-1) return;
  const [moved] = todos.splice(fromIdx, 1);
  todos.splice(toIdx, 0, moved);
  saveTodos(); saveCalEvents(); renderTodos(); initDashboard();
}

// Touch drag
function todoTouchStart(e){
  const handle = e.target.closest('.todo-drag-handle');
  if(!handle) return;
  const row = e.currentTarget;
  _touchDragId = row.dataset.id;
  _touchStartY = e.touches[0].clientY;
  _touchClone = row.cloneNode(true);
  _touchClone.style.cssText = `position:fixed;left:${row.getBoundingClientRect().left}px;top:${row.getBoundingClientRect().top}px;width:${row.offsetWidth}px;opacity:0.85;z-index:9999;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,0.2);border-radius:12px;background:var(--white)`;
  document.body.appendChild(_touchClone);
  row.style.opacity='0.3';
  e.preventDefault();
}

function todoTouchMove(e){
  if(!_touchDragId||!_touchClone) return;
  const touch = e.touches[0];
  const dy = touch.clientY - _touchStartY;
  _touchClone.style.top = (parseFloat(_touchClone.style.top)+dy)+'px';
  _touchStartY = touch.clientY;
  // Find element under touch
  _touchClone.style.display='none';
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  _touchClone.style.display='';
  const row = el?.closest('[data-id]');
  document.querySelectorAll('[data-id]').forEach(r=>{ r.style.borderTop=''; r.style.borderBottom=''; });
  if(row && row.dataset.id !== _touchDragId){
    const list = document.getElementById('todo-list');
    const items = [...list.querySelectorAll('[data-id]')];
    const fromIdx = items.findIndex(el=>el.dataset.id===_touchDragId);
    const toIdx = items.findIndex(el=>el===row);
    row.style.borderTop = toIdx < fromIdx ? '2px solid var(--rose)' : '';
    row.style.borderBottom = toIdx > fromIdx ? '2px solid var(--rose)' : '';
  }
  e.preventDefault();
}

function todoTouchEnd(e){
  if(!_touchDragId) return;
  const touch = e.changedTouches[0];
  if(_touchClone){ _touchClone.remove(); _touchClone=null; }
  document.querySelectorAll('[data-id]').forEach(el=>{ el.style.opacity=''; el.style.borderTop=''; el.style.borderBottom=''; });
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  const targetRow = el?.closest('[data-id]');
  if(targetRow && targetRow.dataset.id !== _touchDragId){
    _reorderTodos(_touchDragId, targetRow.dataset.id);
  }
  _touchDragId = null;
}

function initTodoDrag(){
  // No extra setup needed — all via inline handlers
}

function toggleTodo(id){
  const t=todos.find(x=>x.id===id);
  if(t){ t.done=!t.done; saveTodos(); saveCalEvents(); renderTodos(); initDashboard(); }
}

function pinTodo(id){
  const t=todos.find(x=>x.id===id);
  if(t){ t.pinned=!t.pinned; saveTodos(); saveCalEvents(); renderTodos(); showToast(t.pinned?'Pinned 📌':'Unpinned'); }
}

function todoBulkClearDone(){
  const doneCount = todos.filter(t=>t.done).length;
  if(!doneCount){ showToast('No completed tasks to clear'); return; }
  appConfirm('Clear Done Tasks', `Delete all ${doneCount} completed task${doneCount>1?'s':''}?`, '🗑️ Clear All', ()=>{
    todos = todos.filter(t=>!t.done);
    saveTodos();
    renderTodos();
    initDashboard();
    showToast(`${doneCount} task${doneCount>1?'s':''} cleared ✅`);
  });
}

function deleteTodo(id){
  const t=todos.find(x=>x.id===id);
  const i=todos.findIndex(x=>x.id===id);
  if(i>-1){
    todos.splice(i,1);
    if(t && t.id.startsWith('reorder-') && t.linkId){
      try {
        const d = JSON.parse(localStorage.getItem('biz_reorder_dismissed')||'{}');
        const p = products.find(x=>x.id===t.linkId);
        if(p){ d[p.id] = String(getTotalQty(p)); localStorage.setItem('biz_reorder_dismissed', JSON.stringify(d)); }
      } catch(e){}
    }
    saveTodos(); saveCalEvents(); renderTodos(); initDashboard();
    showToast('Task deleted 🗑️');
  }
}

function addTodoFromContext(text, linkType, linkId, linkLabel, prio){
  todos.unshift({
    id:'t-'+Date.now(), text,
    prio: prio||'med', done:false, pinned:false,
    due:'', linkType:linkType||'', linkId:linkId||'', linkLabel:linkLabel||''
  });
  saveTodos(); saveCalEvents(); renderTodos(); initDashboard();
}

function quickRemindFromTodo(id){
  const t = todos.find(x=>x.id===id);
  if(!t) return;
  // Pre-fill reminder modal with todo data
  resetReminderModal();
  const titleEl = document.getElementById('rem-title');
  const dateEl  = document.getElementById('rem-date');
  if(titleEl) titleEl.value = t.text;
  if(dateEl && t.due) dateEl.value = t.due;
  // Pick type based on link
  const typeMap = {customer:'payment', shipment:'shipment', invoice:'payment', product:'order'};
  selectRemType(typeMap[t.linkType]||'other');
  showModal('m-add-reminder');
  showToast('Pre-filled from task 🔔');
}

// ═══════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════
var calFilter = typeof calFilter !== 'undefined' ? calFilter : 'all';
var calSelectedDate = typeof calSelectedDate !== 'undefined' ? calSelectedDate : null;
var calGridVisible = typeof calGridVisible !== 'undefined' ? calGridVisible : true;

function toggleCalGrid(){
  calGridVisible = !calGridVisible;
  const wrap = document.getElementById('cal-grid-wrap');
  const icon = document.getElementById('cal-toggle-icon');
  if(wrap) wrap.style.display = calGridVisible ? '' : 'none';
  if(icon) icon.textContent = calGridVisible ? '▾' : '▸';
}

function setCalFilter(el){
  document.querySelectorAll('[id^="tl-f-"]').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
}

function getTimelineItems(){
  const today = new Date().toISOString().split('T')[0];
  const items = [];

  // 🚢 Shipments — ETA dates
  shipments.forEach(s=>{
    if(!s.eta) return;
    items.push({
      date: s.eta, type:'shipment',
      title: s.name||s.supplier||'Shipment',
      sub: `ETA · ${s.status==='arrived'?'Arrived':s.status==='onway'?'On the way':'Ordered'}${s.num?' · #'+s.num:''}`,
      icon:'🚢', color:'tl-ship', id: s.id, page:'shipments'
    });
  });

  // 🧾 Invoices — unpaid/partial with due dates
  invoices.forEach(inv=>{
    if(inv.status==='paid'||inv.status==='cancelled'||inv.status==='shipped') return;
    const dueDate = inv.dueDate || inv.date;
    if(!dueDate) return;
    items.push({
      date: dueDate, type:'invoice',
      title: inv.customer||'Invoice',
      sub: `#${inv.num||inv.id.slice(-4)} · $${(inv.total||0).toFixed(2)} · ${inv.status||'unpaid'}`,
      icon:'🧾', color:'tl-inv', id: inv.id, page:'invoices'
    });
  });

  // ✅ To-Dos with due dates
  todos.forEach(t=>{
    if(!t.due || t.done) return;
    items.push({
      date: t.due, type:'todo',
      title: t.text,
      sub: `Task · ${t.prio==='high'?'🔴 High':t.prio==='med'?'🟡 Med':'🟢 Low'} priority${t.linkLabel?' · '+t.linkLabel:''}`,
      icon:'✅', color:'tl-todo', id: t.id, page:'todo'
    });
  });

  // 🔔 Reminders
  reminders.forEach(r=>{
    if(r.done) return;
    items.push({
      date: r.date, type:'reminder',
      title: r.title,
      sub: `Reminder${r.time?' · '+r.time:''}${r.note?' · '+r.note:''}`,
      icon:'🔔', color:'tl-rem', id: r.id, page:'reminders'
    });
  });

  // 📌 Manual calendar events
  calEvents.forEach(e=>{
    items.push({
      date: e.date, type:'event',
      title: e.title,
      sub: `Event · ${e.type||'other'}`,
      icon: e.type==='shipment'?'🚢':e.type==='payment'?'💰':e.type==='order'?'📦':e.type==='meeting'?'🤝':'📌',
      color:'tl-ev', id: e.id, page:'calendar'
    });
  });

  return items;
}

function renderCalendar(){
  renderOccasionCalendar();
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const shortMonths=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('cal-month-lbl').textContent=months[calMonth]+' '+calYear;

  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  const today=new Date();
  const todayStr=today.toISOString().split('T')[0];

  const allItems = getTimelineItems();
  const filtered = calFilter==='all' ? allItems : allItems.filter(i=>i.type===calFilter);

  // Build set of dates that have items this month
  const itemDates = new Set(filtered.map(i=>i.date));

  let html='';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>{ html+=`<div class="cal-dh">${d}</div>`; });
  for(let i=0;i<firstDay;i++){
    html+=`<div class="cal-day other-m">${daysInPrev-firstDay+1+i}</div>`;
  }
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const isToday=dateStr===todayStr;
    const hasEv=itemDates.has(dateStr);
    const isSel=dateStr===calSelectedDate;
    html+=`<div class="cal-day${isToday?' today':''}${hasEv?' has-ev':''}${isSel?' selected':''}" onclick="selectCalDay('${dateStr}')">${d}</div>`;
  }
  document.getElementById('cal-grid').innerHTML=html;

  // Render timeline
  renderTimeline(filtered);
}

function selectCalDay(date){
  calSelectedDate = calSelectedDate===date ? null : date;
  renderCalendar();
}

function renderTimeline(items){
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0];

  let list = calSelectedDate
    ? items.filter(i=>i.date===calSelectedDate)
    : items.filter(i=>i.date>=today).sort((a,b)=>a.date.localeCompare(b.date));

  // Also show past 3 days if selected date is past
  if(calSelectedDate && calSelectedDate < today){
    list = items.filter(i=>i.date===calSelectedDate);
  }

  const dayLabel = document.getElementById('cal-day-label');
  if(calSelectedDate){
    const d = new Date(calSelectedDate+'T12:00:00');
    const label = calSelectedDate===today?'Today':calSelectedDate===tomorrow?'Tomorrow':d.toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'});
    if(dayLabel) dayLabel.textContent = label+' · '+list.length+' item'+(list.length!==1?'s':'');
  } else {
    if(dayLabel) dayLabel.textContent = 'Upcoming · next 60 days';
    list = list.filter(i=>{
      const diff=(new Date(i.date)-new Date(today))/(1000*60*60*24);
      return diff<=60;
    });
  }

  const el = document.getElementById('cal-ev-list');
  if(!el) return;

  if(!list.length){
    el.innerHTML=`<div class="tl-empty"><div class="tl-empty-icon">${calSelectedDate?'🗓️':'🎉'}</div><div class="tl-empty-t">${calSelectedDate?'Nothing on this day':'All clear!'}</div><div class="tl-empty-s">${calSelectedDate?'Tap another date or add an event':'No upcoming shipments, invoices, tasks or reminders due.'}</div></div>`;
    return;
  }

  // Group by date
  const groups = {};
  list.forEach(item=>{
    if(!groups[item.date]) groups[item.date]=[];
    groups[item.date].push(item);
  });

  const typeLabels = {shipment:'Shipment',invoice:'Invoice',todo:'Task',reminder:'Reminder',event:'Event'};

  el.innerHTML = Object.keys(groups).sort().map(date=>{
    const d = new Date(date+'T12:00:00');
    const isToday = date===today;
    const isTomorrow = date===tomorrow;
    const dateLabel = isToday?'Today 🌸':isTomorrow?'Tomorrow':d.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'});
    const itemsHtml = groups[date].map(item=>`
      <div class="tl-item" onclick="if('${item.page}'!=='calendar'){showPage('${item.page}');setNav('${item.page}');if('${item.page}'==='invoices')renderInvoices();if('${item.page}'==='customers')renderCustomers();if('${item.page}'==='shipments')renderShipments();if('${item.page}'==='todo')renderTodos();if('${item.page}'==='supplies')renderSupplies();}">
        <div class="tl-item-icon ${item.color}" style="background:var(--grey)">${item.icon}</div>
        <div class="tl-item-body">
          <div class="tl-item-title">${item.title}</div>
          <div class="tl-item-sub">${item.sub}</div>
        </div>
        <span class="tl-item-type ${item.color}">${typeLabels[item.type]||item.type}</span>
        ${item.type==='event'?`<button onclick="event.stopPropagation();deleteCalEvent('${item.id}')" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:4px;flex-shrink:0;line-height:1">🗑️</button>`:''}
      </div>`).join('');
    return `<div class="tl-group"><div class="tl-date-lbl${isToday?' today-lbl':''}">${dateLabel}</div>${itemsHtml}</div>`;
  }).join('');
}

function calMove(dir){
  calMonth+=dir;
  if(calMonth>11){ calMonth=0; calYear++; }
  if(calMonth<0){ calMonth=11; calYear--; }
  calSelectedDate=null;
  renderCalendar();
}

function deleteCalEvent(id){
  const e = calEvents.find(x=>x.id===id);
  if(!e) return;
  appConfirm('Delete Event', `Delete "${e.title}"?`, '🗑️ Delete', ()=>{
    calEvents = calEvents.filter(x=>x.id!==id);
    saveTodos(); saveCalEvents();
    renderCalendar();
    showToast('Event deleted');
  });
}

function saveEvent(){
  const title=document.getElementById('ev-title').value.trim();
  const date=document.getElementById('ev-date').value;
  if(!title||!date){ showToast('Enter title and date','err'); return; }
  calEvents.push({id:'e-'+Date.now(), title, date, type:document.getElementById('ev-type').value});
  // Reset form
  document.getElementById('ev-title').value='';
  document.getElementById('ev-date').value='';
  document.getElementById('ev-type').value='other';
  closeModal('m-add-event');
  saveTodos(); saveCalEvents();
  renderCalendar();
  showToast('Event added! 📅');
}

function renderUpcoming(){
  // kept for compatibility — now handled by renderCalendar
  renderCalendar();
}
