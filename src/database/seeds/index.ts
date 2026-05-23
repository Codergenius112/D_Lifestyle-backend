import { AppDataSource } from '../data-source';
import { User } from '../../shared/entities/user.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { ApartmentListing } from '../../shared/entities/apartment-listing.entity';
import { CarListing } from '../../shared/entities/car-listing.entity';
import { TableListing } from '../../shared/entities/table-listing.entity';
import { Event }        from '../../shared/entities/event.entity';
import { MenuItem, MenuCategory } from '../../shared/entities/menu-item.entity';
import { TableCategory } from '../../shared/enums';
import * as bcrypt from 'bcryptjs';

async function seed() {
  const connection = AppDataSource;

  if (!connection.isInitialized) {
    await connection.initialize();
  }

  const userRepository      = connection.getRepository(User);
  const walletRepository    = connection.getRepository(Wallet);
  const apartmentRepository = connection.getRepository(ApartmentListing);
  const carRepository       = connection.getRepository(CarListing);
  const tableRepository     = connection.getRepository(TableListing);
  const menuRepository      = connection.getRepository(MenuItem);
  const eventRepository     = connection.getRepository(Event);

  console.log('🌱 Seeding database...');

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
      user.email        = userData.email;
      user.passwordHash = hashedPassword;
      user.firstName    = userData.firstName;
      user.lastName     = userData.lastName;
      user.phone        = userData.phone;
      user.role         = userData.role as any;

      const savedUser = await userRepository.save(user);

      // Create wallet for user
      const wallet = new Wallet();
      wallet.userId  = savedUser.id;
      wallet.balance = userData.role === 'customer' ? 10000 : 0;
      await walletRepository.save(wallet);

      console.log(`✓ Created user: ${userData.email} (${userData.role})`);
    }
  }

  // ── APARTMENT LISTINGS ─────────────────────────────────────────────────────
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

  // ── CAR LISTINGS ───────────────────────────────────────────────────────────
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

  // ── TABLE LISTINGS ─────────────────────────────────────────────────────────
  const existingTables = await tableRepository.count();
  if (existingTables === 0) {
    const venues = [
      { venueId: 'venue-skylounge' },
      { venueId: 'venue-opulence'  },
    ];

    const tableTemplates = [
      { name: 'Standard Table T1', category: TableCategory.STANDARD, capacity: 2,  price: 15000,  description: 'Intimate 2-seater near the bar',                        features: ['Bar Access', 'Table Service'] },
      { name: 'Standard Table T2', category: TableCategory.STANDARD, capacity: 4,  price: 25000,  description: 'Central 4-seater with dance floor view',                features: ['Dance Floor View', 'Table Service'] },
      { name: 'Standard Table T3', category: TableCategory.STANDARD, capacity: 4,  price: 25000,  description: 'Cozy corner 4-seater',                                   features: ['Corner Position', 'Table Service'] },
      { name: 'Standard Table T4', category: TableCategory.STANDARD, capacity: 6,  price: 35000,  description: 'Large standard table for groups',                        features: ['Group Table', 'Table Service'] },
      { name: 'VIP Table 1',       category: TableCategory.VIP,      capacity: 6,  price: 75000,  description: 'Prime VIP with stage view and dedicated waitress',       features: ['Stage View', 'Dedicated Waitress', 'Bottle Service', 'Priority Entry'] },
      { name: 'VIP Table 2',       category: TableCategory.VIP,      capacity: 6,  price: 75000,  description: 'VIP elevated section with full venue view',              features: ['Elevated Section', 'Dedicated Waitress', 'Bottle Service', 'Priority Entry'] },
      { name: 'VIP Table 3',       category: TableCategory.VIP,      capacity: 8,  price: 95000,  description: 'Large VIP table for group celebrations',                 features: ['Large Group', 'Dedicated Waitress', 'Bottle Service', 'Cake Service'] },
      { name: 'VVIP Booth A',      category: TableCategory.VVIP,     capacity: 10, price: 200000, description: 'Front-centre stage, private section with personal host',  features: ['Centre Stage', 'Private Section', 'Personal Host', 'Unlimited Bottles', 'VIP Entry'] },
      { name: 'VVIP Booth B',      category: TableCategory.VVIP,     capacity: 8,  price: 150000, description: 'Premium booth with panoramic venue view',                features: ['Private Booth', 'Panoramic View', 'Personal Host', 'Bottle Service', 'VIP Entry'] },
    ];

    for (const venue of venues) {
      for (const t of tableTemplates) {
        const listing = tableRepository.create({ ...t, venueId: venue.venueId, isActive: true });
        await tableRepository.save(listing);
      }
      console.log(`✓ Seeded ${tableTemplates.length} tables for venue: ${venue.venueId}`);
    }
  } else {
    console.log('⏭  Table listings already seeded, skipping.');
  }

  // ── MENU ITEMS ─────────────────────────────────────────────────────────────
  const existingMenuItems = await menuRepository.count();
  if (existingMenuItems === 0) {
    const venues = [
      { venueId: 'venue-skylounge' },
      { venueId: 'venue-opulence'  },
    ];

    const menuTemplates = [
      // FOOD
      { name: 'Asun (Peppered Goat)',     category: MenuCategory.FOOD,      price: 8500,   description: 'Spicy peppered goat meat, sliced and grilled',      sortOrder: 1 },
      { name: 'Catfish Peppersoup',       category: MenuCategory.FOOD,      price: 7000,   description: 'Spicy catfish pepper soup with yam',                sortOrder: 2 },
      { name: 'Suya Platter',            category: MenuCategory.FOOD,      price: 6000,   description: 'Skewered spiced beef with onions and tomatoes',      sortOrder: 3 },
      { name: 'Peppered Chicken Wings',  category: MenuCategory.FOOD,      price: 7500,   description: '6 pcs crispy wings in house pepper sauce',           sortOrder: 4 },
      { name: 'Club Sandwich',           category: MenuCategory.FOOD,      price: 5500,   description: 'Triple-decker with chicken, bacon, egg',             sortOrder: 5 },
      { name: 'Grilled Tilapia',         category: MenuCategory.FOOD,      price: 9000,   description: 'Whole tilapia grilled with peppers and spices',      sortOrder: 6 },
      // DRINKS
      { name: 'Hennessy VS (Glass)',     category: MenuCategory.DRINKS,    price: 4500,   description: 'Single serve',                                       sortOrder: 1 },
      { name: 'Ciroc Vodka (Glass)',     category: MenuCategory.DRINKS,    price: 4000,   description: 'Single serve with mixer',                            sortOrder: 2 },
      { name: 'Guinness Stout',          category: MenuCategory.DRINKS,    price: 1500,   description: '60cl bottle',                                        sortOrder: 3 },
      { name: 'Star Lager',              category: MenuCategory.DRINKS,    price: 1200,   description: '60cl bottle',                                        sortOrder: 4 },
      { name: 'Moet & Chandon (Glass)',  category: MenuCategory.DRINKS,    price: 5000,   description: 'NV Brut, single flute',                              sortOrder: 5 },
      { name: 'Still Water (75cl)',      category: MenuCategory.DRINKS,    price: 500,    description: '75cl bottle',                                        sortOrder: 6 },
      // COCKTAILS
      { name: 'Lagos Sunrise',           category: MenuCategory.COCKTAILS, price: 5500,   description: 'Vodka, grenadine, orange juice, lime',               sortOrder: 1 },
      { name: 'Afrobeats Sour',          category: MenuCategory.COCKTAILS, price: 5500,   description: 'Whisky, passion fruit, lemon, egg white',            sortOrder: 2 },
      { name: 'Naija Mule',              category: MenuCategory.COCKTAILS, price: 5000,   description: 'Rum, ginger beer, lime, mint',                       sortOrder: 3 },
      { name: 'Mojito',                  category: MenuCategory.COCKTAILS, price: 5000,   description: 'White rum, mint, lime, soda',                        sortOrder: 4 },
      { name: 'Long Island Iced Tea',    category: MenuCategory.COCKTAILS, price: 6000,   description: 'Vodka, gin, rum, tequila, triple sec, cola',         sortOrder: 5 },
      // BOTTLES
      { name: 'Hennessy VS (Bottle)',    category: MenuCategory.BOTTLES,   price: 55000,  description: '700ml, served with mixers and ice',                  sortOrder: 1 },
      { name: 'Hennessy VSOP (Bottle)',  category: MenuCategory.BOTTLES,   price: 85000,  description: '700ml, premium serve',                               sortOrder: 2 },
      { name: 'Ciroc Vodka (Bottle)',    category: MenuCategory.BOTTLES,   price: 48000,  description: '700ml, served with cranberry and tonic',             sortOrder: 3 },
      { name: 'Ace of Spades',           category: MenuCategory.BOTTLES,   price: 250000, description: 'Armand de Brignac Brut Gold, 750ml',                 sortOrder: 4 },
      { name: 'Moet & Chandon (Bottle)', category: MenuCategory.BOTTLES,   price: 45000,  description: 'NV Brut Imperial, 750ml',                            sortOrder: 5 },
      { name: 'Dom Perignon',            category: MenuCategory.BOTTLES,   price: 180000, description: '750ml, vintage',                                     sortOrder: 6 },
      // DESSERTS
      { name: 'Chocolate Lava Cake',     category: MenuCategory.DESSERTS,  price: 4500,   description: 'Warm chocolate cake, vanilla ice cream',             sortOrder: 1 },
      { name: 'Puff Puff (6 pcs)',       category: MenuCategory.DESSERTS,  price: 2500,   description: 'Nigerian fried dough, cinnamon sugar',               sortOrder: 2 },
      { name: 'Chin Chin Platter',       category: MenuCategory.DESSERTS,  price: 2000,   description: 'Crunchy fried pastry snack',                         sortOrder: 3 },
    ];

    for (const venue of venues) {
      for (const item of menuTemplates) {
        const menuItem = menuRepository.create({ ...item, venueId: venue.venueId, isAvailable: true });
        await menuRepository.save(menuItem);
      }
      console.log(`✓ Seeded ${menuTemplates.length} menu items for venue: ${venue.venueId}`);
    }
  } else {
    console.log('⏭  Menu items already seeded, skipping.');
  }


  // ── EVENTS ────────────────────────────────────────────────────────────────────
  const existingEvents = await eventRepository.count();
  if (existingEvents === 0) {
    const now = new Date();

    const events = [
      {
        name:        'Afrobeats Night Lagos',
        description: 'The biggest Afrobeats party in Lagos. Expect top DJs, premium bottle service, and an electric atmosphere that will keep you dancing till dawn. Dress to impress — smart casual required.',
        venueId:     'venue-skylounge',
        venueName:   'Sky Lounge Lagos',
        startDate:   new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 22, 0, 0),
        endDate:     new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 4, 0, 0),
        capacity:    500,
        djs:         ['DJ Neptune', 'Spinall', 'DJ Consequence'],
        genre:       'Afrobeats',
        dresscode:   'Smart Casual',
        status:      'active',
        images:      [],
        ticketPrice: 10000,
      },
      {
        name:        'Opulence Gala Night',
        description: 'An exclusive black-tie evening at Opulence Club VI. Limited tickets available. VIP table packages include champagne on arrival, curated 5-course dinner, and live saxophone performance.',
        venueId:     'venue-opulence',
        venueName:   'Opulence Club VI',
        startDate:   new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 20, 0, 0),
        endDate:     new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15, 2, 0, 0),
        capacity:    200,
        djs:         ['DJ Jimmy Jatt', 'Teni'],
        genre:       'Afro Soul',
        dresscode:   'Black Tie',
        status:      'active',
        images:      [],
        ticketPrice: 25000,
      },
      {
        name:        'Sky High Fridays',
        description: 'The weekly Friday night experience at Sky Lounge. Rooftop views of Lagos, world-class cocktails, and a rotating lineup of the hottest DJs in the city. Walk-ins welcome before 10pm.',
        venueId:     'venue-skylounge',
        venueName:   'Sky Lounge Lagos',
        startDate:   new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 21, 0, 0),
        endDate:     new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4, 3, 0, 0),
        capacity:    350,
        djs:         ['DJ Tunez', 'DJ Obi'],
        genre:       'Afropop / House',
        dresscode:   'Casual Chic',
        status:      'active',
        images:      [],
        ticketPrice: 5000,
      },
    ];

    for (const data of events) {
      const event = eventRepository.create(data);
      await eventRepository.save(event);
      console.log(` Created event: ${data.name}`);
    }
  } else {
    console.log('  Events already seeded, skipping.');
  }

  console.log(' Database seeding completed!');
  await connection.destroy();
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});