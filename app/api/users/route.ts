import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { requirePermission } from '@/lib/permissions'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'EMPLOYEE']),
  isActive: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await requirePermission(session.user.id, 'users', 'read')

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        include: {
          roleAssignments: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ])

    // Remove password from response
    const usersWithoutPassword = users.map(({ password, ...user }) => user)

    return NextResponse.json({
      data: usersWithoutPassword,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    if (error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error fetching users:', error)
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

    await requirePermission(session.user.id, 'users', 'create')

    const body = await req.json()
    const data = userSchema.parse(body)

    // Hash password if provided
    let hashedPassword = ''
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10)
    } else {
      // Generate a random password if not provided
      hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-8), 10)
    }

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await createAuditLog(
      session.user.id,
      'CREATE',
      'User',
      user.id,
      { ...data, password: '[REDACTED]' },
      `Created user: ${user.name}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    return NextResponse.json(user, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

