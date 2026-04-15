// ═══════════════════════════════════════════════════
// SHOP-MANAGER.JS — Customer Shop Manager
// ═══════════════════════════════════════════════════

const SHOP_BASE = 'https://rajemlelb.web.app/';
const FB_DB_URL = 'https://ra-shop-3e01d-default-rtdb.firebaseio.com';
const SHOP_NAME = 'RA Jemle LB';
const SHOP_URL  = SHOP_BASE + 'shop.html';

// ── State ──
let shopSettings = {
  eyebrow:    'RA Jemle LB · Wholesale Beauty',
  title:      'Our Collection',
  heroSub:    'Pick your favourites — by piece or by dozen',
  whatsapp:   '',
  storeFilter:'all',
  browseMode: 'all',
  heroImage:  '',
  announcement:'',
  marquee:    'NEW ARRIVALS ✦ WHOLESALE PRICES ✦ ORDER BY PIECE OR DOZEN ✦ FAST DELIVERY',
  waTemplate: 'Hi! I just placed order #{orderNum}.\nName: {name}\nItems:\n{items}\nTotal: {total}',
  lastPublished: null,
};
let _smTab = 'overview'; // overview | orders | visibility | settings | design
let _smOrdersCache = null;
let _smVisSearch = '';
let _smVisCat = 'all';

// ── Check pending orders and show badge ──
async function checkShopOrdersBadge(){
  try {
    const controller = new AbortController();
    setTimeout(()=>controller.abort(), 5000);
    const res = await fetch(`${FB_DB_URL}/orders.json`, {signal:controller.signal});
    if(!res.ok) return;
    const data = await res.json();
    if(!data) return;
    const orders = Object.values(data);
    const pending = orders.filter(o=>o.status==='pending').length;
    const badge = document.getElementById('shop-orders-badge');
    if(badge){
      badge.style.display = pending > 0 ? 'inline' : 'none';
      badge.textContent = pending > 0 ? pending : '';
    }
    // Cache for overview stats
    _smOrdersCache = orders.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  } catch(e){}
}
async function loadShopSettings(){
  try { const s=await _idbGet('biz_shop_settings'); if(s) shopSettings={...shopSettings,...s}; } catch(e){}
}
async function saveShopSettings(){
  try { await _idbPut('biz_shop_settings',shopSettings); } catch(e){}
}

// ── Image compression ──
async function compressImage(base64,maxDim=320,quality=0.65){
  return new Promise(res=>{
    if(!base64||!base64.startsWith('data:image')){res(base64);return;}
    const img=new Image();
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){if(w>h){h=Math.round(h*maxDim/w);w=maxDim;}else{w=Math.round(w*maxDim/h);h=maxDim;}}
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      res(c.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>res(base64);img.src=base64;
  });
}

function darkenColor(hex,amount){
  try{
    let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    r=Math.max(0,r-amount);g=Math.max(0,g-amount);b=Math.max(0,b-amount);
    return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  }catch(e){return hex;}
}

// ═══════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════
async function renderShopManager(){
  await loadShopSettings();
  const el = document.getElementById('shop-manager-content');
  if(!el) return;

  const published = products.filter(p=>p.shopVisible!==false).length;
  const waSet     = shopSettings.whatsapp && shopSettings.whatsapp.length > 3;
  const lastPub   = shopSettings.lastPublished ? new Date(shopSettings.lastPublished).toLocaleDateString('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Never';

  el.innerHTML = `
    <!-- Hero Banner -->
    <div style="background:linear-gradient(135deg,#1a0d12,#2c1a1f);border-radius:18px;padding:22px 20px 18px;color:white;margin-bottom:16px;position:relative;overflow:hidden">
      <div style="position:absolute;right:-20px;bottom:-20px;font-size:100px;opacity:0.06">🛍️</div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;opacity:0.6;text-transform:uppercase;margin-bottom:6px">Customer Shop</div>
          <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;line-height:1.2;margin-bottom:6px">${SHOP_NAME}</div>
          <div style="font-size:12px;opacity:0.75;margin-bottom:14px">${published} products live · ${waSet?'✅ WhatsApp set':'⚠️ WhatsApp not set'}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="previewShop()" style="background:white;color:#1a0d12;border:none;border-radius:50px;padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">👁️ Open Shop</button>
            <button onclick="copyShopLink()" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.25);border-radius:50px;padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📋 Copy Link</button>
            <button onclick="shareShopLink()" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.25);border-radius:50px;padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📤 Share</button>
          </div>
        </div>
      </div>
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div style="font-size:11px;opacity:0.6">Last published: ${lastPub}</div>
        <button id="publish-btn" onclick="publishShopToFirebase()" style="background:linear-gradient(135deg,#4caf7d,#2e7d50);color:white;border:none;border-radius:50px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(76,175,125,0.4)">🌐 Publish Shop</button>
      </div>
      <div id="publish-status" style="margin-top:8px;font-size:11px;opacity:0.8"></div>
    </div>

    <!-- Tab Nav -->
    <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:16px;padding-bottom:2px">
      ${[
        {id:'overview', icon:'📊', label:'Overview'},
        {id:'orders',   icon:'📦', label:'Incoming Orders'},
        {id:'visibility',icon:'👁️',label:'Products'},
        {id:'settings', icon:'⚙️', label:'Settings'},
        {id:'design',   icon:'🎨', label:'Design'},
      ].map(t=>`
        <button onclick="smSetTab('${t.id}')" id="sm-tab-${t.id}" style="
          flex-shrink:0;border:none;border-radius:50px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.2s;
          background:${_smTab===t.id?'var(--rose)':'var(--grey)'};
          color:${_smTab===t.id?'white':'var(--muted)'}
        ">${t.icon} ${t.label}</button>
      `).join('')}
    </div>

    <!-- Tab Content -->
    <div id="sm-tab-content">
      ${_smTab==='overview'  ? _smRenderOverview(published,waSet) : ''}
      ${_smTab==='orders'    ? '<div id="sm-orders-wrap">⏳ Loading orders...</div>' : ''}
      ${_smTab==='visibility'? _smRenderVisibility() : ''}
      ${_smTab==='settings'  ? _smRenderSettings() : ''}
      ${_smTab==='design'    ? _smRenderDesign() : ''}
    </div>
  `;

  if(_smTab==='orders') smLoadOrders();
}

function smSetTab(tab){
  _smTab = tab;
  renderShopManager();
}

function _smRenderOverview(published, waSet){
  const total = products.length;
  const lowStock = products.filter(p=>p.shopVisible!==false&&(p.variants||[]).reduce((s,v)=>s+(v.ra||0)+(v.flora||0),0)<(p.reorderAt||10)).length;
  const noPrice  = products.filter(p=>!p.priceRAPiece&&!p.priceFlora&&!p.price).length;

  // Order stats from cache
  const orders = _smOrdersCache || [];
  const totalOrders   = orders.length;
  const pendingOrders = orders.filter(o=>o.status==='pending').length;
  const revenue       = orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+(o.total||0),0);

  return `
    <!-- Order stats (if loaded) -->
    ${totalOrders>0?`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--white);border-radius:16px;padding:14px;box-shadow:var(--shadow);border:1.5px solid var(--grey2);text-align:center">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Orders</div>
        <div style="font-size:26px;font-weight:800;color:var(--ink)">${totalOrders}</div>
      </div>
      <div style="background:${pendingOrders>0?'var(--amber-soft)':'var(--white)'};border-radius:16px;padding:14px;box-shadow:var(--shadow);border:1.5px solid ${pendingOrders>0?'rgba(245,166,35,0.3)':'var(--grey2)'};text-align:center">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Pending</div>
        <div style="font-size:26px;font-weight:800;color:${pendingOrders>0?'var(--amber)':'var(--ink)'}">${pendingOrders}</div>
      </div>
      <div style="background:var(--green-soft);border-radius:16px;padding:14px;box-shadow:var(--shadow);border:1.5px solid rgba(76,175,125,0.2);text-align:center">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Revenue</div>
        <div style="font-size:20px;font-weight:800;color:var(--green)">$${revenue.toFixed(0)}</div>
      </div>
    </div>`:''}

    <!-- Product stats grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--white);border-radius:16px;padding:16px;box-shadow:var(--shadow);border:1.5px solid var(--grey2)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Published</div>
        <div style="font-size:28px;font-weight:800;color:var(--ink)">${published}</div>
        <div style="font-size:11px;color:var(--muted)">of ${total} products</div>
      </div>
      <div style="background:var(--white);border-radius:16px;padding:16px;box-shadow:var(--shadow);border:1.5px solid var(--grey2)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">WhatsApp</div>
        <div style="font-size:22px;font-weight:800;color:${waSet?'var(--green)':'var(--red)'}">${waSet?'✅':'⚠️'}</div>
        <div style="font-size:11px;color:var(--muted)">${waSet?'Connected':'Not set'}</div>
      </div>
      <div style="background:${lowStock?'var(--red-soft)':'var(--green-soft)'};border-radius:16px;padding:16px;border:1.5px solid ${lowStock?'rgba(224,82,99,0.2)':'rgba(76,175,125,0.2)'}">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Low Stock</div>
        <div style="font-size:28px;font-weight:800;color:${lowStock?'var(--red)':'var(--green)'}">${lowStock}</div>
        <div style="font-size:11px;color:var(--muted)">products need reorder</div>
      </div>
      <div style="background:${noPrice?'var(--amber-soft)':'var(--green-soft)'};border-radius:16px;padding:16px;border:1.5px solid ${noPrice?'rgba(245,166,35,0.2)':'rgba(76,175,125,0.2)'}">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">No Price</div>
        <div style="font-size:28px;font-weight:800;color:${noPrice?'var(--amber)':'var(--green)'}">${noPrice}</div>
        <div style="font-size:11px;color:var(--muted)">products missing price</div>
      </div>
    </div>

    <!-- Quick actions -->
    <div style="background:var(--white);border-radius:16px;padding:16px;box-shadow:var(--shadow);border:1.5px solid var(--grey2);margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:12px">⚡ Quick Actions</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="smSetTab('orders')" style="background:var(--rose-pale);border:none;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">📦</span>
          <div><div style="font-size:13px;font-weight:700;color:var(--ink)">View Orders ${pendingOrders>0?`<span style="background:var(--amber);color:white;border-radius:50px;padding:1px 7px;font-size:10px;margin-left:4px">${pendingOrders}</span>`:''}</div><div style="font-size:11px;color:var(--muted)">See incoming customer orders</div></div>
          <span style="margin-left:auto;color:var(--muted)">›</span>
        </button>
        <button onclick="smSetTab('visibility')" style="background:var(--rose-pale);border:none;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">👁️</span>
          <div><div style="font-size:13px;font-weight:700;color:var(--ink)">Manage Products</div><div style="font-size:11px;color:var(--muted)">Control what's visible in shop</div></div>
          <span style="margin-left:auto;color:var(--muted)">›</span>
        </button>
        <button onclick="publishShopToFirebase()" style="background:linear-gradient(135deg,#e8f5ee,#d4eddf);border:1.5px solid rgba(76,175,125,0.3);border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">🌐</span>
          <div><div style="font-size:13px;font-weight:700;color:var(--green)">Publish Shop</div><div style="font-size:11px;color:var(--muted)">Push latest changes live</div></div>
          <span style="margin-left:auto;color:var(--green)">›</span>
        </button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════
// ORDERS TAB
// ═══════════════════════════════════════════════════
async function smLoadOrders(){
  const wrap = document.getElementById('sm-orders-wrap');
  if(!wrap) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 8000);
    const res = await fetch(`${FB_DB_URL}/orders.json`, {signal:controller.signal});
    clearTimeout(timeout);
    if(!res.ok) throw new Error('Firebase error');
    const data = await res.json();
    _smOrdersCache = data ? Object.values(data).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)) : [];
    wrap.innerHTML = _smRenderOrders();
  } catch(e){
    wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">⚠️ Could not load orders.<br>Check your connection.</div>`;
  }
}

function _smRenderOrders(){
  if(!_smOrdersCache||!_smOrdersCache.length){
    return `<div style="text-align:center;padding:40px;color:var(--muted)">
      <div style="font-size:40px;margin-bottom:12px">📭</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">No orders yet</div>
      <div style="font-size:12px">Share your shop link with customers to start receiving orders</div>
    </div>`;
  }

  const statusColors = {pending:'var(--amber)',confirmed:'var(--green)',shipped:'var(--blue)',cancelled:'var(--red)'};
  const statusBg     = {pending:'var(--amber-soft)',confirmed:'var(--green-soft)',shipped:'#e8f0ff',cancelled:'var(--red-soft)'};
  const pending = _smOrdersCache.filter(o=>o.status==='pending').length;

  return `
    ${pending>0?`<div style="background:var(--amber-soft);border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;border:1.5px solid rgba(245,166,35,0.3)">
      <span style="font-size:20px">⏳</span>
      <div style="font-size:13px;font-weight:700;color:var(--amber)">${pending} order${pending>1?'s':''} waiting for confirmation</div>
    </div>`:''}
    <div style="display:flex;flex-direction:column;gap:10px">
      ${_smOrdersCache.map(o=>{
        const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
        const itemCount = (o.items||[]).reduce((s,i)=>s+(i.qty||1),0);
        const status = o.status||'pending';
        return `<div style="background:var(--white);border-radius:16px;padding:16px;box-shadow:var(--shadow);border:1.5px solid var(--grey2)">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--ink)">${o.customerName||'Customer'}</div>
              <div style="font-size:11px;color:var(--muted)">#${o.id} · ${date}</div>
            </div>
            <span style="background:${statusBg[status]||'var(--grey)'};color:${statusColors[status]||'var(--muted)'};border-radius:50px;padding:4px 10px;font-size:10px;font-weight:700;white-space:nowrap;text-transform:uppercase">${status}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${itemCount} item${itemCount!==1?'s':''} · Total: <strong style="color:var(--ink)">$${(o.total||0).toFixed(2)}</strong></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${['confirmed','shipped','cancelled'].map(s=>
              s!==status?`<button onclick="smUpdateOrderStatus('${o.id}','${s}')" style="background:${statusBg[s]||'var(--grey)'};color:${statusColors[s]};border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">${s==='confirmed'?'✅ Confirm':s==='shipped'?'🚚 Mark Shipped':'❌ Cancel'}</button>`:''
            ).join('')}
            <button onclick="smWhatsAppOrder('${o.id}')" style="background:var(--green-soft);color:var(--green);border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">💬 WhatsApp</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

const TRACK_URL = 'https://rajemlelb.web.app/track.html';
async function smUpdateOrderStatus(orderId, status){
  try {
    const controller = new AbortController();
    setTimeout(()=>controller.abort(),8000);
    await fetch(`${FB_DB_URL}/orders/${orderId}/status.json`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(status), signal:controller.signal
    });
    // Update local cache
    const o = _smOrdersCache?.find(x=>x.id===orderId);
    if(o) o.status = status;

    // Auto-create customer + invoice if not exists yet
    await _smEnsureInvoiceExists(o);

    // Sync to invoice if linked
    const inv = invoices.find(i=>i.shopOrderId===orderId);
    if(inv){
      if(status==='shipped')    inv.status='shipped';
      if(status==='cancelled')  inv.status='cancelled';
      if(status==='confirmed')  inv.status='unpaid';
      saveInvoices(); saveCustomers();
    }
    showToast(`Order ${status} ✅`);

    // Auto WhatsApp the customer
    if(o) _smAutoWhatsApp(o, status);

    // Silently re-publish stock to Firebase after confirm/cancel
    if(status==='confirmed'||status==='cancelled'||status==='shipped'||status==='delivered'){
      _smSilentPublishStock();
    }

    const wrap = document.getElementById('sm-orders-wrap');
    if(wrap) wrap.innerHTML = _smRenderOrders();
  } catch(e){
    showToast('Could not update order — check connection','err');
  }
}


async function _smSilentPublishStock(){
  try {
    // Push just the products array with updated stock (no photos — already published)
    const cached = JSON.parse(localStorage.getItem('blossom_shop_cache')||'{}');
    if(!cached.products) return;
    // Update cached products stock from live products array
    cached.products = cached.products.map(cp=>{
      const lp = products.find(p=>p.id===cp.id);
      if(!lp) return cp;
      return {...cp, variants:(lp.variants||[]).map(v=>({...v,photo:''}))};
    });
    cached.publishedAt = new Date().toISOString();
    await fetch(`${FB_DB_URL}/shop/products.json`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(cached.products)
    });
    localStorage.setItem('blossom_shop_cache', JSON.stringify(cached));
  } catch(e){ console.log('Silent publish failed:',e); }
}

async function _smEnsureInvoiceExists(order){
  if(!order) return;
  // Check if invoice already exists
  const existing = invoices.find(i=>i.shopOrderId===order.id);
  if(existing) return;

  // Create customer if not exists
  const phone = (order.customerPhone||'').trim();
  const name  = (order.customerName||'Customer').trim();
  let cust = customers.find(c=>c.phone===phone||(c.name&&c.name.toLowerCase()===name.toLowerCase()));
  if(!cust){
    cust = {
      id:'cust-shop-'+Date.now(), name, phone, wa:phone,
      type:'ra', debt:0, notes:'Shop customer 🛍️',
      createdAt:new Date().toISOString()
    };
    customers.push(cust);
    saveCustomers();
    showToast(`New customer added: ${name} 🛍️`);
  }

  // Create invoice
  const invItems = (order.items||[]).map(i=>({
    productId: i.productId||'',
    name: i.name||'',
    emoji: i.emoji||'📦',
    variantId: i.variantId||'',
    variantLabel: i.variantLabel||'',
    qty: i.qtyType==='dozen'?(i.qty*12):(i.qty||1),
    price: i.unitPrice||0,
    total: (i.unitPrice||0)*((i.qtyType==='dozen'?(i.qty*12):(i.qty||1))),
  }));
  const inv = {
    id: 'inv-shop-'+Date.now(),
    num: order.id,
    shopOrderId: order.id,
    fromShop: true,
    store: 'ra',
    customer: name,
    customerPhone: phone,
    customerId: cust.id,
    date: new Date().toISOString().split('T')[0],
    items: invItems,
    total: order.total||0,
    paidAmt: 0,
    status: 'unpaid',
    notes: order.notes||'',
    createdAt: new Date().toISOString(),
  };
  invoices.push(inv);
  saveInvoices();
  showToast(`Invoice created: #${order.id} 🛍️`);
}

function _smAutoWhatsApp(order, status){
  const phone = (order.customerPhone||'').replace(/\D/g,'');
  if(!phone) return;
  const trackLink = `${TRACK_URL}?order=${order.id}`;
  let msg = '';
  if(status==='confirmed'){
    msg = `Hello ${order.customerName||''}! 🌸\n\nWe got your order *#${order.id}* and we're preparing it now!\n\nTrack your order anytime:\n${trackLink}\n\nThank you for shopping with RA Jemle LB! 💛`;
  } else if(status==='shipped'){
    msg = `Hello ${order.customerName||''}! 🚚\n\nYour order *#${order.id}* is on its way!\n\nEstimated delivery: *3-5 business days*\n\nTrack your order:\n${trackLink}\n\nThank you! 💛\nRA Jemle LB`;
  } else if(status==='delivered'){
    msg = `Hello ${order.customerName||''}! 🎉\n\nYour order *#${order.id}* has been delivered!\n\nWe hope you love your products 🌸\nThank you for shopping with RA Jemle LB! 💛`;
  } else if(status==='cancelled'){
    msg = `Hello ${order.customerName||''}!\n\nWe're sorry, your order *#${order.id}* has been cancelled.\n\nPlease contact us if you have any questions.\nRA Jemle LB 🌸`;
  }
  if(msg) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function smWhatsAppOrder(orderId){
  const o = _smOrdersCache?.find(x=>x.id===orderId);
  if(!o) return;
  const phone = (o.customerPhone||'').replace(/\D/g,'');
  if(!phone){ showToast('No phone number for this customer','err'); return; }
  const items = (o.items||[]).map(i=>`• ${i.name}${i.variantLabel?' ('+i.variantLabel+')':''} × ${i.qty}`).join('\n');
  const defaultTemplate = 'Hi {name}! 🌸\nYour order #{orderNum} has been received.\n\n{items}\n\nTotal: {total}\n\nWe\'ll confirm shortly! 💛';
  let msg = (shopSettings.waTemplate || defaultTemplate)
    .replace('{name}', o.customerName||'')
    .replace('{orderNum}', o.id||'')
    .replace('{items}', items)
    .replace('{total}', '$'+(o.total||0).toFixed(2))
    .replace('{status}', o.status||'pending');
  window.open(`https://wa.me/${phone}`, '_blank');
}

// ═══════════════════════════════════════════════════
// PRODUCT VISIBILITY TAB
// ═══════════════════════════════════════════════════
function _smRenderVisibility(){
  const cats = ['all', ...new Set(products.map(p=>p.category).filter(Boolean))];
  let list = products;
  if(_smVisSearch) list = list.filter(p=>p.name.toLowerCase().includes(_smVisSearch.toLowerCase())||p.category?.toLowerCase().includes(_smVisSearch.toLowerCase()));
  if(_smVisCat!=='all') list = list.filter(p=>p.category===_smVisCat);

  const visCount = list.filter(p=>p.shopVisible!==false).length;

  const BADGES = [
    {val:'',       label:'None',       color:'var(--muted)'},
    {val:'bestseller',label:'⭐ Best Seller',color:'var(--amber)'},
    {val:'new',    label:'✨ New',      color:'var(--green)'},
    {val:'clearance',label:'🏷️ Clearance',color:'var(--red)'},
    {val:'lastfew',label:'⚡ Last Few', color:'var(--rose)'},
  ];

  return `
    <div style="background:var(--white);border-radius:16px;padding:16px;box-shadow:var(--shadow);border:1.5px solid var(--grey2)">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--ink)">Product Visibility</div>
          <div style="font-size:11px;color:var(--muted)">${visCount} of ${list.length} shown visible</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="setAllShopVisible(true)" style="background:var(--green-soft);color:var(--green);border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Show All</button>
          <button onclick="setAllShopVisible(false)" style="background:var(--red-soft);color:var(--red);border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Hide All</button>
        </div>
      </div>

      <!-- Search -->
      <div style="position:relative;margin-bottom:10px">
        <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px">🔍</span>
        <input class="fi" placeholder="Search products..." value="${_smVisSearch}"
          oninput="_smVisSearch=this.value;document.getElementById('sm-vis-list').innerHTML=_smBuildVisList()"
          style="padding-left:36px;font-size:13px">
      </div>

      <!-- Category filter -->
      <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:14px;padding-bottom:2px">
        ${cats.map(c=>`
          <button onclick="_smVisCat='${c}';document.getElementById('sm-vis-list').innerHTML=_smBuildVisList()" style="
            flex-shrink:0;border:none;border-radius:50px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;
            background:${_smVisCat===c?'var(--rose)':'var(--grey)'};color:${_smVisCat===c?'white':'var(--muted)'}
          ">${c==='all'?'All':c}</button>
        `).join('')}
      </div>

      <!-- Product list -->
      <div id="sm-vis-list">${_smBuildVisList()}</div>

      <!-- Publish shortcut -->
      <button onclick="publishShopToFirebase()" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#4caf7d,#2e7d50);color:white;border:none;border-radius:12px;padding:13px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">🌐 Publish Changes</button>
    </div>
  `;
}

function _smBuildVisList(){
  const BADGES = ['','bestseller','new','clearance','lastfew'];
  const BADGE_LABELS = {bestseller:'⭐ Best',new:'✨ New',clearance:'🏷️ Sale',lastfew:'⚡ Last'};

  let list = products;
  if(_smVisSearch) list = list.filter(p=>p.name.toLowerCase().includes(_smVisSearch.toLowerCase())||p.category?.toLowerCase().includes(_smVisSearch.toLowerCase()));
  if(_smVisCat!=='all') list = list.filter(p=>p.category===_smVisCat);

  if(!list.length) return `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">No products found</div>`;

  return list.map(p=>{
    const visible = p.shopVisible!==false;
    const qty = (p.variants||[]).reduce((s,v)=>s+(v.ra||0)+(v.flora||0),0);
    const badge = p.badge||'';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--grey2)">
        <div style="width:40px;height:40px;border-radius:10px;background:var(--rose-pale);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;overflow:hidden">
          ${p.photo?`<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`:(p.emoji||'📦')}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${qty} in stock · ${p.category||'Uncategorized'}</div>
          <!-- Badge selector -->
          <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
            ${['','bestseller','new','clearance','lastfew'].map(b=>{
              const labels = {'':"None",'bestseller':'⭐','new':'✨','clearance':'🏷️','lastfew':'⚡'};
              const colors = {'':'var(--grey2)','bestseller':'var(--amber)','new':'var(--green)','clearance':'var(--red)','lastfew':'var(--rose)'};
              const active = badge===b;
              return `<button onclick="smSetBadge('${p.id}','${b}')" style="
                border:1.5px solid ${active?colors[b]:'var(--grey2)'};
                background:${active?colors[b]:'transparent'};
                color:${active?'white':'var(--muted)'};
                border-radius:50px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s
              ">${labels[b]||b}</button>`;
            }).join('')}
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

async function smSetBadge(productId, badge){
  const p = products.find(x=>x.id===productId);
  if(!p) return;
  p.badge = badge;
  await saveProducts();
  document.getElementById('sm-vis-list').innerHTML = _smBuildVisList();
  showToast(badge?`Badge set: ${badge}`:'Badge removed');
}

// ═══════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════
function _smRenderSettings(){
  return `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="background:var(--white);border-radius:16px;padding:16px;box-shadow:var(--shadow);border:1.5px solid var(--grey2)">
        <div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:14px">⚙️ General</div>
        <div style="margin-bottom:14px">
          <span class="fl">WhatsApp Number</span>
          <input class="fi" id="ss-whatsapp" value="${shopSettings.whatsapp||''}" placeholder="+961 70 123 456">
          <div style="font-size:11px;color:var(--muted);margin-top:4px">All orders go to this number.</div>
        </div>

        <div style="margin-bottom:14px">
          <span class="fl">Browse Mode</span>
          <select class="fsel" id="ss-browseMode">
            <option value="all"        ${shopSettings.browseMode==='all'       ?'selected':''}>All Products (category filter)</option>
            <option value="category"   ${shopSettings.browseMode==='category'  ?'selected':''}>Browse by Category</option>
            <option value="collection" ${shopSettings.browseMode==='collection'?'selected':''}>Browse by Collection</option>
          </select>
        </div>
        <div style="margin-bottom:14px">
          <span class="fl">📣 Announcement Banner</span>
          <input class="fi" id="ss-announcement" value="${shopSettings.announcement||''}" placeholder="e.g. Free delivery this week! 🎉">
        </div>
        <button class="btn btn-p" onclick="saveShopSettingsForm()" style="width:100%">💾 Save Settings</button>
      </div>

      <!-- Marquee editor -->
      <div style="background:var(--white);border-radius:16px;padding:16px;box-shadow:var(--shadow);border:1.5px solid var(--grey2)">
        <div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:6px">🏷️ Ticker Text</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px">The scrolling text strip below the hero. Use ✦ to separate items.</div>
        <textarea class="fi" id="ss-marquee" style="width:100%;min-height:70px;resize:vertical;font-size:12px;line-height:1.7">${shopSettings.marquee||''}</textarea>
        <button class="btn btn-p" onclick="saveMarquee()" style="width:100%;margin-top:10px">💾 Save Ticker</button>
      </div>

      <!-- WA message template -->
      <div style="background:var(--white);border-radius:16px;padding:16px;box-shadow:var(--shadow);border:1.5px solid var(--grey2)">
        <div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:6px">💬 WhatsApp Reply Template</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Used when you tap "WhatsApp" on an order. Variables: {name} {orderNum} {items} {total} {status}</div>
        <textarea class="fi" id="ss-waTemplate" style="width:100%;min-height:100px;resize:vertical;font-size:12px;line-height:1.7">${shopSettings.waTemplate||''}</textarea>
        <button class="btn btn-p" onclick="saveWaTemplate()" style="width:100%;margin-top:10px">💾 Save Template</button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════
// DESIGN TAB
// ═══════════════════════════════════════════════════
function _smRenderDesign(){
  const heroImg = shopSettings.heroImage||'';
  return `
    <div style="background:var(--white);border-radius:16px;padding:16px;box-shadow:var(--shadow);border:1.5px solid var(--grey2)">
      <div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:14px">🎨 Shop Appearance</div>

      <div style="margin-bottom:14px">
        <span class="fl">Small Text Above Title</span>
        <input class="fi" id="ss-eyebrow" value="${shopSettings.eyebrow||''}" placeholder="RA Jemle LB · Wholesale Beauty">
      </div>
      <div style="margin-bottom:14px">
        <span class="fl">Hero Title</span>
        <input class="fi" id="ss-title" value="${shopSettings.title||''}" placeholder="Our Collection">
      </div>
      <div style="margin-bottom:18px">
        <span class="fl">Hero Subtitle</span>
        <input class="fi" id="ss-heroSub" value="${shopSettings.heroSub||''}" placeholder="Pick your favourites — by piece or by dozen">
      </div>

      <div style="margin-bottom:18px">
        <span class="fl">Hero Banner Image</span>
        <div style="margin-top:8px">
          ${heroImg?`
            <div style="position:relative;width:100%;height:120px;border-radius:12px;overflow:hidden;margin-bottom:10px">
              <img src="${heroImg}" style="width:100%;height:100%;object-fit:cover">
              <button onclick="removeHeroImage()" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);border:none;color:white;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit">✕ Remove</button>
            </div>
          `:`
            <div style="width:100%;height:80px;border-radius:12px;border:2px dashed var(--grey2);display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:10px;color:var(--muted);font-size:12px;gap:4px">
              <span style="font-size:24px">🖼️</span>No banner yet
            </div>
          `}
          <label style="cursor:pointer">
            <input type="file" accept="image/*" style="display:none" onchange="uploadHeroImage(this)">
            <div class="btn btn-s" style="font-size:12px;padding:9px 16px;display:inline-flex;align-items:center;gap:6px">📷 ${heroImg?'Replace':'Upload'} Banner</div>
          </label>
        </div>
      </div>

      <button class="btn btn-p" onclick="saveShopDesignForm()" style="width:100%">💾 Save Design</button>
    </div>
  `;
}

// ═══════════════════════════════════════════════════
// SAVE FUNCTIONS
// ═══════════════════════════════════════════════════
async function saveShopSettingsForm(){
  shopSettings.whatsapp     = document.getElementById('ss-whatsapp').value.trim();
  shopSettings.browseMode   = document.getElementById('ss-browseMode').value;
  shopSettings.announcement = document.getElementById('ss-announcement').value.trim();
  await saveShopSettings();
  showToast('Settings saved ✅');
}

async function saveMarquee(){
  shopSettings.marquee = document.getElementById('ss-marquee').value.trim();
  await saveShopSettings();
  showToast('Ticker saved ✅');
}

async function saveWaTemplate(){
  shopSettings.waTemplate = document.getElementById('ss-waTemplate').value.trim();
  await saveShopSettings();
  showToast('Template saved ✅');
}

async function saveShopDesignForm(){
  shopSettings.eyebrow = document.getElementById('ss-eyebrow').value.trim();
  shopSettings.title   = document.getElementById('ss-title').value.trim();
  shopSettings.heroSub = document.getElementById('ss-heroSub').value.trim();
  await saveShopSettings();
  showToast('Design saved ✅');
}

// ═══════════════════════════════════════════════════
// PUBLISH
// ═══════════════════════════════════════════════════
async function publishShopToFirebase(){
  const btn = document.getElementById('publish-btn');
  const statusEl = document.getElementById('publish-status');
  const setStatus = (msg,color='rgba(255,255,255,0.7)')=>{ if(statusEl) statusEl.innerHTML=`<span style="color:${color}">${msg}</span>`; };
  if(btn){ btn.disabled=true; btn.textContent='⏳ Publishing...'; }
  setStatus('🖼️ Compressing images...');
  try {
    const total = products.length;
    const publishProducts = [];
    for(let i=0;i<total;i++){
      const p = products[i];
      const cp = {...p};
      if(p.photo) cp.photo = await compressImage(p.photo);
      if(p.variants&&p.variants.length){
        cp.variants = await Promise.all(p.variants.map(async v=>{
          const cv={...v}; if(v.photo) cv.photo=await compressImage(v.photo,280,0.6); return cv;
        }));
      }
      publishProducts.push(cp);
      if(btn) btn.textContent=`⏳ ${i+1}/${total}...`;
    }
    setStatus('☁️ Uploading...');
    const shopData = {
      products: publishProducts,
      settings: {...shopSettings, shopName: SHOP_NAME},
      collections: collections||[],
      publishedAt: new Date().toISOString()
    };
    const res = await fetch(`${FB_DB_URL}/shop.json`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(shopData)});
    if(!res.ok) throw new Error(`Firebase error ${res.status}`);
    shopSettings.lastPublished = new Date().toISOString();
    await saveShopSettings();
    try{ localStorage.setItem('blossom_shop_cache',JSON.stringify(shopData)); }catch(e){}
    showToast('✅ Shop published! Customers can see it now.');
    setStatus('✅ Published just now','rgba(76,175,125,0.9)');
  } catch(e){
    showToast('❌ Publish failed — check connection','err');
    setStatus(`❌ ${e.message}`,'rgba(224,82,99,0.9)');
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='🌐 Publish Shop'; }
  }
}

// ═══════════════════════════════════════════════════
// MISC
// ═══════════════════════════════════════════════════
function getShopURL(){ return SHOP_URL; }

function previewBrandColor(val){
  const lbl=document.getElementById('ss-color-label'); const prv=document.getElementById('ss-color-preview');
  if(lbl)lbl.textContent=val; if(prv)prv.style.background=val;
}

function pickPresetColor(hex){
  const inp=document.getElementById('ss-brandColor'); if(inp) inp.value=hex;
  previewBrandColor(hex);
  document.querySelectorAll('[id^="preset-"]').forEach(el=>el.style.border='2.5px solid transparent');
  const pid=document.getElementById('preset-'+hex.replace('#','')); if(pid) pid.style.border='2.5px solid var(--ink)';
}

function uploadHeroImage(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=async(e)=>{ shopSettings.heroImage=e.target.result; await saveShopSettings(); renderShopManager(); };
  reader.readAsDataURL(file);
}

async function removeHeroImage(){ shopSettings.heroImage=''; await saveShopSettings(); renderShopManager(); }

function renderShopProductList(){
  // Legacy function — kept for compatibility
  return _smBuildVisList();
}

async function toggleProductShopVisible(productId, visible){
  const p=products.find(x=>x.id===productId); if(!p) return;
  p.shopVisible=visible;
  await saveProducts();
  document.getElementById('sm-vis-list').innerHTML = _smBuildVisList();
}

async function setAllShopVisible(visible){
  products.forEach(p=>p.shopVisible=visible);
  await saveProducts();
  renderShopManager();
}

function copyShopLink(){ navigator.clipboard.writeText(getShopURL()).then(()=>showToast('Link copied! 🔗')).catch(()=>showToast('Copy failed','err')); }
function shareShopLink(){ if(navigator.share){ navigator.share({title:SHOP_NAME,url:getShopURL()}).catch(()=>copyShopLink()); }else{ copyShopLink(); } }
function previewShop(){ window.open(getShopURL(),'_blank'); }
async function saveProductShopFlag(){ try{ await _idbPut('biz_products',products); }catch(e){} }
