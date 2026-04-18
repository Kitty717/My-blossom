// ═══════════════════════════════════════════════════
// EXPENSES  (js/expenses.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, dashboard.js
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// FEATURE 3: EXPENSES
// ═══════════════════════════════════════════════════
// expenses / expFilter → js/data.js

const EXP_CATS = {
  transport:{label:'Transport', icon:'🚗'},
  packaging:{label:'Packaging', icon:'📦'},
  rent:{label:'Rent', icon:'🏠'},
  shipping:{label:'Shipping', icon:'✈️'},
  marketing:{label:'Marketing', icon:'📱'},
  salary:{label:'Salary', icon:'👤'},
  other:{label:'Other', icon:'📋'}
};

// loadExpenses / saveExpenses → js/data.js

function openAddExpense(){
  document.getElementById('expense-edit-id').value = '';
  document.getElementById('expense-modal-title').textContent = '💸 Add Expense';
  document.getElementById('expense-cat').value = 'transport';
  document.getElementById('expense-desc').value = '';
  document.getElementById('expense-amount').value = '';
  document.getElementById('expense-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('expense-store').value = 'both';
  showModal('m-expense');
}

function openEditExpense(id){
  const e = expenses.find(x=>x.id===id);
  if(!e) return;
  document.getElementById('expense-edit-id').value = id;
  document.getElementById('expense-modal-title').textContent = '✏️ Edit Expense';
  document.getElementById('expense-cat').value = e.cat||'other';
  document.getElementById('expense-desc').value = e.desc||'';
  document.getElementById('expense-amount').value = e.amount||'';
  document.getElementById('expense-date').value = e.date||'';
  document.getElementById('expense-store').value = e.store||'both';
  showModal('m-expense');
}

function saveExpense(){
  const amount = parseFloat(document.getElementById('expense-amount').value)||0;
  if(!amount){ showToast('Enter an amount','err'); return; }
  const editId = document.getElementById('expense-edit-id').value;
  const data = {
    cat:   document.getElementById('expense-cat').value,
    desc:  document.getElementById('expense-desc').value.trim(),
    amount,
    date:  document.getElementById('expense-date').value||new Date().toISOString().slice(0,10),
    store: document.getElementById('expense-store').value,
  };
  if(editId){
    const e = expenses.find(x=>x.id===editId);
    if(e) Object.assign(e, data);
    showToast('Expense updated ✅');
  } else {
    expenses.push({id:'exp-'+Date.now(), ...data});
    showToast('Expense saved 💸');
  }
  saveExpenses();
  closeModal('m-expense');
  renderExpenses();
  initDashboard();
}

function deleteExpense(id){
  appConfirm('Delete Expense','Delete this expense?','🗑️ Delete',()=>{
    expenses = expenses.filter(x=>x.id!==id);
    saveExpenses(); renderExpenses(); initDashboard(); showToast('Deleted');
  });
}

function renderExpenses(){
  loadExpenses();
  const list = expFilter==='all' ? expenses : expenses.filter(e=>e.cat===expFilter);
  const sorted = [...list].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const total = list.reduce((s,e)=>s+(e.amount||0),0);
  // Summary
  const sumEl = document.getElementById('expense-summary');
  if(sumEl){
    const byCat = {};
    list.forEach(e=>{ byCat[e.cat]=(byCat[e.cat]||0)+(e.amount||0); });
    const topCats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,3);
    sumEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:13px;font-weight:600;color:var(--ink)">Total Expenses</div>
      <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--red)">$${total.toFixed(2)}</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${topCats.map(([cat,amt])=>`<span style="background:var(--grey);border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;color:var(--ink-light)">${EXP_CATS[cat]?.icon||'📋'} $${amt.toFixed(0)}</span>`).join('')}
    </div>`;
  }
  const el = document.getElementById('expense-list');
  if(!el) return;
  if(!sorted.length){
    el.innerHTML='<div style="text-align:center;padding:40px 0;color:var(--muted)"><div style="font-size:40px;margin-bottom:10px">💸</div><div style="font-size:14px;font-weight:600">No expenses yet</div></div>';
    return;
  }
  el.innerHTML = sorted.map(e=>{
    const cat = EXP_CATS[e.cat]||{label:e.cat,icon:'📋'};
    const date = e.date ? new Date(e.date+'T12:00:00').toLocaleDateString('en',{day:'numeric',month:'short'}) : '';
    return `<div class="card" style="margin-bottom:10px;padding:14px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;border-radius:12px;background:var(--red-soft);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${cat.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--ink)">${e.desc||cat.label}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${cat.label} · ${date}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:700;color:var(--red)">$${(e.amount||0).toFixed(2)}</div>
          <div style="display:flex;gap:4px;margin-top:4px;justify-content:flex-end">
            <button onclick="openEditExpense('${e.id}')" style="background:var(--rose-soft);color:var(--rose);border:none;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">✏️</button>
            <button onclick="deleteExpense('${e.id}')" style="background:var(--grey);color:var(--muted);border:none;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer">🗑️</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function setExpFilter(filter){
  expFilter = filter;
  ['all','ra','flora','both'].forEach(f=>{
    const btn = document.getElementById('expf-'+f);
    if(btn){
      btn.style.background = f===filter ? 'var(--rose)' : 'var(--grey)';
      btn.style.color = f===filter ? 'white' : 'var(--muted)';
    }
  });
  renderExpenses();
}
