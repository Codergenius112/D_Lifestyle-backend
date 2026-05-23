# D'Lifestyle Backend

Production-ready NestJS backend for the D'Lifestyle platform - a unified lifestyle, nightlife, and venue-operations platform.

## Features

- 🎫 Ticket booking & event management
- 🪑 Table reservations with group bookings
- 🏠 Apartment booking system
- 🚗 Car rental management
- 🍔 In-venue digital ordering
- 📊 Real-time queue management
- 💳 Payment processing & wallet system
- 📝 Immutable audit logging
- 🔐 Role-based access control
- 📊 Analytics & reporting

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: NestJS 10
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **API**: REST with Swagger docs
- **Payment**: Paystack integration
- **Deployment**: Docker + AWS ECS

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15
- Redis 7

### Local Development

1. Clone the repository
```bash
git clone <repo-url>
cd dlifestyle-backend
```

2. Install dependencies
```bash
npm install
```

3. Setup environment
```bash
cp .env.example .env
```

4. Start with Docker Compose
```bash
npm run docker:dev
```

5. Run migrations
```bash
npm run db:migrate
```

6. Access API
- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/api/docs

### Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run test             # Run unit tests
npm run test:e2e         # Run e2e tests
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed initial data
npm run docker:dev       # Start with Docker Compose
npm run docker:prod      # Start production containers
```

## Project Structure

```
src/
├── config/              # Configuration files
├── common/              # Shared utilities, guards, pipes
├── database/            # TypeORM migrations & seeds
├── modules/             # Feature modules
│   ├── auth/            # Authentication
│   ├── bookings/        # Core booking engine
│   ├── payments/        # Payment & wallet
│   ├── tickets/         # Ticketing
│   ├── tables/          # Table bookings
│   ├── apartments/      # Apartment bookings
│   ├── cars/            # Car rentals
│   ├── orders/          # In-venue orders
│   ├── queues/          # Queue management
│   ├── notifications/   # Notifications
│   ├── analytics/       # Analytics & reporting
│   ├── audit/           # Audit logging
│   ├── admin/           # Admin operations
│   └── events/          # Event management
└── shared/              # Shared entities, DTOs, interfaces
```

## API Documentation

Full API documentation available at `/api/docs` (Swagger UI)

### Core Endpoints

- `POST /auth/login` - User login
- `POST /bookings` - Create booking
- `GET /bookings/:id` - Get booking details
- `POST /payments` - Process payment
- `GET /orders` - List orders
- `POST /orders` - Create order
- `GET /admin/analytics` - Analytics dashboard

## Database Schema

See `database/migrations/` for all table definitions.

### Key Tables
- `users` - User accounts
- `bookings` - All booking records
- `payment_transactions` - Payment history
- `orders` - In-venue orders
- `audit_logs` - Immutable activity logs
- `financial_ledger` - Double-entry accounting

## Deployment

### AWS ECS Deployment

```bash
# Build Docker image
npm run docker:build

# Push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <your-ecr-url>

docker tag dlifestyle-backend:latest <your-ecr-url>/dlifestyle-backend:latest
docker push <your-ecr-url>/dlifestyle-backend:latest

# Deploy with ECS Fargate
# See scripts/deployment/ for deployment scripts
```

## Environment Variables

See `.env.example` for all required environment variables.

### Critical Variables
- `DATABASE_*` - PostgreSQL connection
- `REDIS_*` - Redis connection
- `JWT_SECRET` - JWT signing key
- `PAYSTACK_SECRET_KEY` - Paystack API key
- `AWS_*` - AWS credentials for S3

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Coverage
npm run test -- --coverage
```

## Contributing

1. Create feature branch: `git checkout -b feature/xyz`
2. Commit changes: `git commit -m "feat: xyz"`
3. Push branch: `git push origin feature/xyz`
4. Open Pull Request

## Support

For issues and questions, contact: support@dlifestyle.com

## License

MIT License - See LICENSE file for details
# D_Lifestyle-backend
