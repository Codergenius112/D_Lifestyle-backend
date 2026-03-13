import { AppDataSource } from '../data-source';
import { User } from '../../shared/entities/user.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { ApartmentListing } from '../../shared/entities/apartment-listing.entity';
import { CarListing } from '../../shared/entities/car-listing.entity';
import * as bcrypt from 'bcryptjs';

async function seed() {
  const connection = AppDataSource;

  if (!connection.isInitialized) {
    await connection.initialize();
  }

  const userRepository = connection.getRepository(User);
  const walletRepository = connection.getRepository(Wallet);
  const apartmentRepository = connection.getRepository(ApartmentListing);
  const carRepository = connection.getRepository(CarListing);

  console.log(' Seeding database...');

  // ── USERS ──────────────────────────────────────────────────────────────────
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
      wallet.balance = userData.role === 'customer' ? 10000 : 0;
      await walletRepository.save(wallet);

      console.log(` Created user: ${userData.email} (${userData.role})`);
    }
  }

  // ── APARTMENT LISTINGS ────────────────────────────────────────────────────
  const existingApartments = await apartmentRepository.count();
  if (existingApartments === 0) {
    const apartments = [
      {
        name: 'The Lekki Heights Suite',
        description:
          'A modern luxury apartment in the heart of Lekki Phase 1. Floor-to-ceiling windows, premium furnishings, and 24/7 concierge service. Perfect for executives and couples seeking a high-end Lagos experience.',
        address: '14 Admiralty Way, Lekki Phase 1',
        city: 'Lagos',
        state: 'Lagos',
        pricePerNight: 45000,
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 4,
        amenities: ['WiFi', 'AC', 'Smart TV', 'Kitchen', 'Washer', 'Gym Access', 'Pool', 'Security', 'Parking'],
        images: [],
      },
      {
        name: 'Victoria Island Executive Studio',
        description:
          'Sleek studio apartment steps from the VI business district. Ideal for business travellers. Fully equipped kitchen, high-speed fibre internet, and blackout blinds for quality rest after long meetings.',
        address: '7 Kofo Abayomi Street, Victoria Island',
        city: 'Lagos',
        state: 'Lagos',
        pricePerNight: 28000,
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 2,
        amenities: ['WiFi', 'AC', 'Smart TV', 'Kitchen', 'Workspace', 'Security', 'Parking'],
        images: [],
      },
      {
        name: 'Ikoyi Garden Penthouse',
        description:
          'A stunning 3-bedroom penthouse with a private rooftop terrace overlooking Lagos Lagoon. Designed for those who want the very best — full smart home integration, private chef available on request.',
        address: '3 Bourdillon Road, Ikoyi',
        city: 'Lagos',
        state: 'Lagos',
        pricePerNight: 120000,
        bedrooms: 3,
        bathrooms: 3,
        maxGuests: 6,
        amenities: [
          'WiFi', 'AC', 'Smart TV', 'Kitchen', 'Washer', 'Rooftop Terrace',
          'Pool', 'Gym', 'Security', 'Parking', 'Chef Available',
        ],
        images: [],
      },
      {
        name: 'Abuja Central Apartment',
        description:
          'Comfortable and modern 2-bedroom apartment in the Wuse 2 district. Close to restaurants, embassies, and shopping centres. Great base for exploring Abuja or attending conferences.',
        address: '22 Aminu Kano Crescent, Wuse 2',
        city: 'Abuja',
        state: 'FCT',
        pricePerNight: 35000,
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        amenities: ['WiFi', 'AC', 'Smart TV', 'Kitchen', 'Parking', 'Security'],
        images: [],
      },
    ];

    for (const data of apartments) {
      const listing = apartmentRepository.create(data);
      await apartmentRepository.save(listing);
      console.log(`✓ Created apartment listing: ${data.name}`);
    }
  } else {
    console.log('⏭  Apartment listings already seeded, skipping.');
  }

  // ── CAR LISTINGS ──────────────────────────────────────────────────────────
  const existingCars = await carRepository.count();
  if (existingCars === 0) {
    const cars = [
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2022,
        color: 'Pearl White',
        plateNumber: 'LAG-123-AA',
        transmission: 'automatic',
        category: 'sedan',
        seats: 5,
        pricePerDay: 25000,
        description:
          'Clean and reliable Toyota Camry. Perfect for business trips or airport runs around Lagos. Well-maintained with full AC and Bluetooth connectivity.',
        features: ['AC', 'Bluetooth', 'USB Charging', 'Reverse Camera'],
        images: [],
        city: 'Lagos',
        state: 'Lagos',
        withDriver: false,
      },
      {
        make: 'Toyota',
        model: 'Land Cruiser',
        year: 2021,
        color: 'Black',
        plateNumber: 'LAG-456-BB',
        transmission: 'automatic',
        category: 'suv',
        seats: 7,
        pricePerDay: 65000,
        description:
          'Premium Toyota Land Cruiser for those who demand comfort and capability. Ideal for family trips, VIP airport transfers, or venturing outside the city.',
        features: ['AC', 'Leather Seats', 'Sunroof', 'Bluetooth', 'USB Charging', 'GPS'],
        images: [],
        city: 'Lagos',
        state: 'Lagos',
        withDriver: true,
      },
      {
        make: 'Mercedes-Benz',
        model: 'E-Class',
        year: 2023,
        color: 'Obsidian Black',
        plateNumber: 'LAG-789-CC',
        transmission: 'automatic',
        category: 'luxury',
        seats: 5,
        pricePerDay: 90000,
        description:
          'Step out in style with the Mercedes-Benz E-Class. Our most popular luxury vehicle for weddings, corporate events, and special occasions. Includes a professional driver.',
        features: [
          'AC', 'Leather Seats', 'Massage Seats', 'Sunroof',
          'Premium Sound', 'Bluetooth', 'USB Charging', 'GPS',
        ],
        images: [],
        city: 'Lagos',
        state: 'Lagos',
        withDriver: true,
      },
      {
        make: 'Toyota',
        model: 'Hiace Bus',
        year: 2020,
        color: 'Silver',
        plateNumber: 'ABJ-321-DD',
        transmission: 'manual',
        category: 'van',
        seats: 14,
        pricePerDay: 40000,
        description:
          'Spacious Toyota Hiace for group travel, corporate shuttles, or event transportation in Abuja. Comfortable seating for up to 14 passengers with ample luggage space.',
        features: ['AC', 'Bluetooth', 'USB Charging', 'Luggage Space'],
        images: [],
        city: 'Abuja',
        state: 'FCT',
        withDriver: true,
      },
    ];

    for (const data of cars) {
      const listing = carRepository.create(data);
      await carRepository.save(listing);
      console.log(`✓ Created car listing: ${data.year} ${data.make} ${data.model}`);
    }
  } else {
    console.log('⏭  Car listings already seeded, skipping.');
  }

  console.log(' Database seeding completed!');
  await connection.destroy();
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});