import 'dotenv/config.js';
import { initializeDatabase, get, run, all } from '../config/db.js';
import { hashPassword } from '../config/auth.js';

const REVIEWS = [
  // 5-star (13 - MAJORITY)
  { name: 'Marcus', rating: 5, title: 'Best smoker investment ever', text: 'Built this offset smoker two months ago and it runs like a dream. Temperature holds rock solid. The craftsmanship is phenomenal.' },
  { name: 'Jennifer', rating: 5, title: 'Incredible build quality', text: 'I ordered a barrel smoker and got exactly what I paid for. No shortcuts. Absolutely thrilled with the results.' },
  { name: 'David', rating: 5, title: 'Perfect temperature control', text: 'The custom modifications made this smoker perfect for my needs. Communication with the team was excellent throughout.' },
  { name: 'Sarah', rating: 5, title: 'Worth every penny', text: 'Five years of competition BBQ and this is the best equipment I own. The build quality shows in every detail.' },
  { name: 'Robert', rating: 5, title: 'Absolutely flawless', text: 'Ordered a hybrid model and the execution is flawless. This thing holds temperature better than commercial smokers.' },
  { name: 'Lisa', rating: 5, title: 'Professional grade equipment', text: 'The custom modifications made this smoker perfect for my needs. Communication with the team was excellent throughout.' },
  { name: 'James', rating: 5, title: 'Outstanding craftsmanship', text: 'Five years of competition BBQ and this is the best equipment I own. The build quality shows in every detail.' },
  { name: 'Michelle', rating: 5, title: 'Exceeded all expectations', text: 'Ordered a hybrid model and the execution is flawless. This thing holds temperature better than commercial smokers.' },
  { name: 'William', rating: 5, title: 'Incredible attention to detail', text: 'Built this offset smoker two months ago and it runs like a dream. Temperature holds rock solid. The craftsmanship is phenomenal.' },
  { name: 'Patricia', rating: 5, title: 'Game changer for backyard BBQ', text: 'I ordered a barrel smoker and got exactly what I paid for. No shortcuts. Absolutely thrilled with the results.' },
  { name: 'Daniel', rating: 5, title: 'Exceptional quality', text: 'This smoker exceeded my expectations in every way. The build quality is exceptional and the temperature control is incredibly precise.' },
  { name: 'Nancy', rating: 5, title: 'Highly recommended', text: 'Best purchase ever. Will definitely be ordering another smoker from Smokeyz BBQ.' },
  { name: 'Richard', rating: 5, title: 'Worth the investment', text: 'Premium quality. This is the best smoker I have ever owned. Highly satisfied.' },
  
  // 4-star (7)
  { name: 'Paul', rating: 4, title: 'Very good', text: 'Excellent quality. Minor issues only.' },
  { name: 'Diana', rating: 4, title: 'Great product', text: 'Highly satisfied. Well built.' },
  { name: 'George', rating: 4, title: 'Excellent', text: 'Strong performance. Very pleased.' },
  { name: 'Helen', rating: 4, title: 'Impressive', text: 'Great quality. Highly recommend.' },
  { name: 'Frank', rating: 4, title: 'Superior', text: 'Excellent craftsmanship.' },
  { name: 'Iris', rating: 4, title: 'Outstanding', text: 'Fantastic product. Will buy again.' },
  { name: 'Jack', rating: 4, title: 'Premium quality', text: 'Worth the investment. Excellent.' },
  
  // 2-star (2)
  { name: 'Tom', rating: 2, title: 'Average', text: 'Works but not great. Expected better.' },
  { name: 'Lisa2', rating: 2, title: 'Okay quality', text: 'Decent but has issues. Acceptable.' },
  
  // 1-star (3)
  { name: 'John', rating: 1, title: 'Defective', text: 'Arrived broken. No support response.' },
  { name: 'Sarah2', rating: 1, title: 'Waste of money', text: 'Poor quality. Rusted in weeks.' },
  { name: 'Mike', rating: 1, title: 'Total disaster', text: 'Wrong order. Still waiting for refund.' }
];

async function seed() {
  await initializeDatabase();
  
  const adminEmail = process.env.ADMIN_EMAIL || 'smokersandgrillsb@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('✗ ADMIN_PASSWORD is not set in your .env file.');
    console.error('  Add a line like: ADMIN_PASSWORD=YourSecurePasswordHere');
    process.exit(1);
  }

  const hash = await hashPassword(adminPassword);
  const existing = await get('SELECT id FROM admin_users WHERE email = ?', [adminEmail]);

  if (existing) {
    // UPSERT: always sync the stored password to whatever is currently in .env.
    // This is what makes login reliable — .env is the single source of truth,
    // every time you run this script, instead of silently skipping.
    await run('UPDATE admin_users SET password_hash = ?, is_active = 1 WHERE email = ?',
      [hash, adminEmail]);
    console.log('✓ Admin user already existed — password synced to current ADMIN_PASSWORD');
  } else {
    await run('INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)',
      [adminEmail, hash, 'admin']);
    console.log('✓ Admin user created');
  }
  console.log('  Email: ' + adminEmail);
  console.log('  Password: whatever ADMIN_PASSWORD is currently set to in .env');
  
  const shippingExists = await get('SELECT id FROM shipping_settings LIMIT 1');
  if (!shippingExists) {
    await run('INSERT INTO shipping_settings (base_fee, tax_rate) VALUES (?, ?)', [149.00, 0.0825]);
    console.log('✓ Shipping settings: $149.00');
  }
  
  const reviewCount = await get('SELECT COUNT(*) as count FROM reviews');
  if (reviewCount.count === 0) {
    for (const r of REVIEWS) {
      await run('INSERT INTO reviews (customer_name, rating, title, text, verified) VALUES (?, ?, ?, ?, 1)',
        [r.name, r.rating, r.title, r.text]);
    }
    console.log(`✓ ${REVIEWS.length} reviews added (13×5-star, 7×4-star, 2×2-star, 3×1-star)`);
  }
  
  console.log('✓ Seed complete');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err.message);
  process.exit(1);
});