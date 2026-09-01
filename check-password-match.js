import 'dotenv/config.js';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

const DB_PATH = process.env.DATABASE_URL || './database.db';
const envEmail = process.env.ADMIN_EMAIL;
const envPassword = process.env.ADMIN_PASSWORD;

console.log('ADMIN_EMAIL from .env:    "' + envEmail + '"');
console.log('ADMIN_PASSWORD from .env: "' + envPassword + '"');
console.log('Password length:', envPassword ? envPassword.length : 'undefined');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Could not open database:', err.message);
    process.exit(1);
  }

  db.get(
    'SELECT id, email, password_hash, is_active FROM admin_users WHERE email = ?',
    [envEmail.toLowerCase().trim()],
    async (err, row) => {
      if (err) {
        console.error('Query error:', err.message);
        process.exit(1);
      }
      if (!row) {
        console.log('\nNO MATCHING ROW for email:', envEmail.toLowerCase().trim());
        process.exit(1);
      }

      console.log('\nFound row: id=' + row.id + ' email="' + row.email + '" is_active=' + row.is_active);
      console.log('Stored hash:', row.password_hash);

      const isMatch = await bcrypt.compare(envPassword, row.password_hash);
      console.log('\nbcrypt.compare(ADMIN_PASSWORD from .env, stored hash) =>', isMatch);

      if (isMatch) {
        console.log('\n✓ The .env password DOES match the database hash.');
        console.log('  If login still fails in the browser, the problem is what you are TYPING');
        console.log('  (autofill, extra space, wrong special character) — not the server or DB.');
      } else {
        console.log('\n✗ The .env password does NOT match the database hash.');
        console.log('  Run: node scripts/seed.js   (this re-syncs the hash to current .env)');
      }
      process.exit(0);
    }
  );
});