# Jeevan Ayurvedic - Admin Dashboard

A complete admin dashboard for employee and lead management built with Next.js 14, MySQL, and Prisma.

## Features

### Employee Portal
- **My Leads**: View, create, edit, and delete own leads with filters, search, and activity timeline
- **My Bookings**: Manage bookings with calendar view, create bookings, and update status
- **Dashboard**: Personal KPIs including total leads, active leads, bookings, revenue, and conversion charts

### Admin Portal
- **User Management**: Create, edit, delete users, assign roles, activate/deactivate accounts
- **Roles & Permissions**: RBAC system with granular permissions (coming soon)
- **All Leads**: View all leads across employees, bulk assign leads, filter by employee/status/date
- **All Bookings**: View all bookings, approve/reject pending bookings, cancel bookings with reason
- **Analytics Dashboard**: Company-wide KPIs, revenue trends, lead sources, booking status, employee performance
- **Audit Logs**: View all system changes with filters

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: MySQL 8.0+, Prisma ORM
- **Auth**: NextAuth.js v5 with JWT tokens
- **State**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation

## Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+ database
- Environment variables configured

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="mysql://user:password@localhost:3306/jeevan_ayurvedic"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-change-in-production"
   JWT_SECRET="your-jwt-secret-key-change-in-production"
   JWT_REFRESH_SECRET="your-jwt-refresh-secret-key-change-in-production"
   ```

3. **Setup Database**
   ```bash
   # Generate Prisma Client
   npm run db:generate

   # Push schema to database
   npm run db:push

   # Seed database with initial data
   npm run db:seed
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Access the Application**
   - Open [http://localhost:3000](http://localhost:3000)
   - Login with default credentials:
     - **Admin**: admin@jeevanayurvedic.com / admin123
     - **Employee**: employee@jeevanayurvedic.com / employee123

## Default Credentials

After seeding:
- **Admin User**: admin@jeevanayurvedic.com / admin123
- **Employee User**: employee@jeevanayurvedic.com / employee123

**⚠️ Important**: Change these passwords in production!

## Security Features

- ✅ JWT-based authentication with 15-minute access tokens
- ✅ Role-based access control (RBAC) on all API routes
- ✅ Data isolation: Employees can only access their own data
- ✅ Input validation with Zod on client and server
- ✅ Rate limiting (100 requests per 15 minutes per IP)
- ✅ Audit logging for all CRUD operations
- ✅ Password hashing with bcrypt
- ✅ Server-side permission checks

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Employee portal pages
│   ├── admin/             # Admin portal pages
│   └── login/             # Authentication pages
├── components/            # React components
│   ├── ui/               # Shadcn UI components
│   └── layout/           # Layout components
├── lib/                  # Utility functions
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   ├── permissions.ts    # Permission checking
│   └── audit.ts          # Audit logging
├── prisma/               # Prisma schema and migrations
│   └── schema.prisma     # Database schema
└── types/                # TypeScript type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with initial data

## Database Schema

The application uses the following main models:
- **User**: System users (Admin/Employee)
- **Lead**: Customer leads
- **Booking**: Appointments/bookings
- **Role**: User roles
- **Permission**: System permissions
- **AuditLog**: System activity logs

## API Routes

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth authentication

### Leads
- `GET /api/leads` - List leads (with filters)
- `POST /api/leads` - Create lead
- `GET /api/leads/[id]` - Get lead details
- `PATCH /api/leads/[id]` - Update lead
- `DELETE /api/leads/[id]` - Delete lead
- `POST /api/leads/[id]/activities` - Add activity to lead
- `POST /api/leads/bulk-assign` - Bulk assign leads (Admin only)

### Bookings
- `GET /api/bookings` - List bookings (with filters)
- `POST /api/bookings` - Create booking
- `GET /api/bookings/[id]` - Get booking details
- `PATCH /api/bookings/[id]` - Update booking
- `DELETE /api/bookings/[id]` - Delete booking

### Users (Admin only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/[id]` - Get user details
- `PATCH /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user

### Audit Logs (Admin only)
- `GET /api/audit-logs` - List audit logs (with filters)

## Production Deployment

1. Set up a production MySQL database
2. Update environment variables with production values
3. Generate strong secrets for `NEXTAUTH_SECRET`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`
4. Run database migrations: `npm run db:migrate`
5. Build the application: `npm run build`
6. Start the production server: `npm run start`

## License

This project is proprietary software.

## Support

For issues or questions, please contact the development team.

