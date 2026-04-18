// ═══════════════════════════════════════════════════
// CUSTOMERS  (js/customers.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, dashboard.js
// ═══════════════════════════════════════════════════

var custFilter = typeof custFilter !== 'undefined' ? custFilter : 'all';
// vipSettings / vipSkipped → js/data.js

function renderCustomers(){
  const q = (document.getElementById('cust-search')?.value||'').toLowerCase();
  let list = customers.slice();
  if(custFilter==='blacklist'){
    list = list.filter(c=>c.blacklisted);
  } else {
    list = list.filter(c=>!c.blacklisted); // hide blacklisted from all normal tabs
    if(custFilter==='ra')    list = list.filter(c=>c.type==='ra'||c.type==='both');
    if(custFilter==='flora') list = list.filter(c=>c.type==='flora'||c.type==='both');
    if(custFilter==='debt')  list = list.filter(c=>c.debt>0);
    if(custFilter==='vip')   list = list.filter(c=>c.vip);
  }
  if(q) list = list.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.city||'').toLowerCase().includes(q)||(c.wa||'').toLowerCase().includes(q));
  // VIPs always float to top (in non-blacklist tabs)
  if(custFilter!=='blacklist') list.sort((a,b)=> (b.vip?1:0)-(a.vip?1:0));
  const el = document.getElementById('cust-list');
  if(!el) return;
  el.innerHTML = list.length ? list.map(c=>{
    const typeLabel = c.type==='both'
      ? '<span class="b brose" style="font-size:10px">🏪🌸 Both</span>'
      : c.type==='ra'
        ? '<span class="b brose" style="font-size:10px">🏪 RA</span>'
        : '<span class="b bb" style="font-size:10px">🌸 Flora</span>';
    const debtColor = c.debt>0 ? 'var(--red)' : 'var(--green)';
    const avatar = c.name.trim().charAt(0).toUpperCase();
    const custInvs = (invoices||[]).filter(i=>(i.customer||'').toLowerCase()===(c.name||'').toLowerCase());
    const invCount = custInvs.filter(i=>i.status!=='cancelled').length;
    const totalSpent = custInvs.filter(i=>i.status!=='cancelled').reduce((s,i)=>s+(i.total||0),0);
    const waClean = c.wa ? c.wa.replace(/\s+/g,'') : '';
    // Inactive warning for VIPs
    const sortedInvs = custInvs.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const lastInv = sortedInvs[0];
    const lastOrderDate = lastInv ? new Date(lastInv.date+'T12:00:00') : null;
    const daysSince = lastOrderDate ? Math.floor((Date.now()-lastOrderDate)/(1000*60*60*24)) : null;
    const isInactive = c.vip && daysSince !== null && daysSince >= (vipSettings.inactiveDays||30);
    // Last order info for all customers
    let lastOrderLabel = '';
    if(lastOrderDate){
      if(daysSince === 0) lastOrderLabel = `<span style="color:var(--green);font-weight:600">🟢 Ordered today</span>`;
      else if(daysSince <= 7) lastOrderLabel = `<span style="color:var(--green);font-weight:600">🟢 ${daysSince}d ago</span>`;
      else if(daysSince <= 30) lastOrderLabel = `<span style="color:var(--amber);font-weight:600">🟡 ${daysSince}d ago</span>`;
      else lastOrderLabel = `<span style="color:var(--muted)">🔴 ${daysSince}d ago</span>`;
    } else {
      lastOrderLabel = `<span style="color:var(--muted)">No orders yet</span>`;
    }
    if(c.blacklisted){
      // Blacklist card
      const blackDate = c.blacklistedDate ? new Date(c.blacklistedDate).toLocaleDateString('en',{day:'numeric',month:'short',year:'2-digit'}) : '';
      return `<div class="cr" onclick="openCustDetail('${c.id}')" style="border-left:3px solid var(--red);padding-left:10px;opacity:0.9">
        <div class="cav" style="background:var(--red-soft);color:var(--red);font-size:18px">🚫</div>
        <div class="cif">
          <div class="cname" style="color:var(--red)">${c.name} ${typeLabel}</div>
          <div class="cdtl">${c.blacklistReason?'💬 '+c.blacklistReason:'No reason given'}${blackDate?' · '+blackDate:''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
          ${c.writtenOff>0?`<div style="font-size:11px;font-weight:700;color:var(--red)">💸 $${c.writtenOff.toFixed(0)} lost</div>`:''}
          ${c.debt>0?`<div style="font-size:13px;font-weight:800;color:var(--red)">$${c.debt.toFixed(2)}</div><div style="font-size:10px;color:var(--red)">still owes</div>`:'<div style="font-size:10px;color:var(--muted)">settled</div>'}
        </div>
      </div>`;
    }
    return `<div class="cr" onclick="openCustDetail('${c.id}')" style="${isInactive?'border-left:3px solid var(--amber);padding-left:10px':''}">
      <div class="cav" style="${c.vip?'background:linear-gradient(135deg,#fef3c7,#fde68a);color:#b45309;font-size:18px':''}">
        ${c.vip?'⭐':avatar}
      </div>
      <div class="cif">
        <div class="cname">${c.name} ${c.fromShop?'🛍️':''} ${typeLabel}</div>
        <div class="cdtl" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${lastOrderLabel}
          ${c.city?`<span style="color:var(--muted)">· 📍${c.city}</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
        <div style="font-size:15px;font-weight:800;color:${debtColor}">$${(c.debt||0).toFixed(2)}</div>
        <div style="font-size:10px;font-weight:600;color:${debtColor}">${c.debt>0?'owes':'clear'}</div>
        ${waClean?`<button onclick="event.stopPropagation();window.open('https://wa.me/${waClean}','_blank')" style="background:#25d366;color:white;border:none;border-radius:8px;padding:3px 8px;font-size:11px;cursor:pointer;font-weight:700;margin-top:2px">📤</button>`:''}
      </div>
    </div>`;
  }).join('') : '<div style="color:var(--muted);text-align:center;padding:30px 0;font-size:14px">No customers found</div>';
}

function openNewCustomer(){
  document.getElementById('nc-modal-title').textContent = '👤 New Customer';
  document.getElementById('nc-edit-id').value = '';
  document.getElementById('nc-name').value = '';
  document.getElementById('nc-city').value = '';
  document.getElementById('nc-type').value = 'ra';
  document.getElementById('nc-wa').value = '';
  document.getElementById('nc-notes').value = '';
  document.getElementById('nc-vip-label').value = '';
  document.getElementById('nc-vip-toggle').classList.remove('active');
  showModal('m-new-cust');
}

function editCustomer(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  document.getElementById('nc-modal-title').textContent = '✏️ Edit Customer';
  document.getElementById('nc-edit-id').value = cid;
  document.getElementById('nc-name').value = c.name||'';
  const ncAddr = document.getElementById('nc-address'); if(ncAddr) ncAddr.value = c.address||'';
  document.getElementById('nc-city').value = c.city||'';
  document.getElementById('nc-type').value = c.type||'ra';
  document.getElementById('nc-wa').value = c.wa||'';
  document.getElementById('nc-notes').value = c.notes||'';
  document.getElementById('nc-vip-label').value = c.vipLabel||'';
  if(c.vip) document.getElementById('nc-vip-toggle').classList.add('active');
  else document.getElementById('nc-vip-toggle').classList.remove('active');
  closeModal('m-cust-detail');
  showModal('m-new-cust');
}

function saveCustomer(){
  const name = document.getElementById('nc-name').value.trim();
  if(!name){ showToast('Enter a name','err'); return; }
  const editId = document.getElementById('nc-edit-id').value;
  const isVip = document.getElementById('nc-vip-toggle').classList.contains('active');
  const data = {
    name,
    city:     document.getElementById('nc-city').value.trim(),
    address:  document.getElementById('nc-address')?.value.trim()||'',
    type:     document.getElementById('nc-type').value,
    wa:       document.getElementById('nc-wa').value.trim(),
    notes:    document.getElementById('nc-notes').value.trim(),
    vip:      isVip,
    vipLabel: document.getElementById('nc-vip-label').value.trim(),
  };
  if(editId){
    const c = customers.find(x=>x.id===editId);
    if(c){
      const oldName = c.name;
      Object.assign(c, data);
      // If name changed, update all invoice and flora order references
      if(oldName.toLowerCase() !== name.toLowerCase()){
        invoices.forEach(inv=>{ if((inv.customer||'').toLowerCase()===oldName.toLowerCase()) inv.customer=name; });
        floraOrders.forEach(o=>{ if((o.customer||'').toLowerCase()===oldName.toLowerCase()) o.customer=name; });
      }
    }
    showToast('Customer updated ✅');
  } else {
    // Check for duplicate name
    const exists = customers.find(c=>c.name.toLowerCase()===name.toLowerCase());
    if(exists){
      appConfirm('Customer Already Exists', `"${name}" is already in your list. Add anyway as a separate entry?`, '➕ Add Anyway', ()=>{
        customers.push({ id:'c-'+Date.now(), debt:0, ...data });
        closeModal('m-new-cust');
        saveCustomers(); renderCustomers(); initDashboard();
        showToast('Customer added! 👤');
      });
      return;
    }
    customers.push({ id:'c-'+Date.now(), debt:0, ...data });
    showToast('Customer added! 👤');
  }
  closeModal('m-new-cust');
  saveCustomers(); renderCustomers(); initDashboard();
}

function openVipSettings(){
  document.getElementById('vs-invoices').value = vipSettings.minInvoices||5;
  document.getElementById('vs-spent').value = vipSettings.minSpent||500;
  document.getElementById('vs-inactive').value = vipSettings.inactiveDays||30;
  document.getElementById('vs-discount').value = vipSettings.discount||10;
  showModal('m-vip-settings');
}

function saveVipSettings(){
  vipSettings.minInvoices  = parseInt(document.getElementById('vs-invoices').value,10)||5;
  vipSettings.minSpent     = parseFloat(document.getElementById('vs-spent').value)||500;
  vipSettings.inactiveDays = parseInt(document.getElementById('vs-inactive').value,10)||30;
  vipSettings.discount     = parseFloat(document.getElementById('vs-discount').value)||10;
  saveCustomers();
  closeModal('m-vip-settings');
  showToast('VIP settings saved ✅');
  renderCustomers();
}

function checkVipPromotions(){
  if(document.getElementById('m-vip-prompt')?.style.display==='flex') return; // already showing
  customers.forEach(c => {
    if(c.vip) return;
    if(c.blacklisted) return;
    if(vipSkipped.includes(c.id)) return;
    const custInvs = invoices.filter(i=>(i.customer||'').toLowerCase()===(c.name||'').toLowerCase() && i.status!=='cancelled');
    const totalSpent = custInvs.reduce((s,i)=>s+(i.total||0),0);
    const invCount = custInvs.length;
    const qualifies = invCount >= vipSettings.minInvoices || totalSpent >= vipSettings.minSpent;
    if(qualifies){
      showVipPrompt(c, invCount, totalSpent);
      return; // only show one at a time
    }
  });
}

function showVipPrompt(c, invCount, totalSpent){
  const el = document.getElementById('m-vip-prompt');
  if(!el) return;
  document.getElementById('vip-prompt-name').textContent = c.name;
  document.getElementById('vip-prompt-stats').textContent = invCount+' invoices · $'+totalSpent.toFixed(0)+' total spent';
  el.style.display = 'flex';
  el._custId = c.id;
}

function vipPromptYes(){
  const el = document.getElementById('m-vip-prompt');
  const cid = el._custId;
  const c = customers.find(x=>x.id===cid);
  if(c){ c.vip=true; c.vipLabel=c.vipLabel||'Top Client'; }
  el.style.display='none';
  saveCustomers(); renderCustomers();
  showToast('⭐ '+c.name+' is now VIP!');
}

function vipPromptNo(){
  const el = document.getElementById('m-vip-prompt');
  const cid = el._custId;
  if(!vipSkipped.includes(cid)) vipSkipped.push(cid);
  el.style.display='none';
  saveCustomers();
  showToast('Skipped — won\'t ask again');
}



function blastVipWhatsApp(){
  const vips = customers.filter(c=>c.vip && c.wa);
  if(!vips.length){ showToast('No VIP customers with WhatsApp','err'); return; }
  const msg = encodeURIComponent('🌸 Hi! We have exciting new products just for you. Contact us to see what\'s new! ⭐');
  // Open WA for each VIP one by one
  vips.forEach((c,i)=>{
    setTimeout(()=>{
      const wa = c.wa.replace(/\s+/g,'');
      window.open('https://wa.me/'+wa+'?text='+msg,'_blank');
    }, i*800);
  });
  showToast('📤 Sending to '+vips.length+' VIP customers...');
}

function openCustDetail(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  const typeLabel = c.type==='both'?'🏪🌸 Both':c.type==='ra'?'🏪 RA':'🌸 Flora';
  document.getElementById('cd-title').textContent = c.name;

  // Invoice history for this customer
  const custInvs = (invoices||[]).filter(i=>(i.customer||'').toLowerCase()===(c.name||'').toLowerCase())
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const STATUS = { unpaid:'br', partial:'ba', shipped:'bb', paid:'bg', cancelled:'bm' };
  const invHtml = custInvs.length ? custInvs.map(inv=>{
    const d = inv.date ? new Date(inv.date+'T12:00:00').toLocaleDateString('en',{day:'numeric',month:'short',year:'2-digit'}) : '—';
    return `<div onclick="closeModal('m-cust-detail');openInvoiceDetail('${inv.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--grey2);cursor:pointer">
      <div><div style="font-size:12px;font-weight:600;color:var(--ink)">#${inv.num} <span style="font-weight:400;color:var(--muted)">${d}</span></div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="b ${STATUS[inv.status]||'br'}" style="font-size:10px">${inv.status}</span>
        <span style="font-size:13px;font-weight:700">$${(inv.total||0).toFixed(2)}</span>
      </div>
    </div>`;
  }).join('') : '<div style="font-size:12px;color:var(--muted);padding:8px 0">No invoices yet</div>';

  // Auto-calc debt from invoices (exclude cancelled)
  const autoDebt = custInvs.reduce((s,i)=>{
    if(i.status==='cancelled'||i.status==='paid') return s;
    if(i.status==='unpaid')  return s+(i.total||0);
    if(i.status==='partial') return s+Math.max(0,(i.total||0)-(i.paidAmt||0));
    if(i.status==='shipped') return s+(i.total||0);
    return s;
  }, 0);

  document.getElementById('cd-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <span class="b brose" style="font-size:11px">${typeLabel}</span>
      ${c.blacklisted?`<span style="background:var(--red-soft);color:var(--red);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">🚫 Blacklisted</span>`:''}
      ${c.vip?`<span style="background:#fef3c7;color:#b45309;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">⭐ VIP${c.vipLabel?' · '+c.vipLabel:''}</span>`:''}
      ${c.debt>0?`<span class="b br">Owes $${c.debt.toFixed(2)}</span>`:`<span class="b bg">No debt ✅</span>`}
    </div>
    ${c.blacklisted?`<div class="card" style="padding:12px;margin-bottom:12px;border:1.5px solid var(--red-soft)">
      ${c.blacklistReason?`<div style="font-size:13px;font-weight:600;color:var(--red);margin-bottom:4px">💬 ${c.blacklistReason}</div>`:''}
      ${c.blacklistedDate?`<div style="font-size:11px;color:var(--muted)">Blacklisted on ${new Date(c.blacklistedDate).toLocaleDateString('en',{day:'numeric',month:'long',year:'numeric'})}</div>`:''}
      ${c.writtenOff>0?`<div style="font-size:12px;font-weight:700;color:var(--red);margin-top:6px">💸 $${c.writtenOff.toFixed(2)} written off</div>`:''}
    </div>`:''}
    ${custInvs.length?`<div style="display:flex;gap:8px;margin-bottom:12px">
      <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--green)">$${custInvs.filter(i=>i.status!=='cancelled').reduce((s,i)=>s+(i.total||0),0).toFixed(0)}</div>
        <div style="font-size:10px;color:var(--muted);font-weight:600">TOTAL INVOICED</div>
      </div>
      <div style="flex:1;background:var(--rose-soft);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--rose)">${custInvs.filter(i=>i.status!=='cancelled').length}</div>
        <div style="font-size:10px;color:var(--muted);font-weight:600">INVOICES</div>
      </div>
    </div>`:''}
    <div class="card" style="padding:12px;margin-bottom:12px">
      ${c.city?`<div class="lr"><div class="lif"><div class="ln">📍 ${c.city}</div></div></div>`:''}
      ${c.address?`<div class="lr"><div class="lif"><div class="ln">🏠 ${c.address}</div></div></div>`:''}
      ${c.wa?`<div class="lr"><div class="lif"><div class="ln">📱 ${c.wa}</div></div></div>`:''}
      ${c.fromShop?`<div class="lr"><div class="lif"><div class="ln">🛍️ Shop Customer</div></div></div>`:''}
      ${c.notes?`<div class="lr"><div class="lif"><div class="ln" style="color:var(--muted);font-style:italic">💬 ${c.notes}</div></div></div>`:''}
    </div>
    <div class="card" style="padding:12px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:12px;font-weight:700;color:var(--ink)">💰 Debt</div>
        ${Math.abs(autoDebt - (c.debt||0)) > 0.01 ? `<button onclick="syncCustDebt('${c.id}',${autoDebt})" class="btn btn-s" style="padding:4px 10px;font-size:11px">↻ Sync ($${autoDebt.toFixed(2)})</button>` : '<span style="font-size:10px;color:var(--green)">✅ In sync</span>'}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="fi" type="number" id="cd-debt-inp" value="${c.debt||0}" step="0.01" style="flex:1">
        <button class="btn btn-p btn-sm" onclick="updateCustDebt('${c.id}')">Save</button>
      </div>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:8px">🧾 Invoice History (${custInvs.length})</div>
    <div style="margin-bottom:4px">${invHtml}</div>
    ${(c.interactions||[]).length ? `
    <div style="font-size:12px;font-weight:700;color:var(--ink);margin:12px 0 8px">⭐ Interaction Log (${c.interactions.length})</div>
    <div>${(c.interactions||[]).slice(0,5).map(it=>{
      const icons={'call':'📞','whatsapp':'💬','visit':'🤝','payment':'💰','note':'📝'};
      const d = new Date(it.date).toLocaleDateString('en',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--grey2)">
        <span style="font-size:16px;flex-shrink:0">${icons[it.type]||'📝'}</span>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--ink)">${it.note||it.type}</div>
          <div style="font-size:10px;color:var(--muted)">${d}</div>
        </div>
        <button onclick="deleteInteraction('${c.id}','${it.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px">✕</button>
      </div>`;
    }).join('')}</div>` : ''}`;

  const wa = c.wa ? c.wa.replace(/\s+/g,'') : '';
  if(c.blacklisted){
    document.getElementById('cd-foot').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%">
        <button class="btn btn-g btn-sm" onclick="closeModal('m-cust-detail')">Close</button>
        <button class="btn btn-sm" style="background:var(--red-soft);color:var(--red)" onclick="deleteCust('${c.id}')">🗑️ Delete</button>
        <button class="btn btn-s btn-sm" onclick="editCustomer('${c.id}')">✏️ Edit</button>
        <button class="btn btn-sm" style="background:var(--green-soft);color:var(--green);font-weight:700" onclick="unblacklistCust('${c.id}')">✅ Unblacklist</button>
      </div>
      <button class="btn btn-sm" style="background:var(--green);color:white;width:100%;margin-top:8px;font-weight:700;padding:12px;font-size:13px;border-radius:50px" onclick="sendCustStatement('${c.id}')">📤 Send Statement via WhatsApp</button>
      <button class="btn btn-s btn-sm" style="width:100%;margin-top:6px" onclick="openAddInteraction('${c.id}')">⭐ Log Interaction</button>
      ${c.writtenOff>0?`<button class="btn btn-sm" style="background:var(--green);color:white;width:100%;margin-top:8px;font-weight:700;padding:12px;font-size:13px;border-radius:50px" onclick="blacklistCustPaidKeep('${c.id}')">💚 He paid me back!</button>`:''}`;
  } else {
    document.getElementById('cd-foot').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%">
        <button class="btn btn-g btn-sm" onclick="closeModal('m-cust-detail')">Close</button>
        <button class="btn btn-sm" style="background:var(--red-soft);color:var(--red)" onclick="deleteCust('${c.id}')">🗑️ Delete</button>
        <button class="btn btn-s btn-sm" onclick="editCustomer('${c.id}')">✏️ Edit</button>
        ${wa?`<button class="btn btn-green btn-sm" onclick="window.open('https://wa.me/${wa}','_blank')">📤 WhatsApp</button>`:`<div></div>`}
      </div>
      <button class="btn btn-sm" style="background:var(--green);color:white;width:100%;margin-top:8px;font-weight:700;padding:12px;font-size:13px;border-radius:50px" onclick="sendCustStatement('${c.id}')">📤 Send Statement via WhatsApp</button>
      <button class="btn btn-s btn-sm" style="width:100%;margin-top:6px" onclick="openAddInteraction('${c.id}')">⭐ Log Interaction</button>
      <button class="btn btn-sm" style="background:var(--red-soft);color:var(--red);width:100%;margin-top:6px;font-weight:700" onclick="openBlacklistModal('${c.id}')">🚫 Blacklist Customer</button>`;
  }
  showModal('m-cust-detail');
}

var _blDebtChoice = typeof _blDebtChoice !== 'undefined' ? _blDebtChoice : 'writeoff';
function selectBlDebtChoice(choice){
  _blDebtChoice = choice;
  document.getElementById('bl-choice-writeoff').style.border = choice==='writeoff' ? '2px solid var(--red)' : '2px solid var(--grey2)';
  document.getElementById('bl-choice-writeoff').style.background = choice==='writeoff' ? 'var(--red-soft)' : 'var(--white)';
  document.getElementById('bl-choice-keep').style.border = choice==='keep' ? '2px solid var(--blue)' : '2px solid var(--grey2)';
  document.getElementById('bl-choice-keep').style.background = choice==='keep' ? 'var(--blue-soft)' : 'var(--white)';
}
function openBlacklistModal(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  const el = document.getElementById('m-blacklist');
  el._custId = cid;
  document.getElementById('bl-name').textContent = c.name;
  document.getElementById('bl-reason').value = '';
  _blDebtChoice = 'writeoff';
  selectBlDebtChoice('writeoff');
  const debtSection = document.getElementById('bl-debt-section');
  const debtAmt = document.getElementById('bl-debt-amount');
  if(c.debt > 0){
    debtSection.style.display = 'block';
    debtAmt.textContent = '$'+c.debt.toFixed(2);
  } else {
    debtSection.style.display = 'none';
  }
  closeModal('m-cust-detail');
  showModal('m-blacklist');
}

function confirmBlacklist(){
  const el = document.getElementById('m-blacklist');
  const cid = el._custId;
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  const reason = document.getElementById('bl-reason').value.trim();
  const debtChoice = _blDebtChoice;
  c.blacklisted = true;
  c.blacklistedDate = new Date().toISOString();
  c.blacklistReason = reason;
  c.vip = false; // remove VIP if they had it
  if(c.debt > 0 && debtChoice === 'writeoff'){
    const debtAmt = c.debt;
    c.writtenOff = (c.writtenOff||0) + debtAmt;
    c.debt = 0;
    losses.push({ id:'loss-'+Date.now()+Math.random().toString(36).slice(2,6), type:'bad_debt', amount:debtAmt,
      date:new Date().toISOString().split('T')[0], note:`Bad debt write-off: ${c.name}`, customerId:c.id, customerName:c.name });
  }
  closeModal('m-blacklist');
  saveCustomers(); renderCustomers(); initDashboard();
  showToast('🚫 '+c.name+' blacklisted');
}

function blacklistCustPaid(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  const amt = c.writtenOff||0;
  appConfirm('💚 He Paid Back!', c.name+' paid back the $'+amt.toFixed(2)+' you wrote off. Remove from blacklist too?', '✅ Yes, unblacklist', ()=>{
    c.writtenOff = 0;
    c.blacklisted = false;
    c.blacklistedDate = null;
    saveCustomers(); renderCustomers(); initDashboard(); closeModal('m-cust-detail');
    showToast('💚 Payment recorded! '+c.name+' removed from blacklist');
  });
}

// Keep on blacklist version
function blacklistCustPaidKeep(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  c.writtenOff = 0;
  saveCustomers(); renderCustomers(); initDashboard(); openCustDetail(cid);
  showToast('💚 Payment recorded! Still blacklisted.');
}

function unblacklistCust(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  appConfirm('Remove from Blacklist', 'Move '+c.name+' back to normal customers?', '✅ Unblacklist', ()=>{
    c.blacklisted = false;
    c.blacklistedDate = null;
    saveCustomers(); renderCustomers(); initDashboard();
    closeModal('m-cust-detail');
    showToast(c.name+' removed from blacklist');
  });
}

function syncCustDebt(cid, amount){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  c.debt = amount;
  saveCustomers(); openCustDetail(cid); renderCustomers(); initDashboard();
  showToast('Debt synced ✅');
}


function recalcDebt(customerName){
  // Recalculate a customer's debt from scratch based on their invoices
  if(!customerName) return;
  const c = customers.find(x=>x.name&&x.name.toLowerCase()===customerName.toLowerCase());
  if(!c) return;
  const custInvs = invoices.filter(i=>
    i.customer&&i.customer.toLowerCase()===customerName.toLowerCase()&&
    i.status!=='cancelled'
  );
  const debt = custInvs.reduce((s,i)=>{
    if(i.status==='unpaid'||i.status==='shipped') return s+(i.total||0);
    if(i.status==='partial') return s+((i.total||0)-(i.paidAmt||0));
    return s;
  },0);
  c.debt = Math.max(0, debt);
  saveCustomers();
}

function recalcAllDebts(){
  // Recalculate all customer debts from scratch
  customers.forEach(c=>{
    const custInvs = invoices.filter(i=>
      i.customer&&i.customer.toLowerCase()===(c.name||'').toLowerCase()&&
      i.status!=='cancelled'
    );
    c.debt = Math.max(0, custInvs.reduce((s,i)=>{
      if(i.status==='unpaid'||i.status==='shipped') return s+(i.total||0);
      if(i.status==='partial') return s+((i.total||0)-(i.paidAmt||0));
      return s;
    },0));
  });
  saveCustomers();
}

function saveNewCustomer(){ saveCustomer(); }

function updateCustDebt(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  c.debt = parseFloat(document.getElementById('cd-debt-inp').value)||0;
  saveCustomers(); renderCustomers(); initDashboard();
  closeModal('m-cust-detail');
  showToast('Debt updated ✅');
}

function deleteCust(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  const hasDebt = (c.debt||0) > 0;
  const openInvs = invoices.filter(i=>(i.customer||'').toLowerCase()===c.name.toLowerCase()&&(i.status==='unpaid'||i.status==='partial'||i.status==='shipped')).length;
  const warnMsg = hasDebt
    ? `Delete ${c.name}? They have $${c.debt.toFixed(2)} outstanding debt and ${openInvs} open invoice${openInvs!==1?'s':''}.`
    : `Delete ${c.name}? This cannot be undone.`;
  appConfirm('Delete Customer', warnMsg, '🗑️ Delete', ()=>{
    customers = customers.filter(x=>x.id!==cid);
    saveCustomers(); renderCustomers(); initDashboard();
    closeModal('m-cust-detail');
    showToast('Customer deleted 🗑️');
  });
}


// ── Interaction log ──
function openAddInteraction(cid){
  document.getElementById('interaction-cid').value = cid;
  document.getElementById('interaction-type').value = 'call';
  document.getElementById('interaction-note').value = '';
  showModal('m-interaction');
}

function saveInteraction(){
  const cid = document.getElementById('interaction-cid').value;
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  if(!c.interactions) c.interactions = [];
  c.interactions.unshift({
    id: 'int-'+Date.now(),
    type: document.getElementById('interaction-type').value,
    note: document.getElementById('interaction-note').value.trim(),
    date: new Date().toISOString()
  });
  saveCustomers();
  closeModal('m-interaction');
  openCustDetail(cid);
  showToast('Interaction logged ⭐');
}

function deleteInteraction(cid, iid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  c.interactions = (c.interactions||[]).filter(x=>x.id!==iid);
  saveCustomers();
  openCustDetail(cid);
  showToast('Deleted');
}

// ── Customer WA Statement ──
function sendCustStatement(cid){
  const c = customers.find(x=>x.id===cid);
  if(!c) return;
  const custInvs = invoices.filter(i=>(i.customer||'').toLowerCase()===(c.name||'').toLowerCase())
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const activeInvs = custInvs.filter(i=>i.status!=='cancelled');
  const lines = [
    `🌸 *Account Statement*`,
    `👤 ${c.name}`,
    `📅 ${new Date().toLocaleDateString('en',{day:'numeric',month:'long',year:'numeric'})}`,
    `──────────────────`,
    ...activeInvs.map(inv=>{
      const st = inv.status==='paid'?'✅ Paid':inv.status==='partial'?'💛 Partial':inv.status==='shipped'?'🚚 Shipped — unpaid':'❌ Unpaid';
      return `#${inv.num} · $${(inv.total||0).toFixed(2)} · ${st}`;
    }),
    `──────────────────`,
    `💰 *Total owed: $${(c.debt||0).toFixed(2)}*`
  ];
  // Use customer's own WA if available, else open with our store number
  const custWA = (c.wa||'').replace(/\D/g,'');
  if(!custWA){ showToast('No WhatsApp number for this customer','err'); return; }
  const url = `https://wa.me/${custWA}?text=${encodeURIComponent(lines.join('\n'))}`;
  window.open(url,'_blank');
}
