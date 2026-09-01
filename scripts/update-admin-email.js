import 'dotenv/config.js';
import { get, run } from '../config/db.js';

// Usage: node scripts/update-admin-email.js old@email.com new@email.com
const [oldEmail, newEmail] = process.argv.slice(2);

if (!oldEmail || !newEmail) {
  console.error('Usage: node scripts/update-admin-email.js <old-email> <new-email>');
  process.exit(1);
}

async function main() {
  const existing = await get('SELECT id FROM admin_users WHERE email = ?', [oldEmail.toLowerCase().trim()]);
  if (!existing) {
    console.error(`✗ No admin account found with email: ${oldEmail}`);
    process.exit(1);
  }

  const clash = await get('SELECT id FROM admin_users WHERE email = ?', [newEmail.toLowerCase().trim()]);
  if (clash) {
    console.error(`✗ An account with email ${newEmail} already exists. Aborting to avoid a conflict.`);
    process.exit(1);
  }

  await run('UPDATE admin_users SET email = ? WHERE id = ?', [newEmail.toLowerCase().trim(), existing.id]);
  console.log(`✓ Admin email changed: ${oldEmail} → ${newEmail}`);
  console.log('  Now update ADMIN_EMAIL in your .env to match, so future seed.js runs stay in sync.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});