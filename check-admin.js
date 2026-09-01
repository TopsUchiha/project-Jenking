import 'dotenv/config.js';
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL || './database.db';
console.log('Opening DB at:', path.resolve(DB_PATH));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Could not open database:', err.message);
    process.exit(1);
  }

  db.all('SELECT id, email, is_active, length(password_hash) as hash_len FROM admin_users', [], (err, rows) => {
    if (err) {
      console.error('Query error:', err.message);
      process.exit(1);
    }
    console.log('\n--- admin_users rows ---');
    if (rows.length === 0) {
      console.log('NO ROWS FOUND. The admin_users table is empty.');
    } else {
      rows.forEach(r => {
        console.log(`id=${r.id}  email="${r.email}"  is_active=${r.is_active}  hash_len=${r.hash_len}`);
      });
    }
    process.exit(0);
  });
});