# Admin Login Setup

## Simple Fix - Do This NOW:

1. Make sure you have `.env.local` with:
```
JWT_SECRET=abcdefghijklmnopqrstuvwxyzabcdef01234567
ADMIN_EMAIL=smokersandgrillsb@gmail.com
ADMIN_PASSWORD=SmokeyzBBQ2024!
SENDGRID_API_KEY=SG.test
```

2. Run this command (one time only):
```bash
npm run create-admin
```

3. Login with:
- Email: `smokersandgrillsb@gmail.com`
- Password: `SmokeyzBBQ2024!`

That's it. The admin user will be created in the database.

If that doesn't work, the database file might be corrupted:
```bash
rm database.db*
npm run create-admin
npm run dev
```

Then try logging in again.
