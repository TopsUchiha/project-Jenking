import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { all, get, run } from '../config/db.js';
import {
  validateEmail, validateString, validateInt, validatePrice,
  parseIntParam, hashPassword, verifyPassword, generateToken,
  validateImageURL
} from '../config/auth.js';
import { generatePaymentLink } from '../config/payment.js';
import { sendPaymentLink } from '../config/email.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Adjust if your public/static folder lives somewhere else relative to this file.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../public/images/products');
const MAX_IMAGE_WIDTH = 1600; // plenty for a card shown at ~400-600px, even on retina displays
const JPEG_QUALITY = 82;      // visually near-lossless, dramatically smaller than a raw phone photo
const ALLOWED_IMAGE_TYPES = { 'jpeg': 'jpg', 'jpg': 'jpg', 'png': 'png', 'gif': 'gif', 'webp': 'webp' };

const ALLOWED_TYPES    = ['Barrel', 'Pellet', 'Hybrid', 'Offset', 'Kettle'];
const ALLOWED_STATUSES = ['pending_payment','processing','built','shipped','delivered','cancelled'];
const ALLOWED_PAY_ST   = ['unpaid','paid','refunded'];
const ALLOWED_PM_TYPES = ['stripe','paypal','venmo','cashapp','chime','bank_transfer','check','other'];

// ── POST /admin/api/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!validateEmail(email))
      return res.status(400).json({ error: 'Invalid email format.' });
    if (!validateString(password, 8, 200))
      return res.status(400).json({ error: 'Invalid password.' });

    const admin = await get(
      'SELECT * FROM admin_users WHERE email = ? AND is_active = 1',
      [email.toLowerCase().trim()]
    );
    if (!admin)
      return res.status(401).json({ error: 'Invalid credentials.' });

    const isValid = await verifyPassword(password, admin.password_hash);
    if (!isValid)
      return res.status(401).json({ error: 'Invalid credentials.' });

    const token = generateToken({ admin_id: admin.id, email: admin.email, role: admin.role });

    await run(
      "UPDATE admin_users SET last_login = datetime('now') WHERE id = ?",
      [admin.id]
    );

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge:   8 * 60 * 60 * 1000
    });

    res.json({ success: true, message: 'Logged in successfully.' });
  } catch (err) {
    console.error('[ADMIN] Login error:', err.message);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ── POST /admin/api/logout ───────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out.' });
});

// ── GET /admin/api/dashboard ─────────────────────────────────
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const orderCount    = await get("SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'");
    const pendingCount  = await get("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'unpaid'");
    const totalRevenue  = await get("SELECT COALESCE(SUM(total),0) as total FROM orders WHERE payment_status = 'paid'");
    const recentOrders  = await all(
      `SELECT o.id, o.total, o.status, o.payment_status, o.created_at,
              c.full_name, c.email
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
        ORDER BY o.created_at DESC LIMIT 10`
    );
    const lowStock = await all(
      'SELECT id, name, inventory FROM products WHERE inventory < 3 ORDER BY inventory ASC'
    );

    res.json({
      success: true,
      stats: {
        total_orders:    orderCount.count,
        pending_payment: pendingCount.count,
        total_revenue:   totalRevenue.total
      },
      recent_orders:    recentOrders,
      low_stock_alerts: lowStock
    });
  } catch (err) {
    console.error('[ADMIN] Dashboard error:', err.message);
    res.status(500).json({ error: 'Could not load dashboard.' });
  }
});

// ══ PRODUCTS ════════════════════════════════════════════════

// GET /admin/api/products
router.get('/products', requireAuth, async (req, res) => {
  try {
    const products = await all('SELECT * FROM products ORDER BY created_at DESC');
    res.json({
      success: true,
      count: products.length,
      products: products.map(p => ({
        ...p,
        customization_options: p.customization_options
          ? JSON.parse(p.customization_options)
          : []
      }))
    });
  } catch (err) {
    console.error('[ADMIN] Products list error:', err.message);
    res.status(500).json({ error: 'Could not load products.' });
  }
});

// POST /admin/api/upload - Drag-drop file upload (base64), resized & compressed server-side
router.post('/upload', requireAuth, async (req, res) => {
  try {
    const { file, filename } = req.body;

    if (!file || typeof file !== 'string')
      return res.status(400).json({ error: 'No file provided.' });

    // Expect: data:image/<subtype>;base64,<data>
    const match = file.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match)
      return res.status(400).json({ error: 'Only image files allowed.' });

    const subtype = match[1].toLowerCase();
    if (!ALLOWED_IMAGE_TYPES[subtype])
      return res.status(400).json({ error: 'Unsupported image type. Use JPG, PNG, GIF, or WEBP.' });

    const base64Data = match[2];
    const rawBuffer = Buffer.from(base64Data, 'base64');

    const maxSize = 15 * 1024 * 1024; // generous ceiling on the RAW upload — a fresh phone photo can be large; we compress it down below
    if (rawBuffer.length > maxSize)
      return res.status(400).json({ error: 'File too large (max 15MB).' });

    // Resize + re-encode with sharp. This also acts as content validation: sharp
    // throws on anything that isn't actually decodable image data, regardless of
    // what the client claimed in the data: URI header.
    let outputBuffer;
    try {
      outputBuffer = await sharp(rawBuffer)
        .rotate() // apply EXIF orientation, then strip EXIF (metadata is dropped by default on re-encode)
        .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
    } catch (imgErr) {
      console.error('[ADMIN] Image processing error:', imgErr.message);
      return res.status(400).json({ error: 'Could not process this file as an image.' });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Never trust the client-supplied filename — generate our own. Always .jpg
    // since every upload is re-encoded to JPEG above.
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.jpg`;
    const destPath = path.join(UPLOAD_DIR, safeName);

    await fs.writeFile(destPath, outputBuffer);

    const url = `/images/products/${safeName}`;
    res.json({
      success: true,
      url,
      filename: filename || safeName,
      original_bytes: rawBuffer.length,
      optimized_bytes: outputBuffer.length
    });
  } catch (err) {
    console.error('[ADMIN] Upload error:', err.message);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

// POST /admin/api/products
router.post('/products', requireAuth, async (req, res) => {
  try {
    const { name, description, type, price, inventory, image_url, customization_options } = req.body;

    if (!validateString(name, 2, 200))
      return res.status(400).json({ error: 'Product name must be 2-200 characters.' });
    if (!validateString(description, 10, 2000))
      return res.status(400).json({ error: 'Description must be 10-2000 characters.' });
    if (!ALLOWED_TYPES.includes(type))
      return res.status(400).json({ error: `Type must be one of: ${ALLOWED_TYPES.join(', ')}.` });
    if (!validatePrice(price))
      return res.status(400).json({ error: 'Price must be a positive number.' });

    const invNum = parseInt(String(inventory), 10);
    if (!Number.isFinite(invNum) || invNum < 0)
      return res.status(400).json({ error: 'Inventory must be 0 or greater.' });

    // Sanitise image URL — reject javascript: and data: schemes
    const safeImage = image_url ? validateImageURL(String(image_url)) : null;

    const customJson = Array.isArray(customization_options) && customization_options.length
      ? JSON.stringify(customization_options)
      : null;

    const result = await run(
      `INSERT INTO products
         (name,description,type,price,inventory,image_url,customization_options)
       VALUES (?,?,?,?,?,?,?)`,
      [name.trim(), description.trim(), type, parseFloat(price), invNum, safeImage, customJson]
    );

    res.status(201).json({ success: true, id: result.id, message: 'Product created.' });
  } catch (err) {
    console.error('[ADMIN] Product creation error:', err.message);
    res.status(500).json({ error: 'Could not create product.' });
  }
});

// PUT /admin/api/products/:id
router.put('/products/:id', requireAuth, async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid product ID.' });

    const existing = await get('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const { name, description, type, price, inventory, image_url, customization_options } = req.body;

    if (name        !== undefined && !validateString(name, 2, 200))
      return res.status(400).json({ error: 'Product name must be 2-200 characters.' });
    if (description !== undefined && !validateString(description, 10, 2000))
      return res.status(400).json({ error: 'Description must be 10-2000 characters.' });
    if (type        !== undefined && !ALLOWED_TYPES.includes(type))
      return res.status(400).json({ error: `Type must be one of: ${ALLOWED_TYPES.join(', ')}.` });
    if (price       !== undefined && !validatePrice(price))
      return res.status(400).json({ error: 'Price must be a positive number.' });

    let invNum;
    if (inventory !== undefined) {
      invNum = parseInt(String(inventory), 10);
      if (!Number.isFinite(invNum) || invNum < 0)
        return res.status(400).json({ error: 'Inventory must be 0 or greater.' });
    }

    const updates = [];
    const params  = [];

    if (name        !== undefined) { updates.push('name = ?');        params.push(name.trim()); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description.trim()); }
    if (type        !== undefined) { updates.push('type = ?');        params.push(type); }
    if (price       !== undefined) { updates.push('price = ?');       params.push(parseFloat(price)); }
    if (inventory   !== undefined) { updates.push('inventory = ?');   params.push(invNum); }
    if (image_url   !== undefined) {
      const safeImage = validateImageURL(String(image_url));
      updates.push('image_url = ?');
      params.push(safeImage || null);
    }
    if (customization_options !== undefined) {
      updates.push('customization_options = ?');
      params.push(Array.isArray(customization_options) && customization_options.length
        ? JSON.stringify(customization_options)
        : null);
    }

    if (updates.length === 0)
      return res.status(400).json({ error: 'No fields provided to update.' });

    updates.push("updated_at = datetime('now')");
    params.push(id);

    await run(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Product updated.' });
  } catch (err) {
    console.error('[ADMIN] Product update error:', err.message);
    res.status(500).json({ error: 'Could not update product.' });
  }
});

// DELETE /admin/api/products/:id
router.delete('/products/:id', requireAuth, async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid product ID.' });

    const existing = await get('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    // Remove FK-referencing rows first so the delete can never fail on constraints
    await run('DELETE FROM inventory_logs WHERE product_id = ?', [id]);
    await run('DELETE FROM order_items   WHERE product_id = ?', [id]);
    await run('DELETE FROM products      WHERE id = ?',         [id]);

    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    console.error('[ADMIN] Product deletion error:', err.message);
    res.status(500).json({ error: 'Could not delete product.' });
  }
});

// ══ ORDERS ══════════════════════════════════════════════════

// GET /admin/api/orders
router.get('/orders', requireAuth, async (req, res) => {
  try {
    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim() : null;
    const status    = rawStatus && ALLOWED_STATUSES.includes(rawStatus) ? rawStatus : null;

    let sql    = `SELECT o.id, o.total, o.status, o.payment_status,
                         o.payment_method, o.created_at,
                         c.full_name, c.email
                    FROM orders o
                    JOIN customers c ON o.customer_id = c.id
                   WHERE 1=1`;
    const params = [];

    if (status) { sql += ' AND o.status = ?'; params.push(status); }
    sql += ' ORDER BY o.created_at DESC';

    const orders = await all(sql, params);
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error('[ADMIN] Orders list error:', err.message);
    res.status(500).json({ error: 'Could not load orders.' });
  }
});

// GET /admin/api/orders/:id
router.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid order ID.' });

    const order = await get(
      `SELECT o.*, c.full_name, c.email, c.phone, c.address,
              c.city, c.state, c.zip
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?`,
      [id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const items = await all(
      `SELECT oi.*, p.name as product_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?`,
      [id]
    );

    res.json({ success: true, order, items });
  } catch (err) {
    console.error('[ADMIN] Order detail error:', err.message);
    res.status(500).json({ error: 'Could not load order.' });
  }
});

// PUT /admin/api/orders/:id
router.put('/orders/:id', requireAuth, async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid order ID.' });

    const existing = await get('SELECT id FROM orders WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    const { status, payment_status, notes } = req.body;

    if (status         !== undefined && !ALLOWED_STATUSES.includes(status))
      return res.status(400).json({ error: 'Invalid order status.' });
    if (payment_status !== undefined && !ALLOWED_PAY_ST.includes(payment_status))
      return res.status(400).json({ error: 'Invalid payment status.' });

    const updates = [];
    const params  = [];

    if (status         !== undefined) { updates.push('status = ?');         params.push(status); }
    if (payment_status !== undefined) { updates.push('payment_status = ?'); params.push(payment_status); }
    if (notes          !== undefined && validateString(String(notes), 0, 1000)) {
      updates.push('notes = ?');
      params.push(String(notes).trim());
    }

    if (updates.length === 0)
      return res.status(400).json({ error: 'No fields provided to update.' });

    updates.push("updated_at = datetime('now')");
    params.push(id);

    await run(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Order updated.' });
  } catch (err) {
    console.error('[ADMIN] Order update error:', err.message);
    res.status(500).json({ error: 'Could not update order.' });
  }
});

// POST /admin/api/send-payment-link
router.post('/send-payment-link', requireAuth, async (req, res) => {
  try {
    const { order_id, payment_method } = req.body;

    const orderId = parseIntParam(order_id);
    if (!orderId)
      return res.status(400).json({ error: 'Invalid order ID.' });
    if (!validateString(String(payment_method || ''), 3, 50))
      return res.status(400).json({ error: 'Invalid payment method.' });

    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const customer = await get('SELECT * FROM customers WHERE id = ?', [order.customer_id]);
    const items    = await all(
      `SELECT oi.*, p.name as product_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?`,
      [orderId]
    );

    const method = String(payment_method).trim().toLowerCase();

    try {
      const paymentLink = await generatePaymentLink(order, customer, items, method);
      await sendPaymentLink(customer, order, paymentLink, method);
      await run(
        "UPDATE orders SET payment_method = ?, updated_at = datetime('now') WHERE id = ?",
        [method, orderId]
      );
      res.json({ success: true, message: 'Payment link sent to customer.' });
    } catch (payErr) {
      console.error('[ADMIN] Payment link error:', payErr.message);
      res.status(500).json({ error: 'Could not generate or send payment link.' });
    }
  } catch (err) {
    console.error('[ADMIN] Send-payment-link error:', err.message);
    res.status(500).json({ error: 'Could not process request.' });
  }
});

// ══ CUSTOMERS ═══════════════════════════════════════════════

// GET /admin/api/customers
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : null;
    const search    = rawSearch && rawSearch.length <= 100 ? rawSearch : null;

    let sql    = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (email LIKE ? OR full_name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY created_at DESC';

    const customers = await all(sql, params);
    res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    console.error('[ADMIN] Customers list error:', err.message);
    res.status(500).json({ error: 'Could not load customers.' });
  }
});

// GET /admin/api/customers/:id
router.get('/customers/:id', requireAuth, async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid customer ID.' });

    const customer = await get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const orders = await all(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC',
      [id]
    );

    res.json({ success: true, customer, orders });
  } catch (err) {
    console.error('[ADMIN] Customer detail error:', err.message);
    res.status(500).json({ error: 'Could not load customer.' });
  }
});

// ══ INVENTORY ════════════════════════════════════════════════

// GET /admin/api/inventory
router.get('/inventory', requireAuth, async (req, res) => {
  try {
    const products = await all(
      'SELECT id, name, type, price, inventory FROM products ORDER BY name ASC'
    );
    res.json({ success: true, products });
  } catch (err) {
    console.error('[ADMIN] Inventory list error:', err.message);
    res.status(500).json({ error: 'Could not load inventory.' });
  }
});

// POST /admin/api/inventory
router.post('/inventory', requireAuth, async (req, res) => {
  try {
    const { product_id, quantity_change, reason } = req.body;

    const productId = parseIntParam(product_id);
    if (!productId)
      return res.status(400).json({ error: 'Invalid product ID.' });

    const qtyChange = parseInt(String(quantity_change), 10);
    if (!Number.isFinite(qtyChange))
      return res.status(400).json({ error: 'quantity_change must be a whole number.' });

    if (!validateString(String(reason || ''), 3, 200))
      return res.status(400).json({ error: 'Reason is required (3-200 characters).' });

    const product = await get('SELECT id, inventory FROM products WHERE id = ?', [productId]);
    if (!product)
      return res.status(404).json({ error: 'Product not found.' });

    const newInventory = product.inventory + qtyChange;
    if (newInventory < 0)
      return res.status(400).json({ error: 'Inventory cannot go below 0.' });

    await run(
      "UPDATE products SET inventory = ?, updated_at = datetime('now') WHERE id = ?",
      [newInventory, productId]
    );
    await run(
      'INSERT INTO inventory_logs (product_id,quantity_change,reason) VALUES (?,?,?)',
      [productId, qtyChange, String(reason).trim()]
    );

    res.json({ success: true, message: 'Inventory updated.', new_inventory: newInventory });
  } catch (err) {
    console.error('[ADMIN] Inventory update error:', err.message);
    res.status(500).json({ error: 'Could not update inventory.' });
  }
});

// ══ PAYMENT METHODS ══════════════════════════════════════════

// GET /admin/api/payment-methods
router.get('/payment-methods', requireAuth, async (req, res) => {
  try {
    const methods = await all('SELECT * FROM payment_methods ORDER BY name ASC');
    res.json({ success: true, methods });
  } catch (err) {
    console.error('[ADMIN] Payment methods list error:', err.message);
    res.status(500).json({ error: 'Could not load payment methods.' });
  }
});

// POST /admin/api/payment-methods
router.post('/payment-methods', requireAuth, async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!validateString(String(name || ''), 2, 100))
      return res.status(400).json({ error: 'Name must be 2-100 characters.' });
    if (!ALLOWED_PM_TYPES.includes(type))
      return res.status(400).json({ error: `Type must be one of: ${ALLOWED_PM_TYPES.join(', ')}.` });

    const result = await run(
      'INSERT INTO payment_methods (name,type,is_active) VALUES (?,?,1)',
      [String(name).trim(), type]
    );
    res.status(201).json({ success: true, id: result.id, message: 'Payment method added.' });
  } catch (err) {
    console.error('[ADMIN] Payment method creation error:', err.message);
    res.status(500).json({ error: 'Could not add payment method.' });
  }
});

// PUT /admin/api/payment-methods/:id
router.put('/payment-methods/:id', requireAuth, async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid method ID.' });

    const existing = await get('SELECT id FROM payment_methods WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Payment method not found.' });

    const { is_active } = req.body;
    if (is_active === undefined)
      return res.status(400).json({ error: 'is_active is required.' });

    await run(
      "UPDATE payment_methods SET is_active = ?, updated_at = datetime('now') WHERE id = ?",
      [is_active ? 1 : 0, id]
    );
    res.json({ success: true, message: 'Payment method updated.' });
  } catch (err) {
    console.error('[ADMIN] Payment method update error:', err.message);
    res.status(500).json({ error: 'Could not update payment method.' });
  }
});

// DELETE /admin/api/payment-methods/:id
router.delete('/payment-methods/:id', requireAuth, async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid method ID.' });

    const existing = await get('SELECT id FROM payment_methods WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Payment method not found.' });

    await run('DELETE FROM payment_methods WHERE id = ?', [id]);
    res.json({ success: true, message: 'Payment method deleted.' });
  } catch (err) {
    console.error('[ADMIN] Payment method deletion error:', err.message);
    res.status(500).json({ error: 'Could not delete payment method.' });
  }
});

// GET /admin/api/shipping - Get shipping fee
router.get('/shipping', requireAuth, async (req, res) => {
  try {
    const settings = await get('SELECT * FROM shipping_settings LIMIT 1');
    res.json({
      success: true,
      base_fee: settings?.base_fee ?? 149.00,
      tax_rate: settings?.tax_rate ?? 0.0825
    });
  } catch (err) {
    console.error('[ADMIN] Shipping GET error:', err.message);
    res.status(500).json({ error: 'Could not fetch shipping settings.' });
  }
});

// PUT /admin/api/shipping - Update shipping fee AND tax rate (ADMIN CONTROL)
router.put('/shipping', requireAuth, async (req, res) => {
  try {
    const { base_fee, tax_rate } = req.body;
    if (typeof base_fee !== 'number' || base_fee < 0)
      return res.status(400).json({ error: 'Invalid shipping fee.' });
    if (typeof tax_rate !== 'number' || tax_rate < 0 || tax_rate > 1)
      return res.status(400).json({ error: 'Invalid tax rate. Use a decimal like 0.0825 for 8.25%.' });

    const exists = await get('SELECT id FROM shipping_settings LIMIT 1');
    if (exists) {
      await run("UPDATE shipping_settings SET base_fee = ?, tax_rate = ?, updated_at = datetime('now') WHERE id = ?",
        [base_fee, tax_rate, exists.id]);
    } else {
      await run('INSERT INTO shipping_settings (base_fee, tax_rate) VALUES (?, ?)', [base_fee, tax_rate]);
    }
    res.json({ success: true, message: `Shipping fee set to $${base_fee.toFixed(2)}, tax rate set to ${(tax_rate * 100).toFixed(2)}%` });
  } catch (err) {
    console.error('[ADMIN] Shipping PUT error:', err.message);
    res.status(500).json({ error: 'Could not update shipping settings.' });
  }
});

// GET /admin/api/messages - Get all contact messages
router.get('/messages', requireAuth, async (req, res) => {
  try {
    const messages = await all(
      'SELECT * FROM contact_messages ORDER BY created_at DESC'
    );
    res.json({ success: true, messages, count: messages.length });
  } catch (err) {
    console.error('[ADMIN] Messages GET error:', err.message);
    res.status(500).json({ error: 'Could not fetch messages.' });
  }
});

// PUT /admin/api/messages/:id/read - Mark message as read
router.put('/messages/:id/read', requireAuth, async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid message ID.' });
    
    const exists = await get('SELECT id FROM contact_messages WHERE id = ?', [id]);
    if (!exists) return res.status(404).json({ error: 'Message not found.' });
    
    await run('UPDATE contact_messages SET read = 1 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Mark read error:', err.message);
    res.status(500).json({ error: 'Could not update message.' });
  }
});

export default router;