// SUPABASE
const SUPABASE_URL = 'https://gcjkmbwkztzpfbledjeg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjamttYndrenR6cGZibGVkamVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDkyMzAsImV4cCI6MjA5NjY4NTIzMH0.Ge2noXmmbBDt5PEPz1d_5lMJZoO5v0gSPAuQzh-YVS0';
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// MOCK DATA FALLBACKS (Supabase takes priority for products)
let products = [];
let dbCategories = [];

const reviews = [
  { id: 1, name: 'Sarah M.', rating: 5, text: "Literally the best brownies I've ever had in my life. The crackly top is to die for!", productName: 'Classic Fudge Brownie', avatar: 'S' },
  { id: 2, name: 'Rahul K.', rating: 5, text: "Ordered the gift box for my wife's birthday. The packaging was premium and taste was out of this world.", productName: 'Hola Brownie Box', avatar: 'R' },
  { id: 3, name: 'Ananya P.', rating: 4, text: "The salted caramel one is my absolute favorite. Perfectly balanced and not overly sweet.", productName: 'Salted Caramel Swirl', avatar: 'A' }
];

const moods = [
  { id: 'craving', label: 'Chocolate Craving' },
  { id: 'sweet', label: 'Something Sweet' },
  { id: 'gift', label: 'Gift for Someone' },
  { id: 'latenight', label: 'Late Night Treat' },
  { id: 'party', label: 'Party Box' },
  { id: 'indulgence', label: 'Premium Indulgence' }
];

// STATE
let cart = [];
let builderBoxSize = 4;
let builderSelections = {}; // { id: qty }
let activeMood = 'craving';

// INIT
async function runInit() {
  await fetchSupabaseData();
  logAnalytics();

  initLoadingScreen();
  initNavbar();
  renderFeaturedProducts();
  renderMoods();
  renderMoodProducts();
  initFreshFromOven();
  renderReviews();
  initCart();
  initBuilder();
  initPremiumInteractions();
}

async function fetchSupabaseData() {
  try {
    const { data: items } = await sbClient.from('items').select('*').eq('is_available', true).order('title');
    const { data: cats } = await sbClient.from('categories').select('*').order('name');

    if (cats) dbCategories = cats;
    if (items) {
      products = items.map(dbItem => {
        const badge = dbItem.best_seller ? 'Bestseller' : '';
        const catInfo = dbCategories.find(c => c.id === dbItem.category_id);
        return {
          id: dbItem.id,
          name: dbItem.title,
          desc: dbItem.description || '',
          price: dbItem.price,
          image: dbItem.image_url || 'https://images.unsplash.com/photo-1606822291583-04e4cbef4809?w=800',
          badge: badge,
          category: catInfo ? catInfo.name : 'Classic',
          reviews: Math.floor(Math.random() * 200) + 50,
          rating: (4 + Math.random()).toFixed(1)
        };
      });
    }
  } catch (e) {
    console.warn('Supabase fetch failed, UI will render empty state.', e);
  }
}

// ANALYTICS
function detectReferrerSource() {
  const ref = document.referrer || '';
  if (!ref) return 'direct';
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    if (host.includes('wa.me') || host.includes('whatsapp')) return 'whatsapp';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('facebook') || host.includes('fb.com')) return 'facebook';
    if (host.includes('google')) return 'google';
    return host;
  } catch (_) { return 'direct'; }
}

async function logAnalytics() {
  try {
    sbClient.from('traffic_sources').insert({ source: detectReferrerSource(), visited_at: new Date().toISOString() }).then();
    sbClient.from('page_views').insert({ viewed_at: new Date().toISOString() }).then();
  } catch (_) { }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();
}

// LOADING SCREEN
function initLoadingScreen() {
  setTimeout(() => {
    const loader = document.getElementById('loadingScreen');
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 500);
  }, 1600);
}

// NAVBAR SCROLL & MENU
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  });

  mobileBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
    if (mobileMenu.classList.contains('open')) {
      mobileBtn.innerHTML = '<i class="ph ph-x"></i>';
    } else {
      mobileBtn.innerHTML = '<i class="ph ph-list"></i>';
    }
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      mobileBtn.innerHTML = '<i class="ph ph-list"></i>';
    });
  });
}

// UI HELPERS
function createProductCard(product) {
  const badgeHTML = product.badge ? `<div class="badge">${product.badge}</div>` : '';
  const starsHTML = Array(5).fill('★').join('') + `<span>(${product.reviews})</span>`;

  return `
    <div class="product-card" onclick="openProductModal('${product.id}')">
      <div class="pc-img-wrap">
        <img src="${product.image}" alt="${product.name}" class="pc-img" loading="lazy">
        <div class="pc-overlay"></div>
        ${badgeHTML}
        <button class="pc-wishlist" onclick="event.stopPropagation();"><i class="ph ph-heart"></i></button>
        <div class="pc-quick-view"><i class="ph ph-eye"></i> Quick View</div>
      </div>
      <div class="pc-content">
        <div class="pc-stars">${starsHTML}</div>
        <h3 class="pc-title">${product.name}</h3>
        <p class="pc-desc">${product.desc}</p>
        <div class="pc-footer">
          <div class="pc-price">₹${product.price}</div>
          <button class="pc-add" onclick="event.stopPropagation(); addToCart('${product.id}')">
            <i class="ph ph-shopping-bag"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// RENDERERS
function renderFeaturedProducts() {
  const grid = document.getElementById('featuredGrid');
  const featured = products.slice(0, 3);
  grid.innerHTML = featured.map(createProductCard).join('');

  // animate in
  setTimeout(() => {
    grid.querySelectorAll('.product-card').forEach((el, i) => {
      setTimeout(() => el.classList.add('loaded'), i * 100);
    });
    attachTilt(grid.querySelectorAll('.product-card'));
  }, 300);
}

window.viewFullMenu = function () {
  const grid = document.getElementById('featuredGrid');
  grid.innerHTML = products.map(createProductCard).join('');

  // Animate in the new ones
  setTimeout(() => {
    grid.querySelectorAll('.product-card:not(.loaded)').forEach((el, i) => {
      setTimeout(() => el.classList.add('loaded'), i * 50);
    });
    attachTilt(grid.querySelectorAll('.product-card'));
  }, 50);

  // Hide the buttons after clicking
  document.querySelectorAll('button[onclick="viewFullMenu()"]').forEach(b => b.style.display = 'none');
}

function renderMoods() {
  const container = document.getElementById('moodPillContainer');
  container.innerHTML = moods.map(mood => `
    <button class="mood-pill ${mood.id === activeMood ? 'active' : ''}" data-mood="${mood.id}">
      ${mood.label}
    </button>
  `).join('');

  container.querySelectorAll('.mood-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeMood = e.target.dataset.mood;
      renderMoods();
      renderMoodProducts();
    });
  });
}

function renderMoodProducts() {
  const grid = document.getElementById('moodGrid');

  // Simple mock logic
  let filtered = [];
  if (activeMood === 'craving') filtered = products.slice(0, 3);
  else if (activeMood === 'sweet') filtered = [products[1], products[3], products[4]];
  else if (activeMood === 'gift') filtered = [products[5], products[2], products[0]];
  else if (activeMood === 'latenight') filtered = [products[0], products[4]];
  else if (activeMood === 'party') filtered = [products[5], products[4], products[3]];
  else filtered = products.slice(3, 6);

  filtered = filtered.filter(Boolean);
  grid.innerHTML = filtered.map(createProductCard).join('');

  setTimeout(() => {
    grid.querySelectorAll('.product-card').forEach((el, i) => {
      setTimeout(() => el.classList.add('loaded'), i * 100);
    });
    attachTilt(grid.querySelectorAll('.product-card'));
  }, 50);
}

// FRESH FROM OVEN PARALLAX
function initFreshFromOven() {
  const section = document.getElementById('story');
  const visual = document.getElementById('storyVisual');

  window.addEventListener('scroll', () => {
    const rect = section.getBoundingClientRect();
    const windowH = window.innerHeight;

    // check if in view
    if (rect.top <= windowH && rect.bottom >= 0) {
      const totalDist = windowH + rect.height;
      const currentDist = windowH - rect.top;
      const progress = currentDist / totalDist;

      const moveX = (progress * 150) - 50;
      visual.querySelector('.baking-tray').style.transform = `translate(${moveX}px, 0) rotateY(-15deg) rotateX(10deg) rotateZ(-5deg)`;
    }
  });
}

// BUILDER LOGIC
function initBuilder() {
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const b = e.target.closest('.size-btn');
      document.querySelectorAll('.size-btn').forEach(bb => bb.classList.remove('active'));
      b.classList.add('active');
      builderBoxSize = parseInt(b.dataset.size);
      builderSelections = {}; // reset
      renderBuilderFlavors();
      renderBuilderSummary();
    });
  });

  document.getElementById('addBoxToCartBtn').addEventListener('click', () => {
    // mock adding box to cart
    cart.push({
      id: 'box_' + Date.now(),
      name: `Custom Box (${builderBoxSize}pcs)`,
      price: getBuilderPrice(),
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1621582455850-252bbbc0ee73?w=300'
    });
    updateCartIcon();
    builderSelections = {};
    renderBuilderFlavors();
    renderBuilderSummary();
    document.getElementById('cartDrawerOverlay').classList.add('open');
    renderCartDrawer();
  });

  renderBuilderFlavors();
  renderBuilderSummary();
}

function getBuilderCount() {
  return Object.values(builderSelections).reduce((a, b) => a + b, 0);
}

function getBuilderPrice() {
  if (builderBoxSize === 4) return 600;
  if (builderBoxSize === 6) return 850;
  return 1600;
}

function renderBuilderFlavors() {
  const container = document.getElementById('builderFlavors');
  const isFull = getBuilderCount() >= builderBoxSize;
  const flavors = products; // Allow all flavors in builder

  document.getElementById('builderCountBadge').innerText = `${getBuilderCount()} / ${builderBoxSize} Selected`;

  container.innerHTML = flavors.map(flavor => {
    const qty = builderSelections[flavor.id] || 0;
    return `
      <div class="builder-item ${qty > 0 ? 'selected' : ''}">
        <img src="${flavor.image}" alt="${flavor.name}">
        <div class="builder-item-info">
          <h4>${flavor.name}</h4>
        </div>
        <div class="qty-control">
          <button onclick="builderUpdateQty('${flavor.id}', -1)" ${qty === 0 ? 'disabled' : ''}><i class="ph ph-minus"></i></button>
          <span>${qty}</span>
          <button onclick="builderUpdateQty('${flavor.id}', 1)" ${isFull ? 'disabled' : ''}><i class="ph ph-plus"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

window.builderUpdateQty = function (id, delta) {
  const current = builderSelections[id] || 0;
  const isFull = getBuilderCount() >= builderBoxSize;

  if (delta > 0 && isFull) return;
  if (delta < 0 && current === 0) return;

  const next = current + delta;
  if (next <= 0) delete builderSelections[id];
  else builderSelections[id] = next;

  renderBuilderFlavors();
  renderBuilderSummary();
}

function renderBuilderSummary() {
  const sizeLabel = document.getElementById('summarySizeLabel');
  const summaryList = document.getElementById('summaryList');
  const summaryPrice = document.getElementById('summaryPrice');
  const addBtn = document.getElementById('addBoxToCartBtn');

  sizeLabel.innerText = builderBoxSize;
  summaryPrice.innerText = `₹${getBuilderPrice()}`;

  const count = getBuilderCount();
  const isFull = count >= builderBoxSize;

  if (count === 0) {
    summaryList.innerHTML = `
      <div class="empty-summary">
        <i class="ph ph-plus-circle"></i>
        <p>Select flavors to fill your box</p>
      </div>
    `;
  } else {
    // list out
    let listHTML = '<ul class="summary-list">';
    for (let id in builderSelections) {
      const flavor = products.find(p => p.id == id);
      if (!flavor) continue;
      listHTML += `<li><span><strong>${builderSelections[id]} ×</strong> ${flavor.name}</span></li>`;
    }
    listHTML += '</ul>';
    summaryList.innerHTML = listHTML;
  }

  addBtn.disabled = !isFull;
  addBtn.innerHTML = isFull ? '<i class="ph ph-check"></i> Add to Cart' : 'Select More Flavors';
}

// REVIEWS
function renderReviews() {
  const grid = document.getElementById('reviewGrid');
  grid.innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="rc-stars">${'★'.repeat(r.rating)}</div>
      <p class="rc-text">"${r.text}"</p>
      <div class="rc-author">
        <div class="rc-avatar">${r.avatar}</div>
        <div class="rc-author-info">
          <h4>${r.name}</h4>
          <p>${r.productName}</p>
        </div>
      </div>
    </div>
  `).join('');

  // Intersection observer for animation
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('loaded');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  grid.querySelectorAll('.review-card').forEach(el => observer.observe(el));
}

// PRODUCT MODAL
let modalActiveQty = 1;
let modalActiveProduct = null;

window.openProductModal = function (id) {
  modalActiveProduct = products.find(p => p.id === id);
  if (!modalActiveProduct) return;
  modalActiveQty = 1;

  document.getElementById('modalImg').src = modalActiveProduct.image;

  const badge = document.getElementById('modalBadge');
  if (modalActiveProduct.badge) { badge.style.display = 'block'; badge.innerText = modalActiveProduct.badge; }
  else { badge.style.display = 'none'; }

  document.getElementById('modalStars').innerHTML = '★'.repeat(5) + ` <span>(${modalActiveProduct.reviews} reviews)</span>`;
  document.getElementById('modalCat').innerText = modalActiveProduct.category;
  document.getElementById('modalTitle').innerText = modalActiveProduct.name;
  document.getElementById('modalDesc').innerText = modalActiveProduct.desc;

  // mock ingredients
  const ings = ['Single-Origin Cocoa', 'Organic Butter', 'Dark Chocolate'];
  document.getElementById('modalIngredients').innerHTML = ings.map(i => `<span class="ing-tag">${i}</span>`).join('');

  updateModalPrice();

  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

document.getElementById('closeModalBtn').addEventListener('click', closeProductModal);
document.getElementById('productModal').addEventListener('click', (e) => {
  if (e.target.id === 'productModal') closeProductModal();
});

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = 'auto';
}

document.getElementById('modalQtyInc').addEventListener('click', () => { modalActiveQty++; updateModalPrice(); });
document.getElementById('modalQtyDec').addEventListener('click', () => { if (modalActiveQty > 1) { modalActiveQty--; updateModalPrice(); } });

function updateModalPrice() {
  document.getElementById('modalQtyVal').innerText = modalActiveQty;
  document.getElementById('modalPrice').innerText = '₹' + (modalActiveProduct.price * modalActiveQty);
  document.getElementById('modalAddToCart').innerHTML = `<i class="ph ph-shopping-bag"></i> Add to Box • ₹${modalActiveProduct.price * modalActiveQty}`;
}

document.getElementById('modalAddToCart').addEventListener('click', () => {
  addToCart(modalActiveProduct.id, modalActiveQty);
  closeProductModal();
  document.getElementById('cartDrawerOverlay').classList.add('open');
});

// CART
function initCart() {
  document.getElementById('openCartBtn').addEventListener('click', () => {
    renderCartDrawer();
    document.getElementById('cartDrawerOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  document.getElementById('closeCartBtn').addEventListener('click', closeCart);
  document.getElementById('cartDrawerOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'cartDrawerOverlay') closeCart();
  });
}

function closeCart() {
  document.getElementById('cartDrawerOverlay').classList.remove('open');
  document.body.style.overflow = 'auto';
}

window.addToCart = function (id, qty = 1) {
  const p = products.find(x => x.id === id);
  const existing = cart.find(x => x.id === id);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ ...p, quantity: qty });
  }
  updateCartIcon();
  renderCartDrawer();
}

window.updateCartQty = function (id, delta) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(x => x.id !== id);
  }
  updateCartIcon();
  renderCartDrawer();
}

window.removeFromCart = function (id) {
  cart = cart.filter(x => x.id !== id);
  updateCartIcon();
  renderCartDrawer();
}

function updateCartIcon() {
  const count = cart.reduce((a, b) => a + b.quantity, 0);
  const badge = document.getElementById('cartCountBadge');
  badge.innerText = count;
  if (count > 0) badge.classList.add('active');
  else badge.classList.remove('active');
}

function renderCartDrawer() {
  const list = document.getElementById('cartItemsList');
  const subtotalEl = document.getElementById('cartSubtotal');
  const totalEl = document.getElementById('cartTotal');

  if (cart.length === 0) {
    list.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-mute);">Your box is empty.</div>`;
    subtotalEl.innerText = '₹0';
    totalEl.innerText = '₹0';
    return;
  }

  list.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <div class="cart-item-price">₹${item.price}</div>
        <div class="cart-item-actions">
          <div class="qty-control">
            <button onclick="updateCartQty('${item.id}', -1)"><i class="ph ph-minus"></i></button>
            <span>${item.quantity}</span>
            <button onclick="updateCartQty('${item.id}', 1)"><i class="ph ph-plus"></i></button>
          </div>
          <button class="cart-item-remove" onclick="removeFromCart('${item.id}')"><i class="ph ph-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');

  const subtotal = cart.reduce((a, b) => a + (b.price * b.quantity), 0);
  subtotalEl.innerText = '₹' + subtotal;
  totalEl.innerText = '₹' + (subtotal + 50);
}

// ===== PREMIUM INTERACTION LAYER =====
// 3D tilt, magnetic buttons, scroll reveal, ambient cursor glow.
function initPremiumInteractions() {
  const isTouch = window.matchMedia('(hover: none)').matches;

  // Scroll reveal for any .reveal element on the page
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal, .reveal-scale').forEach(el => revealObserver.observe(el));

  // Re-observe any late-rendered reveal elements
  window.__holaRevealObserver = revealObserver;

  if (isTouch) return; // skip pointer-driven effects on touch devices

  // Ambient cursor glow follow
  const glow = document.getElementById('cursorGlow');
  if (glow) {
    window.addEventListener('mousemove', (e) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    }, { passive: true });
  }

  // Magnetic buttons
  document.querySelectorAll('.btn').forEach(btn => {
    btn.classList.add('magnetic');
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.35}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });

  // Tilt on gallery tiles too
  attachTilt(document.querySelectorAll('.gallery-tile'), 8);
}

// Attach a subtle 3D tilt-on-hover to a NodeList of cards
function attachTilt(nodeList, intensity = 10) {
  if (window.matchMedia('(hover: none)').matches) return;
  nodeList.forEach(card => {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = '1';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-py * intensity).toFixed(2)}deg) rotateY(${(px * intensity).toFixed(2)}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// ===== EXPERIENCE RELIABILITY LAYER =====
// Keeps commerce state between visits without changing the existing Supabase source of truth.
(() => {
  const CART_KEY = 'hola-brownie-cart-v2';
  const fallbackImage = 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=800&q=80';
  const toast = (message) => {
    const el = document.getElementById('siteToast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(window.__holaToastTimer);
    window.__holaToastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  };
  const saveCart = () => localStorage.setItem(CART_KEY, JSON.stringify(cart));
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (_) { cart = []; }

  const originalAdd = window.addToCart;
  window.addToCart = (id, qty = 1) => { originalAdd(id, qty); saveCart(); toast('Added to your brownie box'); };
  const originalQty = window.updateCartQty;
  window.updateCartQty = (id, delta) => { originalQty(id, delta); saveCart(); };
  const originalRemove = window.removeFromCart;
  window.removeFromCart = (id) => { originalRemove(id); saveCart(); toast('Removed from your box'); };

  document.addEventListener('error', (event) => {
    const image = event.target;
    if (image.tagName === 'IMG' && !image.matches('[data-logo]') && image.src !== fallbackImage) image.src = fallbackImage;
  }, true);

  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput = document.getElementById('productSearch');
  const searchResults = document.getElementById('searchResults');
  const closeSearch = () => { searchOverlay.hidden = true; document.body.style.overflow = ''; };
  const runSearch = () => {
    const q = searchInput.value.trim().toLowerCase();
    const matches = products.filter(p => `${p.name} ${p.desc} ${p.category}`.toLowerCase().includes(q));
    searchResults.innerHTML = q && matches.length ? matches.slice(0, 7).map(p => `<button class="search-result" data-id="${p.id}"><img src="${p.image}" alt=""><span><b>${p.name}</b><small>${p.category} · ₹${p.price}</small></span></button>`).join('') : q ? '<p>No brownies match that search. Try a flavour or mood.</p>' : '<p>Search by brownie, flavour or occasion.</p>';
    searchResults.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => { closeSearch(); openProductModal(button.dataset.id); }));
  };
  document.getElementById('openSearchBtn')?.addEventListener('click', () => { searchOverlay.hidden = false; document.body.style.overflow = 'hidden'; searchInput.focus(); runSearch(); });
  document.getElementById('closeSearchBtn')?.addEventListener('click', closeSearch);
  searchInput?.addEventListener('input', runSearch);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeSearch(); closeProductModal(); closeCart(); } });
  document.querySelector('.cart-checkout-btn')?.addEventListener('click', () => {
    if (!cart.length) return toast('Your brownie box is empty.');
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const lines = cart.map(item => `• ${item.name} × ${item.quantity} — ₹${item.price * item.quantity}`);
    const message = ['Hello Hola Brownie! I would like to place an order:', '', ...lines, '', `Subtotal: ₹${subtotal}`, 'Please confirm availability and delivery.'].join('\n');
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  });

  // Logo assets are optional until the final brand mark is supplied.
  document.querySelectorAll('[data-logo]').forEach(logo => {
    logo.addEventListener('load', () => {
      logo.style.display = 'block';
      logo.nextElementSibling?.classList.add('is-hidden');
    });
    logo.addEventListener('error', () => logo.style.display = 'none');
  });

  const lightbox = document.getElementById('galleryLightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  document.querySelectorAll('.gallery-tile').forEach(tile => tile.addEventListener('click', () => {
    lightboxImage.src = tile.dataset.image;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }));
  document.getElementById('closeLightbox')?.addEventListener('click', () => { lightbox.hidden = true; document.body.style.overflow = ''; });


  // A full 9-piece box gets its own tier instead of falling through to 12-piece pricing.
  const originalBuilderPrice = getBuilderPrice;
  getBuilderPrice = () => builderBoxSize === 9 ? 1200 : originalBuilderPrice();

  setTimeout(() => {
    if (!products.length) {
      document.querySelectorAll('#featuredGrid,#moodGrid').forEach(grid => grid.innerHTML = '<div class="empty-state"><i class="ph ph-cookie"></i><h3>We’re having trouble loading the brownies.</h3><p>Please check your connection and refresh to try again.</p></div>');
    }
    updateCartIcon();
    renderCartDrawer();
  }, 1800);
})();
