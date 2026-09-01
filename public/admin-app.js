/* ============================================================
   SMOKEYZ BBQ — ADMIN DASHBOARD LOGIC
   ============================================================ */

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(n) {
  var num = parseFloat(n);
  if (!Number.isFinite(num)) num = 0;
  return '$' + num.toFixed(2);
}

function safeImg(url, fallback) {
  fallback = fallback || '/images/product-placeholder.svg';
  if (typeof url !== 'string') return fallback;
  var trimmed = url.trim();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) return fallback;
  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed;
  return fallback;
}

async function apiGet(url) {
  var res = await fetch(url, { credentials: 'same-origin' });
  var data = await res.json().catch(function () { return {}; });
  if (res.status === 401) { showLogin(); throw new Error(data.error || 'Session expired.'); }
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
async function apiPost(url, body) {
  var res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body || {}) });
  var data = await res.json().catch(function () { return {}; });
  if (res.status === 401) { showLogin(); throw new Error(data.error || 'Session expired.'); }
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
async function apiPut(url, body) {
  var res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body || {}) });
  var data = await res.json().catch(function () { return {}; });
  if (res.status === 401) { showLogin(); throw new Error(data.error || 'Session expired.'); }
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
async function apiDelete(url) {
  var res = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
  var data = await res.json().catch(function () { return {}; });
  if (res.status === 401) { showLogin(); throw new Error(data.error || 'Session expired.'); }
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

/* ── Screen toggling ─────────────────────────────────────── */
function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('dashboardScreen').style.display = 'none';
}
function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboardScreen').style.display = 'flex';
}

/* ── Modal helpers ───────────────────────────────────────── */
function openModal(title, bodyHTML) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('modalBody').innerHTML = '';
}
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

/* ── Login flow ──────────────────────────────────────────── */
document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var msgEl = document.getElementById('loginMsg');
  var btn = document.getElementById('loginBtn');
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging in...';
  msgEl.className = 'form-msg';

  try {
    await apiPost('/admin/api/login', { email: email, password: password });
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    showDashboard();
    navigateTo('dashboard');
  } catch (err) {
    msgEl.textContent = err.message || 'Login failed.';
    msgEl.className = 'form-msg show error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async function () {
  try { await apiPost('/admin/api/logout', {}); } catch (e) {}
  showLogin();
});

/* ── Sidebar navigation ──────────────────────────────────── */
document.querySelectorAll('.sidebar-nav button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    navigateTo(btn.getAttribute('data-view'));
  });
});

function setActiveNav(view) {
  document.querySelectorAll('.sidebar-nav button').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-view') === view);
  });
}

function navigateTo(view) {
  setActiveNav(view);
  var renderers = {
    dashboard: renderDashboardView,
    products: renderProductsView,
    orders: renderOrdersView,
    customers: renderCustomersView,
    inventory: renderInventoryView,
    'payment-methods': renderPaymentMethodsView,
    messages: renderMessagesView,
    shipping: renderShippingView
  };
  (renderers[view] || renderDashboardView)();
}

/* ============================================================
   DASHBOARD VIEW
   ============================================================ */
async function renderDashboardView() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-header"><h1>Dashboard</h1></div><p style="color:var(--a-text-dim);">Loading...</p>';

  try {
    var data = await apiGet('/admin/api/dashboard');
    var stats = data.stats;

    var recentRows = data.recent_orders.map(function (o) {
      return '<tr><td>#' + String(o.id).padStart(6, '0') + '</td><td>' + esc(o.full_name) + '</td><td>' + money(o.total) + '</td>'
        + '<td><span class="badge badge-' + o.status + '">' + o.status.replace('_', ' ') + '</span></td>'
        + '<td><span class="badge badge-' + o.payment_status + '">' + o.payment_status + '</span></td></tr>';
    }).join('') || '<tr class="empty-row"><td colspan="5">No orders yet.</td></tr>';

    var lowStockRows = data.low_stock_alerts.map(function (p) {
      return '<tr><td>' + esc(p.name) + '</td><td>' + p.inventory + ' left</td></tr>';
    }).join('') || '<tr class="empty-row"><td colspan="2">All stock levels healthy.</td></tr>';

    main.innerHTML =
      '<div class="page-header"><h1>Dashboard</h1></div>'
      + '<div class="stats-grid">'
      + '<div class="stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">' + stats.total_orders + '</div></div>'
      + '<div class="stat-card"><div class="stat-label">Pending Payment</div><div class="stat-value">' + stats.pending_payment + '</div></div>'
      + '<div class="stat-card"><div class="stat-label">Total Revenue</div><div class="stat-value">' + money(stats.total_revenue) + '</div></div>'
      + '</div>'
      + '<div class="card"><h3>Recent Orders</h3><div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>' + recentRows + '</tbody></table></div></div>'
      + '<div class="card"><h3>Low Stock Alerts</h3><div class="table-wrap"><table><thead><tr><th>Product</th><th>Remaining</th></tr></thead><tbody>' + lowStockRows + '</tbody></table></div></div>';
  } catch (err) {
    main.innerHTML = '<div class="page-header"><h1>Dashboard</h1></div><p style="color:var(--a-error);">' + esc(err.message) + '</p>';
  }
}

/* ============================================================
   PRODUCTS VIEW
   ============================================================ */
var PRODUCT_TYPES = ['Barrel', 'Pellet', 'Hybrid', 'Offset', 'Kettle'];

async function renderProductsView() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-header"><h1>Products</h1><button class="btn btn-primary" id="addProductBtn">+ Add Product</button></div><p style="color:var(--a-text-dim);">Loading...</p>';

  try {
    var data = await apiGet('/admin/api/products');
    var rows = data.products.map(function (p) {
      return '<tr>'
        + '<td><img src="' + esc(safeImg(p.image_url)) + '" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:4px;"></td>'
        + '<td>' + esc(p.name) + '</td>'
        + '<td>' + esc(p.type) + '</td>'
        + '<td>' + money(p.price) + '</td>'
        + '<td>' + p.inventory + '</td>'
        + '<td><button class="btn btn-outline btn-sm" data-edit="' + p.id + '">Edit</button> <button class="btn btn-danger btn-sm" data-delete="' + p.id + '">Delete</button></td>'
        + '</tr>';
    }).join('') || '<tr class="empty-row"><td colspan="6">No products yet. Add your first one.</td></tr>';

    main.innerHTML =
      '<div class="page-header"><h1>Products</h1><button class="btn btn-primary" id="addProductBtn">+ Add Product</button></div>'
      + '<div class="card"><div class="table-wrap"><table><thead><tr><th>Image</th><th>Name</th><th>Type</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';

    document.getElementById('addProductBtn').addEventListener('click', function () { openProductModal(null); });
    main.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var product = data.products.find(function (p) { return p.id === parseInt(btn.getAttribute('data-edit'), 10); });
        openProductModal(product);
      });
    });
    main.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Delete this product? This cannot be undone.')) return;
        try {
          await apiDelete('/admin/api/products/' + btn.getAttribute('data-delete'));
          renderProductsView();
        } catch (err) {
          alert(err.message || 'Could not delete product.');
        }
      });
    });
  } catch (err) {
    main.innerHTML = '<div class="page-header"><h1>Products</h1></div><p style="color:var(--a-error);">' + esc(err.message) + '</p>';
  }
}

function openProductModal(product) {
  var isEdit = !!product;
  var customOptions = (product && product.customization_options) || [];

  var customRowsHTML = customOptions.map(function (group, i) {
    return '<div class="customizer-row" data-idx="' + i + '"><input type="text" class="custom-group-name" placeholder="Group name (e.g. Size)" value="' + esc(group.name) + '">'
      + '<input type="text" class="custom-group-opts" placeholder="Options, comma separated" value="' + esc((group.options || []).join(', ')) + '">'
      + '<button type="button" class="btn btn-danger btn-sm remove-custom-row">&times;</button></div>';
  }).join('');

  var bodyHTML =
    '<div id="productModalMsg" class="form-msg"></div>'
    + '<form id="productForm">'
    + '<div class="form-group"><label for="pName">Product Name</label><input type="text" id="pName" required minlength="2" maxlength="200" value="' + (product ? esc(product.name) : '') + '"></div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label for="pType">Type</label><select id="pType">' + PRODUCT_TYPES.map(function (t) { return '<option value="' + t + '"' + (product && product.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>'
    + '<div class="form-group"><label for="pPrice">Price (USD)</label><input type="number" id="pPrice" required min="0.01" step="0.01" value="' + (product ? product.price : '') + '"></div>'
    + '</div>'
    + '<div class="form-group"><label for="pInventory">Inventory (units in stock)</label><input type="number" id="pInventory" required min="0" step="1" value="' + (product ? product.inventory : '0') + '"></div>'
    + '<div class="form-group"><label for="pImage">Image URL</label><input type="text" id="pImage" placeholder="https://..." value="' + (product ? esc(product.image_url || '') : '') + '"></div>'
    + '<div id="uploadZone" style="border: 2px dashed #c4622d; border-radius: 8px; padding: 40px; text-align: center; background: #f5f3f0; cursor: pointer; transition: all 0.3s; margin: 20px 0;"><p style="color: #2a2a2a; font-weight: bold; margin: 0;">Drag and drop images or click to browse</p><small style="color: #666;">Max 5MB • PNG, JPG, GIF</small><input type="file" id="imageFileInput" accept="image/*" style="display: none;"><div id="uploadPreview" style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;"></div></div>'
    + '<div class="form-group"><label for="pDescription">Description</label><textarea id="pDescription" required minlength="10" maxlength="2000">' + (product ? esc(product.description) : '') + '</textarea></div>'
    + '<div class="form-group"><label>Customization Options</label><div id="customRows">' + customRowsHTML + '</div>'
    + '<button type="button" class="btn btn-outline btn-sm" id="addCustomRowBtn" style="margin-top:0.5rem;">+ Add Option Group</button></div>'
    + '<button type="submit" class="btn btn-primary btn-block" id="productSubmitBtn">' + (isEdit ? 'Save Changes' : 'Create Product') + '</button>'
    + '</form>';

  openModal(isEdit ? 'Edit Product' : 'Add Product', bodyHTML);
  initImageUpload(); // uploadZone only exists in the DOM now that the modal has rendered

  function addCustomRow(name, opts) {
    var wrap = document.getElementById('customRows');
    var div = document.createElement('div');
    div.className = 'customizer-row';
    div.innerHTML = '<input type="text" class="custom-group-name" placeholder="Group name (e.g. Size)" value="' + esc(name || '') + '">'
      + '<input type="text" class="custom-group-opts" placeholder="Options, comma separated" value="' + esc(opts || '') + '">'
      + '<button type="button" class="btn btn-danger btn-sm remove-custom-row">&times;</button>';
    wrap.appendChild(div);
    div.querySelector('.remove-custom-row').addEventListener('click', function () { div.remove(); });
  }

  document.getElementById('addCustomRowBtn').addEventListener('click', function () { addCustomRow('', ''); });
  document.querySelectorAll('.remove-custom-row').forEach(function (btn) {
    btn.addEventListener('click', function () { btn.closest('.customizer-row').remove(); });
  });

  document.getElementById('productForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msgEl = document.getElementById('productModalMsg');
    var submitBtn = document.getElementById('productSubmitBtn');

    var customization_options = [];
    document.querySelectorAll('#customRows .customizer-row').forEach(function (row) {
      var name = row.querySelector('.custom-group-name').value.trim();
      var opts = row.querySelector('.custom-group-opts').value.split(',').map(function (o) { return o.trim(); }).filter(Boolean);
      if (name && opts.length) customization_options.push({ name: name, options: opts });
    });

    var payload = {
      name: document.getElementById('pName').value.trim(),
      type: document.getElementById('pType').value,
      price: parseFloat(document.getElementById('pPrice').value),
      inventory: parseInt(document.getElementById('pInventory').value, 10),
      image_url: document.getElementById('pImage').value.trim(),
      description: document.getElementById('pDescription').value.trim(),
      customization_options: customization_options
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      if (isEdit) {
        await apiPut('/admin/api/products/' + product.id, payload);
      } else {
        await apiPost('/admin/api/products', payload);
      }
      closeModal();
      renderProductsView();
    } catch (err) {
      msgEl.textContent = err.message || 'Could not save product.';
      msgEl.className = 'form-msg show error';
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Product';
    }
  });
}

/* ============================================================
   ORDERS VIEW
   ============================================================ */
var ORDER_STATUSES = ['pending_payment', 'processing', 'built', 'shipped', 'delivered', 'cancelled'];
var PAYMENT_METHOD_TYPES = [
  { value: 'stripe', label: 'Stripe (Card)' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'chime', label: 'Chime' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' }
];

async function renderOrdersView(filterStatus) {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-header"><h1>Orders</h1></div><p style="color:var(--a-text-dim);">Loading...</p>';

  try {
    var url = '/admin/api/orders' + (filterStatus ? '?status=' + encodeURIComponent(filterStatus) : '');
    var data = await apiGet(url);

    var filterChips = ['', 'pending_payment', 'processing', 'built', 'shipped', 'delivered', 'cancelled'].map(function (s) {
      var label = s ? s.replace('_', ' ') : 'All';
      return '<button class="btn btn-sm ' + (filterStatus === s || (!filterStatus && !s) ? 'btn-primary' : 'btn-outline') + '" data-filter="' + s + '" style="text-transform:capitalize;">' + label + '</button>';
    }).join(' ');

    var rows = data.orders.map(function (o) {
      return '<tr>'
        + '<td>#' + String(o.id).padStart(6, '0') + '</td>'
        + '<td>' + esc(o.full_name) + '<br><span style="color:var(--a-text-dim); font-size:0.8125rem;">' + esc(o.email) + '</span></td>'
        + '<td>' + money(o.total) + '</td>'
        + '<td><span class="badge badge-' + o.status + '">' + o.status.replace('_', ' ') + '</span></td>'
        + '<td><span class="badge badge-' + o.payment_status + '">' + o.payment_status + '</span></td>'
        + '<td>' + new Date(o.created_at).toLocaleDateString() + '</td>'
        + '<td><button class="btn btn-outline btn-sm" data-view-order="' + o.id + '">View</button></td>'
        + '</tr>';
    }).join('') || '<tr class="empty-row"><td colspan="7">No orders found.</td></tr>';

    main.innerHTML =
      '<div class="page-header"><h1>Orders</h1></div>'
      + '<div style="margin-bottom:1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">' + filterChips + '</div>'
      + '<div class="card"><div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Payment</th><th>Date</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';

    main.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () { renderOrdersView(btn.getAttribute('data-filter') || null); });
    });
    main.querySelectorAll('[data-view-order]').forEach(function (btn) {
      btn.addEventListener('click', function () { openOrderModal(parseInt(btn.getAttribute('data-view-order'), 10)); });
    });
  } catch (err) {
    main.innerHTML = '<div class="page-header"><h1>Orders</h1></div><p style="color:var(--a-error);">' + esc(err.message) + '</p>';
  }
}

async function openOrderModal(orderId) {
  openModal('Order #' + String(orderId).padStart(6, '0'), '<p style="color:var(--a-text-dim);">Loading...</p>');

  try {
    var data = await apiGet('/admin/api/orders/' + orderId);
    var order = data.order;

    var itemsHTML = data.items.map(function (item) {
      var custom = item.customization_selections ? JSON.parse(item.customization_selections) : null;
      var customStr = custom ? Object.keys(custom).map(function (k) { return esc(k) + ': ' + esc(custom[k]); }).join(', ') : '';
      return '<tr><td>' + esc(item.product_name) + (customStr ? '<br><span style="color:var(--a-text-dim); font-size:0.8125rem;">' + customStr + '</span>' : '') + '</td><td>' + item.quantity + '</td><td>' + money(item.price_at_purchase * item.quantity) + '</td></tr>';
    }).join('');

    var statusOptions = ORDER_STATUSES.map(function (s) { return '<option value="' + s + '"' + (order.status === s ? ' selected' : '') + '>' + s.replace('_', ' ') + '</option>'; }).join('');
    var paymentOptions = ['unpaid', 'paid', 'refunded'].map(function (s) { return '<option value="' + s + '"' + (order.payment_status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    var methodOptions = PAYMENT_METHOD_TYPES.map(function (m) { return '<option value="' + m.value + '">' + m.label + '</option>'; }).join('');

    var bodyHTML =
      '<div id="orderModalMsg" class="form-msg"></div>'
      + '<p style="margin-bottom:1rem;"><strong>' + esc(order.full_name) + '</strong><br><span style="color:var(--a-text-dim);">' + esc(order.email) + ' &middot; ' + esc(order.phone) + '</span></p>'
      + '<p style="margin-bottom:1rem; color:var(--a-text-dim); font-size:0.875rem;">' + esc(order.address) + ', ' + esc(order.city) + ', ' + esc(order.state) + ' ' + esc(order.zip) + '</p>'
      + '<div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>' + itemsHTML + '</tbody></table></div>'
      + '<p style="text-align:right; margin:1rem 0; font-weight:700; font-size:1.125rem;">Total: ' + money(order.total) + '</p>'
      + '<div class="form-row">'
      + '<div class="form-group"><label for="orderStatus">Order Status</label><select id="orderStatus">' + statusOptions + '</select></div>'
      + '<div class="form-group"><label for="paymentStatus">Payment Status</label><select id="paymentStatus">' + paymentOptions + '</select></div>'
      + '</div>'
      + '<button class="btn btn-outline btn-block" id="updateOrderBtn" style="margin-bottom:1.5rem;">Update Status</button>'
      + '<div class="card" style="background:var(--a-bg);">'
      + '<h3>Send Payment Link</h3>'
      + '<div class="form-group"><label for="paymentMethodSelect">Payment Method</label><select id="paymentMethodSelect">' + methodOptions + '</select></div>'
      + '<button class="btn btn-primary btn-block" id="sendPaymentLinkBtn">Send Payment Link to Customer</button>'
      + '</div>';

    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalTitle').textContent = 'Order #' + String(order.id).padStart(6, '0');

    document.getElementById('updateOrderBtn').addEventListener('click', async function () {
      var msgEl = document.getElementById('orderModalMsg');
      var btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Updating...';
      try {
        await apiPut('/admin/api/orders/' + order.id, {
          status: document.getElementById('orderStatus').value,
          payment_status: document.getElementById('paymentStatus').value
        });
        msgEl.textContent = 'Order updated successfully.';
        msgEl.className = 'form-msg show success';
        renderOrdersView();
      } catch (err) {
        msgEl.textContent = err.message || 'Could not update order.';
        msgEl.className = 'form-msg show error';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Update Status';
      }
    });

    document.getElementById('sendPaymentLinkBtn').addEventListener('click', async function () {
      var msgEl = document.getElementById('orderModalMsg');
      var btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Sending...';
      try {
        await apiPost('/admin/api/send-payment-link', {
          order_id: order.id,
          payment_method: document.getElementById('paymentMethodSelect').value
        });
        msgEl.textContent = 'Payment link sent to customer.';
        msgEl.className = 'form-msg show success';
      } catch (err) {
        msgEl.textContent = err.message || 'Could not send payment link.';
        msgEl.className = 'form-msg show error';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send Payment Link to Customer';
      }
    });
  } catch (err) {
    document.getElementById('modalBody').innerHTML = '<p style="color:var(--a-error);">' + esc(err.message) + '</p>';
  }
}

/* ============================================================
   CUSTOMERS VIEW
   ============================================================ */
async function renderCustomersView() {
  var main = document.getElementById('mainContent');
  main.innerHTML =
    '<div class="page-header"><h1>Customers</h1></div>'
    + '<div class="form-group" style="max-width:320px;"><input type="search" id="customerSearch" placeholder="Search by name, email, or phone..."></div>'
    + '<div class="card"><div class="table-wrap" id="customersTableWrap"><p style="color:var(--a-text-dim);">Loading...</p></div></div>';

  async function loadCustomers(search) {
    var wrap = document.getElementById('customersTableWrap');
    try {
      var url = '/admin/api/customers' + (search ? '?search=' + encodeURIComponent(search) : '');
      var data = await apiGet(url);
      var rows = data.customers.map(function (c) {
        return '<tr><td>' + esc(c.full_name) + '</td><td>' + esc(c.email) + '</td><td>' + esc(c.phone) + '</td>'
          + '<td>' + esc(c.city) + ', ' + esc(c.state) + '</td>'
          + '<td><button class="btn btn-outline btn-sm" data-view-customer="' + c.id + '">View Orders</button></td></tr>';
      }).join('') || '<tr class="empty-row"><td colspan="5">No customers found.</td></tr>';

      wrap.innerHTML = '<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Location</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';

      wrap.querySelectorAll('[data-view-customer]').forEach(function (btn) {
        btn.addEventListener('click', function () { openCustomerModal(parseInt(btn.getAttribute('data-view-customer'), 10)); });
      });
    } catch (err) {
      wrap.innerHTML = '<p style="color:var(--a-error);">' + esc(err.message) + '</p>';
    }
  }

  var searchTimer = null;
  document.getElementById('customerSearch').addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    var val = e.target.value;
    searchTimer = setTimeout(function () { loadCustomers(val.trim()); }, 350);
  });

  loadCustomers();
}

async function openCustomerModal(customerId) {
  openModal('Customer Details', '<p style="color:var(--a-text-dim);">Loading...</p>');
  try {
    var data = await apiGet('/admin/api/customers/' + customerId);
    var c = data.customer;

    var ordersHTML = data.orders.map(function (o) {
      return '<tr><td>#' + String(o.id).padStart(6, '0') + '</td><td>' + money(o.total) + '</td>'
        + '<td><span class="badge badge-' + o.status + '">' + o.status.replace('_', ' ') + '</span></td>'
        + '<td>' + new Date(o.created_at).toLocaleDateString() + '</td></tr>';
    }).join('') || '<tr class="empty-row"><td colspan="4">No orders yet.</td></tr>';

    document.getElementById('modalBody').innerHTML =
      '<p style="margin-bottom:0.5rem;"><strong>' + esc(c.full_name) + '</strong></p>'
      + '<p style="color:var(--a-text-dim); margin-bottom:0.25rem;">' + esc(c.email) + ' &middot; ' + esc(c.phone) + '</p>'
      + '<p style="color:var(--a-text-dim); margin-bottom:1.25rem;">' + esc(c.address) + ', ' + esc(c.city) + ', ' + esc(c.state) + ' ' + esc(c.zip) + '</p>'
      + '<h3 style="margin-bottom:0.75rem;">Order History</h3>'
      + '<div class="table-wrap"><table><thead><tr><th>Order</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>' + ordersHTML + '</tbody></table></div>';
  } catch (err) {
    document.getElementById('modalBody').innerHTML = '<p style="color:var(--a-error);">' + esc(err.message) + '</p>';
  }
}

/* ============================================================
   INVENTORY VIEW
   ============================================================ */
async function renderInventoryView() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-header"><h1>Inventory</h1></div><p style="color:var(--a-text-dim);">Loading...</p>';

  try {
    var data = await apiGet('/admin/api/inventory');
    var rows = data.products.map(function (p) {
      var stockClass = p.inventory === 0 ? 'color:var(--a-error); font-weight:700;' : p.inventory <= 2 ? 'color:var(--a-warning); font-weight:700;' : '';
      return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.type) + '</td><td>' + money(p.price) + '</td>'
        + '<td style="' + stockClass + '">' + p.inventory + '</td>'
        + '<td><button class="btn btn-outline btn-sm" data-adjust="' + p.id + '" data-name="' + esc(p.name) + '">Adjust Stock</button></td></tr>';
    }).join('') || '<tr class="empty-row"><td colspan="5">No products yet.</td></tr>';

    main.innerHTML =
      '<div class="page-header"><h1>Inventory</h1></div>'
      + '<div class="card"><div class="table-wrap"><table><thead><tr><th>Product</th><th>Type</th><th>Price</th><th>Stock</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';

    main.querySelectorAll('[data-adjust]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openInventoryModal(parseInt(btn.getAttribute('data-adjust'), 10), btn.getAttribute('data-name'));
      });
    });
  } catch (err) {
    main.innerHTML = '<div class="page-header"><h1>Inventory</h1></div><p style="color:var(--a-error);">' + esc(err.message) + '</p>';
  }
}

function openInventoryModal(productId, productName) {
  var bodyHTML =
    '<div id="invModalMsg" class="form-msg"></div>'
    + '<form id="invForm">'
    + '<div class="form-group"><label for="invChange">Quantity Change</label><input type="number" id="invChange" required step="1" placeholder="e.g. 5 or -2"></div>'
    + '<div class="form-group"><label for="invReason">Reason</label><input type="text" id="invReason" required minlength="3" maxlength="200" placeholder="e.g. Restocked, Sold, Damaged"></div>'
    + '<button type="submit" class="btn btn-primary btn-block" id="invSubmitBtn">Update Stock</button>'
    + '</form>';

  openModal('Adjust Stock: ' + productName, bodyHTML);

  document.getElementById('invForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msgEl = document.getElementById('invModalMsg');
    var btn = document.getElementById('invSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';
    try {
      await apiPost('/admin/api/inventory', {
        product_id: productId,
        quantity_change: parseInt(document.getElementById('invChange').value, 10),
        reason: document.getElementById('invReason').value.trim()
      });
      closeModal();
      renderInventoryView();
    } catch (err) {
      msgEl.textContent = err.message || 'Could not update inventory.';
      msgEl.className = 'form-msg show error';
      btn.disabled = false;
      btn.textContent = 'Update Stock';
    }
  });
}

/* ============================================================
   PAYMENT METHODS VIEW
   ============================================================ */
async function renderPaymentMethodsView() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-header"><h1>Payment Methods</h1><button class="btn btn-primary" id="addMethodBtn">+ Add Method</button></div><p style="color:var(--a-text-dim);">Loading...</p>';

  try {
    var data = await apiGet('/admin/api/payment-methods');
    var rows = data.methods.map(function (m) {
      return '<tr><td>' + esc(m.name) + '</td><td>' + esc(m.type) + '</td>'
        + '<td><label class="toggle-switch"><input type="checkbox" data-toggle="' + m.id + '" ' + (m.is_active ? 'checked' : '') + '><span class="toggle-slider"></span></label></td>'
        + '<td><button class="btn btn-danger btn-sm" data-delete-method="' + m.id + '">Delete</button></td></tr>';
    }).join('') || '<tr class="empty-row"><td colspan="4">No payment methods added yet.</td></tr>';

    main.innerHTML =
      '<div class="page-header"><h1>Payment Methods</h1><button class="btn btn-primary" id="addMethodBtn">+ Add Method</button></div>'
      + '<p style="color:var(--a-text-dim); margin-bottom:1rem;">Toggle a method on or off to control what customers see as available payment options during checkout communication. Stripe and PayPal auto-generate payment links; all others are handled manually.</p>'
      + '<div class="card"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Active</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';

    document.getElementById('addMethodBtn').addEventListener('click', openAddMethodModal);

    main.querySelectorAll('[data-toggle]').forEach(function (input) {
      input.addEventListener('change', async function () {
        try {
          await apiPut('/admin/api/payment-methods/' + input.getAttribute('data-toggle'), { is_active: input.checked });
        } catch (err) {
          alert(err.message || 'Could not update payment method.');
          input.checked = !input.checked;
        }
      });
    });

    main.querySelectorAll('[data-delete-method]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Delete this payment method?')) return;
        try {
          await apiDelete('/admin/api/payment-methods/' + btn.getAttribute('data-delete-method'));
          renderPaymentMethodsView();
        } catch (err) {
          alert(err.message || 'Could not delete payment method.');
        }
      });
    });
  } catch (err) {
    main.innerHTML = '<div class="page-header"><h1>Payment Methods</h1></div><p style="color:var(--a-error);">' + esc(err.message) + '</p>';
  }
}

function openAddMethodModal() {
  var typeOptions = PAYMENT_METHOD_TYPES.map(function (m) { return '<option value="' + m.value + '">' + m.label + '</option>'; }).join('');
  var bodyHTML =
    '<div id="methodModalMsg" class="form-msg"></div>'
    + '<form id="methodForm">'
    + '<div class="form-group"><label for="methodName">Display Name</label><input type="text" id="methodName" required minlength="2" maxlength="100" placeholder="e.g. Venmo (@smokeyzbbq)"></div>'
    + '<div class="form-group"><label for="methodType">Type</label><select id="methodType">' + typeOptions + '</select></div>'
    + '<button type="submit" class="btn btn-primary btn-block" id="methodSubmitBtn">Add Payment Method</button>'
    + '</form>';

  openModal('Add Payment Method', bodyHTML);

  document.getElementById('methodForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msgEl = document.getElementById('methodModalMsg');
    var btn = document.getElementById('methodSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Adding...';
    try {
      await apiPost('/admin/api/payment-methods', {
        name: document.getElementById('methodName').value.trim(),
        type: document.getElementById('methodType').value
      });
      closeModal();
      renderPaymentMethodsView();
    } catch (err) {
      msgEl.textContent = err.message || 'Could not add payment method.';
      msgEl.className = 'form-msg show error';
      btn.disabled = false;
      btn.textContent = 'Add Payment Method';
    }
  });
}

/* ============================================================
   MESSAGES VIEW — customer contact form submissions
   ============================================================ */
async function renderMessagesView() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-header"><h1>Messages</h1></div><p style="color:var(--a-text-dim);">Loading...</p>';

  try {
    var data = await apiGet('/admin/api/messages');
    var rows = data.messages.map(function (m) {
      var isUnread = !m.read;
      return '<tr style="' + (isUnread ? 'font-weight:700;' : '') + '">'
        + '<td>' + (isUnread ? '<span class="badge badge-pending_payment">New</span> ' : '') + esc(m.full_name) + '</td>'
        + '<td>' + esc(m.email) + (m.phone ? '<br><span style="color:var(--a-text-dim); font-size:0.8125rem;">' + esc(m.phone) + '</span>' : '') + '</td>'
        + '<td style="max-width:320px; white-space:normal;">' + esc(m.message) + '</td>'
        + '<td>' + new Date(m.created_at).toLocaleString() + '</td>'
        + '<td>' + (isUnread ? '<button class="btn btn-outline btn-sm" data-mark-read="' + m.id + '">Mark Read</button>' : '<span style="color:var(--a-text-dim);">Read</span>') + '</td>'
        + '</tr>';
    }).join('') || '<tr class="empty-row"><td colspan="5">No messages yet.</td></tr>';

    main.innerHTML =
      '<div class="page-header"><h1>Messages</h1></div>'
      + '<div class="card"><div class="table-wrap"><table><thead><tr><th>From</th><th>Contact</th><th>Message</th><th>Received</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';

    main.querySelectorAll('[data-mark-read]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await apiPut('/admin/api/messages/' + btn.getAttribute('data-mark-read') + '/read', {});
          renderMessagesView();
        } catch (err) {
          alert(err.message || 'Could not mark message as read.');
        }
      });
    });
  } catch (err) {
    main.innerHTML = '<div class="page-header"><h1>Messages</h1></div><p style="color:var(--a-error);">' + esc(err.message) + '</p>';
  }
}

/* ============================================================
   SHIPPING & TAX VIEW — admin-controlled checkout settings
   ============================================================ */
async function renderShippingView() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-header"><h1>Shipping &amp; Tax</h1></div><p style="color:var(--a-text-dim);">Loading...</p>';

  try {
    var data = await apiGet('/admin/api/shipping');

    main.innerHTML =
      '<div class="page-header"><h1>Shipping &amp; Tax</h1></div>'
      + '<div class="card" style="max-width:480px;">'
      + '<div id="shippingMsg" class="form-msg"></div>'
      + '<form id="shippingForm">'
      + '<div class="form-group"><label for="baseFee">Shipping Fee (USD)</label><input type="number" id="baseFee" required min="0" step="0.01" value="' + data.base_fee + '"></div>'
      + '<div class="form-group"><label for="taxRate">Tax Rate (%)</label><input type="number" id="taxRate" required min="0" max="100" step="0.01" value="' + (data.tax_rate * 100).toFixed(2) + '"></div>'
      + '<p style="color:var(--a-text-dim); font-size:0.8125rem; margin-bottom:1rem;">These apply to every order at checkout. Example: 8.25 means 8.25% tax.</p>'
      + '<button type="submit" class="btn btn-primary btn-block" id="shippingSubmitBtn">Save Changes</button>'
      + '</form>'
      + '</div>';

    document.getElementById('shippingForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var msgEl = document.getElementById('shippingMsg');
      var btn = document.getElementById('shippingSubmitBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Saving...';
      try {
        var baseFee = parseFloat(document.getElementById('baseFee').value);
        var taxPct = parseFloat(document.getElementById('taxRate').value);
        await apiPut('/admin/api/shipping', { base_fee: baseFee, tax_rate: taxPct / 100 });
        msgEl.textContent = 'Saved.';
        msgEl.className = 'form-msg show success';
      } catch (err) {
        msgEl.textContent = err.message || 'Could not save shipping settings.';
        msgEl.className = 'form-msg show error';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
    });
  } catch (err) {
    main.innerHTML = '<div class="page-header"><h1>Shipping &amp; Tax</h1></div><p style="color:var(--a-error);">' + esc(err.message) + '</p>';
  }
}

/* ============================================================
   IMAGE UPLOAD — drag and drop handler
   ============================================================ */
function initImageUpload() {
  var uploadZone = document.getElementById('uploadZone');
  var fileInput = document.getElementById('imageFileInput');
  var preview = document.getElementById('uploadPreview');

  if (!uploadZone) return;

  // Click to browse
  uploadZone.addEventListener('click', function () { fileInput.click(); });

  // Drag events
  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadZone.style.background = '#e8d5c4';
    uploadZone.style.borderColor = '#2a2a2a';
  });

  uploadZone.addEventListener('dragleave', function () {
    uploadZone.style.background = '#f5f3f0';
    uploadZone.style.borderColor = '#c4622d';
  });

  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadZone.style.background = '#f5f3f0';
    uploadZone.style.borderColor = '#c4622d';
    handleImageUpload(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', function (e) {
    handleImageUpload(e.target.files);
  });

  function handleImageUpload(files) {
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!file.type.startsWith('image/')) {
        alert('Only image files allowed');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File ' + file.name + ' is too large (max 5MB)');
        continue;
      }

      var reader = new FileReader();
      reader.onload = (function (f) {
        return async function (e) {
          var base64 = e.target.result;
          try {
            var res = await fetch('/admin/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ file: base64, filename: f.name })
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            if (data.success) {
              var img = document.createElement('img');
              img.src = data.url;
              img.style.width = '100px';
              img.style.height = '100px';
              img.style.borderRadius = '4px';
              img.style.cursor = 'pointer';
              img.style.objectFit = 'cover';
              img.title = 'Click to use this image';
              img.addEventListener('click', function () {
                var imageUrlInput = document.getElementById('pImage');
                if (imageUrlInput) imageUrlInput.value = data.url;
              });
              preview.appendChild(img);
              // Auto-fill the image URL field with the freshly uploaded image
              var imageUrlInput = document.getElementById('pImage');
              if (imageUrlInput && !imageUrlInput.value) imageUrlInput.value = data.url;
            }
          } catch (err) {
            alert('Upload error: ' + err.message);
          }
        };
      })(file);
      reader.readAsDataURL(file);
    }
  }
}

/* ============================================================
   BOOT — check session on load
   ============================================================ */
(async function () {
  try {
    await apiGet('/admin/api/dashboard');
    showDashboard();
    navigateTo('dashboard');
  } catch (e) {
    showLogin();
  }
})();