// ═══════════════════════════════════════════════════
// CATALOG  (js/catalog.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js, collections.js
// ═══════════════════════════════════════════════════

let _catMode = 'ra'; // 'ra' | 'flora'
let _catColFilter = 'all'; // 'all' | collectionId
let _catGroupBy = 'category'; // 'category' | 'collection'

function setCatGroupBy(by){
  _catGroupBy = by;
  const catBtn = document.getElementById('cat-grp-cat');
  const colBtn = document.getElementById('cat-grp-col');
  if(catBtn){ catBtn.style.background = by==='category' ? 'var(--white)' : 'transparent'; catBtn.style.color = by==='category' ? 'var(--rose)' : 'var(--muted)'; }
  if(colBtn){ colBtn.style.background = by==='collection' ? 'var(--white)' : 'transparent'; colBtn.style.color = by==='collection' ? 'var(--rose)' : 'var(--muted)'; }
  // when grouping by collection, hide individual collection filter chips (redundant)
  const colTabs = document.getElementById('cat-col-tabs');
  if(colTabs) colTabs.style.display = by==='collection' ? 'none' : 'flex';
  renderCatalog();
}

function setCatMode(mode){
  _catMode = mode;
  const ra = document.getElementById('cat-mode-ra');
  const fl = document.getElementById('cat-mode-flora');
  const bn = document.getElementById('cat-mode-bundles');
  [ra, fl, bn].forEach(btn=>{ if(btn){ btn.style.background='transparent'; btn.style.color='var(--muted)'; }});
  if(mode==='ra' && ra){ ra.style.background='var(--rose)'; ra.style.color='white'; }
  else if(mode==='flora' && fl){ fl.style.background='var(--rose)'; fl.style.color='white'; }
  else if(mode==='bundles' && bn){ bn.style.background='var(--amber)'; bn.style.color='white'; }

  // Show/hide collection tabs + oos toggle for bundles
  const colTabs = document.getElementById('cat-col-tabs');
  const grpBar = document.getElementById('cat-groupby-bar');
  const oosTog = document.querySelector('#page-catalog [id="cat-oos-toggle"]')?.closest('div[style*="margin-bottom:14px"]');
  if(mode==='bundles'){
    if(colTabs) colTabs.style.display='none';
    if(grpBar) grpBar.style.display='none';
    if(!bundles.length){
      document.getElementById('cat-list').innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:48px;margin-bottom:16px">🎁</div>
          <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:8px">No Bundles Yet</div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.6">Build your first gift bundle and it'll appear here as a shareable catalog card.</div>
          <button class="btn btn-amber btn-full" style="padding:13px;font-size:14px" onclick="showPage('bundles');setNav('more');renderBundles()">🎁 Build a Bundle</button>
        </div>`;
      return;
    }
    const tpls = getCatalogTemplates();
    const t = tpls.flora || {};
    document.getElementById('cat-list').innerHTML = bundles.map(b=>{
      const totalCost = (b.cost||0) + (b.pkgCost||0);
      const margin = b.sellPrice>0&&totalCost>0 ? Math.round(((b.sellPrice-totalCost)/b.sellPrice)*100) : 0;
      const marginCls = margin>=30?'bg':margin>=15?'ba':'br';
      const itemPills = b.items.map(it=>{
        const p = products.find(x=>x.id===it.pid);
        const v = p?.variants.find(x=>x.id===it.vid)||p?.variants[0];
        if(!p) return '';
        const dot = v?.colorHex && v.colorHex!=='#ede6e8'
          ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${v.colorHex};border:1px solid rgba(0,0,0,0.1);margin-right:3px;vertical-align:middle"></span>` : '';
        return `<span style="display:inline-flex;align-items:center;background:var(--blush);border-radius:20px;padding:3px 9px;font-size:11px;font-weight:600;color:var(--ink-light)">${dot}${p.emoji} ${v?.name&&v.name!=='Standard'?v.name:p.name}${it.qty>1?' ×'+it.qty:''}</span>`;
      }).filter(Boolean).join('');
      const photos = b.items.map(it=>{
        const p=products.find(x=>x.id===it.pid);
        const v=p?.variants.find(x=>x.id===it.vid)||p?.variants[0];
        return v?.photo||p?.photo||'';
      }).filter(Boolean).slice(0,3);
      const photoStrip = photos.length
        ? `<div style="display:flex;gap:4px;margin-bottom:10px">${photos.map(src=>`<img src="${src}" style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0">`).join('')}</div>`
        : `<div style="font-size:36px;margin-bottom:10px">🎁</div>`;
      return `<div style="background:var(--white);border:1.5px solid var(--grey2);border-radius:16px;padding:14px;margin-bottom:12px">
        ${photoStrip}
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:15px;font-weight:700;color:var(--ink)">🎁 ${b.name}</div>
          <span class="b ${marginCls}" style="font-size:10px;flex-shrink:0;margin-left:6px">${margin}% margin</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">${itemPills}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--grey2);padding-top:10px">
          <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:var(--rose)">$${(b.sellPrice||0).toFixed(2)}</div>
          <div style="display:flex;gap:6px">
            <button onclick="shareBundleWA('${b.id}')" style="background:var(--green-soft);color:var(--green);border:none;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer">📤 WA</button>
            <button onclick="showPage('bundles');setNav('more');renderBundles()" style="background:var(--amber-soft);color:var(--amber);border:none;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer">✏️ Edit</button>
          </div>
        </div>
      </div>`;
    }).join('');
    return;
  }
  if(colTabs) colTabs.style.display = _catGroupBy==='collection' ? 'none' : 'flex';
  if(grpBar) grpBar.style.display='flex';
  renderCatalog();
}

function renderCatColTabs(){
  const el = document.getElementById('cat-col-tabs');
  if(!el) return;
  const cols = collections || [];
  let html = `<div class="cat-col-chip ${_catColFilter==='all'?'active':''}" onclick="setCatColFilter('all')">All</div>`;
  cols.forEach(c=>{
    html += `<div class="cat-col-chip ${_catColFilter===c.id?'active':''}" onclick="setCatColFilter('${c.id}')">${c.emoji||'📁'} ${c.name}</div>`;
  });
  el.innerHTML = html;
}

function setCatColFilter(id){
  _catColFilter = id;
  renderCatColTabs();
  renderCatalog();
}

function toggleCatOos(el){
  const cb = document.getElementById('cat-hide-oos');
  cb.checked = !cb.checked;
  const knob = document.getElementById('cat-oos-knob');
  el.style.background = cb.checked ? 'var(--rose)' : 'var(--grey2)';
  if(knob) knob.style.transform = cb.checked ? 'translateX(18px)' : 'translateX(0)';
  renderCatalog();
}

function renderCatalog(){
  renderCatColTabs();
  const hideOos = document.getElementById('cat-hide-oos')?.checked;
  const mode = _catMode;

  // Filter products
  let list = products.filter(p=>{
    if(isProductInTransit(p)) return false;
    if(_catGroupBy==='category' && _catColFilter !== 'all' && p.collectionId !== _catColFilter) return false;
    if(mode==='ra' && p.store==='flora') return false;
    if(mode==='flora' && p.store==='ra') return false;
    return true;
  });

  if(!list.length){
    document.getElementById('cat-list').innerHTML = '<div style="color:var(--muted);text-align:center;padding:40px 0;font-size:14px">No products found</div>';
    return;
  }

  // Build rows
  let rows = [];
  list.forEach(p=>{
    p.variants.forEach(v=>{
      const totalStock = mode==='ra' ? (v.ra||0) : (v.flora||0);
      if(hideOos && totalStock===0) return;
      rows.push({p, v, totalStock});
    });
  });

  if(!rows.length){
    document.getElementById('cat-list').innerHTML = '<div style="color:var(--muted);text-align:center;padding:40px 0;font-size:14px">No products in stock</div>';
    return;
  }

  const isRA = mode==='ra';

  // Group rows
  let groups = [];
  if(_catGroupBy==='collection'){
    const colMap = {};
    rows.forEach(r=>{
      const cid = r.p.collectionId||'__none';
      if(!colMap[cid]) colMap[cid]=[];
      colMap[cid].push(r);
    });
    const cols = collections||[];
    cols.forEach(c=>{ if(colMap[c.id]) groups.push({label: c.emoji+' '+c.name, rows: colMap[c.id]}); });
    if(colMap['__none']) groups.push({label:'📦 No Collection', rows: colMap['__none']});
  } else {
    const CAT_LABELS = {lips:'💄 Lips',face:'✨ Face',body:'🧴 Body',hair:'💇 Hair',nails:'💅 Nails',candles:'🕯️ Candles',giftbox:'🎁 Gift Box',decor:'🏠 Decor',accessories:'🧣 Accessories',other:'📦 Other'};
    const tplCatLabels = (getCatalogTemplates()[_catMode]||{}).catLabels || {};
    Object.entries(tplCatLabels).forEach(([k,v])=>{ if(v) CAT_LABELS[k]=v; });
    const catMap = {};
    rows.forEach(r=>{
      const cat = r.p.category||'other';
      if(!catMap[cat]) catMap[cat]=[];
      catMap[cat].push(r);
    });
    Object.keys(catMap).forEach(cat=>{ groups.push({label: CAT_LABELS[cat]||('🏷️ '+cat), rows: catMap[cat]}); });
  }

  // Render
  const tableRows = (rowsArr)=>rowsArr.map(({p,v})=>{
    const photo = v.photo||p.photo||'';
    const photoCell = photo ? `<img class="cat-thumb" src="${photo}" loading="lazy">` : `<div class="cat-thumb-ph">${p.emoji||'📦'}</div>`;
    const colorDot = (v.colorHex&&v.colorHex!=='#ede6e8') ? `<span class="cat-cdot" style="background:${v.colorHex}"></span>` : '';
    const vLabel = [v.label,v.name,v.size].filter(Boolean).join(' · ');
    const pricePC = isRA ? (p.priceRAPiece||0) : (p.priceFlora||0);
    const priceDZ = p.priceRADozen||0;
    return `<tr>
      <td style="text-align:center;padding:8px 6px">${photoCell}</td>
      <td><div class="cat-pname">${p.name}</div><div class="cat-vname">${colorDot}${vLabel||'Standard'}</div></td>
      <td class="cat-price-cell">${pricePC?'$'+pricePC.toFixed(2):'—'}</td>
      ${isRA?`<td class="cat-dz-cell">${priceDZ?'$'+priceDZ.toFixed(2):'—'}</td>`:''}
    </tr>`;
  }).join('');

  let html = '';
  groups.forEach(g=>{
    html += `<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin:14px 2px 6px">${g.label}</div>
    <div style="border-radius:16px;overflow:hidden;box-shadow:var(--shadow);margin-bottom:6px">
      <table class="cat-table" style="width:100%">
        <thead class="cat-thead"><tr>
          <th style="text-align:center">Photo</th><th>Product</th>
          <th>${isRA?'Price/pc':'Price'}</th>${isRA?'<th>Per Dz</th>':''}
        </tr></thead>
        <tbody class="cat-tbody">${tableRows(g.rows)}</tbody>
      </table>
    </div>`;
  });

  document.getElementById('cat-list').innerHTML = html;
}

function openCatalogShareSheet(){
  document.getElementById('m-cat-share').style.display = 'flex';
}
function closeCatalogShareSheet(){
  document.getElementById('m-cat-share').style.display = 'none';
}

function shareCatalogWA(){
  closeCatalogShareSheet();
  const mode = _catMode;
  const isRA = mode === 'ra';
  const hideOos = document.getElementById('cat-hide-oos')?.checked;
  const groupBy = _catGroupBy || 'category';

  let list = products.filter(p=>{
    if(isProductInTransit(p)) return false;
    if(mode==='ra' && p.store==='flora') return false;
    if(mode==='flora' && p.store==='ra') return false;
    // If grouping by category and a collection filter is active, apply it
    if(groupBy==='category' && _catColFilter !== 'all' && p.collectionId !== _catColFilter) return false;
    return true;
  });

  const CAT_LABELS = {lips:'💄 Lips',face:'✨ Face',body:'🧴 Body',hair:'💇 Hair',nails:'💅 Nails',candles:'🕯️ Candles',giftbox:'🎁 Gift Box',decor:'🏠 Decor',accessories:'🧣 Accessories',other:'📦 Other'};
  const tplCatLabels = (getCatalogTemplates()[mode]||{}).catLabels || {};
  Object.entries(tplCatLabels).forEach(([k,v])=>{ if(v) CAT_LABELS[k]=v; });
  const colMap = {};
  collections.forEach(c=>{ colMap[c.id]=c; });

  // Group products
  const groups = {};
  const groupOrder = [];
  list.forEach(p=>{
    let key, label;
    if(groupBy==='collection'){
      key = (p.collectionId && colMap[p.collectionId]) ? p.collectionId : '__none';
      label = key==='__none' ? '📦 Other' : (colMap[p.collectionId]?.emoji||'📁')+' '+colMap[p.collectionId]?.name;
    } else {
      key = p.category||'other';
      label = CAT_LABELS[key]||('🏷️ '+key);
    }
    if(!groups[key]){ groups[key]=[]; groupOrder.push({key,label}); }
    groups[key].push(p);
  });

  const header = isRA ? '🏪 *RA Warehouse — Wholesale Price List*' : '🌸 *Flora Gift Shop — Price List*';
  const divider = '──────────────────────';
  let lines = [header, divider];

  groupOrder.forEach(({key, label})=>{
    const prods = groups[key];
    const hasVisibleVariants = prods.some(p=>p.variants.some(v=>{
      const stock = isRA?(v.ra||0):(v.flora||0);
      return !hideOos || stock>0;
    }));
    if(!hasVisibleVariants) return;
    if(groupOrder.length > 1) lines.push('', `*${label}*`);
    prods.forEach(p=>{
      const varLines = [];
      p.variants.forEach(v=>{
        const stock = isRA?(v.ra||0):(v.flora||0);
        if(hideOos && stock===0) return;
        const vLabel = [v.label,v.name,v.size].filter(Boolean).join(' · ')||'Standard';
        if(isRA){
          const pc = p.priceRAPiece ? '$'+p.priceRAPiece.toFixed(2)+'/pc' : '';
          const dz = p.priceRADozen ? '$'+p.priceRADozen.toFixed(2)+'/dz' : '';
          varLines.push(`  • ${vLabel}${[pc,dz].filter(Boolean).length?' — '+[pc,dz].filter(Boolean).join(' · '):''}`);
        } else {
          varLines.push(`  • ${vLabel}${p.priceFlora?' — $'+p.priceFlora.toFixed(2):''}`);
        }
      });
      if(varLines.length){ lines.push(`${p.emoji||'📦'} *${p.name}*`); lines.push(...varLines); }
    });
  });

  lines.push('', divider, isRA ? '📞 Contact us to place your order!' : '🛍️ DM us to order!');
  const text = lines.join('\n');
  const url = 'https://wa.me/?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}
