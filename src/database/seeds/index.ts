import { AppDataSource } from '../data-source';
import { User } from '../../shared/entities/user.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import * as bcrypt from 'bcryptjs';

async function seed() {
  const connection = AppDataSource;

  if (!connection.isInitialized) {
    await connection.initialize();
  }

  const userRepository = connection.getRepository(User);
  const walletRepository = connection.getRepository(Wallet);

  console.log('🌱 Seeding database...');

  // Create test users
  const testUsers = [
    {
      email: 'customer@test.com',
      password: 'TestPassword123',
      firstName: 'John',
      lastName: 'Customer',
      role: 'customer',
      phone: '+2348012345678',
    },
    {
      email: 'waiter@test.com',
      password: 'TestPassword123',
      firstName: 'Jane',
      lastName: 'Waiter',
      role: 'waiter',
      phone: '+2348012345679',
    },
    {
      email: 'kitchen@test.com',
      password: 'TestPassword123',
      firstName: 'Chef',
      lastName: 'Kitchen',
      role: 'kitchen_staff',
      phone: '+2348012345680',
    },
    {
      email: 'manager@test.com',
      password: 'TestPassword123',
      firstName: 'Mike',
      lastName: 'Manager',
      role: 'manager',
      phone: '+2348012345681',
    },
    {
      email: 'admin@dlifestyle.com',
      password: 'AdminPassword123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'super_admin',
      phone: '+2348012345682',
    },
  ];

  for (const userData of testUsers) {
    const existingUser = await userRepository.findOne({
      where: { email: userData.email },
    });

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const user = new User();
      user.email = userData.email;
      user.passwordHash = hashedPassword;
      user.firstName = userData.firstName;
      user.lastName = userData.lastName;
      user.phone = userData.phone;
      user.role = userData.role as any;

      const savedUser = await userRepository.save(user);

      // Create wallet for user
      const wallet = new Wallet();
      wallet.userId = savedUser.id;
      wallet.balance = userData.role === 'customer' ? 10000 : 0; // Give test customers 10k
      await walletRepository.save(wallet);

      console.log(`✓ Created user: ${userData.email} (${userData.role})`);
    }
  }

  console.log('✅ Database seeding completed!');

  await connection.destroy();
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
