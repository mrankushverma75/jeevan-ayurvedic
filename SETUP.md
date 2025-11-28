# Quick Setup Guide

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Configure Environment
Create a `.env` file:
```env
DATABASE_URL="mysql://user:password@localhost:3306/jeevan_ayurvedic"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-this-to-a-random-secret-in-production"
JWT_SECRET="change-this-to-a-random-secret-in-production"
JWT_REFRESH_SECRET="change-this-to-a-random-secret-in-production"
```

## Step 3: Setup Database
```bash
# Generate Prisma Client
npm run db:generate

# Create database tables
npm run db:push

# Seed with initial data
npm run db:seed
```

## Step 4: Run Development Server
```bash
npm run dev
```

## Step 5: Login
Visit http://localhost:3000 and login with:
- **Admin**: admin@jeevanayurvedic.com / admin123
- **Employee**: employee@jeevanayurvedic.com / employee123

## Troubleshooting

### Database Connection Issues
- Ensure MySQL is running
- Verify DATABASE_URL is correct
- Check database user has proper permissions

### Authentication Issues
- Make sure NEXTAUTH_SECRET is set
- Clear browser cookies and try again
- Check that users exist in database (run seed script)

### Build Errors
- Delete `.next` folder and `node_modules`
- Run `npm install` again
- Run `npm run db:generate`

