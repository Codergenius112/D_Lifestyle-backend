/**
 * Standalone script to seed the super_admin user.
 *
 * Usage (local):
 *   npm run build
 *   dotenv -e .env -- node dist/scripts/seed-superadmin.js
 *
 * Usage (Railway shell):
 *   node dist/scripts/seed-superadmin.js
 *
 * The script uses the same DATABASE_* env vars that the app uses,
 * so it works against any environment (local, Railway, etc.).
 */
import { AppDataSource } from '../database/data-source';
import { User } from '../shared/entities/user.entity';
import { Wallet } from '../shared/entities/wallet.entity';
import * as bcrypt from 'bcryptjs';

const SUPER_ADMIN = {
  email: 'admin@dlifestyle.com',
  password: 'AdminPassword123',
  firstName: 'Admin',
  lastName: 'User',
  role: 'super_admin',
  phone: '+2348012345682',
};

async function seedSuperAdmin() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const userRepository = AppDataSource.getRepository(User);
  const walletRepository = AppDataSource.getRepository(Wallet);

  const existing = await userRepository.findOne({
    where: { email: SUPER_ADMIN.email },
  });

  if (existing) {
    console.log(`Super admin already exists: ${SUPER_ADMIN.email} (role: ${existing.role})`);
    await AppDataSource.destroy();
    return;
  }

  const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 12);

  const user = new User();
  user.email = SUPER_ADMIN.email;
  user.passwordHash = hashedPassword;
  user.firstName = SUPER_ADMIN.firstName;
  user.lastName = SUPER_ADMIN.lastName;
  user.phone = SUPER_ADMIN.phone;
  user.role = SUPER_ADMIN.role as any;
  user.isActive = true;

  const savedUser = await userRepository.save(user);

  const wallet = new Wallet();
  wallet.userId = savedUser.id;
  wallet.balance = 0;
  await walletRepository.save(wallet);

  console.log(`Super admin created: ${SUPER_ADMIN.email}`);
  console.log(`Password: ${SUPER_ADMIN.password}`);
  console.log(`Role: ${SUPER_ADMIN.role}`);

  await AppDataSource.destroy();
}

seedSuperAdmin().catch((error) => {
  console.error('Failed to seed super admin:', error);
  process.exit(1);
});
