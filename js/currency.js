// ═══════════════════════════════════════════════════
// MULTI-CURRENCY SYSTEM  (js/currency.js)
// ═══════════════════════════════════════════════════
// Depends on: data.js, utils.js
// ═══════════════════════════════════════════════════

const CUR_DEFS = [
  { code:'USD', name:'US Dollar',        flag:'🇺🇸', defaultRate:1,       isBase:true  },
  { code:'LBP', name:'Lebanese Pound',   flag:'🇱🇧', defaultRate:89500               },
  { code:'CNY', name:'Chinese Yuan',     flag:'🇨🇳', defaultRate:7.25                },
  { code:'TRY', name:'Turkish Lira',     flag:'🇹🇷', defaultRate:32.5                },
  { code:'AED', name:'UAE Dirham',       flag:'🇦🇪', defaultRate:3.67                },
  { code:'EGP', name:'Egyptian Pound',   flag:'🇪🇬', defaultRate:48.5                },
  { code:'SYP', name:'Syrian Pound',     flag:'🇸🇾', defaultRate:13000               },
  { code:'IQD', name:'Iraqi Dinar',      flag:'🇮🇶', defaultRate:1310                },
];

// _r2 kept for backward compat (LBP rate used in invoices etc)
let _r2 = 89500;

function _applyRate(rate, label) {
  _r2 = rate;
  const f = rate.toLocaleString();
  const lbp1El = document.getElementById('lbp1');
  if(lbp1El) lbp1El.textContent = f; // dashboard hero pill — no suffix needed, unit shown separately
  // rt1 is a decorative dot in the hero pill — no text update needed
  const rp = document.getElementById('set-rate-preview');
  if(rp) rp.textContent = '1 USD = ' + f + ' LBP';
}

// Storage keys
const CUR_RATES_KEY   = 'blossom_cur_rates';
const CUR_HIST_KEY    = 'blossom_cur_hist';
const CUR_STATE_KEY   = 'blossom_cur_state';

function loadCurRates(){
  try { return JSON.parse(localStorage.getItem(CUR_RATES_KEY)||'{}'); } catch(_){ return {}; }
}
function loadCurHist(){
  try { return JSON.parse(localStorage.getItem(CUR_HIST_KEY)||'{}'); } catch(_){ return {}; }
}
function saveCurRates(rates){ localStorage.setItem(CUR_RATES_KEY, JSON.stringify(rates)); }
function saveCurHistStore(hist){ localStorage.setItem(CUR_HIST_KEY, JSON.stringify(hist)); }

function getCurRate(code){
  const rates = loadCurRates();
  if(rates[code] !== undefined) return rates[code];
  const def = CUR_DEFS.find(c=>c.code===code);
  return def ? def.defaultRate : 1;
}

// Convert any amount from one currency to another via USD
function convertCur(amount, from, to){
  if(from === to) return amount;
  const fromRate = getCurRate(from); // units per $1 USD
  const toRate   = getCurRate(to);
  const inUSD    = from === 'USD' ? amount : amount / fromRate;
  return to === 'USD' ? inUSD : inUSD * toRate;
}

function fmtCurAmount(amount, code){
  const bigCurs = ['LBP','SYP','IQD'];
  if(bigCurs.includes(code)){
    return amount.toLocaleString('en-US', {maximumFractionDigits:0});
  }
  if(code === 'USD') return amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function curSymbol(code){
  const syms = {USD:'$',LBP:'ل.ل',CNY:'¥',TRY:'₺',AED:'AED',EGP:'EGP',SYP:'SYP',IQD:'IQD'};
  return syms[code]||code;
}

// ── Render the 8 rate cards grid ──
let _curEditCode = 'LBP';

function renderCurGrid(){
  const grid = document.getElementById('cur-rates-grid');
  if(!grid) return;
  const hist = loadCurHist();
  const now  = Date.now();
  grid.innerHTML = CUR_DEFS.map(c => {
    const rate    = getCurRate(c.code);
    const cHist   = hist[c.code]||[];
    const lastTs  = cHist.length ? cHist[cHist.length-1].ts : null;
    const lastUpdate = lastTs ? new Date(lastTs).toLocaleDateString() : 'Default';
    const daysSince  = lastTs ? Math.floor((now-lastTs)/(1000*60*60*24)) : null;
    const isStale    = daysSince !== null && daysSince >= 14;
    const display    = c.isBase ? '$1.00' : fmtCurAmount(rate, c.code);
    const dotColor   = c.isBase ? 'var(--blue)' : isStale ? 'var(--amber)' : cHist.length ? 'var(--green)' : 'var(--grey2)';
    const staleTag   = isStale ? `<div style="font-size:9px;font-weight:800;color:var(--amber);margin-top:3px">⚠ ${daysSince}d old</div>` : '';
    return `
      <div class="cur-rate-card" onclick="curQuickEdit('${c.code}')" style="position:relative">
        <div class="cur-rate-dot" style="background:${dotColor}"></div>
        <div class="cur-rate-flag">${c.flag}</div>
        <div class="cur-rate-code">${c.code}</div>
        <div class="cur-rate-val">${c.isBase ? '$1.00' : '1 USD = '+display}</div>
        <div class="cur-rate-sub">${c.isBase ? 'Base currency' : lastTs ? 'Updated: '+lastUpdate : 'Default rate'}</div>
        ${staleTag}
      </div>`;
  }).join('');
}

function populateCurSelects(){
  // Only populate the history selector now (big converter removed)
  const opts = CUR_DEFS.map(c=>`<option value="${c.code}">${c.flag} ${c.code} — ${c.name}</option>`).join('');
  const hs = document.getElementById('cur-hist-sel');
  if(hs){ hs.innerHTML = opts; hs.value='LBP'; renderCurHistory(); }
}

// Legacy no-ops kept so showPage('currency') call doesn't crash
function runConverter(){}
function updateQuickLabel(){}
function swapConvCurrencies(){}
function setQuickAmount(){}
function getCurState(){ return {}; }
function saveCurState(){}

let _miniFrom = 'USD', _miniTo = 'LBP';

function curQuickEdit(code){
  const def = CUR_DEFS.find(c=>c.code===code);
  if(!def) return;
  // Set mini converter: USD → tapped currency (or reverse if USD tapped)
  _miniFrom = def.isBase ? 'LBP' : 'USD';
  _miniTo   = def.isBase ? 'USD' : code;
  miniRefreshUI();
  const card = document.getElementById('mini-conv-card');
  card.style.display = 'block';
  setTimeout(()=>{ card.scrollIntoView({behavior:'smooth',block:'start'}); document.getElementById('mini-amount')?.focus(); }, 100);
}

function miniRefreshUI(){
  const fromDef = CUR_DEFS.find(c=>c.code===_miniFrom);
  const toDef   = CUR_DEFS.find(c=>c.code===_miniTo);
  const rate    = getCurRate(_miniTo);
  document.getElementById('mini-conv-flag').textContent = toDef?.flag||'🌍';
  document.getElementById('mini-conv-title').textContent = _miniFrom+' → '+_miniTo;
  document.getElementById('mini-from-lbl').textContent   = _miniFrom;
  document.getElementById('mini-to-lbl').textContent     = _miniTo;
  const rateDisplay = _miniFrom==='USD' ? '1 USD = '+fmtCurAmount(rate,_miniTo)+' '+_miniTo
    : '1 '+_miniTo+' = '+fmtCurAmount(1/rate,'USD')+' USD';
  document.getElementById('mini-conv-rate-lbl').textContent = rateDisplay;
  const rateInp = document.getElementById('mini-rate-inp');
  if(rateInp){
    rateInp.placeholder = toDef?.isBase ? 'USD is the base' : 'New rate (units per $1 USD)';
    rateInp.disabled = !!toDef?.isBase;
    rateInp.value = '';
  }
  document.getElementById('mini-rate-preview').textContent = '';
  miniConvert();
}

function miniConvert(){
  const amt  = parseFloat(document.getElementById('mini-amount')?.value)||0;
  const res  = document.getElementById('mini-result');
  if(!res) return;
  if(!amt){ res.textContent='—'; return; }
  const fromRate = getCurRate(_miniFrom); // units per USD
  const toRate   = getCurRate(_miniTo);
  const inUSD = _miniFrom==='USD' ? amt : amt/fromRate;
  const result = _miniTo==='USD' ? inUSD : inUSD*toRate;
  res.textContent = fmtCurAmount(result, _miniTo)+' '+_miniTo;
}

function miniSwap(){
  [_miniFrom, _miniTo] = [_miniTo, _miniFrom];
  const amt = document.getElementById('mini-amount')?.value;
  miniRefreshUI();
  if(amt) document.getElementById('mini-amount').value = amt;
  miniConvert();
}

function miniSetAmt(v){ const el=document.getElementById('mini-amount'); if(el){el.value=v; miniConvert();} }

function miniRatePreview(){
  const val = parseFloat(document.getElementById('mini-rate-inp')?.value);
  const el  = document.getElementById('mini-rate-preview');
  if(!el) return;
  if(val&&val>0) el.textContent='1 USD = '+fmtCurAmount(val,_miniTo)+' '+_miniTo;
  else el.textContent='';
}

function miniSaveRate(){
  const code = _miniTo;
  const val  = parseFloat(document.getElementById('mini-rate-inp')?.value);
  const def  = CUR_DEFS.find(c=>c.code===code);
  if(def?.isBase){ showToast('USD is the base currency','err'); return; }
  if(!val||val<=0){ showToast('Enter a valid rate','err'); return; }
  const rates = loadCurRates();
  rates[code] = val;
  saveCurRates(rates); if(typeof markCurrencyUpdated==='function') markCurrencyUpdated();
  const hist = loadCurHist();
  if(!hist[code]) hist[code]=[];
  hist[code].push({rate:val, ts:Date.now()});
  if(hist[code].length>5) hist[code]=hist[code].slice(-5);
  saveCurHistStore(hist);
  if(code==='LBP') _applyRate(val,'Updated '+new Date().toLocaleDateString());
  renderCurGrid(); renderCurHistory(); runConverter();
  miniRefreshUI();
  showToast((def?.flag||'')+' '+code+' rate saved! ✅');
}


// ── History ──
function renderCurHistory(){
  const code   = document.getElementById('cur-hist-sel')?.value;
  const hist   = loadCurHist()[code]||[];
  const listEl = document.getElementById('cur-history-list');
  if(!listEl) return;
  if(!hist.length){
    listEl.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:14px 0">No history yet for '+code+'</div>';
    return;
  }
  const def = CUR_DEFS.find(c=>c.code===code);
  listEl.innerHTML = [...hist].reverse().map((h,i)=>`
    <div class="cur-hist-row">
      <div>
        <div class="cur-hist-rate">1 USD = ${fmtCurAmount(h.rate,code)} ${code}</div>
        <div class="cur-hist-date">${new Date(h.ts).toLocaleString()}</div>
      </div>
      ${i===0?'<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:4px;background:var(--green-soft);color:var(--green);letter-spacing:0.5px">CURRENT</span>':''}
    </div>`).join('');
}

// ── Init on page load ──
function initCurrency(){
  // Load saved LBP rate for backward compat
  try {
    const cached = JSON.parse(localStorage.getItem('cached_lbp_rate')||'null');
    if(cached && cached.rate){
      const rates = loadCurRates();
      if(!rates['LBP']){ rates['LBP']=cached.rate; saveCurRates(rates); if(typeof markCurrencyUpdated==='function') markCurrencyUpdated(); }
      _applyRate(cached.rate, 'Updated '+new Date(cached.ts).toLocaleDateString());
    } else {
      _applyRate(89500,'Default rate — tap to update');
    }
  } catch(_){ _applyRate(89500,'Default rate'); }

  // Also set _r2 from multi-cur store
  const rates = loadCurRates();
  if(rates['LBP']) _r2 = rates['LBP'];

  renderCurGrid();
  populateCurSelects();
  runConverter();
}

// old compat stubs
function saveManualRate(){ saveCurRate(); }
function convRatePreview(){ curRatePreview(); }
function convUSD(){ runConverter(); }
function convLBP(){ runConverter(); }
function refreshRate(){}

initCurrency();

function checkCurrencyUpdateReminder(){
  try {
    const lastUpdated = localStorage.getItem('biz_cur_last_updated');
    if(!lastUpdated) return;
    const days = Math.floor((Date.now() - parseInt(lastUpdated)) / 86400000);
    if(days >= 1){
      const el = document.getElementById('cur-update-reminder');
      if(el) el.innerHTML = `<div style="background:var(--amber-soft);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--amber);font-weight:600">⚠️ Rates last updated ${days} day${days>1?'s':''} ago — update for accuracy</div>`;
    }
  } catch(e){}
}

function markCurrencyUpdated(){
  localStorage.setItem('biz_cur_last_updated', Date.now().toString());
  checkCurrencyUpdateReminder();
}
