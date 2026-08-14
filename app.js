// ============================================================
// HOLA BROWNIE — THE MENU
// Standalone page. Same Supabase project & WhatsApp number as
// the main site — this is a read-view on the same live data,
// not a second product database.
// ============================================================

const SUPABASE_URL = 'https://gcjkmbwkztzpfbledjeg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjamttYndrenR6cGZibGVkamVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDkyMzAsImV4cCI6MjA5NjY4NTIzMH0.Ge2noXmmbBDt5PEPz1d_5lMJZoO5v0gSPAuQzh-YVS0';
const WHATSAPP_NUMBER = '917902770041'; // same destination used on index.html
const CART_KEY = 'hola-brownie-cart-v2'; // shared with index.html's cart — one order, either page

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- STATE ----
let rawItems = [];        // every item, available or not
let categories = [];      // categories table rows
let cart = [];
let activeCategory = 'all';
let activePriceBucket = null; // { min, max } or null
let searchQuery = '';
let sortMode = 'recommended';
let priceBuckets = [];

let detailItem = null;
let detailQty = 1;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  loadCartFromStorage();
  updateOrderUI();
  wireStaticEvents();

  try {
    await fetchData();
    if (!rawItems.length) {
      renderEmptyMenuShell('Our menu is taking a little break.', 'Please check back soon.');
    } else {
      buildPriceBuckets();
      renderCategoryNav();
      renderPriceFilter();
      renderStats();
      renderSignature();
      renderCravingChips();
      applyFiltersAndRender();
    }
  } catch (err) {
    console.warn('Menu data failed to load:', err);
    renderFatalError();
  } finally {
    document.getElementById('mainContent').setAttribute('aria-busy', 'false');
    hideLoader();
  }

  initRevealObserver();
}

function hideLoader() {
  const loader = document.getElementById('menuLoader');
  setTimeout(() => {
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 500);
  }, 400);
}

async function fetchData() {
  const [itemsRes, catRes] = await Promise.all([
    sb.from('items').select('*').order('title'),
    sb.from('categories').select('*').order('name')
  ]);
  if (itemsRes.error) throw itemsRes.error;
  rawItems = itemsRes.data || [];
  categories = (catRes.data || []).filter(c => c.visible !== false);
}

function renderFatalError() {
  document.getElementById('mainContent').innerHTML = `
    <div class="empty-panel wrap" style="padding-top:140px;">
      <i class="ph ph-cloud-warning"></i>
      <h3>We're having trouble loading the menu.</h3>
      <p>Please check your connection and try again.</p>
      <button class="btn-ghost" id="retryLoadBtn">Retry</button>
    </div>`;
  document.getElementById('retryLoadBtn').addEventListener('click', () => window.location.reload());
}

function renderEmptyMenuShell(title, body) {
  document.getElementById('signatureSection').classList.add('is-hidden');
  document.getElementById('menuControls').classList.add('is-hidden');
  document.getElementById('cravingSection').classList.add('is-hidden');
  document.getElementById('statsStrip').classList.add('is-hidden');
  document.getElementById('menuList').innerHTML = `
    <div class="empty-panel">
      <i class="ph ph-cookie"></i>
      <h3>${title}</h3>
      <p>${body}</p>
    </div>`;
}

// ============================================================
// DERIVED DATA HELPERS
// ============================================================
function categoryName(id) {
  const c = categories.find(c => c.id === id);
  return c ? c.name : null;
}

function buildPriceBuckets() {
  const prices = rawItems.filter(i => i.is_available).map(i => i.price).filter(p => typeof p === 'number');
  const unique = [...new Set(prices)].sort((a, b) => a - b);
  if (unique.length < 4) { priceBuckets = []; return; }

  const sorted = [...prices].sort((a, b) => a - b);
  const t1 = sorted[Math.floor(sorted.length / 3)];
  const t2 = sorted[Math.floor((sorted.length * 2) / 3)];
  const round = n => Math.round(n / 10) * 10;
  const low = round(t1), high = round(t2);

  if (low <= sorted[0] || high <= low) { priceBuckets = []; return; }

  priceBuckets = [
    { label: `Under ₹${low}`, min: -Infinity, max: low },
    { label: `₹${low}–₹${high}`, min: low, max: high },
    { label: `₹${high}+`, min: high, max: Infinity }
  ];
}

// ============================================================
// RENDER: category nav
// ============================================================
function renderCategoryNav() {
  const usedCatIds = new Set(rawItems.map(i => i.category_id));
  const usable = categories.filter(c => usedCatIds.has(c.id));
  const nav = document.getElementById('categoryNav');

  const chips = [{ id: 'all', name: 'All' }, ...usable];
  nav.innerHTML = chips.map(c => `
    <button class="cat-btn ${activeCategory === c.id ? 'active' : ''}" data-cat="${c.id}" role="tab" aria-selected="${activeCategory === c.id}">
      ${c.icon ? c.icon + ' ' : ''}${escapeHtml(c.name)}
    </button>
  `).join('');

  nav.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      renderCategoryNav();
      applyFiltersAndRender();
    });
  });
}

// ============================================================
// RENDER: price filter
// ============================================================
function renderPriceFilter() {
  const wrap = document.getElementById('priceFilter');
  if (!priceBuckets.length) { wrap.classList.add('is-hidden'); return; }
  wrap.classList.remove('is-hidden');
  wrap.innerHTML = priceBuckets.map((b, i) => `
    <button class="price-chip ${activePriceBucket === i ? 'active' : ''}" data-idx="${i}">${b.label}</button>
  `).join('');
  wrap.querySelectorAll('.price-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      activePriceBucket = activePriceBucket === idx ? null : idx;
      renderPriceFilter();
      applyFiltersAndRender();
    });
  });
}

// ============================================================
// RENDER: stats strip
// ============================================================
function renderStats() {
  const available = rawItems.filter(i => i.is_available);
  const usedCatIds = new Set(rawItems.map(i => i.category_id));
  const catCount = categories.filter(c => usedCatIds.has(c.id)).length;

  document.getElementById('statsStrip').innerHTML = `
    <div class="stat-block"><strong>${available.length}</strong><span>Brownies</span></div>
    <div class="stat-block"><strong>${catCount}</strong><span>Categories</span></div>
    <div class="stat-block"><strong>Small Batch</strong><span>Every Day</span></div>
  `;
}

// ============================================================
// RENDER: signature treats (real best_seller field only)
// ============================================================
function renderSignature() {
  const section = document.getElementById('signatureSection');
  const featured = rawItems.filter(i => i.best_seller && i.is_available).slice(0, 6);
  if (!featured.length) { section.classList.add('is-hidden'); return; }
  section.classList.remove('is-hidden');

  document.getElementById('signatureGrid').innerHTML = featured.map(item => `
    <div class="sig-card reveal" data-id="${item.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(item.title)}">
      <div class="sig-star"><i class="ph-fill ph-star"></i> Bestseller</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description || '')}</p>
      <div class="sig-foot">
        <span class="sig-price">₹${item.price}</span>
        <span class="sig-add" data-quickadd="${item.id}" aria-hidden="true"><i class="ph ph-plus"></i></span>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.sig-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-quickadd]')) { quickAdd(e.target.closest('[data-quickadd]').dataset.quickadd); return; }
      openDetail(card.dataset.id);
    });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDetail(card.dataset.id); });
  });
}

// ============================================================
// FILTER + SORT + RENDER FULL LIST
// ============================================================
function getFilteredSortedItems() {
  let list = [...rawItems];

  if (activeCategory !== 'all') list = list.filter(i => i.category_id === activeCategory);

  if (activePriceBucket !== null && priceBuckets[activePriceBucket]) {
    const { min, max } = priceBuckets[activePriceBucket];
    list = list.filter(i => i.price >= min && i.price < max);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter(i => {
      const cat = (categoryName(i.category_id) || '').toLowerCase();
      return i.title.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q) || cat.includes(q);
    });
  }

  switch (sortMode) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'az': list.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'za': list.sort((a, b) => b.title.localeCompare(a.title)); break;
    default:
      // Recommended: available + bestsellers first, then original order
      list.sort((a, b) => (b.is_available - a.is_available) || ((b.best_seller ? 1 : 0) - (a.best_seller ? 1 : 0)));
  }

  return list;
}

function applyFiltersAndRender() {
  const list = getFilteredSortedItems();
  const listEl = document.getElementById('menuList');
  const countEl = document.getElementById('resultsCount');

  countEl.textContent = list.length === rawItems.length
    ? `${list.length} treats on the menu`
    : `${list.length} treat${list.length === 1 ? '' : 's'} found`;

  if (!list.length) {
    listEl.innerHTML = `
      <div class="empty-panel">
        <i class="ph ph-magnifying-glass"></i>
        <h3>Nothing matched that craving.</h3>
        <p>Try another brownie or browse all treats.</p>
        <button class="btn-ghost" id="showAllBtn">Show All Brownies</button>
      </div>`;
    document.getElementById('showAllBtn').addEventListener('click', () => {
      activeCategory = 'all'; activePriceBucket = null; searchQuery = '';
      document.getElementById('menuSearch').value = '';
      renderCategoryNav(); renderPriceFilter(); applyFiltersAndRender();
    });
    return;
  }

  listEl.innerHTML = list.map((item, i) => {
    const cat = categoryName(item.category_id);
    const num = String(i + 1).padStart(2, '0');
    const inCart = cart.find(c => c.id === item.id);
    return `
    <div class="menu-row reveal ${item.is_available ? '' : 'unavailable'}" data-id="${item.id}" role="listitem" tabindex="0">
      <span class="mr-num">${num}</span>
      <div class="mr-body">
        <h3>${escapeHtml(item.title)}
          ${item.best_seller ? '<span class="badge-mini badge-best">Bestseller</span>' : ''}
          ${!item.is_available ? '<span class="badge-mini badge-unavailable">Currently Unavailable</span>' : ''}
        </h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
        ${cat ? `<div class="mr-meta">${escapeHtml(cat)}</div>` : ''}
      </div>
      <div class="mr-price">₹${item.price}</div>
      <button class="mr-add ${inCart ? 'in-order' : ''}" data-add="${item.id}" ${!item.is_available ? 'disabled' : ''}>
        ${!item.is_available ? 'Unavailable' : inCart ? `In Order · ${inCart.quantity}` : '+ Add'}
      </button>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.menu-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]')) return;
      openDetail(row.dataset.id);
    });
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.target.closest('[data-add]')) openDetail(row.dataset.id); });
  });
  listEl.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); quickAdd(btn.dataset.add); });
  });

  initRevealObserver();
}

// ============================================================
// CRAVING DISCOVERY (derived from real categories)
// ============================================================
function renderCravingChips() {
  const usedCatIds = new Set(rawItems.map(i => i.category_id));
  const usable = categories.filter(c => usedCatIds.has(c.id));
  const wrap = document.getElementById('cravingChips');
  if (!usable.length) { document.getElementById('cravingSection').classList.add('is-hidden'); return; }

  wrap.innerHTML = usable.map(c => `<button class="craving-chip" data-cat="${c.id}">${c.icon ? c.icon + ' ' : ''}${escapeHtml(c.name)}</button>`).join('');
  wrap.querySelectorAll('.craving-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      wrap.querySelectorAll('.craving-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.cat;
      renderCategoryNav();
      applyFiltersAndRender();
      document.getElementById('cravingNote').textContent = `Showing your ${chip.textContent.trim()} favourites`;
      document.getElementById('fullMenu').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ============================================================
// PRODUCT DETAIL PANEL
// ============================================================
function openDetail(id) {
  const item = rawItems.find(i => i.id === id);
  if (!item) return;
  detailItem = item;
  detailQty = 1;

  document.getElementById('detailCat').textContent = categoryName(item.category_id) || '';
  document.getElementById('detailTitle').textContent = item.title;
  document.getElementById('detailDesc').textContent = item.description || '';
  document.getElementById('detailPrice').textContent = `₹${item.price}`;

  const badges = [];
  if (item.best_seller) badges.push('<span class="badge-mini badge-best">Bestseller</span>');
  if (!item.is_available) badges.push('<span class="badge-mini badge-unavailable">Currently Unavailable</span>');
  document.getElementById('detailBadges').innerHTML = badges.join('');

  const addBtn = document.getElementById('detailAddBtn');
  addBtn.disabled = !item.is_available;
  addBtn.textContent = item.is_available ? 'Add to Order' : 'Currently Unavailable';
  document.getElementById('detailQtyVal').textContent = detailQty;

  const overlay = document.getElementById('detailOverlay');
  overlay.classList.add('open');
  document.body.classList.add('no-scroll');
  document.getElementById('detailClose').focus();
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('open');
  document.body.classList.remove('no-scroll');
  detailItem = null;
}

// ============================================================
// MINI CART / ORDER SUMMARY
// ============================================================
function loadCartFromStorage() {
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (_) { cart = []; }
}
function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

function quickAdd(id) {
  const item = rawItems.find(i => i.id === id);
  if (!item || !item.is_available) return;
  addToCart(item, 1);
  showToast(`Added ${item.title} to your order`);
}

function addToCart(item, qty) {
  const existing = cart.find(c => c.id === item.id);
  if (existing) existing.quantity += qty;
  else cart.push({ id: item.id, name: item.title, price: item.price, quantity: qty, image: item.image_url || '' });
  saveCart();
  updateOrderUI();
  applyFiltersAndRender();
  renderSignature();
}

function updateCartQty(id, delta) {
  const line = cart.find(c => c.id === id);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) cart = cart.filter(c => c.id !== id);
  saveCart();
  updateOrderUI();
  applyFiltersAndRender();
}

function removeCartItem(id) {
  cart = cart.filter(c => c.id !== id);
  saveCart();
  updateOrderUI();
  applyFiltersAndRender();
}

function cartTotal() { return cart.reduce((sum, c) => sum + c.price * c.quantity, 0); }
function cartCount() { return cart.reduce((sum, c) => sum + c.quantity, 0); }

function updateOrderUI() {
  document.getElementById('navOrderCount').textContent = cartCount();

  const itemsEl = document.getElementById('orderItems');
  if (!cart.length) {
    itemsEl.innerHTML = `<div class="order-empty"><i class="ph ph-shopping-bag"></i><p>Your order is empty. Add a few treats from the menu.</p></div>`;
  } else {
    itemsEl.innerHTML = cart.map(c => `
      <div class="order-item">
        <div class="order-item-info">
          <h4>${escapeHtml(c.name)}</h4>
          <span>₹${c.price * c.quantity}</span>
        </div>
        <div class="order-item-ctrl">
          <button data-dec="${c.id}" aria-label="Decrease ${escapeHtml(c.name)} quantity"><i class="ph ph-minus"></i></button>
          <span>${c.quantity}</span>
          <button data-inc="${c.id}" aria-label="Increase ${escapeHtml(c.name)} quantity"><i class="ph ph-plus"></i></button>
        </div>
      </div>
    `).join('');
    itemsEl.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => updateCartQty(b.dataset.dec, -1)));
    itemsEl.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => updateCartQty(b.dataset.inc, 1)));
  }

  document.getElementById('orderTotal').textContent = `₹${cartTotal()}`;
  document.getElementById('orderWaBtn').disabled = cart.length === 0;
}

function openOrderPanel() {
  document.getElementById('orderPanel').classList.add('open');
  document.getElementById('orderOverlay').classList.add('open');
  document.body.classList.add('no-scroll');
}
function closeOrderPanel() {
  document.getElementById('orderPanel').classList.remove('open');
  document.getElementById('orderOverlay').classList.remove('open');
  document.body.classList.remove('no-scroll');
}

// ============================================================
// WHATSAPP
// ============================================================
function buildWhatsAppUrl(message) {
  return `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
}

function sendCartToWhatsApp() {
  if (!cart.length) return;
  const lines = cart.map(c => `• ${c.name} × ${c.quantity} — ₹${c.price * c.quantity}`);
  const message = ['Hi Hola Brownie! I\'d like to order:', '', ...lines, '', `Total: ₹${cartTotal()}`, 'Please confirm availability and delivery.'].join('\n');
  window.open(buildWhatsAppUrl(message), '_blank', 'noopener');
}

function genericWhatsAppGreeting() {
  return 'Hi Hola Brownie! I have a question about the menu.';
}

// ============================================================
// TOAST
// ============================================================
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('menuToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ============================================================
// REVEAL ON SCROLL
// ============================================================
let revealObserver;
function initRevealObserver() {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('in-view'); revealObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
  }
  document.querySelectorAll('.reveal:not(.in-view)').forEach(el => revealObserver.observe(el));
}

// ============================================================
// STATIC EVENTS
// ============================================================
function wireStaticEvents() {
  // Search (debounced)
  let searchTimer;
  document.getElementById('menuSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const val = e.target.value;
    searchTimer = setTimeout(() => { searchQuery = val; applyFiltersAndRender(); }, 280);
  });

  // Sort
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    sortMode = e.target.value;
    applyFiltersAndRender();
  });

  // Detail panel
  document.getElementById('detailClose').addEventListener('click', closeDetail);
  document.getElementById('detailOverlay').addEventListener('click', (e) => { if (e.target.id === 'detailOverlay') closeDetail(); });
  document.getElementById('detailQtyInc').addEventListener('click', () => { detailQty++; document.getElementById('detailQtyVal').textContent = detailQty; });
  document.getElementById('detailQtyDec').addEventListener('click', () => { if (detailQty > 1) { detailQty--; document.getElementById('detailQtyVal').textContent = detailQty; } });
  document.getElementById('detailAddBtn').addEventListener('click', () => {
    if (!detailItem || !detailItem.is_available) return;
    addToCart(detailItem, detailQty);
    showToast(`Added ${detailItem.title} × ${detailQty} to your order`);
    closeDetail();
  });

  // Order panel
  document.getElementById('openOrderBtn').addEventListener('click', openOrderPanel);
  document.getElementById('orderClose').addEventListener('click', closeOrderPanel);
  document.getElementById('orderOverlay').addEventListener('click', closeOrderPanel);
  document.getElementById('orderWaBtn').addEventListener('click', sendCartToWhatsApp);

  // Floating + footer WhatsApp — send the cart if it has items, else a friendly greeting
  const genericLink = () => buildWhatsAppUrl(cart.length ? '' : genericWhatsAppGreeting()) ;
  document.getElementById('floatWaBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (cart.length) sendCartToWhatsApp();
    else window.open(buildWhatsAppUrl(genericWhatsAppGreeting()), '_blank', 'noopener');
  });
  document.getElementById('footerWaLink').addEventListener('click', (e) => {
    e.preventDefault();
    if (cart.length) sendCartToWhatsApp();
    else window.open(buildWhatsAppUrl(genericWhatsAppGreeting()), '_blank', 'noopener');
  });

  // Escape closes whatever is open
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('detailOverlay').classList.contains('open')) closeDetail();
    if (document.getElementById('orderPanel').classList.contains('open')) closeOrderPanel();
  });
}

// ============================================================
// UTIL
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
