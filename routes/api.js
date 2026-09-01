import express from 'express';
import { all, get, run } from '../config/db.js';
import {
  validateEmail, validateString, validatePhone,
  validatePrice, parseIntParam, validateImageURL
} from '../config/auth.js';
import { sendOrderConfirmation } from '../config/email.js';

const router = express.Router();

// ── GET /api/products ────────────────────────────────────────
router.get('/products', async (req, res) => {
  try {
    const ALLOWED_TYPES = ['Barrel', 'Pellet', 'Hybrid', 'Offset', 'Kettle'];
    const rawType   = typeof req.query.type   === 'string' ? req.query.type.trim()   : null;
    const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : null;

    const type   = rawType   && ALLOWED_TYPES.includes(rawType)  ? rawType   : null;
    const search = rawSearch && rawSearch.length <= 100           ? rawSearch : null;

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (type)   { sql += ' AND type = ?';                              params.push(type); }
    if (search) { sql += ' AND (name LIKE ? OR description LIKE ?)';  params.push(`%${search}%`, `%${search}%`); }

    sql += ' ORDER BY created_at DESC';

    const products = await all(sql, params);
    res.json({
      success: true,
      count: products.length,
      products: products.map(p => ({
        ...p,
        customization_options: p.customization_options ? JSON.parse(p.customization_options) : []
      }))
    });
  } catch (err) {
    console.error('[API] Products list error:', err.message);
    res.status(500).json({ error: 'Could not load products.' });
  }
});

// ── GET /api/products/:id ────────────────────────────────────
router.get('/products/:id', async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid product ID.' });

    const product = await get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    product.customization_options = product.customization_options
      ? JSON.parse(product.customization_options)
      : [];

    res.json({ success: true, product });
  } catch (err) {
    console.error('[API] Product detail error:', err.message);
    res.status(500).json({ error: 'Could not load product.' });
  }
});

// ── POST /api/orders ─────────────────────────────────────────
router.post('/orders', async (req, res) => {
  try {
    const {
      full_name, email, phone, address, city, state, zip,
      cart_items, subtotal, tax, shipping
    } = req.body;

    // ── input validation ──────────────────────────────────
    if (!validateString(full_name, 2, 150))
      return res.status(400).json({ error: 'Full name is required (2-150 characters).' });
    if (!validateEmail(email))
      return res.status(400).json({ error: 'A valid email address is required.' });
    if (!validatePhone(phone))
      return res.status(400).json({ error: 'Phone must be 7-30 characters.' });
    if (!validateString(address, 5, 300))
      return res.status(400).json({ error: 'Address is required.' });
    if (!validateString(city, 2, 100))
      return res.status(400).json({ error: 'City is required.' });
    if (!validateString(state, 2, 100))
      return res.status(400).json({ error: 'State is required.' });
    if (!validateString(zip, 3, 20))
      return res.status(400).json({ error: 'ZIP code is required.' });
    if (!Array.isArray(cart_items) || cart_items.length === 0)
      return res.status(400).json({ error: 'Cart is empty.' });
    if (!validatePrice(subtotal) || !validatePrice(shipping))
      return res.status(400).json({ error: 'Invalid pricing.' });
    // tax can be 0 on tax-exempt orders
    const taxNum = parseFloat(tax);
    if (!Number.isFinite(taxNum) || taxNum < 0)
      return res.status(400).json({ error: 'Invalid tax amount.' });

    // ── sanitise ──────────────────────────────────────────
    const cleanName    = full_name.trim();
    const cleanEmail   = email.trim().toLowerCase();
    const cleanPhone   = phone.trim();
    const cleanAddress = address.trim();
    const cleanCity    = city.trim();
    const cleanState   = state.trim();
    const cleanZip     = zip.trim();
    const subNum       = parseFloat(subtotal);
    const shipNum      = parseFloat(shipping);
    const total        = subNum + taxNum + shipNum;

    // ── validate each cart item before touching the DB ────
    for (const item of cart_items) {
      const pid = parseIntParam(item.product_id);
      const qty = parseIntParam(item.quantity);
      if (!pid || !qty)
        return res.status(400).json({ error: 'Invalid cart item.' });
    }

    // ── upsert customer ───────────────────────────────────
    const existing = await get('SELECT id FROM customers WHERE email = ?', [cleanEmail]);
    let customerId;

    if (existing) {
      customerId = existing.id;
      await run(
        `UPDATE customers
            SET full_name=?, phone=?, address=?, city=?, state=?, zip=?,
                updated_at=datetime('now')
          WHERE id=?`,
        [cleanName, cleanPhone, cleanAddress, cleanCity, cleanState, cleanZip, customerId]
      );
    } else {
      const result = await run(
        'INSERT INTO customers (email,full_name,phone,address,city,state,zip) VALUES (?,?,?,?,?,?,?)',
        [cleanEmail, cleanName, cleanPhone, cleanAddress, cleanCity, cleanState, cleanZip]
      );
      customerId = result.id;
    }

    // ── create order ──────────────────────────────────────
    const orderResult = await run(
      `INSERT INTO orders
         (customer_id,subtotal,tax,shipping,total,status,payment_status)
       VALUES (?,?,?,?,?,'pending_payment','unpaid')`,
      [customerId, subNum, taxNum, shipNum, total]
    );
    const orderId = orderResult.id;

    // ── insert order items ────────────────────────────────
    for (const item of cart_items) {
      const pid = parseIntParam(item.product_id);
      const qty = parseIntParam(item.quantity);

      const product = await get('SELECT * FROM products WHERE id = ?', [pid]);
      if (!product)
        return res.status(400).json({ error: `Product ${pid} not found.` });

      const customJson = item.customization_selections
        ? JSON.stringify(item.customization_selections)
        : null;

      await run(
        `INSERT INTO order_items
           (order_id,product_id,quantity,price_at_purchase,customization_selections)
         VALUES (?,?,?,?,?)`,
        [orderId, pid, qty, product.price, customJson]
      );
    }

    // ── confirmation email (non-blocking) ─────────────────
    const customer = await get('SELECT * FROM customers WHERE id = ?', [customerId]);
    const order    = await get('SELECT * FROM orders    WHERE id = ?', [orderId]);
    const items    = await all(
      `SELECT oi.*, p.name as product_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?`,
      [orderId]
    );
    sendOrderConfirmation(customer, order, items).catch(() => {});

    res.status(201).json({
      success: true,
      order_id: orderId,
      message: 'Order created successfully. Check your email for confirmation.'
    });
  } catch (err) {
    console.error('[API] Order creation error:', err.message);
    res.status(500).json({ error: 'Could not create order. Please try again.' });
  }
});

// ── GET /api/orders/:id ──────────────────────────────────────
router.get('/orders/:id', async (req, res) => {
  try {
    const orderId = parseIntParam(req.params.id);
    if (!orderId) return res.status(400).json({ error: 'Invalid order ID.' });

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

    res.json({ success: true, order, customer, items });
  } catch (err) {
    console.error('[API] Order detail error:', err.message);
    res.status(500).json({ error: 'Could not load order.' });
  }
});

// ── GET /api/orders/:id/track - Order tracking (public) ──────────
router.get('/orders/:id/track', async (req, res) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid order ID.' });
    
    const order = await get(`
      SELECT o.id, o.status, o.payment_status, o.total, o.created_at, o.updated_at,
             c.full_name, c.email
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `, [id]);
    
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    
    const items = await all('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]);
    res.json({ order, items });
  } catch (err) {
    console.error('[API] Track error:', err.message);
    res.status(500).json({ error: 'Could not track order.' });
  }
});

// ── POST /api/contact ────────────────────────────────────────
router.post('/contact', async (req, res) => {
  try {
    const { full_name, email, phone, message } = req.body;

    if (!validateString(full_name, 2, 150))
      return res.status(400).json({ error: 'Full name is required (2-150 characters).' });
    if (!validateEmail(email))
      return res.status(400).json({ error: 'A valid email address is required.' });
    if (!validateString(message, 10, 2000))
      return res.status(400).json({ error: 'Message must be 10-2000 characters.' });
    if (phone !== undefined && phone !== '' && !validatePhone(String(phone)))
      return res.status(400).json({ error: 'Invalid phone number.' });

    await run(
      'INSERT INTO contact_messages (full_name,email,phone,message) VALUES (?,?,?,?)',
      [
        full_name.trim(),
        email.trim().toLowerCase(),
        phone ? String(phone).trim() : null,
        message.trim()
      ]
    );

    res.status(201).json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error('[API] Contact form error:', err.message);
    res.status(500).json({ error: 'Could not send message. Please try again.' });
  }
});

// ── GET /api/payment-methods ─────────────────────────────────
router.get('/payment-methods', async (req, res) => {
  try {
    const methods = await all(
      'SELECT name, type FROM payment_methods WHERE is_active = 1 ORDER BY name ASC'
    );
    res.json({ success: true, methods });
  } catch (err) {
    console.error('[API] Payment methods error:', err.message);
    res.status(500).json({ error: 'Could not load payment methods.' });
  }
});

// GET /api/reviews - Get all reviews
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await all('SELECT customer_name, rating, title, text FROM reviews ORDER BY RANDOM()');
    const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 0;
    res.json({ reviews, count: reviews.length, average: parseFloat(avg) });
  } catch (err) {
    console.error('[API] Reviews error:', err.message);
    res.status(500).json({ error: 'Could not load reviews.' });
  }
});

export default router;
