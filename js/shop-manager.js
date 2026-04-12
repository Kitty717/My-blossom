// ═══════════════════════════════════════════════════
// SHOP-MANAGER.JS — Controls the customer-facing shop
// Depends on: data.js, utils.js
// ═══════════════════════════════════════════════════

// ── Shop settings state ──
let shopSettings = {
  shopName:   'Blossom',
  title:      'Our Collection',
  heroSub:    'Pick your favourites — by piece or by dozen',
  subtitle:   'Browse our collection',
  whatsapp:   '',
  storeFilter: 'all'   // 'all' | 'ra' | 'flora'
};

// ── Load shop settings ──
async function loadShopSettings() {
  try {
    const saved = await _idbGet('biz_shop_settings');
    if (saved) shopSettings = { ...shopSettings, ...saved };
  } catch(e) { console.warn('loadShopSettings', e); }
}

// ── Save shop settings ──
async function saveShopSettings() {
  try {
    await _idbPut('biz_shop_settings', shopSettings);
    showToast('Shop settings saved ✅');
  } catch(e) {
    console.warn('saveShopSettings', e);
    showToast('Could not save shop settings', 'err');
  }
}

// ── Save product's shopVisible flag ──
async function saveProductShopFlag() {
  try {
    await _idbPut('biz_products', products);
  } catch(e) { console.warn('saveProductShopFlag', e); }
}

// ═══════════════════════════════════════════════════
// RENDER SHOP MANAGER PAGE
// ═══════════════════════════════════════════════════
async function renderShopManager() {
  await loadShopSettings();

  const el = document.getElementById('shop-manager-content');
  if (!el) return;

  // Count published products
  const published  = products.filter(p => p.shopVisible !== false).length;
  const total      = products.length;
  const waSet      = shopSettings.whatsapp && shopSettings.whatsapp.length > 3;

  el.innerHTML = `
    <!-- Status Banner -->
    <div style="background:linear-gradient(135deg,var(--rose),#d45f76);border-radius:var(--radius);padding:20px;color:white;margin-bottom:18px;position:relative;overflow:hidden">
      <div style="position:absolute;font-size:60px;opacity:0.1;right:-10px;bottom:-10px">🛍️</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;opacity:0.8;text-transform:uppercase;margin-bottom:6px">Customer Shop</div>
      <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:4px">${published} products published</div>
      <div style="font-size:12px;opacity:0.85">${waSet ? '✅ WhatsApp connected' : '⚠️ Set your WhatsApp number below'} · ${total} total in inventory</div>
    </div>

    <!-- Share Link -->
    <div class="card" style="margin-bottom:14px">
      <div class="ct">🔗 Shop Link</div>
      <div style="font-size:13px;color:var(--ink-light);margin-bottom:12px">Share this page with your customers. It shows your published products live from your inventory.</div>
      <div style="background:var(--grey);border-radius:10px;padding:12px 14px;font-size:12px;color:var(--ink-light);font-family:monospace;margin-bottom:10px;word-break:break-all" id="shop-url-display">shop.html</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-p" style="font-size:12px;padding:9px 16px" onclick="copyShopLink()">📋 Copy Link</button>
        <button class="btn btn-s" style="font-size:12px;padding:9px 16px" onclick="previewShop()">👁️ Preview Shop</button>
      </div>
    </div>

    <!-- Settings -->
    <div class="card" style="margin-bottom:14px">
      <div class="ct">⚙️ Shop Settings</div>

      <div style="margin-bottom:14px">
        <span class="fl">Shop Name</span>
        <input class="fi" id="ss-shopName" value="${shopSettings.shopName||''}" placeholder="e.g. Blossom">
      </div>

      <div style="margin-bottom:14px">
        <span class="fl">WhatsApp Number (orders go here)</span>
        <input class="fi" id="ss-whatsapp" value="${shopSettings.whatsapp||''}" placeholder="e.g. +961 70 123 456">
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Include country code. Orders will be sent to this number.</div>
      </div>

      <div style="margin-bottom:14px">
        <span class="fl">Hero Title</span>
        <input class="fi" id="ss-title" value="${shopSettings.title||''}" placeholder="e.g. Our Collection">
      </div>

      <div style="margin-bottom:14px">
        <span class="fl">Hero Subtitle</span>
        <input class="fi" id="ss-heroSub" value="${shopSettings.heroSub||''}" placeholder="e.g. Pick your favourites — by piece or by dozen">
      </div>

      <div style="margin-bottom:18px">
        <span class="fl">Show Products From</span>
        <select class="fsel" id="ss-storeFilter">
          <option value="all"   ${shopSettings.storeFilter==='all'  ?'selected':''}>Both Stores (All Products)</option>
          <option value="ra"    ${shopSettings.storeFilter==='ra'   ?'selected':''}>RA Warehouse Only</option>
          <option value="flora" ${shopSettings.storeFilter==='flora'?'selected':''}>Flora Gift Shop Only</option>
        </select>
      </div>

      <button class="btn btn-p" onclick="saveShopSettingsForm()">💾 Save Settings</button>
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

      <div id="shop-product-list">
        ${renderShopProductList()}
      </div>
    </div>
  `;

  // Set actual URL
  try {
    const url = window.location.href.replace('index.html', 'shop.html').replace(/\?.*$/, '');
    document.getElementById('shop-url-display').textContent = url;
  } catch(e){}
}

function renderShopProductList() {
  if (!products.length) {
    return '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">No products yet. Add products in Inventory first.</div>';
  }

  return products.map(p => {
    const visible   = p.shopVisible !== false;
    const totalQty  = (p.variants||[]).reduce((s,v) => s + (v.flora||0) + (v.ra||0), 0);
    const piecePrice = p.priceRAPiece || p.priceFlora || p.price || 0;
    const dozenPrice = p.priceRADozen || 0;
    const hasPrice  = piecePrice > 0 || dozenPrice > 0;
    const colors    = (p.variants||[]).filter(v => v.colorHex && v.colorHex !== '#ede6e8' && v.colorHex !== '#f4a0b0' && v.colorHex !== '');

    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--grey2)">
        <div style="width:42px;height:42px;border-radius:10px;background:var(--rose-pale);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden">
          ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : (p.emoji||'🌸')}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;margin-top:2px">
            <span>${totalQty} in stock</span>
            ${hasPrice ? `<span>·</span><span>${piecePrice ? '$'+piecePrice.toFixed(2)+'/pc' : ''}${dozenPrice ? ' · $'+(dozenPrice*12).toFixed(2)+'/doz' : ''}</span>` : '<span style="color:var(--red)">· No price set</span>'}
            ${colors.length ? `<span>·</span><span style="display:flex;gap:3px">${colors.slice(0,4).map(v=>`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${v.colorHex}"></span>`).join('')}</span>` : ''}
          </div>
        </div>
        <label style="position:relative;width:44px;height:26px;flex-shrink:0;cursor:pointer">
          <input type="checkbox" ${visible?'checked':''} onchange="toggleProductShopVisible('${p.id}',this.checked)"
            style="opacity:0;width:0;height:0;position:absolute">
          <div class="shop-toggle-track" style="position:absolute;inset:0;border-radius:13px;background:${visible?'var(--rose)':'var(--grey2)'};transition:background 0.2s">
            <div style="position:absolute;top:3px;left:${visible?'21':'3'}px;width:20px;height:20px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.15)"></div>
          </div>
        </label>
      </div>`;
  }).join('');
}

// ── Toggle product visibility ──
async function toggleProductShopVisible(productId, visible) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  p.shopVisible = visible;
  await saveData();
  // Re-render just the count in the banner
  const banner = document.querySelector('#shop-manager-content .card:first-child');
  // Soft refresh
  renderShopManager();
}

// ── Show all / hide all ──
async function setAllShopVisible(visible) {
  products.forEach(p => p.shopVisible = visible);
  await saveData();
  renderShopManager();
}

// ── Save settings form ──
async function saveShopSettingsForm() {
  shopSettings.shopName    = document.getElementById('ss-shopName').value.trim();
  shopSettings.whatsapp    = document.getElementById('ss-whatsapp').value.trim();
  shopSettings.title       = document.getElementById('ss-title').value.trim();
  shopSettings.heroSub     = document.getElementById('ss-heroSub').value.trim();
  shopSettings.storeFilter = document.getElementById('ss-storeFilter').value;
  await saveShopSettings();
}

// ── Copy shop link ──
function copyShopLink() {
  const url = document.getElementById('shop-url-display').textContent;
  navigator.clipboard.writeText(url).then(() => showToast('Link copied! 🔗')).catch(() => {
    showToast('Could not copy — copy manually', 'err');
  });
}

// ── Preview shop ──
function previewShop() {
  const url = document.getElementById('shop-url-display').textContent;
  window.open(url, '_blank');
}
