// ═══════════════════════════════════════════════════
// SETTINGS  (js/settings.js)
// ═══════════════════════════════════════════════════
// Covers: AI Messages, Business Profiles, Catalog Templates,
//         Catalog PDF, VColor Picker, App Bootstrap
// Depends on: all other modules
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// AI MESSAGES
// ═══════════════════════════════════════════════════
const TPL_BASE = {
  debt:     'Write a polite but firm WhatsApp message to a customer who owes money. Ask them to settle their balance.',
  invoice:  'Write a professional WhatsApp message confirming an order and sharing invoice details.',
  marketing:'Write an engaging WhatsApp caption promoting new beauty products for a Lebanese wholesale beauty business (RA Warehouse).',
  shipment: 'Write a WhatsApp message notifying a customer their order has shipped or is on the way.',
  thankyou: 'Write a warm thank-you message to a customer for their order.',
  arrival:  'Write a WhatsApp message letting a customer know a new shipment just arrived with products they might love. Be exciting and warm.',
  bundle:   'Write a WhatsApp message promoting a gift bundle or product set. Make it sound like a beautiful, great-value gift idea.',
  followup: 'Write a gentle follow-up WhatsApp message to a customer who received a quote or offer but has not replied yet. Warm, not pushy.',
  custom:   ''
};

let activeTpl = null;
let aiSelectedCustomerId = null;
let aiSelectedCustomerIds = []; // for broadcast multi-select
let aiCustomContact = null; // {name, wa} for non-customer contacts

function selectAiCustomContact(){
  closeModal('m-ai-customer');
  appPrompt('Other Contact', 'Enter name (and phone if you want to send WA):', [{label:'Name', id:'acc-name', placeholder:'e.g. Ahmad Supplier'},{label:'WhatsApp (optional)', id:'acc-wa', placeholder:'+961 xx xxx xxx'}], (vals)=>{
    const name = vals['acc-name']?.trim();
    if(!name){ showToast('Enter a name','err'); return; }
    aiCustomContact = { name, wa: vals['acc-wa']?.trim()||'' };
    aiSelectedCustomerId = null;
    updateAiToCard();
  });
}

function appPrompt(title, msg, fields, cb){
  const fieldsHtml = fields.map(f=>`
    <div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--ink-light);text-transform:uppercase;margin-bottom:4px">${f.label}</div>
      <input class="fi" id="aprompt-${f.id}" placeholder="${f.placeholder||''}" style="width:100%">
    </div>`).join('');
  const overlay = document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(44,26,31,0.5);display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML=`<div style="background:var(--white);border-radius:20px;padding:22px 20px;width:100%;max-width:360px;box-shadow:0 8px 40px rgba(0,0,0,0.2)">
    <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:var(--ink);margin-bottom:6px">${title}</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:14px">${msg}</div>
    ${fieldsHtml}
    <div style="display:flex;gap:8px;margin-top:6px">
      <button onclick="this.closest('div[style*=fixed]').remove()" style="flex:1;padding:12px;border:1.5px solid var(--grey2);border-radius:50px;background:transparent;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--ink-light)">Cancel</button>
      <button id="aprompt-ok" style="flex:1;padding:12px;border:none;border-radius:50px;background:var(--rose);color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">OK</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#aprompt-ok').onclick = ()=>{
    const vals = {};
    fields.forEach(f=>{ vals[f.id] = document.getElementById('aprompt-'+f.id)?.value||''; });
    overlay.remove();
    cb(vals);
  };
  overlay.addEventListener('click',e=>{ if(e.target===overlay) overlay.remove(); });
  setTimeout(()=>{ const first = overlay.querySelector('input'); if(first) first.focus(); },100);
}
let aiSelectedLang = 'mix';

const BROADCAST_TYPES = new Set(['arrival','marketing','thankyou','bundle','custom']);
function isBroadcastType(){ return BROADCAST_TYPES.has(activeTpl); }

function setAiLang(lang){
  aiSelectedLang = lang;
  document.querySelectorAll('.ai-lang-btn').forEach(b=>b.classList.remove('sel'));
  const btn = document.getElementById('ailang-'+lang);
  if(btn) btn.classList.add('sel');
}

function selectAiType(el, key){
  const wasBroadcast = isBroadcastType();
  document.querySelectorAll('.ai-tpill').forEach(t=>t.classList.remove('sel'));
  el.classList.add('sel');
  activeTpl = key;
  // Reset selections when switching modes
  if(wasBroadcast !== isBroadcastType()){
    aiSelectedCustomerId = null;
    aiSelectedCustomerIds = [];
    updateAiToCard();
  }
  renderAiContext();
  document.getElementById('ai-result-wrap').style.display = 'none';
  const bub = document.getElementById('ai-bubble');
  if(bub) bub.style.display = 'none';
}

// Keep old name as alias so any other callers don't break
function selectTpl2(el, key){ selectAiType(el, key); }

function openAiCustomerSheet(){
  const inp = document.getElementById('ai-cust-search');
  if(inp) inp.value = '';
  // Update modal title based on mode
  const title = document.querySelector('#m-ai-customer .mtitle');
  if(title) title.textContent = isBroadcastType() ? '👥 Pick customers' : '👤 Who are you messaging?';
  renderAiCustSheet();
  showModal('m-ai-customer');
}

function renderAiCustSheet(){
  const q = (document.getElementById('ai-cust-search')?.value||'').toLowerCase();
  const list = document.getElementById('ai-cust-list');
  if(!list) return;
  const filtered = customers.filter(c=>
    !c.blacklisted &&
    (!q || c.name.toLowerCase().includes(q) || (c.city||'').toLowerCase().includes(q) || (c.wa||'').includes(q))
  );
  const broadcast = isBroadcastType();

  if(broadcast){
    // Multi-select mode
    const rows = filtered.map(c=>{
      const initials = c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const city = c.city ? `· ${c.city}` : '';
      const wa = c.wa ? `· 📱` : '';
      const isSel = aiSelectedCustomerIds.includes(c.id);
      return `<div class="ai-cust-row" onclick="toggleAiCustomer('${c.id}')">
        <div class="ai-cust-avatar" style="${isSel?'background:var(--rose);color:white':''}">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--ink)">${c.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">${city}${wa}</div>
        </div>
        <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${isSel?'var(--rose)':'var(--grey2)'};background:${isSel?'var(--rose)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:white">${isSel?'✓':''}</div>
      </div>`;
    }).join('');
    const count = aiSelectedCustomerIds.length;
    const doneBtn = `<div style="padding:12px 14px;border-top:1px solid var(--grey2)">
      <button class="btn btn-p btn-full" onclick="confirmAiMultiSelect()" style="border-radius:12px;padding:13px">
        Done${count>0?' · '+count+' selected':''}
      </button>
    </div>`;
    list.innerHTML = rows + doneBtn;
  } else {
    // Single-select mode
    const generalRow = `<div class="ai-cust-row" onclick="selectAiCustomer(null)">
      <div class="ai-cust-avatar" style="background:var(--grey);color:var(--muted)">📢</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--ink)">General / Broadcast</div><div style="font-size:11px;color:var(--muted)">No specific customer</div></div>
      ${!aiSelectedCustomerId&&aiCustomContact===null?'<span style="color:var(--rose);font-size:16px">✓</span>':''}
    </div>
    <div class="ai-cust-row" onclick="selectAiCustomContact()" style="border-bottom:2px solid var(--grey2)">
      <div class="ai-cust-avatar" style="background:var(--blue-soft);color:var(--blue)">✏️</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--ink)">Other contact</div>
        <div style="font-size:11px;color:var(--muted)">Supplier, friend, anyone not in your list</div>
      </div>
      ${aiCustomContact!==null?'<span style="color:var(--rose);font-size:16px">✓</span>':''}
    </div>`;
    const rows = filtered.map(c=>{
      const initials = c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const debt = (c.debt||0)>0 ? `<span style="color:var(--red);font-weight:700">💰 owes $${(c.debt).toFixed(2)}</span>` : '';
      const city = c.city ? `· ${c.city}` : '';
      const wa = c.wa ? `· 📱` : '';
      const isSel = aiSelectedCustomerId === c.id;
      return `<div class="ai-cust-row" onclick="selectAiCustomer('${c.id}')">
        <div class="ai-cust-avatar">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--ink)">${c.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">${debt||''}${city}${wa}</div>
        </div>
        ${isSel?'<span style="color:var(--rose);font-size:16px">✓</span>':''}
      </div>`;
    }).join('');
    list.innerHTML = generalRow + rows;
  }
}

function toggleAiCustomer(id){
  const idx = aiSelectedCustomerIds.indexOf(id);
  if(idx === -1) aiSelectedCustomerIds.push(id);
  else aiSelectedCustomerIds.splice(idx,1);
  renderAiCustSheet();
}

function confirmAiMultiSelect(){
  closeModal('m-ai-customer');
  updateAiToCard();
}

function updateAiToCard(){
  const nameEl = document.getElementById('ai-to-name');
  const subEl  = document.getElementById('ai-to-sub');
  const avEl   = document.getElementById('ai-to-avatar');
  if(isBroadcastType()){
    const count = aiSelectedCustomerIds.length;
    if(count === 0){
      nameEl.textContent = 'Pick customers...';
      subEl.textContent  = 'tap to select multiple';
      avEl.textContent   = '👥';
    } else if(count === 1){
      const c = customers.find(x=>x.id===aiSelectedCustomerIds[0]);
      nameEl.textContent = c ? c.name : '1 customer';
      subEl.textContent  = 'tap to change';
      avEl.textContent   = c ? c.name.slice(0,2).toUpperCase() : '1';
    } else {
      const first = customers.find(x=>x.id===aiSelectedCustomerIds[0]);
      nameEl.textContent = `${first?first.name:'...'} +${count-1} more`;
      subEl.textContent  = `${count} customers selected`;
      avEl.textContent   = '👥';
    }
  } else {
    if(aiCustomContact !== null){
      nameEl.textContent = aiCustomContact.name;
      subEl.textContent = aiCustomContact.wa ? '📱 '+aiCustomContact.wa : 'No WhatsApp saved';
      avEl.textContent = aiCustomContact.name.slice(0,2).toUpperCase();
    } else if(!aiSelectedCustomerId){
      nameEl.textContent = 'Pick a customer...';
      subEl.textContent  = 'or send as general broadcast';
      avEl.textContent   = '👤';
    } else {
      const c = customers.find(x=>x.id===aiSelectedCustomerId);
      if(c){
        nameEl.textContent = c.name;
        subEl.innerHTML = `${(c.debt||0)>0?'<span style="color:var(--red)">💰 owes $'+(c.debt).toFixed(2)+'</span>':''} ${c.city?'· '+c.city:''} ${c.wa?'· 📱 '+c.wa:''}`.trim();
        avEl.textContent = c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      }
    }
  }
}

function selectAiCustomer(id){
  aiSelectedCustomerId = id;
  aiCustomContact = null;
  closeModal('m-ai-customer');
  const waLabel = document.getElementById('ai-wa-label');
  if(!id){
    if(waLabel) waLabel.textContent = 'WhatsApp';
  } else {
    const c = customers.find(x=>x.id===id);
    if(c && waLabel) waLabel.textContent = c.wa ? 'WhatsApp ' + c.wa : 'WhatsApp';
  }
  updateAiToCard();
  renderAiContext();
}

function renderAiContext(){
  const ctx = document.getElementById('ai-context');
  const ta  = document.getElementById('ai-prompt');
  if(!ctx) return;
  ta.value = '';
  ctx.innerHTML = '';

  const placeholders = {
    debt:     'e.g. already sent 2 reminders, be more firm...',
    invoice:  'e.g. include delivery date, cash on delivery...',
    shipment: 'e.g. slight delay, will call before delivery...',
    arrival:  'e.g. new Korean skincare, perfumes, hair masks...',
    bundle:   'e.g. great for Mother\'s Day, limited stock...',
    followup: 'e.g. sent quote 3 days ago, no reply yet...',
    marketing:'e.g. 10% off this week, new lipstick shades...',
    thankyou: 'e.g. loyal customer, very large order...',
    custom:   'Write exactly what you want the AI to write...',
  };
  ta.placeholder = placeholders[activeTpl] || 'Any extra details...';

  if(activeTpl === 'invoice'){
    const invList = invoices.filter(i=>i.status!=='cancelled').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,30);
    if(invList.length){
      ctx.innerHTML = `<div class="ai-ctx-card">
        <div class="ai-section-lbl">INVOICE <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></div>
        <select class="fsel" id="ai-ctx-sel-invoice" style="width:100%;font-size:13px;padding:10px 12px">
          <option value="">— no specific invoice —</option>
          ${invList.map(inv=>`<option value="${inv.id}">#${inv.num||inv.id.slice(-4)} · ${inv.customer||'?'} · $${(inv.total||0).toFixed(2)} · ${inv.status||'?'}</option>`).join('')}
        </select>
      </div>`;
    }
  } else if(activeTpl === 'shipment'){
    const shipList = shipments.filter(s=>s.status==='onway'||s.status==='ordered').concat(shipments.filter(s=>s.status==='arrived')).slice(0,15);
    if(shipList.length){
      ctx.innerHTML = `<div class="ai-ctx-card">
        <div class="ai-section-lbl">SHIPMENT <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></div>
        <select class="fsel" id="ai-ctx-sel-shipment" style="width:100%;font-size:13px;padding:10px 12px">
          <option value="">— no specific shipment —</option>
          ${shipList.map(s=>`<option value="${s.id}">${s.name||s.supplier||'Shipment'}${s.num?' · '+s.num:''} · ${s.status}${s.eta?' · ETA '+s.eta:''}</option>`).join('')}
        </select>
      </div>`;
    }
  } else if(activeTpl === 'bundle'){
    const bList = (bundles||[]).slice(0,20);
    if(bList.length){
      ctx.innerHTML = `<div class="ai-ctx-card">
        <div class="ai-section-lbl">BUNDLE <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></div>
        <select class="fsel" id="ai-ctx-sel-bundle" style="width:100%;font-size:13px;padding:10px 12px">
          <option value="">— no specific bundle —</option>
          ${bList.map(b=>`<option value="${b.id}">${b.name||'Bundle'} · $${(b.sellPrice||b.price||0).toFixed(2)}</option>`).join('')}
        </select>
      </div>`;
    }
  }
}

async function generateMsg(){
  if(!activeTpl){ showToast('Pick a message type first','err'); return; }
  const prompt = document.getElementById('ai-prompt').value.trim();
  if(activeTpl === 'custom' && !prompt){ showToast('Write your prompt first','err'); return; }
  const key = localStorage.getItem('groq_key');
  if(!key){ showToast('Add your Groq API key in Settings ⚙️','err'); return; }

  // Build context
  let contextStr = '';
  let customerWa = '';
  if(aiCustomContact !== null){
    contextStr += `Contact: ${aiCustomContact.name}.`;
    if(aiCustomContact.wa) customerWa = aiCustomContact.wa;
  } else if(aiSelectedCustomerId){
    const c = customers.find(x=>x.id===aiSelectedCustomerId);
    if(c){
      contextStr += `Customer: ${c.name}.`;
      if((c.debt||0)>0) contextStr += ` Outstanding debt: $${(c.debt).toFixed(2)}.`;
      if(c.city) contextStr += ` City: ${c.city}.`;
      if(c.wa){ customerWa = c.wa; }
    }
  }
  const ctxSel = document.getElementById('ai-ctx-sel-' + activeTpl);
  if(ctxSel && ctxSel.value){
    if(activeTpl === 'invoice'){
      const inv = invoices.find(x=>x.id===ctxSel.value);
      if(inv){
        contextStr += ` Invoice #${inv.num||inv.id.slice(-4)}, total $${(inv.total||0).toFixed(2)}, date ${inv.date||'?'}, status: ${inv.status||'unpaid'}.`;
        if(inv.status==='partial') contextStr += ` Paid: $${(inv.paidAmt||0).toFixed(2)}, remaining: $${((inv.total||0)-(inv.paidAmt||0)).toFixed(2)}.`;
      }
    } else if(activeTpl === 'shipment'){
      const s = shipments.find(x=>x.id===ctxSel.value);
      if(s) contextStr += ` Shipment: ${s.name||s.supplier||'shipment'}, status: ${s.status}${s.eta?', ETA: '+s.eta:''}.`;
    } else if(activeTpl === 'bundle'){
      const b = (bundles||[]).find(x=>x.id===ctxSel.value);
      if(b) contextStr += ` Bundle: "${b.name||'Gift Set'}", price $${(b.sellPrice||b.price||0).toFixed(2)}.`;
    }
  }

  const langNote = {
    en:       'Write in English. Casual and friendly like a WhatsApp message.',
    ar_fusha: 'اكتب بالعربية الفصحى. أسلوب محترم ورسمي.',
    ar_lebs:  'اكتب باللهجة اللبنانية العامية بالكامل. أسلوب واتساب حميمي وبسيط. استخدم كلمات مثل "هيدا"، "كتير"، "بس"، "شو"، "يلا"، "تفضلي"، "منيح"، "عنجد". لا تستخدم فصحى أبداً.',
    mix:      'Write mixing Lebanese Arabic dialect and English naturally, exactly how Lebanese people text on WhatsApp. Switch languages mid-sentence. Use Lebanese words like "هيدا", "كتير", "بس", "يلا", "عنجد", mixed with English. Example: "Hey! هيدا l invoice, $100 total 💕" or "Yalla طلبك ready بيوصلك بكرا inshallah 🌸". NEVER use formal MSA Arabic.'
  };

  const parts = [];
  if(activeTpl !== 'custom' && TPL_BASE[activeTpl]) parts.push(TPL_BASE[activeTpl]);
  if(contextStr) parts.push('Context: ' + contextStr);
  if(prompt) parts.push('Additional details: ' + prompt);
  parts.push(langNote[aiSelectedLang] || langNote.en);
  parts.push('Keep it concise (2-4 sentences max). Return ONLY the message text — no labels, no subject line, no commentary.');

  const btn = document.getElementById('ai-gen-btn');
  btn.innerHTML = '⏳ Generating...';
  btn.disabled = true;

  document.getElementById('ai-result-wrap').style.display = 'block';
  document.getElementById('ai-typing').style.display = 'flex';
  document.getElementById('ai-bubble').style.display = 'none';

  // Scroll to result
  setTimeout(()=>{
    document.getElementById('ai-result-wrap').scrollIntoView({behavior:'smooth',block:'nearest'});
  }, 100);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: `You are a messaging assistant for a Lebanese beauty business owner named ${(BIZ_DEFAULTS&&BIZ_DEFAULTS.ra&&BIZ_DEFAULTS.ra.owner)||'Aya'}. She runs two businesses: RA Warehouse (wholesale beauty) and Flora Gift Shop (retail gifts). Write short, warm, natural WhatsApp messages. When asked to write in Lebanese mix style, use casual Lebanese dialect mixed with English — never formal MSA Arabic. Return only the message text, nothing else.

Current business snapshot:
- Total products: ${products.filter(p=>!isProductInTransit(p)).length}
- Low stock products: ${products.filter(p=>!isProductInTransit(p)&&p.variants&&p.variants.some(v=>(v.ra||0)<(p.reorderAt||3))).length}
- Open invoices (unpaid/partial/shipped): ${invoices.filter(i=>i.status==='unpaid'||i.status==='partial'||i.status==='shipped').length}
- Total customer debt: $${customers.reduce((s,c)=>s+(c.debt||0),0).toFixed(2)}
- Active customers: ${customers.filter(c=>!c.blacklisted).length}
- Flora orders pending: ${(floraOrders||[]).filter(o=>o.status==='processing').length}
- Shipments in transit: ${shipments.filter(s=>s.status==='onway'||s.status==='ordered').length}`},
          { role: 'user', content: parts.join('\n') }
        ],
        max_tokens: 400,
        temperature: 0.8
      })
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    document.getElementById('ai-typing').style.display = 'none';
    document.getElementById('ai-bubble').style.display = 'block';
    if(text){
      document.getElementById('ai-result').textContent = text.trim();
      const now = new Date();
      document.getElementById('ai-bubble-time').textContent = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');

      // Show correct action area
      const singleRow = document.getElementById('ai-wa-single-row');
      const multiList = document.getElementById('ai-wa-multi-list');
      const copyBroadcast = document.getElementById('ai-copy-broadcast');
      if(isBroadcastType() && aiSelectedCustomerIds.length > 0){
        singleRow.style.display = 'none';
        copyBroadcast.style.display = 'block';
        multiList.style.display = 'block';
        multiList.innerHTML = aiSelectedCustomerIds.map(id=>{
          const c = customers.find(x=>x.id===id);
          if(!c) return '';
          const initials = c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--white);border-radius:12px;margin-bottom:7px;box-shadow:var(--shadow)">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--rose-soft);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--rose);flex-shrink:0">${initials}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--ink)">${c.name}</div>
              <div style="font-size:11px;color:var(--muted)">${c.wa||'no number'}</div>
            </div>
            ${c.wa ? `<button onclick="sendWATo('${c.id}')" style="background:#25d366;color:white;border:none;border-radius:10px;padding:8px 13px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0">📤 Send</button>` : `<span style="font-size:11px;color:var(--muted)">no WA</span>`}
          </div>`;
        }).join('');
      } else {
        singleRow.style.display = 'grid';
        multiList.style.display = 'none';
        copyBroadcast.style.display = 'none';
      }
      showToast('Message ready ✨');
    } else {
      document.getElementById('ai-result').textContent = 'Error: '+(data?.error?.message||JSON.stringify(data));
    }
  } catch(e){
    document.getElementById('ai-typing').style.display = 'none';
    document.getElementById('ai-bubble').style.display = 'block';
    document.getElementById('ai-result').textContent = 'Error: '+e.message;
  } finally {
    btn.innerHTML = '✨ Generate Message';
    btn.disabled = false;
  }
}

function copyAiMsg(){
  const el = document.getElementById('ai-result');
  const txt = el.innerText || el.textContent;
  navigator.clipboard.writeText(txt).then(()=>showToast('Copied! 📋')).catch(()=>showToast('Copy failed','err'));
}

function sendWATo(customerId){
  const el = document.getElementById('ai-result');
  const txt = el.innerText || el.textContent;
  const c = customers.find(x=>x.id===customerId);
  if(!c || !c.wa){ showToast('No WhatsApp number','err'); return; }
  const num = c.wa.replace(/\D/g,'');
  const url = `https://wa.me/${num}?text=${encodeURIComponent(txt)}`;
  showToast('Opening WhatsApp... 📤');
  setTimeout(()=>window.open(url,'_blank'),400);
}

function sendWAMsg(){
  const el = document.getElementById('ai-result');
  const txt = el.innerText || el.textContent;
  let waUrl = 'https://wa.me/';
  if(aiSelectedCustomerId){
    const c = customers.find(x=>x.id===aiSelectedCustomerId);
    if(c && c.wa) waUrl = `https://wa.me/${c.wa.replace(/\D/g,'')}`;
  }
  waUrl += '?text=' + encodeURIComponent(txt);
  showToast('Opening WhatsApp... 📤');
  setTimeout(()=>window.open(waUrl,'_blank'),400);
}

function toggleBubbleEdit(){
  const el = document.getElementById('ai-result');
  const btn = document.getElementById('ai-edit-btn');
  const hint = document.getElementById('ai-edit-hint');
  const isEditing = el.contentEditable === 'true';
  if(isEditing){
    el.contentEditable = 'false';
    el.style.background = '';
    el.style.padding = '';
    btn.textContent = '✏️ Edit';
    hint.style.display = 'none';
  } else {
    el.contentEditable = 'true';
    el.style.background = 'rgba(255,255,255,0.6)';
    el.style.padding = '4px 6px';
    el.focus();
    btn.textContent = '✅ Done';
    hint.style.display = 'none';
  }
}

function getCustomCategories(){ try{ return JSON.parse(localStorage.getItem('customCategories')||'[]'); }catch(e){ return []; } }
function saveCustomCategories(arr){ localStorage.setItem('customCategories', JSON.stringify(arr)); }

function selectCatChip(el, hiddenId){
  const container = el.parentElement;
  container.querySelectorAll('.cat-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(hiddenId).value = el.dataset.val;
  // hide custom input if open
  const customInput = hiddenId==='np-cat' ? document.getElementById('np-cat-custom') : document.getElementById('ep-cat-custom');
  if(customInput) customInput.style.display='none';
}

function openCustomCatChip(hiddenId, chipsId){
  const wrapId = hiddenId==='np-cat' ? 'np-cat-custom-wrap' : 'ep-cat-custom-wrap';
  const wrap = document.getElementById(wrapId);
  const inp = document.getElementById(hiddenId==='np-cat' ? 'np-cat-custom' : 'ep-cat-custom');
  if(!wrap||!inp) return;
  wrap.style.display = 'flex';
  inp.value = '';
  setTimeout(()=>inp.focus(),50);
}

function confirmCustomCat(hiddenId, chipsId, inp){
  const val = inp.value.trim();
  if(!val){
    const wrapId0 = hiddenId==='np-cat' ? 'np-cat-custom-wrap' : 'ep-cat-custom-wrap';
    const wrap0 = document.getElementById(wrapId0);
    if(wrap0) wrap0.style.display='none'; else inp.style.display='none';
    return;
  }
  // Save to localStorage
  const customs = getCustomCategories();
  if(!customs.includes(val)){ customs.push(val); saveCustomCategories(customs); }
  // Inject chip into both pickers
  injectCustomCatChip(val);
  // Select it
  document.getElementById(hiddenId).value = val;
  const container = document.getElementById(chipsId);
  if(container){
    container.querySelectorAll('.cat-chip').forEach(c=>c.classList.remove('active'));
    const chip = container.querySelector(`[data-val="${val}"]`);
    if(chip) chip.classList.add('active');
  }
  const wrapId2 = hiddenId==='np-cat' ? 'np-cat-custom-wrap' : 'ep-cat-custom-wrap';
  const wrap2 = document.getElementById(wrapId2);
  if(wrap2) wrap2.style.display='none';
  else inp.style.display='none';
}

function injectCustomCatChip(val){
  ['np-cat-chips','ep-cat-chips'].forEach(chipsId=>{
    const container = document.getElementById(chipsId);
    if(!container) return;
    if(container.querySelector(`[data-val="${val}"]`)) return; // already exists
    const hiddenId = chipsId==='np-cat-chips' ? 'np-cat' : 'ep-cat';
    const chip = document.createElement('div');
    chip.className = 'cat-chip';
    chip.dataset.val = val;
    chip.textContent = '🏷️ '+val;
    chip.onclick = function(){ selectCatChip(chip, hiddenId); };
    // insert before the + Custom chip
    const customChip = container.querySelector('.cat-chip-custom');
    if(customChip) container.insertBefore(chip, customChip);
    else container.appendChild(chip);
  });
}

function setCatChipValue(hiddenId, val){
  // Used when opening edit product to set active chip
  if(!val) return;
  injectCustomCatChip(val); // ensure chip exists if custom
  const chipsId = hiddenId==='np-cat' ? 'np-cat-chips' : 'ep-cat-chips';
  const container = document.getElementById(chipsId);
  if(!container) return;
  container.querySelectorAll('.cat-chip').forEach(c=>c.classList.remove('active'));
  const chip = container.querySelector(`[data-val="${val}"]`);
  if(chip) chip.classList.add('active');
  document.getElementById(hiddenId).value = val;
}

function loadCustomCategories(){
  getCustomCategories().forEach(val => injectCustomCatChip(val));
}

// Legacy no-op (kept for safety)
function handleCatChange(){}
function injectCustomCatOption(){}



function saveGroqKey(){
  const k = document.getElementById('groq-key-input').value.trim();
  if(k){
    localStorage.setItem('groq_key', k);
    updateGroqStatus(true);
    showToast('Groq API key saved ✓');
  } else {
    showToast('Enter a key first','err');
  }
}

function updateGroqStatus(hasKey){
  const dot = document.getElementById('groq-status-dot');
  const txt = document.getElementById('groq-status-txt');
  const bannerDot = document.getElementById('ai-key-status-dot');
  const bannerTxt = document.getElementById('ai-key-status-txt');
  if(!dot) return;
  if(hasKey){
    dot.style.background = '#22c55e';
    txt.textContent = 'Key saved · Ready to generate';
    txt.style.color = '#22c55e';
    if(bannerDot){ bannerDot.style.background='#22c55e'; }
    if(bannerTxt){ bannerTxt.textContent='Groq connected · Ready ✓'; }
  } else {
    dot.style.background = '#f59e0b';
    txt.textContent = 'No key saved';
    txt.style.color = 'var(--muted)';
    if(bannerDot){ bannerDot.style.background='#f59e0b'; }
    if(bannerTxt){ bannerTxt.textContent='No API key · Add one in Settings ⚙️'; }
  }
}


// ── isProductInTransit ──
function isProductInTransit(p){
  if(!p.shipmentId) return false;
  const s = shipments.find(x=>x.id===p.shipmentId);
  if(!s) return false;
  if(s.status==='arrived') return false;
  // Only hide if product has zero existing stock
  const existingStock = (p.variants||[]).reduce((s,v)=>(v.ra||0)+(v.flora||0)+s, 0);
  return existingStock === 0;
}

// ── Business Profile ──
const BIZ_DEFAULTS = {
  ra:    { name:'RA Warehouse',    desc:'Wholesale beauty & cosmetics', phone:'', wa:'', ig:'', address:'', hours:'', bank:'', acc:'', notes:'', logo:'' },
  flora: { name:'Flora Gift Shop', desc:'Retail gifts & accessories',   phone:'', wa:'', ig:'', address:'', hours:'', bank:'', acc:'', notes:'', logo:'' }
};

function loadBizProfiles(){
  try {
    const saved = JSON.parse(localStorage.getItem('bizProfiles')||'{}');
    BIZ_DEFAULTS.ra    = Object.assign({}, BIZ_DEFAULTS.ra,    saved.ra    || {});
    BIZ_DEFAULTS.flora = Object.assign({}, BIZ_DEFAULTS.flora, saved.flora || {});
  } catch(e){}
  // Update settings labels
  const rn = document.getElementById('set-ra-name');
  const rs = document.getElementById('set-ra-sub');
  const fn = document.getElementById('set-flora-name');
  const fs = document.getElementById('set-flora-sub');
  if(rn) rn.textContent = BIZ_DEFAULTS.ra.name;
  if(rs) rs.textContent = BIZ_DEFAULTS.ra.desc || 'Wholesale beauty & cosmetics';
  if(fn) fn.textContent = BIZ_DEFAULTS.flora.name;
  if(fs) fs.textContent = BIZ_DEFAULTS.flora.desc || 'Retail gifts & accessories';
}

function openBizModal(biz){
  const p = BIZ_DEFAULTS[biz];
  document.getElementById(biz+'-name').value    = p.name    || '';
  document.getElementById(biz+'-desc').value    = p.desc    || '';
  document.getElementById(biz+'-phone').value   = p.phone   || '';
  document.getElementById(biz+'-wa').value      = p.wa      || '';
  document.getElementById(biz+'-wa2').value     = p.wa2     || '';
  document.getElementById(biz+'-ig').value      = p.ig      || '';
  document.getElementById(biz+'-address').value = p.address || '';
  document.getElementById(biz+'-hours').value   = p.hours   || '';
  document.getElementById(biz+'-bank').value    = p.bank    || '';
  document.getElementById(biz+'-acc').value     = p.acc     || '';
  document.getElementById(biz+'-notes').value   = p.notes   || '';
  // Logo preview
  const prev = document.getElementById(biz+'-logo-preview');
  if(p.logo){ prev.innerHTML = `<img src="${p.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:16px">`; }
  else { prev.innerHTML = biz==='ra' ? '🏪' : '🌸'; }
  showModal('m-edit-'+biz);
}

function previewLogo(biz, input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    BIZ_DEFAULTS[biz]._pendingLogo = e.target.result;
    const prev = document.getElementById(biz+'-logo-preview');
    prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:16px">`;
  };
  reader.readAsDataURL(file);
}

function saveBizProfile(biz){
  const p = BIZ_DEFAULTS[biz];
  p.name    = document.getElementById(biz+'-name').value.trim()    || p.name;
  p.desc    = document.getElementById(biz+'-desc').value.trim();
  p.phone   = document.getElementById(biz+'-phone').value.trim();
  p.wa      = document.getElementById(biz+'-wa').value.trim();
  p.wa2     = document.getElementById(biz+'-wa2').value.trim();
  p.ig      = document.getElementById(biz+'-ig').value.trim();
  p.address = document.getElementById(biz+'-address').value.trim();
  p.hours   = document.getElementById(biz+'-hours').value.trim();
  p.bank    = document.getElementById(biz+'-bank').value.trim();
  p.acc     = document.getElementById(biz+'-acc').value.trim();
  p.notes   = document.getElementById(biz+'-notes').value.trim();
  if(p._pendingLogo){ p.logo = p._pendingLogo; delete p._pendingLogo; }
  const existing = JSON.parse(localStorage.getItem('bizProfiles')||'{}');
  existing[biz] = p;
  localStorage.setItem('bizProfiles', JSON.stringify(existing));
  loadBizProfiles();
  closeModal('m-edit-'+biz);
  showToast((biz==='ra'?'RA Warehouse':'Flora Gift Shop')+' updated ✅');
}



// ── Catalog Template Builder ──
let _ctplMode = 'ra'; // 'ra' or 'flora'
let _ctplLogoData = { ra:'', flora:'' };
let _ctplHeroData = { ra: '', flora: '' };

const CTPL_DEFAULTS = {
  ra: {
    bizName: 'RA Warehouse', wa: '', ig: '', address: '',
    intro: 'Welcome to RA Warehouse — your trusted wholesale partner for beauty & cosmetics.',
    minOrder: 'Minimum 1 dozen per item',
    payment: 'Cash, OMT, WhatsApp transfer',
    delivery: 'Delivery available across Lebanon',
    notes: '',
    showStock: false, showPrice: true, showDozen: true, showCategory: true,
    lang: 'en', hero: '', catLabels: {}
  },
  flora: {
    bizName: 'Flora Gift Shop', wa: '', ig: '', address: '',
    intro: 'Discover our beautiful collection of gifts and beauty products.',
    minOrder: '',
    payment: 'Cash accepted',
    delivery: 'Delivery available',
    notes: '',
    showStock: false, showPrice: true, showDozen: false, showCategory: true,
    lang: 'en', hero: '', catLabels: {}
  }
};

function getCatalogTemplates(){
  const saved = localStorage.getItem('catalogTemplates');
  if(saved){
    try{
      const p = JSON.parse(saved);
      return {
        ra:    Object.assign({}, CTPL_DEFAULTS.ra,    p.ra    || {}),
        flora: Object.assign({}, CTPL_DEFAULTS.flora, p.flora || {})
      };
    }catch(e){}
  }
  return { ra: {...CTPL_DEFAULTS.ra}, flora: {...CTPL_DEFAULTS.flora} };
}

function saveCatalogTemplates(tpls){
  localStorage.setItem('catalogTemplates', JSON.stringify(tpls));
}

function openCatalogTemplate(mode){
  _ctplMode = mode;
  const tpls = getCatalogTemplates();
  const t = tpls[mode];
  const isRA = mode === 'ra';

  document.getElementById('ctpl-title').textContent = isRA ? '🏪 RA Wholesale Template' : '🌸 Flora Retail Template';
  document.getElementById('ctpl-biz-name').value = t.bizName || '';
  document.getElementById('ctpl-wa').value = t.wa || '';
  document.getElementById('ctpl-ig').value = t.ig || '';
  document.getElementById('ctpl-address').value = t.address || '';
  document.getElementById('ctpl-intro').value = t.intro || '';
  document.getElementById('ctpl-min-order').value = t.minOrder || '';
  document.getElementById('ctpl-payment').value = t.payment || '';
  document.getElementById('ctpl-delivery').value = t.delivery || '';
  document.getElementById('ctpl-notes').value = t.notes || '';
  document.getElementById('ctpl-lang').value = t.lang || 'en';

  // Show/hide dozen row for Flora
  document.getElementById('ctpl-dozen-row').style.display = isRA ? 'flex' : 'none';

  // Toggles
  ctplSetToggle('ctpl-toggle-stock', t.showStock);
  ctplSetToggle('ctpl-toggle-price', t.showPrice);
  ctplSetToggle('ctpl-toggle-dozen', t.showDozen);
  ctplSetToggle('ctpl-toggle-category', t.showCategory);

  // Logo
  _ctplLogoData[mode] = t.logo || '';
  const logoPrev = document.getElementById('ctpl-logo-preview');
  const logoClearBtn = document.getElementById('ctpl-logo-clear');
  if(t.logo){
    logoPrev.innerHTML = `<img src="${t.logo}" style="width:100%;height:100%;object-fit:cover">`;
    logoClearBtn.style.display = 'block';
  } else {
    logoPrev.innerHTML = `<span style="font-size:26px">${mode==='ra'?'🏪':'🌸'}</span>`;
    logoClearBtn.style.display = 'none';
  }

  // Hero image
  _ctplHeroData[mode] = t.hero || '';
  const prev = document.getElementById('ctpl-hero-preview');
  const clearBtn = document.getElementById('ctpl-hero-clear');
  if(t.hero){
    prev.innerHTML = `<img src="${t.hero}" style="width:100%;height:100%;object-fit:cover">`;
    clearBtn.style.display = 'block';
  } else {
    prev.innerHTML = `<span style="font-size:12px;color:var(--muted)">No image — default will be used</span>`;
    clearBtn.style.display = 'none';
  }

  // Category labels
  const BASE_CATS = {lips:'💄 Lips',face:'✨ Face',body:'🧴 Body',hair:'💇 Hair',nails:'💅 Nails',candles:'🕯️ Candles',giftbox:'🎁 Gift Box',decor:'🏠 Decor',accessories:'🧣 Accessories',other:'📦 Other'};
  const customCats = getCustomCategories();
  customCats.forEach(c=>{ BASE_CATS[c] = '🏷️ '+c; });
  const catLabels = t.catLabels || {};
  const catLabelsList = document.getElementById('ctpl-cat-labels-list');
  if(catLabelsList){
    catLabelsList.innerHTML = Object.entries(BASE_CATS).map(([key, def])=>`
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-size:12px;font-weight:600;color:var(--ink-light);width:110px;flex-shrink:0">${def}</div>
        <input class="fi" data-cat="${key}" placeholder="${def}" value="${catLabels[key]||''}" style="flex:1;font-size:13px;padding:8px 10px">
      </div>`).join('');
  }

  showModal('m-catalog-tpl');
}

function ctplSetToggle(id, active){
  const el = document.getElementById(id);
  if(!el) return;
  if(active) el.classList.add('active');
  else el.classList.remove('active');
}

function ctplToggle(el){ el.classList.toggle('active'); }

function ctplIsOn(id){ return document.getElementById(id)?.classList.contains('active'); }

function ctplSetHero(input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _ctplHeroData[_ctplMode] = e.target.result;
    document.getElementById('ctpl-hero-preview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
    document.getElementById('ctpl-hero-clear').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function ctplClearHero(){
  _ctplHeroData[_ctplMode] = '';
  document.getElementById('ctpl-hero-preview').innerHTML = '<span style="font-size:12px;color:var(--muted)">No image — default will be used</span>';
  document.getElementById('ctpl-hero-clear').style.display = 'none';
}

function ctplSetLogo(input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _ctplLogoData[_ctplMode] = e.target.result;
    document.getElementById('ctpl-logo-preview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
    document.getElementById('ctpl-logo-clear').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function ctplClearLogo(){
  _ctplLogoData[_ctplMode] = '';
  document.getElementById('ctpl-logo-preview').innerHTML = `<span style="font-size:26px">${_ctplMode==='ra'?'🏪':'🌸'}</span>`;
  document.getElementById('ctpl-logo-clear').style.display = 'none';
}

function ctplGetCurrent(){
  // Collect category label overrides
  const catLabels = {};
  document.querySelectorAll('#ctpl-cat-labels-list input[data-cat]').forEach(inp=>{
    const val = inp.value.trim();
    if(val) catLabels[inp.dataset.cat] = val;
  });
  return {
    bizName: document.getElementById('ctpl-biz-name').value.trim(),
    wa: document.getElementById('ctpl-wa').value.trim(),
    ig: document.getElementById('ctpl-ig').value.trim(),
    address: document.getElementById('ctpl-address').value.trim(),
    intro: document.getElementById('ctpl-intro').value.trim(),
    minOrder: document.getElementById('ctpl-min-order').value.trim(),
    payment: document.getElementById('ctpl-payment').value.trim(),
    delivery: document.getElementById('ctpl-delivery').value.trim(),
    notes: document.getElementById('ctpl-notes').value.trim(),
    lang: document.getElementById('ctpl-lang').value,
    showStock: ctplIsOn('ctpl-toggle-stock'),
    showPrice: ctplIsOn('ctpl-toggle-price'),
    showDozen: ctplIsOn('ctpl-toggle-dozen'),
    showCategory: ctplIsOn('ctpl-toggle-category'),
    hero: _ctplHeroData[_ctplMode] || '',
    logo: _ctplLogoData[_ctplMode] || '',
    catLabels
  };
}

function ctplSave(){
  const tpls = getCatalogTemplates();
  tpls[_ctplMode] = ctplGetCurrent();
  saveCatalogTemplates(tpls);
  closeModal('m-catalog-tpl');
  showToast('Template saved ✅');
}


// ── Catalog PDF Generator ──
function generateCatalogPDF(mode){
  // Bundles mode has no PDF — redirect to share WA instead
  if(mode === 'bundles'){
    showToast('Use 📤 WA to share bundles individually','err');
    return;
  }
  if(!products.filter(p=> !isProductInTransit(p) && (mode==='ra' ? p.store!=='flora' : p.store!=='ra')).length){
    showToast('No products to generate PDF','err');
    return;
  }
  const tpls = getCatalogTemplates();
  const t = tpls[mode] || {};
  const isRA = mode === 'ra';
  const today = new Date().toLocaleDateString('en',{day:'numeric',month:'long',year:'numeric'});
  const groupBy = _catGroupBy || 'category'; // respect current toggle

  // --- collect products ---
  const hideOos = document.getElementById('cat-hide-oos')?.checked;
  let list = products.filter(p=>{
    if(isProductInTransit(p)) return false;
    if(isRA && p.store==='flora') return false;
    if(!isRA && p.store==='ra') return false;
    return true;
  });

  // Build collection name map
  const colMap = {};
  collections.forEach(c=>{ colMap[c.id] = c.name; });

  const CAT_LABELS = {lips:'💄 Lips',face:'✨ Face',body:'🧴 Body',hair:'💇 Hair',nails:'💅 Nails',candles:'🕯️ Candles',giftbox:'🎁 Gift Box',decor:'🏠 Decor',accessories:'🧣 Accessories',other:'📦 Other'};
  const tplCatLabels = t.catLabels || {};
  Object.entries(tplCatLabels).forEach(([k,v])=>{ if(v) CAT_LABELS[k]=v; });

  // Group by category OR collection
  const grouped = {};
  const groupOrder = [];
  list.forEach(p=>{
    let key, label;
    if(groupBy === 'collection'){
      key = (p.collectionId && colMap[p.collectionId]) ? p.collectionId : '__none';
      label = key === '__none' ? 'No Collection' : colMap[p.collectionId];
    } else {
      key = p.category || 'other';
      label = CAT_LABELS[key] || ('🏷️ '+key);
    }
    if(!grouped[key]){ grouped[key] = []; groupOrder.push({key, label}); }
    grouped[key].push(p);
  });

  // Build product rows
  function buildRows(prods){
    let rows = '';
    prods.forEach(p=>{
      p.variants.forEach(v=>{
        const stock = isRA ? (v.ra||0) : (v.flora||0);
        if(hideOos && stock===0) return;
        const photo = v.photo||p.photo||'';
        const colorDot = (v.colorHex && v.colorHex!=='#ede6e8' && v.colorHex!=='#f4a0b0' && v.colorHex!=='')
          ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${v.colorHex};border:1px solid rgba(0,0,0,0.15);margin-right:4px;vertical-align:middle;flex-shrink:0"></span>` : '';
        const vLabel = [v.label,v.name,v.size].filter(Boolean).join(' · ') || 'Standard';
        const pricePC = isRA ? (p.priceRAPiece||0) : (p.priceFlora||0);
        const priceDZ = p.priceRADozen||0;
        const imgCell = photo
          ? `<img src="${photo}" style="width:52px;height:52px;object-fit:cover;border-radius:50%;border:1.5px solid ${isRA?'#c9a84c':'#f7c5d5'}">`
          : `<div style="width:52px;height:52px;border-radius:50%;background:${isRA?'#e8eaf0':'#fce8f0'};display:flex;align-items:center;justify-content:center;font-size:24px">${p.emoji||'📦'}</div>`;
        const badgePill = p.badge==='bestseller'
          ? `<span style="display:inline-block;background:#fff8e1;color:#c9a84c;border:1px solid #f0d080;border-radius:20px;font-size:9px;font-weight:800;padding:1px 7px;margin-left:6px;vertical-align:middle;letter-spacing:0.3px">⭐ BEST SELLER</span>`
          : p.badge==='new'
          ? `<span style="display:inline-block;background:${isRA?'#e8f5ee':'#fce8f0'};color:${isRA?'#3a9060':'#d4557a'};border:1px solid ${isRA?'#a8d8bc':'#f7a0c0'};border-radius:20px;font-size:9px;font-weight:800;padding:1px 7px;margin-left:6px;vertical-align:middle;letter-spacing:0.3px">✨ NEW</span>`
          : '';
        if(isRA){
          rows += `<tr>
            <td style="padding:10px 14px;text-align:center">${imgCell}</td>
            <td style="padding:10px 14px;overflow:hidden">
              <div style="font-weight:700;font-size:14px;color:#1a2340">${p.name}${badgePill}</div>
              <div style="font-size:11px;color:#6b7590;margin-top:2px;display:flex;align-items:center">${colorDot}${vLabel}</div>
            </td>
            ${t.showPrice!==false ? `<td style="padding:10px 14px;text-align:right;font-weight:700;font-size:14px;color:#c9a84c;white-space:nowrap">${pricePC?'$'+pricePC.toFixed(2):'—'}</td>` : ''}
            ${(t.showPrice!==false&&t.showDozen!==false) ? `<td style="padding:10px 14px;text-align:right;font-size:13px;color:#6b7590;white-space:nowrap">${priceDZ?'$'+priceDZ.toFixed(2)+'/dz':'—'}</td>` : ''}
            ${(()=>{ if(!t.showStock) return ''; const sb=stock>5?'#e8f5ee':stock>0?'#fef3e2':'#fdeaec'; const sc=stock>5?'#4caf7d':stock>0?'#f5a623':'#e05263'; return '<td style="padding:10px 14px;text-align:center"><span style="background:'+sb+';color:'+sc+';padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700">'+stock+'</span></td>'; })()}
          </tr>`;
        } else {
          rows += `<tr>
            <td style="padding:10px 14px;text-align:center;width:68px">${imgCell}</td>
            <td style="padding:10px 14px">
              <div style="font-weight:700;font-size:14px;color:#3d1f2e">${p.name}${badgePill}</div>
              <div style="font-size:11px;color:#c0839a;margin-top:2px;display:flex;align-items:center">${colorDot}${vLabel}</div>
            </td>
            ${t.showPrice!==false ? `<td style="padding:10px 14px;text-align:right;font-weight:700;font-size:15px;color:#d4557a;white-space:nowrap">${pricePC?'$'+pricePC.toFixed(2):'—'}</td>` : ''}
            ${(()=>{ if(!t.showStock) return ''; const sb=stock>5?'#e8f5ee':stock>0?'#fef3e2':'#fdeaec'; const sc=stock>5?'#4caf7d':stock>0?'#f5a623':'#e05263'; return '<td style="padding:10px 14px;text-align:center"><span style="background:'+sb+';color:'+sc+';padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700">'+stock+'</span></td>'; })()}
          </tr>`;
        }
      });
    });
    return rows;
  }

  // Build all sections
  let tableBody = '';
  groupOrder.forEach(({key, label})=>{
    const rows = buildRows(grouped[key]);
    if(!rows) return;
    const showHeader = groupOrder.length > 1 || (groupOrder.length === 1 && key !== '__none');
    if(showHeader){
      const hdrStyle = isRA
        ? 'padding:10px 14px 8px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;background:#1a2340'
        : 'padding:10px 14px 4px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#d4557a;background:#fce8f0';
      tableBody += `<tr><td colspan="10" style="${hdrStyle}">${label}</td></tr>`;
    }
    tableBody += rows;
  });

  if(!tableBody){ showToast('No products to show','err'); return; }

  // Flora decorative SVG
  const floraBgSVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='220'><defs><radialGradient id='g' cx='30%25' cy='50%25' r='70%25'><stop offset='0' stop-color='%23ffe0ec'/><stop offset='1' stop-color='%23ffc8dc'/></radialGradient></defs><rect width='800' height='220' fill='url(%23g)'/><circle cx='700' cy='50' r='80' fill='%23ffb3cc' opacity='.4'/><circle cx='100' cy='180' r='60' fill='%23ffd6e7' opacity='.5'/><circle cx='400' cy='20' r='40' fill='%23ffffff' opacity='.3'/><text x='640' y='160' font-size='90' opacity='.18'>🌸</text><text x='30' y='100' font-size='60' opacity='.15'>🌺</text><text x='350' y='200' font-size='50' opacity='.12'>✿</text></svg>`;

  const heroSrc = t.hero || floraBgSVG;

  // --- CSS (shared for both RA and Flora) ---
  const floraCSS = `
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{font-family:'DM Sans',sans-serif;background:#fff0f5;color:#3d1f2e}
    @page{margin:0;size:letter}
    @media print{
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .no-print{display:none!important}
      .wrap{box-shadow:none!important;border-radius:0!important;max-width:100%!important}
      thead{display:table-header-group!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      tbody{display:table-row-group}
      tr{page-break-inside:avoid;break-inside:avoid}
      td{page-break-inside:avoid;break-inside:avoid}
      td img{max-height:56px!important;max-width:56px!important;object-fit:cover!important}
      .hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;height:190px!important}
      .hero img{max-height:190px!important;max-width:100%!important;width:100%!important;object-fit:cover!important}
      .logo-circle{border-radius:50%!important;overflow:hidden!important;width:66px!important;height:66px!important}
      .logo-circle img{max-height:66px!important;max-width:66px!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:50%!important}
    }
    body{padding:20px 0 60px}
    .wrap{max-width:720px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 60px rgba(212,85,122,0.18)}
    .hero{position:relative;height:190px;overflow:hidden;background:#fce8f0}
    .hero img{width:100%;height:100%;object-fit:cover;display:block}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(255,230,240,0.0) 0%,rgba(255,230,240,0.88) 80%)}
    .hero-content{position:absolute;bottom:0;left:0;right:110px;padding:18px 24px}
    .biz-name{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#c23067;letter-spacing:-0.3px;line-height:1.1}
    .biz-tag{font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#d4557a;margin-top:5px}
    .biz-contact{font-size:11px;color:#b06080;margin-top:6px;display:flex;gap:14px;flex-wrap:wrap}
    .biz-date{font-size:10px;color:#c0839a;margin-top:3px}
    .logo-circle{position:absolute;top:50%;right:24px;transform:translateY(-50%);width:66px;height:66px;border-radius:50%;background:#fff;border:3px solid #f7a0c0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 4px 16px rgba(212,85,122,0.25)}
    .logo-circle img{width:100%;height:100%;object-fit:cover}
    .intro-bar{background:#fff5f8;border-left:4px solid #f7a0c0;padding:14px 28px;font-size:13px;color:#a05070;font-style:italic;line-height:1.6}
    .save-bar{padding:16px 28px;display:flex;justify-content:center;background:#fff;border-bottom:1px solid #fce0ea}
    .save-btn{background:linear-gradient(135deg,#e8748a,#c23067);color:#fff;border:none;border-radius:50px;padding:11px 30px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 18px rgba(194,48,103,0.3)}
    .save-btn:active{opacity:0.85}
    table{width:100%;border-collapse:collapse}
    thead{background:linear-gradient(90deg,#fce8f0,#ffd6e8)}
    thead th{padding:11px 14px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c23067;text-align:left}
    thead th:not(:first-child){text-align:right}
    thead th:nth-child(2){text-align:left}
    tbody tr{border-bottom:1px solid #fce0ea}
    tbody tr:nth-child(even){background:#fffbfc}
    tbody tr:hover{background:#fff5f8}
    .terms{background:#fff5f8;border-top:1px solid #fce0ea;padding:20px 28px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .term-item{font-size:12px;color:#a05070;line-height:1.7}
    .term-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#d4557a;margin-bottom:4px}
    .footer{background:#fce8f0;padding:14px 28px;text-align:center;font-size:11px;color:#c0839a;border-top:1px solid #fcd0e0}
    .print-bar{position:fixed;bottom:24px;right:24px;display:flex;gap:10px;z-index:999}
    .print-bar button{padding:12px 22px;border:none;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;box-shadow:0 4px 20px rgba(212,85,122,0.25)}
    .btn-print{background:linear-gradient(135deg,#e8748a,#c23067);color:white}
    .btn-close{background:#fff;color:#a05070;border:1px solid #fce0ea}`;

  const raCSS = `
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{font-family:'DM Sans',sans-serif;background:#e8eaf0;color:#1a2340}
    @page{margin:0;size:letter}
    @media print{
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .no-print{display:none!important}
      .wrap{box-shadow:none!important;border-radius:0!important;max-width:100%!important}
      thead{display:table-header-group!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      tbody{display:table-row-group}
      tr{page-break-inside:avoid;break-inside:avoid}
      td{page-break-inside:avoid;break-inside:avoid}
      td img{max-height:56px!important;max-width:56px!important;object-fit:cover!important}
      .hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;height:190px!important}
      .hero img{max-height:190px!important;max-width:100%!important;width:100%!important;object-fit:cover!important}
      .logo-circle{border-radius:50%!important;overflow:hidden!important;width:66px!important;height:66px!important}
      .logo-circle img{max-height:66px!important;max-width:66px!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:50%!important}
    }
    body{padding:20px 0 60px}
    .wrap{max-width:720px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 60px rgba(26,35,64,0.22)}
    .hero{position:relative;height:190px;overflow:hidden;background:#1a2340}
    .hero img{width:100%;height:100%;object-fit:cover;display:block;opacity:0.72}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(26,35,64,0.15) 0%,rgba(26,35,64,0.85) 100%)}
    .hero-content{position:absolute;bottom:0;left:0;right:110px;padding:18px 24px}
    .biz-name{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;line-height:1.1}
    .biz-tag{font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c9a84c;margin-top:5px}
    .biz-contact{font-size:11px;color:#b0b8cc;margin-top:6px;display:flex;gap:14px;flex-wrap:wrap}
    .biz-date{font-size:10px;color:#8890aa;margin-top:3px}
    .logo-circle{position:absolute;top:50%;right:24px;transform:translateY(-50%);width:66px;height:66px;border-radius:50%;background:#fff;border:3px solid #c9a84c;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 4px 16px rgba(26,35,64,0.45)}
    .logo-circle img{width:100%;height:100%;object-fit:cover}
    .intro-bar{background:#f5f6f9;border-left:4px solid #c9a84c;padding:14px 28px;font-size:13px;color:#4a5270;font-style:italic;line-height:1.6}
    .save-bar{padding:16px 28px;display:flex;justify-content:center;background:#fff;border-bottom:1px solid #e0e3ec}
    .save-btn{background:linear-gradient(135deg,#2c3a6e,#1a2340);color:#fff;border:none;border-radius:50px;padding:11px 30px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 18px rgba(26,35,64,0.3)}
    .save-btn:active{opacity:0.85}
    table{width:100%;border-collapse:collapse}
    thead{background:#1a2340}
    thead th{padding:11px 14px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-align:left;overflow:hidden}
    thead th:not(:first-child){text-align:right}
    thead th:nth-child(2){text-align:left}
    tbody tr{border-bottom:1px solid #e0e3ec}
    tbody tr:nth-child(even){background:#f7f8fb}
    tbody tr:hover{background:#eef0f6}
    .terms{background:#f5f6f9;border-top:1px solid #e0e3ec;padding:20px 28px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .term-item{font-size:12px;color:#4a5270;line-height:1.7}
    .term-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1a2340;margin-bottom:4px}
    .footer{background:#1a2340;padding:14px 28px;text-align:center;font-size:11px;color:#8890aa}
    .print-bar{position:fixed;bottom:24px;right:24px;display:flex;gap:10px;z-index:999}
    .print-bar button{padding:12px 22px;border:none;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;box-shadow:0 4px 20px rgba(26,35,64,0.2)}
    .btn-print{background:linear-gradient(135deg,#2c3a6e,#1a2340);color:white}
    .btn-close{background:#fff;color:#4a5270;border:1px solid #e0e3ec}`;

  const theCSS = isRA ? raCSS : floraCSS;

  // thead columns
  const thCols = isRA
    ? `<th>Photo</th><th>Product</th>${t.showPrice!==false?'<th style="text-align:right;white-space:nowrap">Per Piece</th>':''}${t.showPrice!==false&&t.showDozen!==false?'<th style="text-align:right;white-space:nowrap">Per Dozen</th>':''}${t.showStock?'<th style="text-align:center">Stock</th>':''}`
    : `<th>Photo</th><th>Product</th>${t.showPrice!==false?'<th style="text-align:right">Price</th>':''}${t.showStock?'<th style="text-align:center">Stock</th>':''}`;
  // Terms block
  const hasTerms = t.minOrder||t.payment||t.delivery||t.notes;
  const termsHTML = hasTerms ? `<div class="terms">
    ${t.minOrder?`<div class="term-item"><div class="term-label">📦 Min Order</div>${t.minOrder}</div>`:''}
    ${t.payment?`<div class="term-item"><div class="term-label">💳 Payment</div>${t.payment}</div>`:''}
    ${t.delivery?`<div class="term-item"><div class="term-label">🚚 Delivery</div>${t.delivery}</div>`:''}
    ${t.notes?`<div class="term-item" style="grid-column:1/-1"><div class="term-label">📝 Notes</div>${t.notes}</div>`:''}
  </div>` : '';

  const logoHTML = t.logo
    ? `<div class="logo-circle"><img src="${t.logo}" alt="logo"></div>`
    : `<div class="logo-circle">${isRA?'🏪':'🌸'}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.bizName||( isRA?'RA Warehouse':'Flora Gift Shop')} — Price List</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${theCSS}</style>
</head>
<body>
<div class="no-print print-bar">
  <button class="btn-close" onclick="window.close()">✕ Close</button>
  <button class="btn-print" onclick="window.print()">🖨️ Save as PDF</button>
</div>
<div class="wrap">
  <div class="hero">
    <img src="${heroSrc}" alt="hero">
    <div class="hero-overlay"></div>
    ${logoHTML}
    <div class="hero-content">
      <div class="biz-name">${t.bizName||(isRA?'RA Warehouse':'Flora Gift Shop')}</div>
      <div class="biz-tag">${isRA?'Wholesale Price List':'Retail Price List'}</div>
      <div class="biz-contact">
        ${t.wa?`<span>📱 ${t.wa}</span>`:''}
        ${t.ig?`<span>📸 ${t.ig}</span>`:''}
      </div>
      <div class="biz-date">Generated ${today}</div>
    </div>
  </div>
  ${t.intro?`<div class="intro-bar">${t.intro}</div>`:''}
  <div class="save-bar no-print">
    <button class="save-btn" onclick="window.print()">🖨️ Save as PDF</button>
  </div>
  <table>
    <thead><tr>${thCols}</tr></thead>
    <tbody>${tableBody}</tbody>
  </table>
  ${termsHTML}
  <div class="footer">${t.bizName||(isRA?'RA Warehouse':'Flora Gift Shop')} · ${today}${t.address?' · '+t.address:''}</div>
</div>

</body></html>`;

  const w = window.open('','_blank');
  if(!w){ showToast('Allow popups to open PDF','err'); return; }
  w.document.write(html);
  w.document.close();
}

// ── App Bootstrap (DOMContentLoaded) ──
document.addEventListener('DOMContentLoaded', async ()=>{
  await loadData();
  // Load inv session and history from IDB
  await _loadInvSessionAsync();
  try {
    let hist = await _idbGet('scHistory');
    if(hist === undefined || hist === null){
      const raw = localStorage.getItem('scHistory');
      hist = raw ? JSON.parse(raw) : [];
    }
    window._scHistoryCache = hist || [];
  } catch(e){ window._scHistoryCache = []; }
  // If old localStorage data existed, migrate it fully into IDB now and clean up
  const _hasOldLS = localStorage.getItem('biz_products') || localStorage.getItem('biz_customers');
  if(_hasOldLS){
    await saveData();
    ['biz_products','biz_product_photos','biz_reminders','biz_todos','biz_calEvents',
     'biz_customers','biz_shipments','biz_bundles','biz_collections','biz_invoices',
     'biz_floraOrders','biz_floraOrderCounter','biz_supplies','biz_vipSettings',
     'biz_vipSkipped','biz_losses','biz_expenses','scHistory','invSession']
    .forEach(k => localStorage.removeItem(k));
  }
  loadCustomCategories();
  autoExpireRefunds(); // auto-convert expired refunds to losses on every app open
  if(typeof hideSplash === 'function') hideSplash(); // data loaded — dismiss splash
  setTimeout(checkMorningSummary, 2000); // show morning summary after app loads

  // ── DEMO SEED DATA (runs once on first open) ──
  if(!localStorage.getItem('biz_seeded_v1')){
    const NOW = Date.now();
    const d = (offset=0) => { const x=new Date(); x.setDate(x.getDate()+offset); return x.toISOString().slice(0,10); };
    const ms = (offset=0) => NOW + offset*86400000;

    // Collections
    const colSkin={id:'col-001',name:'Skincare Essentials',emoji:'🧴',createdAt:ms(-60)};
    const colLip ={id:'col-002',name:'Lip & Color',        emoji:'💄',createdAt:ms(-55)};
    const colGift={id:'col-003',name:'Gift Sets',          emoji:'🎁',createdAt:ms(-50)};
    const colFrag={id:'col-004',name:'Fragrance & Body',   emoji:'🌹',createdAt:ms(-45)};
    collections=[colSkin,colLip,colGift,colFrag];

    // Shipments
    shipments=[
      {id:'sh-001',name:'Spring Beauty Haul',    num:'GZ-2026-03',supplier:'Guangzhou Glam Co.',  eta:d(-15),cost:1850,status:'arrived',forStore:'ra'},
      {id:'sh-002',name:'Skincare Restock',       num:'SZ-2026-04',supplier:'Shenzhen Beauty Ltd.',eta:d(18), cost:2400,status:'onway',  forStore:'ra'},
      {id:'sh-003',name:'Flora Packaging Run',    num:'YW-2026-04',supplier:'Yiwu Gift Box Co.',   eta:d(22), cost:640, status:'onway',  forStore:'flora'},
      {id:'sh-004',name:'Summer Fragrance Batch', num:'GZ-2026-05',supplier:'Guangzhou Glam Co.',  eta:d(35), cost:1200,status:'ordered',forStore:'ra'},
    ];

    // Products
    const mkV=(id,name,size,colorHex,ra,flora)=>({id,name,size:size||'',colorHex:colorHex||'',label:'',ra,flora,incomingQty:0});
    products=[
      {id:'p-001',name:'Vitamin C Brightening Serum',emoji:'✨',store:'ra',  cost:4.50,priceRAPiece:9.00, priceRADozen:8.00, priceFlora:0,   reorderAt:10,shipmentId:'sh-001',collectionId:'col-001',variants:[mkV('v001a','Standard','30ml','',38,0)]},
      {id:'p-002',name:'Hyaluronic Glow Cream',      emoji:'💧',store:'ra',  cost:5.00,priceRAPiece:10.50,priceRADozen:9.50, priceFlora:0,   reorderAt:8, shipmentId:'sh-001',collectionId:'col-001',variants:[mkV('v002a','Standard','50ml','',52,0)]},
      {id:'p-003',name:'Retinol Night Repair Cream', emoji:'🌙',store:'ra',  cost:6.00,priceRAPiece:12.00,priceRADozen:11.00,priceFlora:0,   reorderAt:8, shipmentId:'sh-002',collectionId:'col-001',variants:[mkV('v003a','Standard','50ml','',0, 0)]},
      {id:'p-004',name:'Rose Petal Lip Gloss',       emoji:'💋',store:'ra',  cost:2.00,priceRAPiece:4.50, priceRADozen:4.00, priceFlora:0,   reorderAt:12,shipmentId:'sh-001',collectionId:'col-002',variants:[mkV('v004a','Rose', '','#e8748a',24,0),mkV('v004b','Berry','','#8b3a5c',18,0),mkV('v004c','Nude','','#c4956a',20,0),mkV('v004d','Clear','','#f0e8e8',15,0)]},
      {id:'p-005',name:'Waterproof Lash Serum',      emoji:'👁️',store:'ra',  cost:3.50,priceRAPiece:7.00, priceRADozen:6.50, priceFlora:0,   reorderAt:6, shipmentId:'sh-001',collectionId:'col-002',variants:[mkV('v005a','Standard','5ml','',3,0)]},
      {id:'p-006',name:'Dewy Setting Spray',         emoji:'💦',store:'ra',  cost:3.00,priceRAPiece:6.50, priceRADozen:5.80, priceFlora:0,   reorderAt:10,shipmentId:'sh-002',collectionId:'col-002',variants:[mkV('v006a','Standard','100ml','',0,0)]},
      {id:'p-007',name:'Collagen Sheet Mask',        emoji:'🎭',store:'ra',  cost:1.20,priceRAPiece:2.80, priceRADozen:2.40, priceFlora:0,   reorderAt:20,shipmentId:'sh-001',collectionId:'col-001',variants:[mkV('v007a','Standard','1pc','',60,0)]},
      {id:'p-008',name:'Rose Gold Luxury Gift Set',  emoji:'🌹',store:'flora',cost:12.00,priceRAPiece:0,  priceRADozen:0,    priceFlora:38.00,reorderAt:5,shipmentId:'sh-003',collectionId:'col-003',variants:[mkV('v008a','Standard','','',0,0)]},
      {id:'p-009',name:'Velvet Rose Candle',         emoji:'🕯️',store:'flora',cost:4.50,priceRAPiece:0,  priceRADozen:0,    priceFlora:22.00,reorderAt:5,shipmentId:'',      collectionId:'col-003',variants:[mkV('v009a','Classic','','#c4956a',0,10),mkV('v009b','Black','','#2c1a1f',0,8)]},
      {id:'p-010',name:'Botanical Bath Bomb Set',    emoji:'🛁',store:'flora',cost:6.00,priceRAPiece:0,  priceRADozen:0,    priceFlora:28.00,reorderAt:4,shipmentId:'',      collectionId:'col-003',variants:[mkV('v010a','Lavender','','#8b5cf6',0,7),mkV('v010b','Rose','','#e8748a',0,9)]},
      {id:'p-011',name:'Oud & Rose Body Mist',       emoji:'🌸',store:'ra', cost:5.50,priceRAPiece:11.00,priceRADozen:10.00,priceFlora:26.00,reorderAt:8,shipmentId:'sh-004',collectionId:'col-004',variants:[mkV('v011a','Standard','150ml','',0,0)]},
      {id:'p-012',name:'Jasmine Eau de Toilette',    emoji:'💐',store:'ra', cost:8.00,priceRAPiece:16.00,priceRADozen:15.00,priceFlora:42.00,reorderAt:6,shipmentId:'sh-004',collectionId:'col-004',variants:[mkV('v012a','Standard','50ml','',0,0)]},
    ];

    // Customers
    customers=[
      {id:'c-001',name:'Sara Khalil',     phone:'+961 70 123 456',type:'ra', wa:'+96170123456',   debt:120,notes:'Prefers weekday delivery'},
      {id:'c-002',name:'Lara Nassar',     phone:'+961 71 234 567',type:'ra', wa:'+96171234567',   debt:0,  notes:''},
      {id:'c-003',name:'Rima Abboud',     phone:'+961 76 345 678',type:'ra', wa:'+96176345678',   debt:250,notes:'Pays end of month'},
      {id:'c-004',name:'Dana Frem',       phone:'+961 79 456 789',type:'ra', wa:'+96179456789',   debt:0,  notes:'Buys every 2 weeks'},
      {id:'c-005',name:'Nour Khoury',     phone:'+961 81 567 890',type:'ra', wa:'+96181567890',   debt:80, notes:''},
      {id:'c-006',name:'Maya Haddad',     phone:'+961 03 678 901',type:'flora',wa:'+96103678901',debt:0,  notes:'Instagram customer'},
      {id:'c-007',name:'Joelle Abi Nader',phone:'+961 70 789 012',type:'flora',wa:'+96170789012',debt:0,  notes:''},
      {id:'c-008',name:'Rania Sleiman',   phone:'+961 71 890 123',type:'flora',wa:'+96171890123',debt:0,  notes:'Repeat buyer'},
    ];

    // RA Invoices
    invoices=[
      {id:'inv-001',num:'INV-001',store:'ra',   customer:'Sara Khalil',  date:d(-32),status:'paid',    total:340, paidAmt:340, notes:'',                  paymentMethod:'cash',    dueDate:d(-25),
       items:[{productId:'p-001',productName:'Vitamin C Brightening Serum',qty:24,price:8.00,total:192},{productId:'p-004',productName:'Rose Petal Lip Gloss',qty:24,price:4.50,total:108},{productId:'p-007',productName:'Collagen Sheet Mask',qty:20,price:2.00,total:40}]},
      {id:'inv-002',num:'INV-002',store:'ra',   customer:'Rima Abboud',  date:d(-28),status:'partial', total:520, paidAmt:270, notes:'Rest due end April', paymentMethod:'transfer',dueDate:d(3),
       items:[{productId:'p-002',productName:'Hyaluronic Glow Cream',qty:24,price:9.50,total:228},{productId:'p-004',productName:'Rose Petal Lip Gloss',qty:36,price:4.00,total:144},{productId:'p-001',productName:'Vitamin C Brightening Serum',qty:16,price:9.25,total:148}]},
      {id:'inv-003',num:'INV-003',store:'ra',   customer:'Lara Nassar',  date:d(-10),status:'paid',    total:190, paidAmt:190, notes:'',                  paymentMethod:'cash',    dueDate:d(-3),
       items:[{productId:'p-002',productName:'Hyaluronic Glow Cream',qty:12,price:9.50,total:114},{productId:'p-005',productName:'Waterproof Lash Serum',qty:12,price:6.33,total:76}]},
      {id:'inv-004',num:'INV-004',store:'ra',   customer:'Dana Frem',    date:d(-5), status:'unpaid',  total:280, paidAmt:0,   notes:'',                  paymentMethod:'',        dueDate:d(2),
       items:[{productId:'p-001',productName:'Vitamin C Brightening Serum',qty:12,price:9.00,total:108},{productId:'p-007',productName:'Collagen Sheet Mask',qty:60,price:2.00,total:120},{productId:'p-004',productName:'Rose Petal Lip Gloss',qty:12,price:4.33,total:52}]},
      {id:'inv-005',num:'INV-005',store:'ra',   customer:'Nour Khoury',  date:d(-3), status:'partial', total:160, paidAmt:80,  notes:'',                  paymentMethod:'cash',    dueDate:d(4),
       items:[{productId:'p-004',productName:'Rose Petal Lip Gloss',qty:24,price:4.00,total:96},{productId:'p-002',productName:'Hyaluronic Glow Cream',qty:6,price:10.67,total:64}]},
      {id:'inv-006',num:'INV-006',store:'flora',customer:'Maya Haddad',  date:d(-8), status:'paid',    total:76,  paidAmt:76,  notes:'Birthday gift',     paymentMethod:'cash',    dueDate:d(-1),
       items:[{productId:'p-008',productName:'Rose Gold Luxury Gift Set',qty:2,price:38.00,total:76}]},
    ];

    // Flora Orders
    floraOrders=[
      {id:'fl-001',num:'FL-001',customer:'Maya Haddad',      channel:'instagram',status:'delivered', stockReduced:true, createdAt:ms(-12),total:76, notes:'Birthday gift wrapping please',
       items:[{productId:'p-008',productName:'Rose Gold Luxury Gift Set',qty:2,price:38.00,emoji:'🌹'}]},
      {id:'fl-002',num:'FL-002',customer:'Joelle Abi Nader', channel:'whatsapp', status:'shipped',   stockReduced:true, createdAt:ms(-6), total:50, notes:'',
       items:[{productId:'p-009',productName:'Velvet Rose Candle',qty:1,price:22.00,emoji:'🕯️'},{productId:'p-010',productName:'Botanical Bath Bomb Set',qty:1,price:28.00,emoji:'🛁'}]},
      {id:'fl-003',num:'FL-003',customer:'Rania Sleiman',    channel:'website',  status:'processing',stockReduced:false,createdAt:ms(-1), total:38, notes:'Include a card please',
       items:[{productId:'p-008',productName:'Rose Gold Luxury Gift Set',qty:1,price:38.00,emoji:'🌹'}]},
      {id:'fl-004',num:'FL-004',customer:'Sara Khalil',      channel:'instagram',status:'processing',stockReduced:false,createdAt:ms(0),  total:22, notes:'',
       items:[{productId:'p-009',productName:'Velvet Rose Candle',qty:1,price:22.00,emoji:'🕯️'}]},
    ];
    floraOrderCounter=4;

    // Supplies
    supplies=[
      {id:'sup-001',name:'Gift Box (Medium)',  emoji:'🎁',store:'flora',cost:0.80,stock:45, reorderAt:20},
      {id:'sup-002',name:'Satin Ribbon Roll',  emoji:'🎀',store:'flora',cost:1.20,stock:8,  reorderAt:10},
      {id:'sup-003',name:'Floral Tissue Paper',emoji:'🌸',store:'flora',cost:0.30,stock:120,reorderAt:30},
      {id:'sup-004',name:'Bubble Wrap Roll',   emoji:'📦',store:'ra',   cost:0.50,stock:55, reorderAt:20},
      {id:'sup-005',name:'Kraft Paper Bag (L)',emoji:'🛍️',store:'flora',cost:0.65,stock:30, reorderAt:15},
      {id:'sup-006',name:'Sticker Labels',     emoji:'🏷️',store:'ra', cost:0.10,stock:200,reorderAt:50},
      {id:'sup-007',name:'Protective Sleeve',  emoji:'🛡️',store:'ra',   cost:0.20,stock:5,  reorderAt:15},
    ];

    // Reminders
    reminders=[
      {id:'r-001',text:'Pay Guangzhou Glam Co. — shipment balance due',  date:d(4), done:false,type:'payment', link:null},
      {id:'r-002',text:'Restock satin ribbon rolls — running very low!', date:d(-2),done:false,type:'supply',  link:null},
      {id:'r-003',text:'Follow up with Rima Abboud — $250 outstanding',  date:d(2), done:false,type:'payment', link:null},
      {id:'r-004',text:'Check ETA on Skincare Restock shipment',         date:d(8), done:false,type:'shipment',link:'sh-002'},
      {id:'r-005',text:'Send April price list to all RA clients',        date:d(1), done:false,type:'task',    link:null},
      {id:'r-006',text:'Prepare Flora IG post for new candle collection',date:d(5), done:false,type:'task',    link:null},
    ];

    // Todos
    todos=[
      {id:'t-001',text:'Update Flora product photos on easy-orders.net',     done:false,prio:'high',createdAt:ms(-3)},
      {id:'t-002',text:'Print new RA Warehouse price list for April',            done:false,prio:'high',createdAt:ms(-2)},
      {id:'t-003',text:'Add Retinol Cream to inventory when ship arrives',   done:false,prio:'med', createdAt:ms(-1)},
      {id:'t-004',text:'Pack Rania Sleiman FL-003 order',                    done:false,prio:'high',createdAt:ms(0)},
      {id:'t-005',text:'Order more gift boxes from Yiwu supplier',           done:false,prio:'med', createdAt:ms(-4)},
      {id:'t-006',text:'Set up summer fragrance display shelf',              done:false,prio:'low', createdAt:ms(-5)},
      {id:'t-007',text:'Do full stock count for RA inventory',               done:true, prio:'med', createdAt:ms(-7)},
    ];

    // Calendar events
    calEvents=[
      {id:'ce-001',title:'📦 Skincare Restock arrives',      date:d(18),type:'shipment',link:'sh-002'},
      {id:'ce-002',title:'📦 Flora Packaging arrives',       date:d(22),type:'shipment',link:'sh-003'},
      {id:'ce-003',title:'💰 Collect from Rima Abboud',      date:d(5), type:'payment', link:null},
      {id:'ce-004',title:'🌸 Flora IG post — new candles',   date:d(5), type:'task',    link:null},
      {id:'ce-005',title:'📋 Monthly inventory review',      date:d(14),type:'task',    link:null},
    ];

    localStorage.setItem('biz_seeded_v1','1');
    try{
      await saveData(); // photo-safe save covers all arrays
    }catch(e){console.warn('Seed error',e);}
  }
  // ── END SEED ──

  loadBizProfiles();
  loadDisplayPrefs();
  initDashboard();
  renderTodos();
  renderBundles();
  renderReminders();
  renderPresets();
  renderShipments();
  renderCustomers();
  renderInvoices();
  renderSupplies();
  renderFloraPage();
  renderCollections();
  rebuildInvTabs();
  renderInventory();
  initPWA();
  setTimeout(()=>{ buildNotifications(); syncToIDB(); checkTodayReminders(); }, 1500);
  const savedGroqKey = localStorage.getItem('groq_key');
  if(savedGroqKey){ const el = document.getElementById('groq-key-input'); if(el) el.value = savedGroqKey; }
  updateGroqStatus(!!savedGroqKey);
});

// ── Variant Color Picker ──
const VCOLOR_CATS = [
  { label:'🤍 White', colors:['#FFFFFF','#FFF5F7','#FFF0F3','#F7F3F0','#EDE6E8','#E8E0E3','#F5F0F0','#FAFAFA'] },
  { label:'🌸 Pink',  colors:['#FFD6E0','#FFB6C1','#F4A0B0','#E8748A','#FF85A1','#F06292','#E05480','#C71585'] },
  { label:'❤️ Red',   colors:['#FF9A8B','#FF6B6B','#FF4757','#E05263','#DC143C','#C0392B','#8B0000','#FF0000'] },
  { label:'💜 Purple',colors:['#F3E5F5','#E1BEE7','#CE93D8','#BA68C8','#9B59B6','#8B5CF6','#7B2D8B','#6A0DAD'] },
  { label:'🌿 Nude',  colors:['#FDEBD0','#F5DEB3','#DEB887','#D2B48C','#C4956A','#A0785A','#8D6348','#7A5230'] },
  { label:'🟫 Brown', colors:['#C8956C','#A0522D','#8B4513','#6B3A2A','#4A2515','#3D1C02','#2C1503','#1A0D00'] },
  { label:'🟠 Orange',colors:['#FFD580','#FFA500','#F5A623','#E67E22','#FF7043','#D35400','#C0392B','#BF360C'] },
  { label:'💛 Yellow',colors:['#FFFDE7','#FFF176','#FFD700','#F9A825','#DAA520','#B8860B','#8B7355','#6D5B1E'] },
  { label:'💚 Green', colors:['#E8F5E9','#A5D6A7','#66BB6A','#4CAF7D','#2E7D32','#1B5E20','#33691E','#556B2F'] },
  { label:'💙 Blue',  colors:['#E3F2FD','#90CAF9','#5B8DEE','#2196F3','#1565C0','#0D47A1','#000080','#1A237E'] },
  { label:'🩶 Grey',  colors:['#F5F5F5','#E0E0E0','#BDBDBD','#9E9E9E','#757575','#616161','#404040','#212121'] },
  { label:'🖤 Black', colors:['#2C1A1F','#1C1C1C','#111111','#000000','#0D0D0D','#1A1A1A','#0A0A0A','#050505'] },
  { label:'🥂 Metal', colors:['#E8B4A0','#D4957A','#C0A080','#C0C0C0','#A8A9AD','#CFB53B','#B8860B','#808080'] },
];

let _vcolorTarget = null;
let _vcolorSelected = '#ede6e8';
let _vcolorActiveCat = 0;
let _vcolorBuilt = false;

function openVColorPicker(btn){
  const row = btn.closest('.variant-input-row');
  _vcolorTarget = row ? row.querySelector('.variant-color-input') : null;
  _vcolorSelected = (_vcolorTarget?.value) || '#ede6e8';
  if(!_vcolorBuilt){ _buildVColorUI(); _vcolorBuilt=true; }
  _vcolorSwitchCat(_vcolorActiveCat, false);
  updateVColorPreview();
  highlightVColorGrid(_vcolorSelected);
  // sync custom input
  document.getElementById('vcolor-custom-input').value = _vcolorSelected.replace('#','');
  document.getElementById('vcolor-custom-swatch').style.background = _vcolorSelected;
  document.getElementById('vcolor-sheet').style.display='flex';
}

function _buildVColorUI(){
  const tabsEl = document.getElementById('vcolor-tabs');
  const pagesEl = document.getElementById('vcolor-pages');
  tabsEl.innerHTML=''; pagesEl.innerHTML='';

  // tab strip
  VCOLOR_CATS.forEach((cat,i)=>{
    const t = document.createElement('button');
    t.textContent = cat.label;
    t.dataset.i = i;
    t.style.cssText = `padding:6px 12px;border-radius:50px;border:1.5px solid var(--grey2);background:var(--white);color:var(--muted);font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;font-family:'DM Sans',sans-serif;flex-shrink:0;transition:all 0.15s`;
    t.onclick = ()=> _vcolorSwitchCat(i, true);
    tabsEl.appendChild(t);
  });

  // one grid page per category — horizontal slider
  const slider = document.createElement('div');
  slider.id = 'vcolor-slider';
  slider.style.cssText = `display:flex;transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);will-change:transform;height:100%`;
  pagesEl.style.cssText = `flex:1;overflow:hidden;position:relative`;

  VCOLOR_CATS.forEach(cat=>{
    const page = document.createElement('div');
    page.style.cssText = `flex-shrink:0;width:100%;padding:12px 18px 4px;display:grid;grid-template-columns:repeat(8,1fr);gap:8px;align-content:start`;
    cat.colors.forEach(hex=>{
      const c = document.createElement('div');
      c.style.cssText = `aspect-ratio:1;border-radius:50%;background:${hex};cursor:pointer;border:2px solid rgba(0,0,0,0.08);transition:transform 0.12s,border 0.12s`;
      c.onclick = ()=>{ _vcolorSelected=hex; updateVColorPreview(); highlightVColorGrid(hex);
        document.getElementById('vcolor-custom-input').value=hex.replace('#','');
        document.getElementById('vcolor-custom-swatch').style.background=hex; };
      c.dataset.hex = hex;
      page.appendChild(c);
    });
    slider.appendChild(page);
  });
  pagesEl.appendChild(slider);
}

function _vcolorSwitchCat(i, scroll){
  _vcolorActiveCat = i;
  const slider = document.getElementById('vcolor-slider');
  if(slider) slider.style.transform = `translateX(-${i*100}%)`;
  // update tabs
  document.querySelectorAll('#vcolor-tabs button').forEach((t,j)=>{
    const active = j===i;
    t.style.background = active ? 'var(--rose)' : 'var(--white)';
    t.style.color = active ? 'white' : 'var(--muted)';
    t.style.borderColor = active ? 'var(--rose)' : 'var(--grey2)';
  });
  if(scroll){
    const tab = document.querySelector(`#vcolor-tabs button[data-i="${i}"]`);
    if(tab) tab.scrollIntoView({inline:'center',behavior:'smooth'});
  }
}

function updateVColorPreview(){
  document.getElementById('vcolor-preview-circle').style.background = _vcolorSelected;
  document.getElementById('vcolor-preview-hex').textContent = _vcolorSelected.toUpperCase();
}

function highlightVColorGrid(hex){
  document.querySelectorAll('#vcolor-slider div[data-hex]').forEach(c=>{
    const match = c.dataset.hex?.toLowerCase()===hex?.toLowerCase();
    c.style.border = match ? '3px solid var(--rose)' : '2px solid rgba(0,0,0,0.08)';
    c.style.transform = match ? 'scale(1.18)' : 'scale(1)';
  });
}

function onVColorCustomInput(inp){
  const raw = inp.value.replace(/[^0-9a-fA-F]/g,'');
  inp.value = raw;
  if(raw.length===6){
    const hex = '#'+raw;
    document.getElementById('vcolor-custom-swatch').style.background = hex;
  }
}

function applyVColorCustom(){
  const raw = document.getElementById('vcolor-custom-input').value.trim();
  if(raw.length!==6){ showToast('Enter a valid 6-digit hex code','err'); return; }
  const hex = '#'+raw.toUpperCase();
  _vcolorSelected = hex;
  updateVColorPreview();
  highlightVColorGrid(hex);
  document.getElementById('vcolor-custom-swatch').style.background = hex;
}

function closeVColorSheet(){
  document.getElementById('vcolor-sheet').style.display='none';
}

function confirmVColor(){
  if(_vcolorTarget){
    _vcolorTarget.value = _vcolorSelected;
    const row = _vcolorTarget.closest('.variant-input-row');
    const btn = row?.querySelector('.vcolor-btn');
    if(btn) btn.style.background = _vcolorSelected;
  }
  closeVColorSheet();
}

function detectColorFromPhoto(){
  document.getElementById('vcolor-photo-input').click();
}

function extractColorFromPhoto(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = function(){
      const canvas = document.getElementById('vcolor-canvas');
      const ctx = canvas.getContext('2d');
      const size = 80;
      canvas.width = size; canvas.height = size;
      const srcX = Math.max(0,(img.width-img.height)/2);
      const cropSize = Math.min(img.width,img.height);
      ctx.drawImage(img, srcX, 0, cropSize, cropSize, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let r=0,g=0,b=0,count=0;
      for(let i=0;i<data.length;i+=4){
        const pr=data[i],pg=data[i+1],pb=data[i+2],pa=data[i+3];
        if(pa<100) continue;
        const brightness=(pr+pg+pb)/3;
        if(brightness>240||brightness<15) continue;
        if(Math.max(pr,pg,pb)-Math.min(pr,pg,pb)<20) continue;
        r+=pr;g+=pg;b+=pb;count++;
      }
      let hex;
      if(count>0){
        hex='#'+[Math.round(r/count),Math.round(g/count),Math.round(b/count)].map(v=>v.toString(16).padStart(2,'0')).join('');
      } else {
        r=0;g=0;b=0;count=0;
        for(let i=0;i<data.length;i+=4){ r+=data[i];g+=data[i+1];b+=data[i+2];count++; }
        hex='#'+[Math.round(r/count),Math.round(g/count),Math.round(b/count)].map(v=>v.toString(16).padStart(2,'0')).join('');
      }
      _vcolorSelected = hex;
      updateVColorPreview();
      highlightVColorGrid(hex);
      document.getElementById('vcolor-custom-input').value = hex.replace('#','');
      document.getElementById('vcolor-custom-swatch').style.background = hex;
      showToast('Color detected from photo ✓','ok');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value='';
}

// ── Social Media Badge Toggle ──
function toggleSMBadge(pid, field){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  p[field] = !p[field];
  saveData();
  // update badge in DOM without full re-render
  const badgeEl = document.getElementById('sm-'+field+'-'+pid);
  if(badgeEl){
    if(field==='postedIG'||field==='postedIGFlora'){
      badgeEl.className = 'sm-badge '+(p[field]?'ig-on':'ig-off');
      badgeEl.innerHTML = (p[field]?'✅':'📷')+' Instagram';
    } else {
      badgeEl.className = 'sm-badge '+(p[field]?'web-on':'web-off');
      badgeEl.innerHTML = (p[field]?'✅':'🌐')+' Website';
    }
  }
  showToast(p[field]?'Marked as posted ✅':'Unmarked');
}

