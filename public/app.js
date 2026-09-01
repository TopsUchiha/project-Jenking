/* ============================================================
   SMOKEYZ BBQ — SHARED FRONTEND LOGIC
   ============================================================ */

// esc() — Escape HTML entities to prevent XSS when injecting into innerHTML.
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// safeImg() — Only allow safe image URL schemes.
function safeImg(url, fallback) {
  fallback = fallback || '/images/product-placeholder.svg';
  if (typeof url !== 'string') return fallback;
  var trimmed = url.trim();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) return fallback;
  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed;
  return fallback;
}

function money(n) {
  var num = parseFloat(n);
  if (!Number.isFinite(num)) num = 0;
  return '$' + num.toFixed(2);
}

/* ── Mobile nav toggle ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      menu.classList.toggle('open');
      var expanded = menu.classList.contains('open');
      toggle.setAttribute('aria-expanded', String(expanded));
    });
  }
  updateCartBadge();
});

/* ============================================================
   CART (localStorage-backed)
   ============================================================ */
var CART_KEY = 'smokeyz_cart_v1';

function getCart() {
  try {
    var raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Could not save cart:', e);
  }
  updateCartBadge();
}

function addToCart(product, quantity, customizations) {
  quantity = Math.max(1, parseInt(quantity, 10) || 1);
  var items = getCart();

  // Build a unique key based on product + customization selections
  var customKey = customizations ? JSON.stringify(customizations) : '';
  var existing = items.find(function (i) {
    return i.product_id === product.id && (i.customKey || '') === customKey;
  });

  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: quantity,
      customizations: customizations || null,
      customKey: customKey
    });
  }

  saveCart(items);
  return items;
}

function removeFromCart(index) {
  var items = getCart();
  items.splice(index, 1);
  saveCart(items);
  return items;
}

function updateCartQuantity(index, quantity) {
  var items = getCart();
  if (!items[index]) return items;
  quantity = parseInt(quantity, 10);
  if (quantity < 1) {
    items.splice(index, 1);
  } else {
    items[index].quantity = quantity;
  }
  saveCart(items);
  return items;
}

function clearCart() {
  saveCart([]);
}

function cartCount() {
  return getCart().reduce(function (sum, i) { return sum + i.quantity; }, 0);
}

function cartSubtotal() {
  return getCart().reduce(function (sum, i) { return sum + (i.price * i.quantity); }, 0);
}

function updateCartBadge() {
  var badge = document.querySelector('.cart-badge');
  if (!badge) return;
  var count = cartCount();
  badge.textContent = String(count);
  badge.style.display = count > 0 ? 'flex' : 'none';
}

/* ============================================================
   API HELPERS
   ============================================================ */
async function apiGet(url) {
  var res = await fetch(url, { credentials: 'same-origin' });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

async function apiPost(url, body) {
  var res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body)
  });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

async function apiPut(url, body) {
  var res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body)
  });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

async function apiDelete(url) {
  var res = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

/* ============================================================
   FORM VALIDATION HELPERS
   ============================================================ */
function showFieldError(fieldId, message) {
  var group = document.getElementById(fieldId).closest('.form-group');
  if (!group) return;
  group.classList.add('invalid');
  var errEl = group.querySelector('.field-error');
  if (errEl) errEl.textContent = message;
}

function clearFieldError(fieldId) {
  var group = document.getElementById(fieldId).closest('.form-group');
  if (!group) return;
  group.classList.remove('invalid');
}

function clearAllFieldErrors(formEl) {
  formEl.querySelectorAll('.form-group.invalid').forEach(function (g) {
    g.classList.remove('invalid');
  });
}

function showFormMessage(msgEl, message, type) {
  msgEl.textContent = message;
  msgEl.className = 'form-msg show ' + type;
}

// Load featured products on homepage
document.addEventListener('DOMContentLoaded', function() {
  var featuredContainer = document.getElementById('featured-products');
  if (!featuredContainer) return;
  
  fetch('/api/products')
    .then(r => r.json())
    .then(data => {
      if (!data.products || data.products.length === 0) {
        featuredContainer.innerHTML = '<p style="text-align:center;grid-column:1/-1;">No smokers available yet. Check back soon!</p>';
        return;
      }
      
      var featured = data.products.slice(0, 4);
      featuredContainer.innerHTML = featured.map(p => `
        <div class="product-card">
          <div class="product-image">
            ${p.image_url ? '<img src="' + p.image_url + '" alt="' + p.name + '">' : '<div class="no-image">No Image</div>'}
          </div>
          <div class="product-info">
            <h3>${p.name}</h3>
            <p class="product-type">${p.type}</p>
            <p class="product-desc">${p.description.substring(0, 100)}...</p>
            <p class="product-price">$${parseFloat(p.price).toLocaleString()}</p>
            <a href="/product-detail.html?id=${p.id}" class="btn btn-primary">View Details</a>
          </div>
        </div>
      `).join('');
    })
    .catch(err => console.error('Error loading featured products:', err));
});
