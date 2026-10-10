// Usage: npm run create-admin -- you@example.com "a strong password"
// Creates an admin account, or promotes an existing account to admin and resets its password.
import { getDb, nowIso } from '../server/db';
import { createUser, findUserByEmail, hashPassword } from '../server/auth';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- <email> <password (8+ characters)>');
  process.exit(1);
}
const existing = findUserByEmail(email);
if (existing) {
  getDb().prepare("update users set role = 'admin', status = 'active', password_hash = ?, updated_at = ? where id = ?").run(await hashPassword(password), nowIso(), existing.id);
  console.log(`✔ ${email} is now an admin (password updated).`);
} else {
  await createUser({ email, password, role: 'admin', name: 'Admin' });
  console.log(`✔ Admin account created for ${email}.`);
}
