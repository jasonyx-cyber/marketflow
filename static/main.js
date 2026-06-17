/* ═══════════════════════════════════════════════════════════
   VaultX — main.js
   Features: live prices, sparklines, portfolio, alerts,
             news, pin, sort, persist, PWA countdown
   ═══════════════════════════════════════════════════════════ */

const REFRESH_INTERVAL = 30_000;

/* ── Coin maps ─────────────────────────────────────────── */
const COIN_SYMBOLS = {
  bitcoin:'BTC', ethereum:'ETH', solana:'SOL', binancecoin:'BNB',
  cardano:'ADA', ripple:'XRP', polkadot:'DOT', dogecoin:'DOGE',
  chainlink:'LINK', litecoin:'LTC', 'avalanche-2':'AVAX', uniswap:'UNI',
  stellar:'XLM', cosmos:'ATOM', monero:'XMR', 'matic-network':'MATIC',
  'shiba-inu':'SHIB', tron:'TRX', 'ethereum-classic':'ETC', filecoin:'FIL',
  near:'NEAR', algorand:'ALGO', 'internet-computer':'ICP', vechain:'VET',
  'the-sandbox':'SAND', decentraland:'MANA', 'axie-infinity':'AXS',
  fantom:'FTM', 'hedera-hashgraph':'HBAR', tezos:'XTZ', eos:'EOS',
  'bitcoin-cash':'BCH', zcash:'ZEC', dash:'DASH',
  'basic-attention-token':'BAT', 'the-graph':'GRT',
  'lido-dao':'LDO', aptos:'APT', arbitrum:'ARB', optimism:'OP',
  'injective-protocol':'INJ', sui:'SUI', 'the-open-network':'TON',
  pepe:'PEPE', floki:'FLOKI',
};
const COIN_ICONS = {
  bitcoin:'₿', ethereum:'Ξ', solana:'◎', binancecoin:'BNB',
  cardano:'₳', ripple:'XRP', polkadot:'●', dogecoin:'Ð',
  chainlink:'⬡', litecoin:'Ł',
};
const COIN_ALIASES = {
  btc:'bitcoin', eth:'ethereum', sol:'solana', bnb:'binancecoin',
  ada:'cardano', xrp:'ripple', dot:'polkadot', doge:'dogecoin',
  link:'chainlink', ltc:'litecoin', avax:'avalanche-2', uni:'uniswap',
  xlm:'stellar', atom:'cosmos', xmr:'monero', matic:'matic-network',
  shib:'shiba-inu', trx:'tron', etc:'ethereum-classic', fil:'filecoin',
  near:'near', algo:'algorand', icp:'internet-computer', vet:'vechain',
  sand:'the-sandbox', mana:'decentraland', axs:'axie-infinity',
  ftm:'fantom', hbar:'hedera-hashgraph', egld:'elrond-erd-2',
  theta:'theta-token', xtz:'tezos', eos:'eos', bch:'bitcoin-cash',
  zec:'zcash', dash:'dash', bat:'basic-attention-token', grt:'the-graph',
  ldo:'lido-dao', apt:'aptos', arb:'arbitrum', op:'optimism',
  inj:'injective-protocol', sui:'sui', ton:'the-open-network',
  pepe:'pepe', floki:'floki',
  polygon:'matic-network', avalanche:'avalanche-2', binance:'binancecoin',
  'shiba inu':'shiba-inu', 'bitcoin cash':'bitcoin-cash',
  'ethereum classic':'ethereum-classic', 'the graph':'the-graph',
  sandbox:'the-sandbox', hedera:'hedera-hashgraph',
};

function resolveCoins(input) {
  return input.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    .map(s => COIN_ALIASES[s] || s);
}

/* ── State ─────────────────────────────────────────────── */
let currentCurrency = localStorage.getItem('vx_currency') || 'usd';
let trackedCoins    = new Set(JSON.parse(localStorage.getItem('vx_coins') || '["bitcoin","ethereum","solana","binancecoin","cardano"]'));
let pinnedCoins     = new Set(JSON.parse(localStorage.getItem('vx_pinned') || '[]'));
let portfolio       = JSON.parse(localStorage.getItem('vx_portfolio') || '{}');
let alerts          = JSON.parse(localStorage.getItem('vx_alerts') || '[]');
let lastData        = {};
let currentSort     = 'default';
let modalCoin       = null;
let countdownVal    = 30;
let countdownTimer  = null;
let sparklineCache  = {};

/* ── DOM ───────────────────────────────────────────────── */
const gridEl         = document.getElementById('prices-grid');
const tickerInner    = document.getElementById('ticker-inner');
const errorBanner    = document.getElementById('error-banner');
const lastUpdatedEl  = document.getElementById('last-updated-time');
const cachedBadge    = document.getElementById('cached-badge');
const searchInput    = document.getElementById('coin-search');
const searchBtn      = document.getElementById('search-btn');
const liveLabel      = document.getElementById('live-label');
const countdownEl    = document.getElementById('refresh-countdown');
const currencySelect = document.getElementById('currency-select');
const portfolioTotal = document.getElementById('portfolio-total');
const portfolioChange= document.getElementById('portfolio-change');
const portfolioList  = document.getElementById('portfolio-list');
const alertsList     = document.getElementById('alerts-list');
const alertCoinSel   = document.getElementById('alert-coin');
const alertDirSel    = document.getElementById('alert-dir');
const alertPriceIn   = document.getElementById('alert-price');
const alertAddBtn    = document.getElementById('alert-add-btn');
const newsGrid       = document.getElementById('news-grid');
const modal          = document.getElementById('coin-modal');
const modalClose     = document.getElementById('modal-close');
const modalRemove    = document.getElementById('modal-remove-btn');
const modalPinBtn    = document.getElementById('modal-pin-btn');
const toast          = document.getElementById('alert-toast');
const toastMsg       = document.getElementById('alert-toast-msg');
const toastClose     = document.getElementById('alert-toast-close');

/* ── Init currency select ──────────────────────────────── */
currencySelect.value = currentCurrency;
currencySelect.addEventListener('change', () => {
  currentCurrency = currencySelect.value;
  localStorage.setItem('vx_currency', currentCurrency);
  fetchPrices();
});

/* ── Tabs ──────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'news') loadNews();
  });
});

/* ── Sort ──────────────────────────────────────────────── */
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    if (Object.keys(lastData).length) renderGrid(lastData);
  });
});

/* ── Search ────────────────────────────────────────────── */
searchBtn.addEventListener('click', addCoins);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') addCoins(); });

async function addCoins() {
  const raw = searchInput.value.trim().toLowerCase();
  if (!raw) return;
  const newCoins = resolveCoins(raw);
  searchBtn.textContent = 'Checking…';
  searchBtn.disabled = true;
  try {
    const res = await fetch(`/crypto?ids=${encodeURIComponent(newCoins.join(','))}&vs_currencies=${currentCurrency}`);
    const payload = await res.json();
    const valid = Object.keys(payload.data || {});
    if (!valid.length) {
      showError(`Not found: "${raw}". Use CoinGecko IDs or ticker symbols e.g. btc, eth, doge.`);
    } else {
      hideError();
      valid.forEach(c => trackedCoins.add(c));
      saveCoins();
      const invalid = newCoins.filter(c => !valid.includes(c));
      if (invalid.length) showError(`Added: ${valid.join(', ')}. Not found: ${invalid.join(', ')}.`);
      await fetchPrices();
      updateAlertCoinOptions();
    }
  } catch (err) { showError(`Error: ${err.message}`); }
  searchInput.value = '';
  searchBtn.textContent = 'Track';
  searchBtn.disabled = false;
}

/* ── Fetch prices ──────────────────────────────────────── */
async function fetchPrices() {
  setLiveState('fetching');
  try {
    const ids = [...trackedCoins].join(',');
    const res = await fetch(`/crypto?ids=${encodeURIComponent(ids)}&vs_currencies=${currentCurrency}`);
    const payload = await res.json();

    if (!res.ok || payload.status === 'error') {
      showError(`⚠️ ${payload.message || 'Failed to fetch prices.'} — Check your internet connection or try again shortly.`);
      setLiveState('error');
      // Clear skeletons so error is visible
      gridEl.querySelectorAll('.skeleton-card').forEach(el => el.remove());
      return;
    }

    hideError();
    lastData = payload.data || {};

    if (!Object.keys(lastData).length) {
      showError('⚠️ CoinGecko returned no data. You may be rate-limited — wait 60 seconds and refresh.');
      setLiveState('error');
      gridEl.querySelectorAll('.skeleton-card').forEach(el => el.remove());
      return;
    }

    renderGrid(lastData);
    renderTicker(lastData);
    updatePortfolio();
    checkAlerts(lastData);

    if (modalCoin && lastData[modalCoin]) openModal(modalCoin, lastData[modalCoin]);

    lastUpdatedEl.textContent = new Date(payload.timestamp).toLocaleTimeString();
    cachedBadge.style.display = payload.cached ? 'inline' : 'none';
    setLiveState('live');
    resetCountdown();
  } catch (err) {
    showError(`⚠️ Network error: ${err.message}`);
    setLiveState('error');
    gridEl.querySelectorAll('.skeleton-card').forEach(el => el.remove());
  }
}

/* ── Sort helper ───────────────────────────────────────── */
function sortedEntries(data) {
  let entries = Object.entries(data);
  // Pinned first
  const pinned = entries.filter(([c]) => pinnedCoins.has(c));
  const rest   = entries.filter(([c]) => !pinnedCoins.has(c));

  const sortFn = {
    'default':     null,
    'price-desc':  ([,a],[,b]) => (b[currentCurrency]||0) - (a[currentCurrency]||0),
    'price-asc':   ([,a],[,b]) => (a[currentCurrency]||0) - (b[currentCurrency]||0),
    'change-desc': ([,a],[,b]) => (b[`${currentCurrency}_24h_change`]||0) - (a[`${currentCurrency}_24h_change`]||0),
    'change-asc':  ([,a],[,b]) => (a[`${currentCurrency}_24h_change`]||0) - (b[`${currentCurrency}_24h_change`]||0),
    'mcap-desc':   ([,a],[,b]) => (b[`${currentCurrency}_market_cap`]||0) - (a[`${currentCurrency}_market_cap`]||0),
  }[currentSort];

  if (sortFn) { pinned.sort(sortFn); rest.sort(sortFn); }
  return [...pinned, ...rest];
}

/* ── Render grid ───────────────────────────────────────── */
function renderGrid(data) {
  const existing = {};
  gridEl.querySelectorAll('.coin-card[data-coin]').forEach(el => existing[el.dataset.coin] = el);
  gridEl.querySelectorAll('.skeleton-card').forEach(el => el.remove());

  const entries = sortedEntries(data);
  if (!entries.length) { gridEl.innerHTML = '<p style="color:var(--muted);font-family:var(--font-mono);font-size:.85rem;grid-column:1/-1">No data.</p>'; return; }

  const inSet = new Set(entries.map(([c]) => c));
  Object.keys(existing).forEach(c => { if (!inSet.has(c)) existing[c].remove(); });

  // Build all cards fresh into a fragment for correct ordering
  const fragment = document.createDocumentFragment();

  entries.forEach(([coin, vals], i) => {
    const price  = vals[currentCurrency];
    const change = vals[`${currentCurrency}_24h_change`];
    const mcap   = vals[`${currentCurrency}_market_cap`];
    const up     = (change ?? 0) >= 0;
    const sym    = COIN_SYMBOLS[coin] ?? coin.slice(0,4).toUpperCase();
    const icon   = COIN_ICONS[coin]   ?? coin[0].toUpperCase();

    if (existing[coin]) {
      // Update data in place
      const card = existing[coin];
      card.classList.toggle('pinned', pinnedCoins.has(coin));
      card.querySelector('.coin-price').textContent = formatPrice(price, currentCurrency);
      const ce = card.querySelector('.coin-change');
      ce.className = `coin-change ${up ? 'up' : 'down'}`;
      ce.textContent = `${up?'▲':'▼'} ${change != null ? Math.abs(change).toFixed(2)+'%' : 'N/A'}`;
      if (mcap != null) card.querySelector('.coin-mcap').textContent = 'MC ' + formatCompact(mcap);
      fragment.appendChild(card);
    } else {
      const card = document.createElement('div');
      card.className = 'coin-card' + (pinnedCoins.has(coin) ? ' pinned' : '');
      card.dataset.coin = coin;
      card.style.animationDelay = `${i * 40}ms`;
      card.innerHTML = `
        <div class="coin-card-top">
          <div class="coin-icon">${icon}</div>
          <div class="coin-symbol">${sym}</div>
        </div>
        <div class="coin-name">${coin}</div>
        <canvas class="card-sparkline" data-coin="${coin}" height="36"></canvas>
        <div class="coin-price">${formatPrice(price, currentCurrency)}</div>
        <div class="coin-footer">
          <div class="coin-change ${up?'up':'down'}">${up?'▲':'▼'} ${change != null ? Math.abs(change).toFixed(2)+'%' : 'N/A'}</div>
          <div class="coin-mcap">${mcap != null ? 'MC '+formatCompact(mcap) : ''}</div>
        </div>`;
      card.addEventListener('click', () => openModal(coin, lastData[coin] ?? vals));
      fragment.appendChild(card);
      // Load sparkline after appending
      setTimeout(() => loadSparkline(coin, card.querySelector('.card-sparkline')), 50);
    }
  });

  // Replace grid contents with sorted fragment
  gridEl.innerHTML = '';
  gridEl.appendChild(fragment);
}

/* ── Sparklines ────────────────────────────────────────── */
async function loadSparkline(coin, canvas) {
  if (!canvas) return;
  try {
    let prices;
    if (sparklineCache[coin]) {
      prices = sparklineCache[coin];
    } else {
      const res = await fetch(`/history?id=${coin}&vs_currency=${currentCurrency}`);
      const data = await res.json();
      prices = data.prices || [];
      sparklineCache[coin] = prices;
    }
    drawSparkline(canvas, prices, canvas.offsetHeight || 36);
  } catch {}
}

function drawSparkline(canvas, prices, h) {
  if (!prices.length) return;
  const w   = canvas.offsetWidth || 220;
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const up = prices[prices.length-1] >= prices[0];

  const px = (i) => (i / (prices.length-1)) * w;
  const py = (v)  => h - ((v - min) / range) * (h - 4) - 2;

  ctx.clearRect(0, 0, w, h);

  // Fill
  const fill = ctx.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, up ? 'rgba(0,229,160,0.18)' : 'rgba(255,61,90,0.18)');
  fill.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  prices.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
  ctx.lineTo(px(prices.length-1), h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  // Line
  ctx.beginPath();
  prices.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
  ctx.strokeStyle = up ? 'rgba(0,229,160,0.9)' : 'rgba(255,61,90,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/* ── Modal ─────────────────────────────────────────────── */
async function openModal(coin, vals) {
  modalCoin = coin;
  const price  = vals[currentCurrency];
  const change = vals[`${currentCurrency}_24h_change`];
  const mcap   = vals[`${currentCurrency}_market_cap`];
  const vol    = vals[`${currentCurrency}_24h_vol`];
  const up     = (change ?? 0) >= 0;
  const sym    = COIN_SYMBOLS[coin] ?? coin.slice(0,4).toUpperCase();

  document.getElementById('modal-icon').textContent  = COIN_ICONS[coin] ?? coin[0].toUpperCase();
  document.getElementById('modal-name').textContent  = coin;
  document.getElementById('modal-symbol').textContent = sym;
  document.getElementById('modal-price').textContent = formatPrice(price, currentCurrency);

  const changeEl = document.getElementById('modal-change');
  changeEl.className = `modal-change ${up?'up':'down'}`;
  changeEl.textContent = `${up?'▲':'▼'} ${change != null ? Math.abs(change).toFixed(2)+'%' : 'N/A'} (24h)`;

  modalPinBtn.className = 'pin-btn' + (pinnedCoins.has(coin) ? ' pinned' : '');
  modalPinBtn.textContent = pinnedCoins.has(coin) ? '★' : '☆';

  document.getElementById('modal-stats').innerHTML = `
    <div class="modal-stat"><div class="modal-stat-label">MARKET CAP</div><div class="modal-stat-value">${mcap != null ? formatCompact(mcap) : 'N/A'}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">24H CHANGE</div><div class="modal-stat-value" style="color:${up?'var(--up)':'var(--down)'}">${change != null ? (up?'+':'')+change.toFixed(2)+'%' : 'N/A'}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">24H VOLUME</div><div class="modal-stat-value">${vol != null ? formatCompact(vol) : 'N/A'}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">CURRENCY</div><div class="modal-stat-value">${currentCurrency.toUpperCase()}</div></div>`;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Draw sparkline in modal
  const sc = document.getElementById('sparkline-canvas');
  sc.width = sc.offsetWidth;
  try {
    let prices = sparklineCache[coin];
    if (!prices) {
      const res = await fetch(`/history?id=${coin}&vs_currency=${currentCurrency}`);
      const data = await res.json();
      prices = data.prices || [];
      sparklineCache[coin] = prices;
    }
    drawSparkline(sc, prices, 80);
  } catch {}

  // AI summary
  loadAISummary(coin, vals);
}

/* ── AI Summary ─────────────────────────────────────────── */
const aiCache = {};

async function loadAISummary(coin, vals) {
  const box  = document.getElementById('ai-summary-body');
  const price  = vals[currentCurrency];
  const change = vals[`${currentCurrency}_24h_change`];
  const mcap   = vals[`${currentCurrency}_market_cap`];

  // Show loading dots
  box.innerHTML = '<div class="ai-loading"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></div>';

  const refreshBtn = document.getElementById('ai-refresh-btn');
  refreshBtn.classList.add('spinning');

  const cacheKey = `${coin}_${currentCurrency}_${Math.floor(Date.now()/300000)}`; // 5min cache
  if (aiCache[cacheKey]) {
    typewriterEffect(box, aiCache[cacheKey]);
    refreshBtn.classList.remove('spinning');
    return;
  }

  try {
    const params = new URLSearchParams({
      coin,
      currency: currentCurrency,
      price: price?.toFixed(2) ?? 'N/A',
      change: change?.toFixed(2) ?? 'N/A',
      mcap: mcap ? formatCompact(mcap) : 'N/A',
    });
    const res  = await fetch(`/ai-summary?${params}`);
    const data = await res.json();

    if (data.status === 'ok') {
      aiCache[cacheKey] = data.summary;
      typewriterEffect(box, data.summary);
    } else {
      box.innerHTML = `<span class="ai-error">⚠ ${data.message || 'Could not generate summary.'}</span>`;
    }
  } catch (err) {
    box.innerHTML = `<span class="ai-error">⚠ Failed to connect to AI: ${err.message}</span>`;
  }
  refreshBtn.classList.remove('spinning');
}

function typewriterEffect(el, text, speed = 18) {
  el.innerHTML = '<span class="ai-text"></span><span class="ai-cursor"></span>';
  const textEl   = el.querySelector('.ai-text');
  const cursorEl = el.querySelector('.ai-cursor');
  let i = 0;
  const interval = setInterval(() => {
    textEl.textContent += text[i++];
    if (i >= text.length) {
      clearInterval(interval);
      cursorEl.style.display = 'none';
    }
  }, speed);
}

document.getElementById('ai-refresh-btn').addEventListener('click', () => {
  if (!modalCoin || !lastData[modalCoin]) return;
  // Bust cache for this coin
  const keyPrefix = `${modalCoin}_${currentCurrency}_`;
  Object.keys(aiCache).forEach(k => { if (k.startsWith(keyPrefix)) delete aiCache[k]; });
  loadAISummary(modalCoin, lastData[modalCoin]);
});

function closeModal() { modal.style.display = 'none'; document.body.style.overflow = ''; modalCoin = null; }
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

modalRemove.addEventListener('click', () => {
  if (!modalCoin) return;
  trackedCoins.delete(modalCoin);
  pinnedCoins.delete(modalCoin);
  delete portfolio[modalCoin];
  saveCoins(); savePinned(); savePortfolio();
  gridEl.querySelector(`.coin-card[data-coin="${modalCoin}"]`)?.remove();
  closeModal();
  updateAlertCoinOptions();
  updatePortfolio();
  if (trackedCoins.size) fetchPrices();
});

modalPinBtn.addEventListener('click', () => {
  if (!modalCoin) return;
  if (pinnedCoins.has(modalCoin)) { pinnedCoins.delete(modalCoin); modalPinBtn.className='pin-btn'; modalPinBtn.textContent='☆'; }
  else                             { pinnedCoins.add(modalCoin);    modalPinBtn.className='pin-btn pinned'; modalPinBtn.textContent='★'; }
  savePinned();
  renderGrid(lastData);
});

/* ── Ticker ────────────────────────────────────────────── */
function renderTicker(data) {
  const items = Object.entries(data).map(([coin, vals]) => {
    const price  = vals[currentCurrency];
    const change = vals[`${currentCurrency}_24h_change`];
    const up     = (change ?? 0) >= 0;
    const sym    = COIN_SYMBOLS[coin] ?? coin.slice(0,4).toUpperCase();
    return `<span class="ticker-item"><span class="t-name">${sym}</span><span>${formatPrice(price, currentCurrency)}</span><span class="${up?'t-up':'t-down'}">${up?'▲':'▼'} ${change!=null?Math.abs(change).toFixed(2)+'%':''}</span></span>`;
  }).join('');
  tickerInner.innerHTML = items + items;
}

/* ── Portfolio ─────────────────────────────────────────── */
function updatePortfolio() {
  if (!Object.keys(lastData).length) return;
  const rows = [];
  let total = 0, totalChange = 0;

  [...trackedCoins].forEach(coin => {
    const vals   = lastData[coin];
    if (!vals) return;
    const price  = vals[currentCurrency] || 0;
    const change = vals[`${currentCurrency}_24h_change`] || 0;
    const held   = parseFloat(portfolio[coin] || 0);
    const value  = held * price;
    total        += value;
    totalChange  += value * (change / 100);
    rows.push({ coin, price, change, held, value });
  });

  portfolioTotal.textContent = formatPrice(total, currentCurrency);
  const pUp = totalChange >= 0;
  portfolioChange.className = `portfolio-change ${pUp?'up':'down'}`;
  portfolioChange.textContent = `${pUp?'▲':'▼'} ${formatPrice(Math.abs(totalChange), currentCurrency)} today`;

  if (!rows.length) { portfolioList.innerHTML = '<p class="empty-msg">Track some coins first, then add your holdings here.</p>'; return; }

  portfolioList.innerHTML = rows.map(({ coin, price, change, held, value }) => {
    const up  = change >= 0;
    const sym = COIN_SYMBOLS[coin] ?? coin.slice(0,4).toUpperCase();
    const pct = total > 0 ? ((value/total)*100).toFixed(1) : '0.0';
    return `
      <div class="portfolio-row">
        <div class="portfolio-row-name">${coin} <span style="color:var(--muted);font-family:var(--font-mono);font-size:0.75rem">${sym}</span></div>
        <input class="portfolio-row-input" type="number" min="0" step="any"
          placeholder="Amount held"
          value="${held || ''}"
          data-coin="${coin}"
          oninput="updateHolding(this)" />
        <div class="portfolio-row-value">${held > 0 ? formatPrice(value, currentCurrency) : '—'}</div>
        <div class="portfolio-row-pct ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(change).toFixed(2)}%<br><span style="color:var(--muted)">${pct}%</span></div>
      </div>`;
  }).join('');
}

function updateHolding(input) {
  const coin = input.dataset.coin;
  const val  = parseFloat(input.value);
  if (isNaN(val) || val < 0) { delete portfolio[coin]; }
  else { portfolio[coin] = val; }
  savePortfolio();
  updatePortfolio();
}
window.updateHolding = updateHolding;

/* ── Alerts ────────────────────────────────────────────── */
function updateAlertCoinOptions() {
  alertCoinSel.innerHTML = '<option value="">Select coin…</option>' +
    [...trackedCoins].map(c => `<option value="${c}">${c}</option>`).join('');
}

alertAddBtn.addEventListener('click', () => {
  const coin  = alertCoinSel.value;
  const dir   = alertDirSel.value;
  const price = parseFloat(alertPriceIn.value);
  if (!coin || isNaN(price) || price <= 0) return;
  alerts.push({ id: Date.now(), coin, dir, price, triggered: false });
  saveAlerts();
  renderAlerts();
  alertPriceIn.value = '';
});

function renderAlerts() {
  if (!alerts.length) { alertsList.innerHTML = '<p class="empty-msg">No alerts set. Add one above.</p>'; return; }
  alertsList.innerHTML = alerts.map(a => `
    <div class="alert-row" data-id="${a.id}">
      <span class="a-coin">${a.coin}</span>
      <span class="a-dir">${a.dir}</span>
      <span class="a-price">${formatPrice(a.price, currentCurrency)}</span>
      <span class="a-status ${a.triggered?'triggered':'active'}">${a.triggered?'Triggered':'Active'}</span>
      <button class="alert-del-btn" onclick="deleteAlert(${a.id})">✕ Remove</button>
    </div>`).join('');
}
window.deleteAlert = (id) => { alerts = alerts.filter(a => a.id !== id); saveAlerts(); renderAlerts(); };

function checkAlerts(data) {
  let changed = false;
  alerts.forEach(a => {
    if (a.triggered) return;
    const vals  = data[a.coin];
    if (!vals) return;
    const price = vals[currentCurrency];
    const hit   = a.dir === 'above' ? price >= a.price : price <= a.price;
    if (hit) {
      a.triggered = true;
      changed = true;
      showToast(`🎯 ${a.coin.toUpperCase()} is ${a.dir} ${formatPrice(a.price, currentCurrency)}! Current: ${formatPrice(price, currentCurrency)}`);
      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification('VaultX Alert 🔔', { body: `${a.coin} hit ${formatPrice(a.price, currentCurrency)}` });
      }
    }
  });
  if (changed) { saveAlerts(); renderAlerts(); }
}

/* ── News ──────────────────────────────────────────────── */
let newsLoaded = false;
async function loadNews() {
  if (newsLoaded) return;
  try {
    const res  = await fetch('/news');
    const data = await res.json();
    const articles = data.articles || [];
    if (!articles.length) { newsGrid.innerHTML = '<p class="empty-msg">No news available.</p>'; return; }
    newsGrid.innerHTML = articles.map((a, i) => `
      <a class="news-card" href="${a.url}" target="_blank" rel="noopener" style="animation-delay:${i*40}ms">
        ${a.thumb ? `<img class="news-thumb" src="${a.thumb}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
        <div class="news-body">
          <div class="news-source">${a.source || 'Crypto News'}</div>
          <div class="news-title">${a.title}</div>
          ${a.description ? `<div class="news-desc">${a.description.slice(0,100)}…</div>` : ''}
          <div class="news-time">${a.published ? new Date(a.published * 1000).toLocaleDateString() : ''}</div>
        </div>
      </a>`).join('');
    newsLoaded = true;
  } catch (err) { newsGrid.innerHTML = `<p class="empty-msg">Failed to load news: ${err.message}</p>`; }
}

/* ── Toast ─────────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  toastMsg.textContent = msg;
  toast.style.display = 'flex';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 7000);
}
toastClose.addEventListener('click', () => { toast.style.display = 'none'; clearTimeout(toastTimer); });

/* ── Countdown ─────────────────────────────────────────── */
function resetCountdown() {
  countdownVal = 30;
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdownVal--;
    countdownEl.textContent = countdownVal + 's';
    if (countdownVal <= 0) { clearInterval(countdownTimer); }
  }, 1000);
}

/* ── Notification permission ───────────────────────────── */
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

/* ── PWA service worker ────────────────────────────────── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/static/sw.js').catch(() => {});
}

/* ── Persist helpers ───────────────────────────────────── */
function saveCoins()     { localStorage.setItem('vx_coins',     JSON.stringify([...trackedCoins])); }
function savePinned()    { localStorage.setItem('vx_pinned',    JSON.stringify([...pinnedCoins])); }
function savePortfolio() { localStorage.setItem('vx_portfolio', JSON.stringify(portfolio)); }
function saveAlerts()    { localStorage.setItem('vx_alerts',    JSON.stringify(alerts)); }

/* ── Format helpers ────────────────────────────────────── */
function formatPrice(value, currency) {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency.toUpperCase(),
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}
function formatCompact(value) {
  return new Intl.NumberFormat('en-US', { notation:'compact', maximumFractionDigits:1 }).format(value);
}

/* ── UI helpers ────────────────────────────────────────── */
function showError(msg) { errorBanner.textContent = msg; errorBanner.style.display = 'block'; }
function hideError()    { errorBanner.style.display = 'none'; }
function setLiveState(s) { liveLabel.textContent = s==='live'?'LIVE':s==='fetching'?'SYNCING':'ERROR'; }

/* ── Boot ──────────────────────────────────────────────── */
updateAlertCoinOptions();
renderAlerts();
fetchPrices();
setInterval(fetchPrices, REFRESH_INTERVAL);

/* ── Wallet ──────────────────────────────────────────────── */
let connectedWallet = JSON.parse(localStorage.getItem('vx_wallet') || 'null');

// Wallet tab button clicks
document.querySelectorAll('.wallet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.wallet;
    if (type === 'manual') {
      document.getElementById('manual-wallet-form').style.display = 'flex';
    } else {
      connectWallet(type, null);
    }
  });
});

document.getElementById('wallet-address-btn')?.addEventListener('click', () => {
  const addr = document.getElementById('wallet-address-input').value.trim();
  if (addr) connectWallet('manual', addr);
});

document.getElementById('wallet-disconnect')?.addEventListener('click', () => {
  connectedWallet = null;
  localStorage.removeItem('vx_wallet');
  document.getElementById('wallet-connected').style.display = 'none';
  document.getElementById('wallet-grid').style.display = 'grid';
  document.getElementById('manual-wallet-form').style.display = 'none';
});

function connectWallet(type, address) {
  const names = {
    metamask: 'MetaMask', walletconnect: 'WalletConnect',
    coinbase: 'Coinbase Wallet', phantom: 'Phantom',
    trustwallet: 'Trust Wallet', manual: 'Custom Address'
  };

  // For MetaMask/browser wallets, try real Web3 connection
  if (type === 'metamask' && window.ethereum) {
    window.ethereum.request({ method: 'eth_requestAccounts' })
      .then(accounts => {
        const addr = accounts[0];
        showConnectedWallet(type, names[type], addr);
        loadWalletBalances(addr);
      })
      .catch(err => alert(`MetaMask error: ${err.message}`));
    return;
  }

  // Phantom (Solana)
  if (type === 'phantom' && window.solana?.isPhantom) {
    window.solana.connect()
      .then(resp => {
        const addr = resp.publicKey.toString();
        showConnectedWallet(type, names[type], addr);
        loadWalletBalances(addr);
      })
      .catch(err => alert(`Phantom error: ${err.message}`));
    return;
  }

  // Manual or wallet not installed — show demo mode
  const demoAddr = address || generateDemoAddress(type);
  showConnectedWallet(type, names[type], demoAddr);
  loadWalletBalances(demoAddr, true); // demo mode
}

function generateDemoAddress(type) {
  if (type === 'phantom') {
    return Array.from({length: 44}, () => 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789'[Math.floor(Math.random()*58)]).join('');
  }
  return '0x' + Array.from({length: 40}, () => '0123456789abcdef'[Math.floor(Math.random()*16)]).join('');
}

function showConnectedWallet(type, name, address) {
  connectedWallet = { type, name, address };
  localStorage.setItem('vx_wallet', JSON.stringify(connectedWallet));

  document.getElementById('wallet-grid').style.display = 'none';
  document.getElementById('manual-wallet-form').style.display = 'none';
  document.getElementById('wallet-connected-name').textContent = name;
  document.getElementById('wallet-connected-addr').textContent =
    address.slice(0, 8) + '…' + address.slice(-6);
  document.getElementById('wallet-connected').style.display = 'block';
}

function loadWalletBalances(address, demo = false) {
  const container = document.getElementById('wallet-balances');

  // In demo mode, show tracked coins with fake balances
  const coins = [...trackedCoins].slice(0, 5);
  if (!coins.length || !Object.keys(lastData).length) {
    container.innerHTML = '<p class="empty-msg" style="padding:16px 0">Track some coins first to see balances here.</p>';
    return;
  }

  // Skeleton while "loading"
  container.innerHTML = coins.map(() => '<div class="skeleton-card" style="height:68px;"></div>').join('');

  setTimeout(() => {
    container.innerHTML = coins.map(coin => {
      const vals   = lastData[coin];
      if (!vals) return '';
      const price  = vals[currentCurrency] || 0;
      const change = vals[`${currentCurrency}_24h_change`] || 0;
      const up     = change >= 0;
      // Demo: random realistic balance
      const balance = demo ? parseFloat((Math.random() * 2 + 0.001).toFixed(6)) : 0;
      const value   = balance * price;
      const sym     = COIN_SYMBOLS[coin] ?? coin.slice(0,4).toUpperCase();
      const icon    = COIN_ICONS[coin] ?? coin[0].toUpperCase();

      return `
        <div class="wallet-balance-row">
          <div class="wb-left">
            <div class="wb-icon">${icon}</div>
            <div>
              <div class="wb-name">${coin}</div>
              <div class="wb-amount">${balance.toFixed(6)} ${sym}</div>
            </div>
          </div>
          <div>
            <div class="wb-value">${formatPrice(value, currentCurrency)}</div>
            <div class="wb-change ${up ? 'up' : 'down'}">${up?'▲':'▼'} ${Math.abs(change).toFixed(2)}%</div>
          </div>
        </div>`;
    }).join('');

    if (demo) {
      container.insertAdjacentHTML('beforeend',
        '<p style="font-family:var(--font-mono);font-size:0.68rem;color:var(--muted);padding:12px 4px;">⚠ Demo mode — connect a real wallet to see live balances.</p>');
    }
  }, 1200);
}

// Restore wallet on load
if (connectedWallet) {
  showConnectedWallet(connectedWallet.type, connectedWallet.name, connectedWallet.address);
  // Wait for price data before loading balances
  setTimeout(() => loadWalletBalances(connectedWallet.address, connectedWallet.type !== 'metamask' && connectedWallet.type !== 'phantom'), 2000);
}
