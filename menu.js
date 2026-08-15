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
let searchQuery = '';
let sortMode = 'recommended';

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
      renderCategoryNav();
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
  document.getElementById('menuControls').classList.add('is-hidden');
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
// FILTER + SORT + RENDER FULL LIST
// ============================================================
function getFilteredSortedItems() {
  let list = [...rawItems];

  if (activeCategory !== 'all') list = list.filter(i => i.category_id === activeCategory);

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
      activeCategory = 'all'; searchQuery = '';
      document.getElementById('menuSearch').value = '';
      renderCategoryNav(); applyFiltersAndRender();
    });
    return;
  }

  let num = 0;
  const rowHtml = (item) => {
    num++;
    const numStr = String(num).padStart(2, '0');
    const inCart = cart.find(c => c.id === item.id);
    return `
    <div class="menu-row reveal ${item.is_available ? '' : 'unavailable'}" data-id="${item.id}" role="listitem" tabindex="0">
      <span class="mr-num">${numStr}</span>
      <div class="mr-body">
        <h3>${escapeHtml(item.title)}
          ${item.best_seller ? '<span class="badge-mini badge-best">Bestseller</span>' : ''}
          ${!item.is_available ? '<span class="badge-mini badge-unavailable">Currently Unavailable</span>' : ''}
        </h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
      </div>
      <div class="mr-price">₹${item.price}</div>
      <button class="mr-add ${inCart ? 'in-order' : ''}" data-add="${item.id}" ${!item.is_available ? 'disabled' : ''}>
        ${!item.is_available ? 'Unavailable' : inCart ? `In Order · ${inCart.quantity}` : '+ Add'}
      </button>
    </div>`;
  };

  const usedCatIds = new Set(list.map(i => i.category_id));
  const orderedCats = categories.filter(c => usedCatIds.has(c.id));
  const uncategorized = list.filter(i => !orderedCats.some(c => c.id === i.category_id));

  let html = '';
  orderedCats.forEach(cat => {
    const items = list.filter(i => i.category_id === cat.id);
    if (!items.length) return;
    html += `<div class="menu-cat-heading reveal">${escapeHtml(cat.name)}</div>`;
    html += items.map(rowHtml).join('');
  });
  if (uncategorized.length) {
    if (orderedCats.length) html += `<div class="menu-cat-heading reveal">Menu</div>`;
    html += uncategorized.map(rowHtml).join('');
  }

  listEl.innerHTML = html;

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

  // Download menu (JPG)
  document.getElementById('downloadMenuBtn').addEventListener('click', handleDownloadMenu);

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
// DOWNLOAD MENU — clean, brand-styled JPG export(s)
// Rendered from a hidden export container, never a screenshot
// of the live page. Auto-splits into multiple JPGs if the menu
// is too long for one image; never cuts an item in half.
// ============================================================
const EXPORT_WIDTH = 1000;
const EXPORT_MAX_BODY_HEIGHT = 1450; // px, at 1x scale, per page body

async function handleDownloadMenu() {
  const btn = document.getElementById('downloadMenuBtn');
  if (btn.disabled) return;
  if (!rawItems.filter(i => i.is_available).length) {
    showToast('No menu items to download yet.');
    return;
  }

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Preparing…';

  try {
    await ensureHtml2Canvas();
    const nodes = buildExportNodes();
    const pages = paginateExportNodes(nodes);

    for (let i = 0; i < pages.length; i++) {
      const canvas = await renderExportPage(pages[i], i + 1, pages.length);
      const filename = pages.length > 1 ? `hola-brownie-menu-${i + 1}.jpg` : 'hola-brownie-menu.jpg';
      await downloadCanvasAsJpg(canvas, filename);
    }
    showToast(pages.length > 1 ? `Downloaded ${pages.length} menu images` : 'Menu downloaded');
  } catch (err) {
    console.warn('Menu download failed:', err);
    showToast('Could not generate the menu right now. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load html2canvas'));
    document.head.appendChild(s);
  });
}

// Build a flat list of category headers + items, in the same
// category order as the live menu, numbered continuously.
// Uses the currently loaded live product data — never a
// hard-coded list.
function buildExportNodes() {
  const available = rawItems.filter(i => i.is_available);
  const usedCatIds = new Set(available.map(i => i.category_id));
  const orderedCats = categories.filter(c => usedCatIds.has(c.id));

  const nodes = [];
  let counter = 1;

  orderedCats.forEach(cat => {
    const items = available.filter(i => i.category_id === cat.id);
    if (!items.length) return;
    nodes.push({ type: 'category', name: cat.name });
    items.forEach(item => nodes.push({ type: 'item', item, number: String(counter++).padStart(2, '0') }));
  });

  const uncategorized = available.filter(i => !orderedCats.some(c => c.id === i.category_id));
  if (uncategorized.length) {
    if (orderedCats.length) nodes.push({ type: 'category', name: 'Menu' });
    uncategorized.forEach(item => nodes.push({ type: 'item', item, number: String(counter++).padStart(2, '0') }));
  }

  return nodes;
}

function exportNodeHtml(node) {
  if (node.type === 'category') {
    return `<div class="export-category">${escapeHtml(node.name)}</div>`;
  }
  const item = node.item;
  return `
    <div class="export-item">
      <span class="export-num">${node.number}</span>
      <div class="export-item-main">
        <div class="export-item-row">
          <span class="export-item-name">${escapeHtml(item.title)}</span>
          <span class="export-item-price">₹${item.price}</span>
        </div>
        ${item.description ? `<p class="export-item-desc">${escapeHtml(item.description)}</p>` : ''}
      </div>
    </div>`;
}

// Measures real rendered height in a hidden container to decide
// where to split pages, so a product is never cut in half and a
// category heading never ends up alone at the bottom of a page.
function paginateExportNodes(nodes) {
  const measurer = document.createElement('div');
  measurer.className = 'export-page';
  Object.assign(measurer.style, { position: 'fixed', left: '-99999px', top: '0', width: EXPORT_WIDTH + 'px', padding: '0', visibility: 'hidden' });
  const body = document.createElement('div');
  body.className = 'export-body';
  measurer.appendChild(body);
  document.body.appendChild(measurer);

  const pages = [];
  let current = [];

  function heightOf(list) {
    body.innerHTML = list.map(exportNodeHtml).join('');
    return body.offsetHeight;
  }

  function pushPage() {
    // never leave a lone category heading at the end of a page
    if (current.length && current[current.length - 1].type === 'category') {
      const dangling = current.pop();
      pages.push(current);
      current = [dangling];
    } else {
      pages.push(current);
      current = [];
    }
  }

  nodes.forEach(node => {
    current.push(node);
    if (heightOf(current) > EXPORT_MAX_BODY_HEIGHT) {
      current.pop();
      if (!current.length) {
        // single node taller than the max on its own — keep it alone rather than lose it
        current.push(node);
      } else {
        pushPage();
        current.push(node);
      }
    }
  });
  if (current.length) pages.push(current);

  document.body.removeChild(measurer);
  return pages.length ? pages : [[]];
}

async function renderExportPage(pageNodes, pageNum, totalPages) {
  const container = document.createElement('div');
  container.className = 'export-page';
  Object.assign(container.style, { position: 'fixed', left: '-99999px', top: '0', width: EXPORT_WIDTH + 'px' });
  container.innerHTML = `
    <div class="export-header">
      <div class="export-brand">Hola Brownie</div>
      <div class="export-subtitle">The Menu</div>
    </div>
    <div class="export-body">${pageNodes.map(exportNodeHtml).join('')}</div>
    ${totalPages > 1 ? `<div class="export-footer">Page ${pageNum} of ${totalPages}</div>` : ''}
  `;
  document.body.appendChild(container);

  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  let canvas;
  try {
    canvas = await window.html2canvas(container, { backgroundColor: '#FBF3EE', scale: 2, useCORS: true, logging: false });
  } finally {
    document.body.removeChild(container);
  }
  return canvas;
}

function downloadCanvasAsJpg(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve();
    }, 'image/jpeg', 0.92);
  });
}

// ============================================================
// UTIL
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
