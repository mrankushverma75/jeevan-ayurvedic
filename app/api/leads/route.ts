import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const leadSchema = z.object({
  // Patient Information
  name: z.string().min(1),
  fatherName: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  age: z.number().int().positive().optional(),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  alternatePhone: z.string().optional(),
  
  // Medical Information
  disease: z.string().optional(),
  duration: z.string().optional(),
  patientHistory: z.string().optional(),
  vppAmount: z.number().min(0).optional(),
  
  // Address Information
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
  
  // Communication Preferences
  preferredLanguage: z.string().optional(),
  preferredCommunication: z.string().optional(),
  
  // Lead Management
  source: z.enum(['WHATSAPP', 'SOCIAL_MEDIA', 'WEBSITE', 'REFERRAL', 'PHONE_CALL', 'OTHER']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  notes: z.string().optional(),
})

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
    const priority = searchParams.get('priority')
    const source = searchParams.get('source')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}

    // Data isolation: Employees can only see their own leads
    if (session.user.role === 'EMPLOYEE') {
      where.assignedTo = session.user.id
    }

    if (status) {
      where.status = status
    }
    if (priority) {
      where.priority = priority
    }
    if (source) {
      where.source = source
    }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { disease: { contains: search } },
      ]
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
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
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ])

    return NextResponse.json({
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
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
    const data = leadSchema.parse(body)

    // Employees can only assign leads to themselves
    const assignedTo = session.user.role === 'ADMIN' ? (body.assignedTo || session.user.id) : session.user.id

    const lead = await prisma.lead.create({
      data: {
        ...data,
        assignedTo,
        status: data.status || 'NEW',
        priority: data.priority || 'MEDIUM',
        source: data.source || 'OTHER',
      },
      include: {
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
      },
    })

    await createAuditLog(
      session.user.id,
      'CREATE',
      'Lead',
      lead.id,
      { ...data, assignedTo },
      `Created lead: ${lead.name}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    // Get current user details for notifications
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, role: true },
    })

    // Notify the assigned user if they're not the creator (admin assigning to employee)
    if (assignedTo !== session.user.id) {
      await createNotification({
        userId: assignedTo,
        type: 'LEAD_ASSIGNED',
        title: 'New Lead Assigned',
        message: `You have been assigned a new lead: ${lead.name}`,
        entityType: 'Lead',
        entityId: lead.id,
      })
    }

    // Notify admins when employee creates a lead
    if (currentUser?.role === 'EMPLOYEE') {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
      })
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'LEAD_ASSIGNED',
          title: 'New Lead Created',
          message: `Employee ${currentUser.name} created a new lead: ${lead.name}`,
          entityType: 'Lead',
          entityId: lead.id,
        })
      }
    }

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
