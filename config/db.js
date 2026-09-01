import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '..', 'database.db');

let db;

export function getDB() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('[DB] Connection failed:', err.message);
        process.exit(1);
      }
      console.log('[DB] Using database file:', DB_PATH);
      if (!process.env.DATABASE_URL) {
        console.log('[DB] DATABASE_URL is not set — using the default path above.');
        console.log('[DB] Every script (server, seed) must resolve to this SAME path or they will silently disagree.');
      }
    });
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
  }
  return db;
}

export function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const database = getDB();
    database.serialize(() => {
      // Products table
      database.run(`CREATE TABLE IF NOT EXISTS products (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        name                  TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
        description           TEXT NOT NULL CHECK(length(description) > 0),
        type                  TEXT NOT NULL CHECK(type IN ('Barrel', 'Pellet', 'Hybrid', 'Offset', 'Kettle')),
        price                 REAL NOT NULL CHECK(price > 0),
        inventory             INTEGER NOT NULL DEFAULT 0 CHECK(inventory >= 0),
        image_url             TEXT,
        customization_options TEXT,
        created_at            TEXT DEFAULT (datetime('now')),
        updated_at            TEXT DEFAULT (datetime('now'))
      )`);

      // Customers table
      database.run(`CREATE TABLE IF NOT EXISTS customers (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT NOT NULL UNIQUE CHECK(length(email) > 0 AND length(email) <= 254),
        full_name     TEXT NOT NULL CHECK(length(full_name) > 0 AND length(full_name) <= 150),
        phone         TEXT NOT NULL CHECK(length(phone) > 0 AND length(phone) <= 30),
        address       TEXT NOT NULL CHECK(length(address) > 0),
        city          TEXT NOT NULL CHECK(length(city) > 0),
        state         TEXT NOT NULL CHECK(length(state) > 0),
        zip           TEXT NOT NULL CHECK(length(zip) > 0),
        country       TEXT DEFAULT 'US',
        created_at    TEXT DEFAULT (datetime('now')),
        updated_at    TEXT DEFAULT (datetime('now'))
      )`);

      // Orders table
      database.run(`CREATE TABLE IF NOT EXISTS orders (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id     INTEGER NOT NULL REFERENCES customers(id),
        subtotal        REAL NOT NULL CHECK(subtotal >= 0),
        tax             REAL NOT NULL CHECK(tax >= 0),
        shipping        REAL NOT NULL CHECK(shipping >= 0),
        total           REAL NOT NULL CHECK(total > 0),
        status          TEXT DEFAULT 'pending_payment' CHECK(status IN ('pending_payment', 'processing', 'built', 'shipped', 'delivered', 'cancelled')),
        payment_status  TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'refunded')),
        payment_method  TEXT,
        notes           TEXT,
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now'))
      )`);

      // Order items table
      database.run(`CREATE TABLE IF NOT EXISTS order_items (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id                  INTEGER NOT NULL REFERENCES orders(id),
        product_id                INTEGER NOT NULL REFERENCES products(id),
        quantity                  INTEGER NOT NULL CHECK(quantity > 0),
        price_at_purchase         REAL NOT NULL CHECK(price_at_purchase > 0),
        customization_selections  TEXT,
        created_at                TEXT DEFAULT (datetime('now'))
      )`);

      // Inventory logs
      database.run(`CREATE TABLE IF NOT EXISTS inventory_logs (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id       INTEGER NOT NULL REFERENCES products(id),
        quantity_change  INTEGER NOT NULL,
        reason           TEXT NOT NULL CHECK(length(reason) > 0),
        notes            TEXT,
        created_at       TEXT DEFAULT (datetime('now'))
      )`);

      // Payment methods table (admin can add/remove)
      database.run(`CREATE TABLE IF NOT EXISTS payment_methods (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
        type        TEXT NOT NULL CHECK(type IN ('stripe', 'paypal', 'venmo', 'cashapp', 'chime', 'bank_transfer', 'check', 'other')),
        is_active   INTEGER DEFAULT 1,
        config      TEXT,
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now'))
      )`);

      // Contact messages table
      database.run(`CREATE TABLE IF NOT EXISTS contact_messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name   TEXT NOT NULL CHECK(length(full_name) > 0 AND length(full_name) <= 150),
        email       TEXT NOT NULL CHECK(length(email) > 0 AND length(email) <= 254),
        phone       TEXT,
        message     TEXT NOT NULL CHECK(length(message) > 0 AND length(message) <= 2000),
        read        INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now'))
      )`);

      // Shipping settings (admin-controlled)
      database.run(`CREATE TABLE IF NOT EXISTS shipping_settings (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        base_fee    REAL NOT NULL DEFAULT 149.00 CHECK(base_fee >= 0),
        tax_rate    REAL NOT NULL DEFAULT 0.0825 CHECK(tax_rate >= 0 AND tax_rate <= 1),
        updated_at  TEXT DEFAULT (datetime('now'))
      )`);

      // Customer reviews
      database.run(`CREATE TABLE IF NOT EXISTS reviews (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL CHECK(length(customer_name) > 0 AND length(customer_name) <= 150),
        rating      INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        title       TEXT NOT NULL CHECK(length(title) > 0 AND length(title) <= 200),
        text        TEXT NOT NULL CHECK(length(text) > 0 AND length(text) <= 2000),
        verified    INTEGER DEFAULT 1,
        created_at  TEXT DEFAULT (datetime('now'))
      )`);

      // Admin users table
      database.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT NOT NULL UNIQUE CHECK(length(email) > 0 AND length(email) <= 254),
        password_hash TEXT NOT NULL,
        role          TEXT DEFAULT 'admin',
        is_active     INTEGER DEFAULT 1,
        created_at    TEXT DEFAULT (datetime('now')),
        last_login    TEXT
      )`);

      // Cart sessions (temporary storage)
      database.run(`CREATE TABLE IF NOT EXISTS cart_sessions (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        items     TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT
      )`);

      database.run(`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}