import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const orderSchema = z.object({
  leadId: z.string().min(1),
  receivedAmount: z.number().min(0),
  paymentStatus: z.enum(['PENDING', 'PARTIAL', 'FULL', 'CUSTOM']),
  paymentMethod: z.string().optional(),
  moneyOrderNumber: z.string().optional(),
  totalAmount: z.number().min(0),
  vppAmount: z.number().min(0),
  // Address fields
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  addressLine4: z.string().optional(),
  addressLine5: z.string().optional(),
  addressLine6: z.string().optional(),
  pincodeId: z.string().optional(),
  cityId: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  station: z.string().optional(),
  notes: z.string().optional(),
})

// Generate order number
function generateOrderNumber(): string {
  const prefix = 'G'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}${timestamp}${random}`
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const paymentStatus = searchParams.get('paymentStatus')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}

    // Data isolation: Employees can only see their own orders
    if (session.user.role === 'EMPLOYEE') {
      where.assignedTo = session.user.id
    }

    if (status) {
      where.status = status
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus
    }
    if (startDate || endDate) {
      where.dispatchDate = {}
      if (startDate) where.dispatchDate.gte = new Date(startDate)
      if (endDate) where.dispatchDate.lte = new Date(endDate)
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { patientName: { contains: search } },
        { trackingId: { contains: search } },
        { lead: { phone: { contains: search } } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              disease: true,
            },
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          city: {
            select: {
              id: true,
              city: true,
              state: true,
            },
          },
          pincode: {
            select: {
              id: true,
              pincode: true,
              area: true,
            },
          },
          payments: {
            orderBy: { receivedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json()
    const data = orderSchema.parse(body)

    // Get lead information
    const lead = await prisma.lead.findUnique({
      where: { id: data.leadId },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Employees can only assign orders to themselves
    const assignedTo = session.user.role === 'ADMIN' ? (body.assignedTo || session.user.id) : session.user.id

    // Generate order number
    let orderNumber = generateOrderNumber()
    let exists = await prisma.order.findUnique({ where: { orderNumber } })
    while (exists) {
      orderNumber = generateOrderNumber()
      exists = await prisma.order.findUnique({ where: { orderNumber } })
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        ...data,
        leadId: data.leadId,
        orderNumber,
        patientName: lead.name,
        patientId: orderNumber, // Use order number as patient ID initially
        assignedTo,
        status: 'PENDING',
        bookedBy: session.user.id,
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create initial payment record
    if (data.receivedAmount > 0) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: data.receivedAmount,
          paymentType: 'INITIAL',
          paymentMethod: data.paymentMethod || 'MONEY_ORDER',
          referenceNumber: data.moneyOrderNumber,
          receivedBy: session.user.id,
        },
      })
    }

    // Update lead status to CONVERTED
    await prisma.lead.update({
      where: { id: data.leadId },
      data: { status: 'CONVERTED' },
    })

    await createAuditLog(
      session.user.id,
      'CREATE',
      'Order',
      order.id,
      { ...data, orderNumber },
      `Created order from lead: ${lead.name}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    // Notify the assigned user if they're not the creator
    if (assignedTo !== session.user.id) {
      await createNotification({
        userId: assignedTo,
        type: 'ORDER_CREATED',
        title: 'New Order Created',
        message: `A new order ${orderNumber} has been created from lead: ${lead.name}`,
        entityType: 'Order',
        entityId: order.id,
      })
    }

    // Notify admin if employee created order
    if (session.user.role === 'EMPLOYEE') {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
      })
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'ORDER_CREATED',
          title: 'New Order Created',
          message: `Employee ${session.user.name} created order ${orderNumber} from lead: ${lead.name}`,
          entityType: 'Order',
          entityId: order.id,
        })
      }
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

