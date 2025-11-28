import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jeevanayurvedic.com' },
    update: {},
    create: {
      email: 'admin@jeevanayurvedic.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log('Created admin user:', admin.email)

  // Create sample employee
  const employeePassword = await bcrypt.hash('employee123', 10)
  const employee = await prisma.user.upsert({
    where: { email: 'employee@jeevanayurvedic.com' },
    update: {},
    create: {
      email: 'employee@jeevanayurvedic.com',
      password: employeePassword,
      name: 'Employee User',
      role: 'EMPLOYEE',
      isActive: true,
    },
  })

  console.log('Created employee user:', employee.email)

  // Create sample leads (only if they don't exist)
  const existingLeads = await prisma.lead.findMany({
    where: {
      assignedTo: employee.id,
    },
  })

  let leads = existingLeads
  if (existingLeads.length === 0) {
    leads = await Promise.all([
      prisma.lead.create({
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          source: 'WEBSITE',
          status: 'NEW',
          priority: 'HIGH',
          notes: 'Interested in our services',
          assignedTo: employee.id,
        },
      }),
      prisma.lead.create({
        data: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+1234567891',
          source: 'REFERRAL',
          status: 'QUALIFIED',
          priority: 'MEDIUM',
          notes: 'Follow up next week',
          assignedTo: employee.id,
        },
      }),
    ])
  }

  console.log('Created sample leads:', leads.length)

  // Create sample orders (only if they don't exist)
  const existingOrders = await prisma.order.findMany({
    where: {
      assignedTo: employee.id,
    },
  })

  let orders = existingOrders
  if (existingOrders.length === 0 && leads.length > 0) {
    const orderNumber = `G${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    orders = await Promise.all([
      prisma.order.create({
        data: {
          leadId: leads[0].id,
          orderNumber,
          patientName: leads[0].name,
          totalAmount: 5000,
          vppAmount: 5000,
          receivedAmount: 2500,
          paymentStatus: 'PARTIAL',
          status: 'PENDING',
          assignedTo: employee.id,
          bookedBy: employee.id,
        },
      }),
    ])
  }

  console.log('Created sample orders:', orders.length)

  console.log('Seeding completed!')
  console.log('\nDefault credentials:')
  console.log('Admin: admin@jeevanayurvedic.com / admin123')
  console.log('Employee: employee@jeevanayurvedic.com / employee123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

