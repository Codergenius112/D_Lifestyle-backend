/**
 * Standalone script to seed the super_admin user.
 *
 * All credentials are read from environment variables — never hardcoded.
 *
 * Required env vars:
 *   SUPER_ADMIN_EMAIL     - super admin email
 *   SUPER_ADMIN_PASSWORD  - super admin password
 *   SUPER_ADMIN_FIRSTNAME - first name (optional, defaults to "Admin")
 *   SUPER_ADMIN_LASTNAME  - last name (optional, defaults to "User")
 *
 * Plus the usual DATABASE_* vars for the connection.
 *
 * Usage (local):
 *   npm run build
 *   dotenv -e .env -- npm run db:seed:superadmin
 *
 * Usage (Railway shell):
 *   node dist/scripts/seed-superadmin.js
 *   (Set env vars in Railway dashboard first)
 */
import { AppDataSource } from '../database/data-source';
import { User } from '../shared/entities/user.entity';
import { Wallet } from '../shared/entities/wallet.entity';
import * as bcrypt from 'bcryptjs';

const email    = process.env.SUPER_ADMIN_EMAIL!;
const password = process.env.SUPER_ADMIN_PASSWORD!;
const firstName = process.env.SUPER_ADMIN_FIRSTNAME || 'Admin';
const lastName  = process.env.SUPER_ADMIN_LASTNAME  || 'User';

if (!email || !password) {
  console.error('ERROR: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set as environment variables.');
  console.error('Set them in your .env file or Railway environment, never in source code.');
  process.exit(1);
}

async function seedSuperAdmin() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const userRepository = AppDataSource.getRepository(User);
  const walletRepository = AppDataSource.getRepository(Wallet);

  const existing = await userRepository.findOne({
    where: { email },
  });

  if (existing) {
    console.log(`Super admin already exists: ${email} (role: ${existing.role})`);
    await AppDataSource.destroy();
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = new User();
  user.email        = email;
  user.passwordHash = hashedPassword;
  user.firstName    = firstName;
  user.lastName     = lastName;
  user.phone        = '';
  user.role         = 'super_admin' as any;
  user.isActive     = true;

  const savedUser = await userRepository.save(user);

  const wallet = new Wallet();
  wallet.userId  = savedUser.id;
  wallet.balance = 0;
  await walletRepository.save(wallet);

  console.log(`Super admin created: ${email}`);
  console.log('Role: super_admin');

  await AppDataSource.destroy();
}

seedSuperAdmin().catch((error) => {
  console.error('Failed to seed super admin:', error);
  process.exit(1);
});
