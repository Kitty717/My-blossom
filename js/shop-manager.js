// ═══════════════════════════════════════════════════
// SHOP-MANAGER.JS — Controls the customer-facing shop
// Depends on: data.js, utils.js
// ═══════════════════════════════════════════════════

const SHOP_BASE = 'https://kitty717.github.io/My-blossom/';
function getShopURL() {
  const theme = shopSettings.shopTheme || '1';
  return theme === '2' ? SHOP_BASE + 'shop2.html' : SHOP_BASE + 'shop.html';
}

const FB_DB_URL = 'https://ra-shop-3e01d-default-rtdb.firebaseio.com';

async function compressImage(base64, maxDim=320, quality=0.65) {
  return new Promise(resolve => {
    if(!base64||!base64.startsWith('data:image')){resolve(base64);return;}
    const img=new Image();
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){if(w>h){h=Math.round(h*maxDim/w);w=maxDim;}else{w=Math.round(w*maxDim/h);h=maxDim;}}
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>resolve(base64);img.src=base64;
  });
}

async function publishShopToFirebase() {
  const btn=document.getElementById('publish-btn');
  const statusEl=document.getElementById('publish-status');
  if(btn){btn.disabled=true;btn.textContent='⏳ Publishing...';}
  const setStatus=(msg,color='#888')=>{if(statusEl)statusEl.innerHTML=`<span style="color:${color};font-size:12px">${msg}</span>`;};
  setStatus('🖼️ Compressing images...');
  try {
    // Compress main photo + all variant photos
    const total=products.length;
    const publishProducts=[];
    for(let i=0;i<total;i++){
      const p=products[i];
      const cp={...p};
      if(p.photo) cp.photo=await compressImage(p.photo);
      if(p.variants&&p.variants.length){
        cp.variants=await Promise.all(p.variants.map(async v=>{
          const cv={...v};
          if(v.photo) cv.photo=await compressImage(v.photo,280,0.6);
          return cv;
        }));
      }
      publishProducts.push(cp);
      if(btn) btn.textContent=`⏳ ${i+1}/${total} images...`;
    }
    setStatus('☁️ Uploading to cloud...');
    if(btn) btn.textContent='☁️ Uploading...';
    const shopData={products:publishProducts,settings:shopSettings,collections:collections||[],publishedAt:new Date().toISOString()};
    const res=await fetch(`${FB_DB_URL}/shop.json`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(shopData)});
    if(!res.ok) throw new Error(`Firebase error ${res.status}`);
    try{localStorage.setItem('blossom_shop_cache',JSON.stringify(shopData));}catch(e){}
    showToast('✅ Shop published! Customers can see it now.');
    setStatus(`✅ Last published: ${new Date().toLocaleString()}`,'#4caf7d');
  } catch(e) {
    showToast('❌ Publish failed — check connection','err');
    setStatus(`❌ ${e.message}`,'var(--red)');
  } finally {
    if(btn){btn.disabled=false;btn.textContent='🌐 Publish Shop';}
  }
}

// ── Shop settings state ──
let shopSettings = {
  shopName:    'Blossom',
  eyebrow:     'RA Jemle LB',
  title:       'Our Collection',
  heroSub:     'Pick your favourites — by piece or by dozen',
  whatsapp:    '',
  storeFilter: 'all',
  browseMode:  'all',
  brandColor:  '#c0536a',
  heroImage:   ''
};

async function loadShopSettings() {
  try {
    const saved = await _idbGet('biz_shop_settings');
    if (saved) shopSettings = { ...shopSettings, ...saved };
  } catch(e) { console.warn('loadShopSettings', e); }
}

async function saveShopSettings() {
  try {
    await _idbPut('biz_shop_settings', shopSettings);
    showToast('Shop settings saved ✅');
  } catch(e) { showToast('Could not save shop settings', 'err'); }
}

async function saveProductShopFlag() {
  try { await _idbPut('biz_products', products); } catch(e) {}
}

function darkenColor(hex, amount) {
  try {
    let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    r=Math.max(0,r-amount); g=Math.max(0,g-amount); b=Math.max(0,b-amount);
    return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  } catch(e) { return hex; }
}

// ═══════════════════════════════════════════════════
// RENDER SHOP MANAGER PAGE
// ═══════════════════════════════════════════════════
async function renderShopManager() {
  await loadShopSettings();
  const el = document.getElementById('shop-manager-content');
  if (!el) return;

  const published = products.filter(p => p.shopVisible !== false).length;
  const total     = products.length;
  const waSet     = shopSettings.whatsapp && shopSettings.whatsapp.length > 3;
  const color     = shopSettings.brandColor || '#c0536a';
  const heroImg   = shopSettings.heroImage || '';

  const presetColors = [
    ['#c0536a','Rose'],['#1a3a5c','Navy'],['#2d6a4f','Forest'],
    ['#7b4fa6','Purple'],['#c07830','Gold'],['#2a2a2a','Black'],
    ['#d45f9e','Pink'],['#1a7a8a','Teal']
  ];

  el.innerHTML = `
    <!-- Status Banner -->
    <div style="background:linear-gradient(135deg,${color},${darkenColor(color,20)});border-radius:var(--radius);padding:20px;color:white;margin-bottom:18px;position:relative;overflow:hidden">
      <div style="position:absolute;font-size:60px;opacity:0.1;right:-10px;bottom:-10px">🛍️</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;opacity:0.8;text-transform:uppercase;margin-bottom:6px">Customer Shop</div>
      <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:4px">${published} products published</div>
      <div style="font-size:12px;opacity:0.85">${waSet ? '✅ WhatsApp connected' : '⚠️ Set your WhatsApp number below'} · ${total} total in inventory</div>
    </div>

    <!-- Shop Link Card -->
    <div class="card" style="margin-bottom:14px">
      <div class="ct">🔗 Shop Link</div>
      <div style="font-size:13px;color:var(--ink-light);margin-bottom:14px">Share your shop with customers — they'll see your live products and order via WhatsApp.</div>
      <div style="background:var(--rose-pale);border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="font-size:28px">🛍️</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:2px">${shopSettings.shopName||'My Shop'}</div>
          <div style="font-size:11px;color:var(--muted)">${published} products live · Orders via WhatsApp</div>
        </div>
        <button class="btn btn-p" style="font-size:12px;padding:9px 14px;flex-shrink:0" onclick="previewShop()">👁️ Open</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-s" style="font-size:12px;padding:9px 16px" onclick="copyShopLink()">📋 Copy Link</button>
        <button class="btn btn-s" style="font-size:12px;padding:9px 16px" onclick="shareShopLink()">📤 Share</button>
        <button id="publish-btn" class="btn btn-p" style="font-size:12px;padding:9px 16px;background:#4caf7d;border-color:#4caf7d" onclick="publishShopToFirebase()">🌐 Publish Shop</button>
      </div>
      <div id="publish-status" style="margin-top:8px"></div>
    </div>

    <!-- Settings -->
    <div class="card" style="margin-bottom:14px">
      <div class="ct">⚙️ Shop Settings</div>

      <div style="margin-bottom:14px">
        <span class="fl">Shop Name</span>
        <input class="fi" id="ss-shopName" value="${shopSettings.shopName||''}" placeholder="e.g. RA Jemle LB">
      </div>
      <div style="margin-bottom:14px">
        <span class="fl">WhatsApp Number (orders go here)</span>
        <input class="fi" id="ss-whatsapp" value="${shopSettings.whatsapp||''}" placeholder="e.g. +961 70 123 456">
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Include country code. Orders go to this number.</div>
      </div>
      <div style="margin-bottom:14px">
        <span class="fl">Show Products From</span>
        <select class="fsel" id="ss-storeFilter">
          <option value="all"   ${shopSettings.storeFilter==='all'  ?'selected':''}>Both Stores</option>
          <option value="ra"    ${shopSettings.storeFilter==='ra'   ?'selected':''}>RA Warehouse Only</option>
          <option value="flora" ${shopSettings.storeFilter==='flora'?'selected':''}>Flora Gift Shop Only</option>
        </select>
      </div>
      <div style="margin-bottom:18px">
        <span class="fl">Browse Mode</span>
        <select class="fsel" id="ss-browseMode">
          <option value="all"        ${shopSettings.browseMode==='all'       ?'selected':''}>All Products (with category filter pills)</option>
          <option value="category"   ${shopSettings.browseMode==='category'  ?'selected':''}>Browse by Category (grouped sections)</option>
          <option value="collection" ${shopSettings.browseMode==='collection'?'selected':''}>Browse by Collection (collection cards then products)</option>
        </select>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Controls how customers browse your shop.</div>
      </div>
      <div style="margin-bottom:18px">
        <span class="fl">Shop Theme</span>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px">
          <div onclick="selectShopTheme('1')" id="theme-opt-1" style="border:2px solid var(--border);border-radius:12px;padding:14px 12px;cursor:pointer;transition:all 0.2s">
            <div style="font-size:20px;margin-bottom:6px">🌹</div>
            <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:2px">Luxe Gold</div>
            <div style="font-size:10px;color:var(--muted)">Dark hero · Gold accents</div>
          </div>
          <div onclick="selectShopTheme('2')" id="theme-opt-2" style="border:2px solid var(--border);border-radius:12px;padding:14px 12px;cursor:pointer;transition:all 0.2s">
            <div style="font-size:20px;margin-bottom:6px">📋</div>
            <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:2px">Editorial</div>
            <div style="font-size:10px;color:var(--muted)">Clean list · Magazine style</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">Choose how your customer shop looks.</div>
      </div>
      <button class="btn btn-p" onclick="saveShopSettingsForm()">💾 Save Settings</button>
    </div>

    <!-- Design -->
    <div class="card" style="margin-bottom:14px">
      <div class="ct">🎨 Shop Design</div>

      <!-- Brand Color -->
      <div style="margin-bottom:20px">
        <span class="fl">Brand Color</span>
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
          <input type="color" id="ss-brandColor" value="${color}"
            style="width:46px;height:46px;border:2px solid var(--grey2);border-radius:12px;cursor:pointer;padding:2px;background:white"
            oninput="previewBrandColor(this.value)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--ink)" id="ss-color-label">${color}</div>
            <div style="font-size:11px;color:var(--muted)">Applied to header, buttons & highlights</div>
          </div>
          <div id="ss-color-preview" style="width:38px;height:38px;border-radius:10px;background:${color};flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15)"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          ${presetColors.map(([c,n])=>`
            <div onclick="pickPresetColor('${c}')" title="${n}" id="preset-${c.replace('#','')}"
              style="width:30px;height:30px;border-radius:8px;background:${c};cursor:pointer;border:2.5px solid ${c===color?'var(--ink)':'transparent'};transition:border 0.15s;box-shadow:0 1px 4px rgba(0,0,0,0.1)"></div>
          `).join('')}
        </div>
      </div>

      <!-- Hero Eyebrow -->
      <div style="margin-bottom:14px">
        <span class="fl">Small Text Above Title</span>
        <input class="fi" id="ss-eyebrow" value="${shopSettings.eyebrow||''}" placeholder="e.g. RA Jemle LB · Wholesale Beauty">
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Tiny uppercase text that appears above your hero title.</div>
      </div>

      <!-- Hero Title -->
      <div style="margin-bottom:14px">
        <span class="fl">Hero Title</span>
        <input class="fi" id="ss-title" value="${shopSettings.title||''}" placeholder="e.g. Our Collection">
      </div>

      <!-- Hero Subtitle -->
      <div style="margin-bottom:18px">
        <span class="fl">Hero Subtitle</span>
        <input class="fi" id="ss-heroSub" value="${shopSettings.heroSub||''}" placeholder="e.g. Pick your favourites — by piece or by dozen">
      </div>

      <!-- Hero Banner Image -->
      <div style="margin-bottom:18px">
        <span class="fl">Hero Banner Image</span>
        <div style="margin-top:8px">
          ${heroImg ? `
            <div style="position:relative;width:100%;height:120px;border-radius:12px;overflow:hidden;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
              <img src="${heroImg}" style="width:100%;height:100%;object-fit:cover">
              <button onclick="removeHeroImage()" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);border:none;color:white;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit">✕ Remove</button>
            </div>
          ` : `
            <div style="width:100%;height:90px;border-radius:12px;border:2px dashed var(--grey2);display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:10px;color:var(--muted);font-size:12px;gap:6px">
              <span style="font-size:28px">🖼️</span>No banner yet
            </div>
          `}
          <label style="cursor:pointer">
            <input type="file" accept="image/*" style="display:none" onchange="uploadHeroImage(this)">
            <div class="btn btn-s" style="font-size:12px;padding:9px 16px;display:inline-flex;align-items:center;gap:6px">📷 ${heroImg?'Replace':'Upload'} Banner Photo</div>
          </label>
          <div style="font-size:11px;color:var(--muted);margin-top:8px">Full-width banner below the header. Best with a beauty or lifestyle photo 📸</div>
        </div>
      </div>

      <button class="btn btn-p" onclick="saveShopDesignForm()">💾 Save Design</button>
    </div>

    <!-- Product Visibility -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="ct" style="margin-bottom:0">📦 Product Visibility</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-s" style="font-size:11px;padding:6px 12px" onclick="setAllShopVisible(true)">Show All</button>
          <button class="btn btn-g" style="font-size:11px;padding:6px 12px" onclick="setAllShopVisible(false)">Hide All</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Toggle which products appear in your customer shop.</div>
      <div id="shop-product-list">${renderShopProductList()}</div>
    </div>
  `;
}

function previewBrandColor(val) {
  const lbl = document.getElementById('ss-color-label');
  const prv = document.getElementById('ss-color-preview');
  if (lbl) lbl.textContent = val;
  if (prv) prv.style.background = val;
}

function pickPresetColor(hex) {
  const inp = document.getElementById('ss-brandColor');
  if (inp) inp.value = hex;
  previewBrandColor(hex);
  document.querySelectorAll('[id^="preset-"]').forEach(el => el.style.border = '2.5px solid transparent');
  const pid = document.getElementById('preset-' + hex.replace('#',''));
  if (pid) pid.style.border = '2.5px solid var(--ink)';
}

function uploadHeroImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    shopSettings.heroImage = e.target.result;
    await saveShopSettings();
    renderShopManager();
  };
  reader.readAsDataURL(file);
}

async function removeHeroImage() {
  shopSettings.heroImage = '';
  await saveShopSettings();
  renderShopManager();
}

function renderShopProductList() {
  if (!products.length) {
    return '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">No products yet. Add products in Inventory first.</div>';
  }
  return products.map(p => {
    const visible    = p.shopVisible !== false;
    const totalQty   = (p.variants||[]).reduce((s,v) => s+(v.flora||0)+(v.ra||0), 0);
    const piecePrice = p.priceRAPiece || p.priceFlora || p.price || 0;
    const dozenPrice = p.priceRADozen || 0;
    const hasPrice   = piecePrice > 0 || dozenPrice > 0;
    const colors     = (p.variants||[]).filter(v => v.colorHex && !['#ede6e8','#f4a0b0',''].includes(v.colorHex));
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--grey2)">
        <div style="width:42px;height:42px;border-radius:10px;background:var(--rose-pale);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden">
          ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : (p.emoji||'🌸')}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap">
            <span>${totalQty} in stock</span>
            ${hasPrice ? `<span>·</span><span>${piecePrice?'$'+piecePrice.toFixed(2)+'/pc':''}${dozenPrice?' · $'+(dozenPrice*12).toFixed(2)+'/doz':''}</span>` : '<span style="color:var(--red)">· No price set</span>'}
            ${p.category ? `<span>· ${p.category}</span>` : ''}
            ${colors.length ? `<span style="display:flex;gap:3px;margin-left:2px">${colors.slice(0,4).map(v=>`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${v.colorHex}"></span>`).join('')}</span>` : ''}
          </div>
        </div>
        <label style="position:relative;width:44px;height:26px;flex-shrink:0;cursor:pointer">
          <input type="checkbox" ${visible?'checked':''} onchange="toggleProductShopVisible('${p.id}',this.checked)" style="opacity:0;width:0;height:0;position:absolute">
          <div style="position:absolute;inset:0;border-radius:13px;background:${visible?'var(--rose)':'var(--grey2)'};transition:background 0.2s">
            <div style="position:absolute;top:3px;left:${visible?'21':'3'}px;width:20px;height:20px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.15)"></div>
          </div>
        </label>
      </div>`;
  }).join('');
}

async function toggleProductShopVisible(productId, visible) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  p.shopVisible = visible;
  await saveData();
  renderShopManager();
}

async function setAllShopVisible(visible) {
  products.forEach(p => p.shopVisible = visible);
  await saveData();
  renderShopManager();
}

async function saveShopSettingsForm() {
  shopSettings.shopName    = document.getElementById('ss-shopName').value.trim();
  shopSettings.whatsapp    = document.getElementById('ss-whatsapp').value.trim();
  shopSettings.storeFilter = document.getElementById('ss-storeFilter').value;
  shopSettings.browseMode  = document.getElementById('ss-browseMode').value;
  // shopTheme is set by selectShopTheme() directly on shopSettings
  await saveShopSettings();
}

function selectShopTheme(theme) {
  shopSettings.shopTheme = theme;
  // Update UI
  ['1','2'].forEach(t => {
    const el = document.getElementById('theme-opt-' + t);
    if (!el) return;
    el.style.border = t === theme ? '2px solid var(--rose)' : '2px solid var(--border)';
    el.style.background = t === theme ? 'var(--rose-pale)' : 'white';
  });
}

async function saveShopDesignForm() {
  shopSettings.brandColor = document.getElementById('ss-brandColor').value;
  shopSettings.eyebrow    = document.getElementById('ss-eyebrow').value.trim();
  shopSettings.title      = document.getElementById('ss-title').value.trim();
  shopSettings.heroSub    = document.getElementById('ss-heroSub').value.trim();
  await saveShopSettings();
}

function copyShopLink() {
  navigator.clipboard.writeText(getShopURL())
    .then(() => showToast('Link copied! 🔗'))
    .catch(() => showToast('Could not copy — copy manually', 'err'));
}

function shareShopLink() {
  if (navigator.share) {
    navigator.share({ title: shopSettings.shopName||'My Shop', url: getShopURL() }).catch(() => copyShopLink());
  } else {
    copyShopLink();
  }
}

function previewShop() {
  window.open(getShopURL(), '_blank');
}
