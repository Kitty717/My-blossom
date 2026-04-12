// ═══════════════════════════════════════════════════
// BUNDLE BUILDER  (js/bundles.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, inventory.js, dashboard.js
// ═══════════════════════════════════════════════════

function renderBundles(){
  const el = document.getElementById('bundles-list');
  if(!el) return;
  if(!bundles.length){
    el.innerHTML='<div style="text-align:center;padding:50px 20px;color:var(--muted)"><div style="font-size:48px;margin-bottom:12px">🎁</div><div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">No bundles yet</div><div style="font-size:13px">Tap <b>+ Manual</b> to build one yourself<br>or <b>✨ Auto</b> to let AI build it for you</div></div>';
    return;
  }
  el.innerHTML = bundles.map(b=>{
    const pkgCost = b.pkgCost||0;
    const prodCost = b.cost||0;
    const supplyCost = (b.supplies||[]).reduce((s,item)=>{
      const sup = supplies.find(x=>x.id===item.sid);
      return s + (item.qty||1)*(sup?.cost||0);
    },0);
    const totalCost = prodCost + pkgCost + supplyCost;
    const sellPrice = b.sellPrice||0;
    const profit = sellPrice - totalCost;
    const margin = sellPrice>0&&totalCost>0 ? ((profit/sellPrice)*100).toFixed(0) : 0;
    const marginCls = margin>=30?'bg':margin>=15?'ba':'br';
    const profitColor = profit>=0?'var(--green)':'var(--red)';
    // Color dots from variants
    const colorDots = b.items.map(it=>{
      const p=products.find(x=>x.id===it.pid);
      const v=p?.variants.find(x=>x.id===it.vid)||p?.variants[0];
      const hex=v?.colorHex&&v.colorHex!=='#ede6e8'?v.colorHex:null;
      return hex?`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${hex};border:1.5px solid rgba(0,0,0,0.08);flex-shrink:0"></span>`:'';
    }).filter(Boolean).join('');
    const itemPills = b.items.map(it=>{
      const p=products.find(x=>x.id===it.pid);
      const v=p?.variants.find(x=>x.id===it.vid)||p?.variants[0];
      return p?`<span class="bundle-item-pill">${p.emoji} ${v?.name&&v.name!=='Standard'?v.name:p.name}${it.qty>1?' ×'+it.qty:''}</span>`:'';
    }).filter(Boolean).join('');
    // Stock check
    const stockOk = b.items.every(it=>{
      const p=products.find(x=>x.id===it.pid);
      const v=p?.variants.find(x=>x.id===it.vid)||p?.variants[0];
      const p2=products.find(x=>x.id===it.pid);
      const stk = p2?.store==='flora' ? (v?.flora||0) : (v?.ra||0);
      return v&&stk>=(it.qty||1);
    });
    return `<div class="bundle-save-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div style="font-size:15px;font-weight:700;color:var(--ink)">🎁 ${b.name}</div>
        <div style="display:flex;gap:5px;align-items:center">
          <span class="b ${marginCls}" style="font-size:10px">${margin}% margin</span>
          ${!stockOk?'<span class="b ba" style="font-size:10px">⚠️ Low</span>':''}
        </div>
      </div>
      ${colorDots?`<div style="display:flex;gap:4px;align-items:center;margin-bottom:6px">${colorDots}</div>`:''}
      <div class="bundle-items-preview">${itemPills}</div>
      <div class="bundle-total-row">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;color:var(--muted)">Products</span>
            <span style="font-size:11px;color:var(--ink-light);font-weight:600">$${prodCost.toFixed(2)}</span>
          </div>
          ${pkgCost>0?`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;color:var(--muted)">Packaging</span>
            <span style="font-size:11px;color:var(--ink-light);font-weight:600">$${pkgCost.toFixed(2)}</span>
          </div>`:''}
          ${supplyCost>0?`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;color:var(--muted)">Supplies</span>
            <span style="font-size:11px;color:var(--ink-light);font-weight:600">$${supplyCost.toFixed(2)}</span>
          </div>`:''}
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px solid var(--grey2);margin-bottom:4px">
            <span style="font-size:11px;font-weight:700;color:var(--ink)">Total cost</span>
            <span style="font-size:11px;font-weight:700;color:var(--ink)">$${totalCost.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;font-weight:700;color:var(--ink)">Sell price</span>
            <span style="font-size:13px;font-weight:800;color:var(--rose)">$${sellPrice.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <span style="font-size:11px;font-weight:600;color:${profitColor}">Profit per bundle</span>
            <span style="font-size:12px;font-weight:800;color:${profitColor}">${profit>=0?'+':''}$${profit.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn btn-s btn-sm" onclick="editBundle('${b.id}')">✏️</button>
          <button class="btn btn-sm" style="background:var(--green-soft);color:var(--green)" onclick="fulfillBundle('${b.id}')">🛍️ Fulfill</button>
          <button class="btn btn-sm" style="background:var(--green-soft);color:var(--green)" onclick="shareBundleWA('${b.id}')">💬</button>
          <button class="btn btn-sm" style="background:var(--red-soft);color:var(--red)" onclick="deleteBundle('${b.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// ── Manual Bundle ──
let bundleItems = [];
let _bndEditId = null;

function openNewBundle(){
  _bndEditId = null;
  bundleItems = [];
  bundleSupplies = [];
  document.getElementById('bnd-edit-id').value = '';
  document.getElementById('bnd-modal-title').textContent = '🎁 Build Bundle';
  document.getElementById('bnd-name').value = '';
  document.getElementById('bnd-sell').value = '';
  document.getElementById('bnd-pkg').value = '0';
  document.getElementById('bnd-items').innerHTML = '';
  document.getElementById('bnd-calc').style.display = 'none';
  document.getElementById('bnd-stock-warn').style.display = 'none';
  renderBundleSupplies();
  addBundleItem();
  showModal('m-build-bundle');
}

function editBundle(bid){
  const b = bundles.find(x=>x.id===bid);
  if(!b) return;
  _bndEditId = bid;
  document.getElementById('bnd-edit-id').value = bid;
  document.getElementById('bnd-modal-title').textContent = '✏️ Edit Bundle';
  document.getElementById('bnd-name').value = b.name||'';
  document.getElementById('bnd-sell').value = (b.sellPrice||0).toFixed(2);
  document.getElementById('bnd-pkg').value = (b.pkgCost||0).toFixed(2);
  document.getElementById('bnd-items').innerHTML = '';
  bundleItems = [];
  bundleSupplies = JSON.parse(JSON.stringify(b.supplies||[]));
  b.items.forEach(it=>{
    const idx = bundleItems.length;
    bundleItems.push({pid:it.pid||'', vid:it.vid||'', qty:it.qty||1});
    const opts = products.filter(p=>!isProductInTransit(p)).map(p=>`<option value="${p.id}" ${p.id===it.pid?'selected':''}>${p.emoji} ${p.name}</option>`).join('');
    const p = products.find(x=>x.id===it.pid);
    const varOpts = p ? p.variants.map(v=>`<option value="${v.id}" ${v.id===it.vid?'selected':''}>${fmtVariant(v)}</option>`).join('') : '';
    const row = document.createElement('div');
    row.className = 'bundle-picker-row';
    row.id = 'bpi-'+idx;
    row.innerHTML = `
      <select class="fsel" style="flex:1;font-size:12px" onchange="updateBundleItem(${idx},'pid',this.value);updateVariantOpts(${idx},this.value)">
        <option value="">— Product —</option>${opts}
      </select>
      <select class="fsel" style="width:110px;font-size:12px" id="bpi-var-${idx}" onchange="updateBundleItem(${idx},'vid',this.value)">${varOpts}</select>
      <input type="number" class="fi" style="width:52px;text-align:center;font-size:13px;margin:0" value="${it.qty||1}" min="1" onchange="updateBundleItem(${idx},'qty',parseInt(this.value,10));calcBundle()">
      <button class="icon-btn icon-btn-g" onclick="removeBundleItem(${idx})">✕</button>`;
    document.getElementById('bnd-items').appendChild(row);
  });
  renderBundleSupplies();
  calcBundle();
  showModal('m-build-bundle');
}

function addBundleItem(){
  const idx = bundleItems.length;
  bundleItems.push({pid:'',vid:'',qty:1});
  const opts = products.filter(p=>!isProductInTransit(p)).map(p=>`<option value="${p.id}">${p.emoji} ${p.name}</option>`).join('');
  const row = document.createElement('div');
  row.className = 'bundle-picker-row';
  row.id = 'bpi-'+idx;
  row.innerHTML = `
    <select class="fsel" style="flex:1;font-size:12px" onchange="updateBundleItem(${idx},'pid',this.value);updateVariantOpts(${idx},this.value)">
      <option value="">— Product —</option>${opts}
    </select>
    <select class="fsel" style="width:110px;font-size:12px" id="bpi-var-${idx}" onchange="updateBundleItem(${idx},'vid',this.value)">
      <option value="">— Variant —</option>
    </select>
    <input type="number" class="fi" style="width:52px;text-align:center;font-size:13px;margin:0" value="1" min="1" onchange="updateBundleItem(${idx},'qty',parseInt(this.value,10));calcBundle()">
    <button class="icon-btn icon-btn-g" onclick="removeBundleItem(${idx})">✕</button>`;
  document.getElementById('bnd-items').appendChild(row);
}

function updateBundleItem(idx,field,val){
  if(bundleItems[idx]) bundleItems[idx][field] = field==='qty' ? parseInt(val,10)||1 : val;
  calcBundle();
}
function removeBundleItem(idx){
  document.getElementById('bpi-'+idx)?.remove();
  bundleItems[idx] = {pid:'',vid:'',qty:0};
  calcBundle();
}
function updateVariantOpts(idx,pid){
  const p = products.find(x=>x.id===pid);
  const sel = document.getElementById('bpi-var-'+idx);
  if(!sel) return;
  sel.innerHTML = p ? p.variants.map(v=>`<option value="${v.id}">${fmtVariant(v)}</option>`).join('') : '<option>—</option>';
  if(p&&p.variants.length>0){ updateBundleItem(idx,'vid',p.variants[0].id); }
}

function calcBundle(){
  const active = bundleItems.filter(i=>i.pid&&i.qty>0);
  if(!active.length){ document.getElementById('bnd-calc').style.display='none'; return; }
  let prodCost = 0;
  active.forEach(i=>{ const p=products.find(x=>x.id===i.pid); if(p) prodCost+=(p.cost||0)*i.qty; });
  // Supply cost
  let supplyCost = 0;
  bundleSupplies.forEach(item=>{ const s=supplies.find(x=>x.id===item.sid); if(s) supplyCost+=(s.cost||0)*(item.qty||1); });
  const pkgCost = parseFloat(document.getElementById('bnd-pkg')?.value)||0;
  const totalCost = prodCost + supplyCost + pkgCost;
  const p30 = totalCost/0.70, p40 = totalCost/0.60;
  document.getElementById('bnd-cost').textContent = '$'+prodCost.toFixed(2);
  document.getElementById('bnd-pkg-cost').textContent = '$'+(supplyCost+pkgCost).toFixed(2);
  document.getElementById('bnd-total-cost').textContent = '$'+totalCost.toFixed(2);
  document.getElementById('bnd-p30').textContent = '$'+p30.toFixed(2);
  document.getElementById('bnd-p40').textContent = '$'+p40.toFixed(2);
  document.getElementById('bnd-calc').style.display = 'block';
  // Margin on sell price
  const sell = parseFloat(document.getElementById('bnd-sell')?.value)||0;
  if(sell>0&&totalCost>0){
    const m = ((sell-totalCost)/sell*100).toFixed(0);
    const mEl = document.getElementById('bnd-my-margin');
    if(mEl){ mEl.textContent=m+'%'; mEl.style.color=m>=30?'var(--green)':m>=15?'var(--amber)':'var(--red)'; }
  }
  if(!document.getElementById('bnd-sell').value) document.getElementById('bnd-sell').value = p40.toFixed(2);
  // Stock warning — use correct stock field per store type
  const warn = document.getElementById('bnd-stock-warn');
  const lowItems = active.filter(i=>{
    const p=products.find(x=>x.id===i.pid);
    const v=p?.variants.find(x=>x.id===i.vid)||p?.variants[0];
    const stk = p?.store==='flora' ? (v?.flora||0) : (v?.ra||0);
    return !v||stk<i.qty;
  });
  const lowSupplies = bundleSupplies.filter(item=>{
    const s=supplies.find(x=>x.id===item.sid);
    return !s||(s.stock||0)<(item.qty||1);
  }).map(item=>{ const s=supplies.find(x=>x.id===item.sid); return s?s.name:'?'; });
  const warnItems = [...lowItems.map(i=>{const p=products.find(x=>x.id===i.pid);return p?p.name:'?';}), ...lowSupplies];
  if(warnItems.length&&warn){
    warn.style.display='block';
    warn.textContent='⚠️ Low stock: '+warnItems.join(', ');
  } else if(warn){ warn.style.display='none'; }
}

function saveBundle(){
  const name = document.getElementById('bnd-name').value.trim();
  if(!name){ showToast('Enter a bundle name','err'); return; }
  const active = bundleItems.filter(i=>i.pid&&i.qty>0);
  if(!active.length){ showToast('Add at least one product','err'); return; }
  let prodCost=0;
  active.forEach(i=>{ const p=products.find(x=>x.id===i.pid); if(p) prodCost+=(p.cost||0)*i.qty; });
  let supplyCost=0;
  bundleSupplies.forEach(item=>{ const s=supplies.find(x=>x.id===item.sid); if(s) supplyCost+=(s.cost||0)*(item.qty||1); });
  const pkgCost = parseFloat(document.getElementById('bnd-pkg').value)||0;
  const sellPrice = parseFloat(document.getElementById('bnd-sell').value)||((prodCost+supplyCost+pkgCost)/0.6);
  const editId = document.getElementById('bnd-edit-id').value;
  const activeSups = bundleSupplies.filter(i=>i.sid&&i.qty>0);
  if(editId){
    const b = bundles.find(x=>x.id===editId);
    if(b){ b.name=name; b.items=active; b.cost=prodCost; b.pkgCost=supplyCost+pkgCost; b.sellPrice=sellPrice; b.supplies=activeSups; }
  } else {
    bundles.push({id:'b-'+Date.now(), name, items:active, cost:prodCost, pkgCost:supplyCost+pkgCost, sellPrice, supplies:activeSups});
  }
  closeModal('m-build-bundle');
  saveData(); renderBundles();
  showToast('🎁 Bundle "'+name+'" saved!');
}

function deleteBundle(bid){
  const b = bundles.find(x=>x.id===bid);
  if(!b) return;
  appConfirm('Delete Bundle',`Delete "${b.name}"?`,'🗑️ Delete',()=>{
    bundles = bundles.filter(x=>x.id!==bid);
    saveData(); renderBundles(); showToast('Bundle deleted');
  });
}

function shareBundleWA(bid){
  const b = bundles.find(x=>x.id===bid);
  if(!b) return;
  const floraBizName = (getCatalogTemplates().flora||{}).bizName || 'Flora Gift Shop';
  const lines = [
    `🎁 *${b.name}*`,
    ``,
    ...b.items.map(it=>{
      const p=products.find(x=>x.id===it.pid);
      const v=p?.variants.find(x=>x.id===it.vid)||p?.variants[0];
      return p?`${p.emoji} ${p.name}${v&&v.name!=='Standard'?' ('+v.name+')':''}${it.qty>1?' ×'+it.qty:''}`:null;
    }).filter(Boolean),
    ``,
    `💰 $${(b.sellPrice||0).toFixed(2)}`,
    `🌸 ${floraBizName}`
  ];
  window.open('https://wa.me/?text='+encodeURIComponent(lines.join('\n')),'_blank');
}

function fulfillBundle(bid){
  const b = bundles.find(x=>x.id===bid);
  if(!b) return;

  // Check supply stock before proceeding
  const shortSupplies = (b.supplies||[]).filter(item=>{
    const sup = supplies.find(x=>x.id===item.sid);
    return sup && (sup.stock||0) < (item.qty||1);
  });

  const doFulfill = ()=>{
    _pendingBundleSupplies = (b.supplies&&b.supplies.length) ? b.supplies : null;
    _pendingBundleId = bid;
    _foEditId = null;
    _foItems = b.items.map(it=>{
      const p = products.find(x=>x.id===it.pid);
      const v = p?.variants.find(x=>x.id===it.vid)||p?.variants[0];
      return p ? {
        productId: p.id, variantId: v?.id||'',
        productName: p.name, productEmoji: p.emoji,
        variantName: v?.name||'', qty: it.qty||1,
        price: b.sellPrice||0
      } : null;
    }).filter(Boolean);
    const perItem = b.sellPrice / (b.items.length||1);
    _foItems.forEach(it=>{ it.price = parseFloat((perItem).toFixed(2)); });
    document.getElementById('fo-customer').value = '';
    document.getElementById('fo-channel').value = 'website';
    document.getElementById('fo-status').value = 'processing';
    document.getElementById('fo-notes').value = '🎁 Bundle: '+b.name;
    const dl = document.getElementById('fo-cust-list');
    if(dl) dl.innerHTML = customers.filter(c=>!c.blacklisted).map(c=>`<option value="${c.name}">`).join('');
    const title = document.querySelector('#m-flora .mtitle');
    if(title) title.textContent = '🎁 Fulfill: '+b.name;
    renderFoItems();
    showModal('m-flora');
  };

  if(shortSupplies.length){
    const lines = shortSupplies.map(item=>{
      const sup = supplies.find(x=>x.id===item.sid);
      return `• ${sup?.name||'Supply'}: need ${item.qty}, have ${sup?.stock||0}`;
    }).join('\n');
    appConfirm('⚠️ Low Supplies', `Not enough supplies for this bundle:\n\n${lines}\n\nFulfill anyway?`, '🛍️ Fulfill Anyway', doFulfill);
  } else {
    doFulfill();
  }
}

// ═══════════════════════════════════════════════════
// AUTO BUNDLE BUILDER
// ═══════════════════════════════════════════════════
let _abOccasion = 'birthday';
let _abColor = 'pink';
let _abColorMode = 'match';
let _abResult = null; // last AI result for swapping

function openAutoBundle(){
  const key = localStorage.getItem('groq_key');
  if(!key){ showToast('Add your Groq API key in Settings first','err'); return; }
  const floraProds = products.filter(p=>!isProductInTransit(p)&&p.variants.some(v=>p.store==='flora' ? (v.flora||0)>0 : (v.ra||0)>0));
  if(!floraProds.length){ showToast('No Flora products with stock found','err'); return; }
  _abOccasion = 'birthday'; _abColor = 'pink'; _abColorMode = 'match';
  // Reset pills
  document.querySelectorAll('#ab-occasion-pills .ab-pill').forEach((el,i)=>el.classList.toggle('active',i===0));
  document.querySelectorAll('#ab-color-pills .ab-pill').forEach((el,i)=>el.classList.toggle('active',i===0));
  abSetColorMode('match');
  document.getElementById('ab-budget').value = '';
  document.getElementById('ab-count').value = '';
  document.getElementById('ab-pkg').value = '0';
  document.getElementById('ab-gen-btn').textContent = '✨ Build My Bundle';
  document.getElementById('ab-gen-btn').disabled = false;
  showModal('m-auto-bundle');
}

function abPick(el, type, val){
  el.closest('[id]').querySelectorAll('.ab-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  if(type==='occasion') _abOccasion = val;
  if(type==='color') _abColor = val;
}

function abUpdateCountHint(){
  const budget = parseFloat(document.getElementById('ab-budget').value)||0;
  const hint = document.getElementById('ab-count-hint');
  if(!hint) return;
  if(budget > 0){
    hint.textContent = `Leave empty to auto-fit $${budget.toFixed(0)} budget`;
    hint.style.color = 'var(--rose)';
  } else {
    hint.textContent = 'Leave empty to auto-fit budget';
    hint.style.color = 'var(--muted)';
  }
}

function abSetColorMode(mode){
  _abColorMode = mode;
  const matchBtn = document.getElementById('ab-mode-match');
  const mixBtn = document.getElementById('ab-mode-mix');
  const themeSection = document.getElementById('ab-color-theme-section');
  if(mode==='match'){
    matchBtn.style.cssText='flex:1;padding:12px;border-radius:12px;border:2px solid var(--rose);background:var(--rose-soft);text-align:center;cursor:pointer';
    matchBtn.querySelector('div:nth-child(2)').style.color='var(--rose)';
    mixBtn.style.cssText='flex:1;padding:12px;border-radius:12px;border:2px solid var(--grey2);background:var(--white);text-align:center;cursor:pointer';
    mixBtn.querySelector('div:nth-child(2)').style.color='var(--ink-light)';
    themeSection.style.display='block';
  } else {
    mixBtn.style.cssText='flex:1;padding:12px;border-radius:12px;border:2px solid var(--rose);background:var(--rose-soft);text-align:center;cursor:pointer';
    mixBtn.querySelector('div:nth-child(2)').style.color='var(--rose)';
    matchBtn.style.cssText='flex:1;padding:12px;border-radius:12px;border:2px solid var(--grey2);background:var(--white);text-align:center;cursor:pointer';
    matchBtn.querySelector('div:nth-child(2)').style.color='var(--ink-light)';
    themeSection.style.display='none';
  }
}

async function runAutoBundle(){
  const budget = parseFloat(document.getElementById('ab-budget').value);
  if(!budget||budget<=0){ showToast('Enter a budget','err'); return; }
  const countVal = parseInt(document.getElementById('ab-count').value,10);
  const count = countVal > 0 ? countVal : null; // null = let AI decide
  const pkg = parseFloat(document.getElementById('ab-pkg').value)||0;
  const key = localStorage.getItem('groq_key');
  if(!key){ showToast('No Groq API key — add it in Settings','err'); return; }

  // Build full inventory snapshot for AI — only Flora products with stock
  const invSnapshot = products
    .filter(p=>p.variants.some(v=>p.store==='flora' ? (v.flora||0)>0 : (v.ra||0)>0))
    .map(p=>({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      category: p.category||'',
      priceFlora: p.priceFlora||0,
      cost: p.cost||0,
      variants: p.variants
        .filter(v=>p.store==='flora' ? (v.flora||0)>0 : (v.ra||0)>0)
        .map(v=>({
          id: v.id,
          name: v.name||'Standard',
          shade: v.label||'',
          size: v.size||'',
          colorHex: v.colorHex||'',
          floraQty: p.store==='flora' ? (v.flora||0) : (v.ra||0)
        }))
    }));

  const colorInstruction = _abColorMode === 'match'
    ? `COLOR STRATEGY: Matching — pick variants that all belong to the same color family: "${_abColor}". Use the colorHex values to determine color family. All items should feel visually cohesive.`
    : `COLOR STRATEGY: Mix & Match — pick variants with complementary colors that look beautiful together aesthetically (e.g. rose + gold + cream, purple + silver + white). Use colorHex values. The palette should feel intentional, not random.`;

  const countInstruction = count
    ? `Build ONE gift bundle of exactly ${count} products`
    : `Build ONE gift bundle — choose however many products best fit the budget (aim for 3–8 items that feel balanced and generous)`;

  const prompt = `You are a gift box curator for Flora Gift Shop, a retail gift store.

TASK: ${countInstruction} for occasion: "${_abOccasion}".
Budget for products only: $${budget} (not including $${pkg} packaging cost).
${colorInstruction}

FULL INVENTORY (only items with Flora stock):
${JSON.stringify(invSnapshot, null, 2)}

RULES:
- ${count ? `Pick EXACTLY ${count} items` : `Pick however many items best fill the $${budget} budget (3–8 is ideal)`} (each item = 1 product + 1 specific variant)
- Total priceFlora of all picked items must be <= $${budget}
- Each variant must have floraQty >= 1
- Choose items that make SENSE together for a ${_abOccasion} gift
- Apply the color strategy strictly using colorHex values
- Prefer variety (don't pick same product twice)
- Write a short 1-line bundle name and a 1-line occasion-appropriate message for WhatsApp sharing

RESPOND ONLY WITH THIS JSON (no markdown, no explanation):
{
  "bundleName": "...",
  "waMessage": "...",
  "colorNote": "...",
  "items": [
    {
      "productId": "...",
      "variantId": "...",
      "productName": "...",
      "variantName": "...",
      "colorHex": "...",
      "priceFlora": 0,
      "reason": "why this item fits"
    }
  ]
}`;

  const btn = document.getElementById('ab-gen-btn');
  btn.textContent = '✨ Building...'; btn.disabled = true;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body: JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],max_tokens:1000,temperature:0.7})
    });
    const data = await res.json();
    let text = data?.choices?.[0]?.message?.content||'';
    text = text.replace(/```json|```/g,'').trim();
    const result = JSON.parse(text);
    _abResult = {result, budget, pkg, count, occasion: _abOccasion, colorMode: _abColorMode, color: _abColor};
    closeModal('m-auto-bundle');
    showAutoBundleResult(result, budget, pkg);
  } catch(e){
    showToast('AI error: '+e.message,'err');
    btn.textContent='✨ Build My Bundle'; btn.disabled=false;
  }
}

function showAutoBundleResult(result, budget, pkg){
  const total = result.items.reduce((s,it)=>s+(it.priceFlora||0),0);
  const totalCost = result.items.reduce((s,it)=>{
    const p=products.find(x=>x.id===it.productId);
    return s+(p?.cost||0);
  },0)+pkg;
  const suggested = totalCost/0.6;

  const itemsHtml = result.items.map((it,idx)=>{
    const p = products.find(x=>x.id===it.productId);
    const v = p?.variants.find(x=>x.id===it.variantId);
    const dot = it.colorHex&&it.colorHex!=='#ede6e8'
      ?`<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${it.colorHex};border:1.5px solid rgba(0,0,0,0.1);flex-shrink:0"></span>`:'';
    const stockLeft = v ? (p?.store==='flora' ? (v.flora||0) : (v.ra||0)) : 0;
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--grey);border-radius:12px;margin-bottom:6px">
      <div style="font-size:22px;flex-shrink:0">${p?.emoji||'📦'}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          ${dot}
          <div style="font-size:13px;font-weight:700;color:var(--ink)">${it.productName}</div>
        </div>
        <div style="font-size:12px;color:var(--muted)">${it.variantName&&it.variantName!=='Standard'?it.variantName+' · ':''}$${(it.priceFlora||0).toFixed(2)} · Stock: ${stockLeft}</div>
        <div style="font-size:11px;color:var(--ink-light);margin-top:2px;font-style:italic">${it.reason||''}</div>
      </div>
      <button onclick="swapBundleItem(${idx})" style="background:var(--rose-soft);color:var(--rose);border:none;border-radius:8px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0">Swap</button>
    </div>`;
  }).join('');

  // Color palette strip
  const hexes = [...new Set(result.items.map(it=>it.colorHex).filter(h=>h&&h!=='#ede6e8'))];
  const palette = hexes.map(h=>`<span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${h};border:2px solid rgba(0,0,0,0.08)"></span>`).join('');

  document.getElementById('ab-result-body').innerHTML = `
    <div style="background:linear-gradient(135deg,var(--rose),#d45f76);border-radius:16px;padding:16px;color:white;margin-bottom:16px">
      <div style="font-size:11px;opacity:0.8;margin-bottom:4px">${_abResult.occasion} · ${_abResult.colorMode==='match'?'Matching colors':'Mix & Match'}</div>
      <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:6px">${result.bundleName}</div>
      ${palette?`<div style="display:flex;gap:5px;align-items:center">${palette}</div>`:''}
      ${result.colorNote?`<div style="font-size:11px;opacity:0.75;margin-top:5px">${result.colorNote}</div>`:''}
    </div>
    <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Items</div>
    ${itemsHtml}
    <div style="background:var(--rose-pale);border-radius:12px;padding:14px;margin-top:12px">
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:var(--ink-light)"><span>Products total</span><span>$${total.toFixed(2)}</span></div>
      ${pkg?`<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:var(--ink-light)"><span>Packaging</span><span>$${pkg.toFixed(2)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding:6px 0;color:var(--ink);border-top:1px solid var(--rose-soft);margin-top:4px"><span>Suggested sell price</span><span style="color:var(--rose)">$${suggested.toFixed(2)}</span></div>
    </div>
    <div style="margin-top:12px"><label class="fl">Your Sell Price ($)</label><input class="fi" id="ab-sell-price" type="number" value="${suggested.toFixed(2)}" step="0.01"></div>`;

  document.getElementById('ab-result-foot').innerHTML = `
    <button class="btn btn-p btn-full" style="padding:14px" onclick="saveAutoBundle()">💾 Save Bundle</button>
    <button class="btn btn-sm btn-full" style="background:var(--green-soft);color:var(--green);padding:13px;justify-content:center" onclick="fulfillAutoBundle()">🛍️ Save & Fulfill (Flora Order)</button>
    <button class="btn btn-g btn-full" onclick="closeModal('m-auto-result');showModal('m-auto-bundle')">← Try Again</button>`;

  showModal('m-auto-result');
}

async function swapBundleItem(idx){
  if(!_abResult) return;
  showToast('Finding a swap... ✨');
  const current = _abResult.result.items[idx];
  const usedIds = _abResult.result.items.map(it=>it.productId+it.variantId);
  const key = localStorage.getItem('groq_key');
  if(!key){ showToast('No Groq key — add it in Settings','err'); return; }

  const available = products
    .filter(p=>!isProductInTransit(p)&&p.variants.some(v=>(p.store==='flora'?(v.flora||0):(v.ra||0))>0&&!usedIds.includes(p.id+v.id)))
    .map(p=>({id:p.id,name:p.name,emoji:p.emoji,priceFlora:p.priceFlora||0,cost:p.cost||0,
      variants:p.variants.filter(v=>(p.store==='flora'?(v.flora||0):(v.ra||0))>0&&!usedIds.includes(p.id+v.id))
        .map(v=>({id:v.id,name:v.name||'Standard',shade:v.label||'',size:v.size||'',colorHex:v.colorHex||'',floraQty:p.store==='flora'?(v.flora||0):(v.ra||0)}))}));

  const colorInstruction = _abResult.colorMode==='match'
    ? `Find a replacement with similar color family (${_abResult.color}) — use colorHex.`
    : `Find a replacement with a complementary color to the rest of the bundle.`;

  const prompt = `You are a gift box curator. Replace item at index ${idx} in this bundle for occasion "${_abResult.occasion}".
Current bundle items: ${JSON.stringify(_abResult.result.items)}
Item to replace: ${JSON.stringify(current)}
${colorInstruction}
Budget remaining for this item: $${current.priceFlora||0} (can be slightly over)
Available products: ${JSON.stringify(available)}
RESPOND ONLY WITH JSON for the replacement item:
{"productId":"...","variantId":"...","productName":"...","variantName":"...","colorHex":"...","priceFlora":0,"reason":"..."}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],max_tokens:400,temperature:0.7})
    });
    const data = await res.json();
    let text = data?.choices?.[0]?.message?.content||'';
    text = text.replace(/```json|```/g,'').trim();
    const replacement = JSON.parse(text);
    _abResult.result.items[idx] = replacement;
    showAutoBundleResult(_abResult.result, _abResult.budget, _abResult.pkg);
    showToast('Item swapped ✨');
  } catch(e){ showToast('Swap failed','err'); }
}

function saveAutoBundle(){
  if(!_abResult) return;
  const result = _abResult.result;
  const pkg = _abResult.pkg||0;
  let prodCost=0;
  const items = result.items.map(it=>{
    const p=products.find(x=>x.id===it.productId);
    if(p) prodCost+=(p.cost||0);
    return {pid:it.productId,vid:it.variantId,qty:1};
  });
  const sellPrice = parseFloat(document.getElementById('ab-sell-price')?.value)||prodCost/0.6;
  bundles.push({id:'b-'+Date.now(), name:result.bundleName, items, cost:prodCost, pkgCost:pkg, sellPrice, waMessage:result.waMessage||''});
  saveData(); renderBundles();
  closeModal('m-auto-result');
  showToast('🎁 "'+result.bundleName+'" saved!');
}

function fulfillAutoBundle(){
  saveAutoBundle();
  // Fulfill the last saved bundle
  const b = bundles[bundles.length-1];
  if(b) fulfillBundle(b.id);
}



