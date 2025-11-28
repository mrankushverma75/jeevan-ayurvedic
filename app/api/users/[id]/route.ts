import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { requirePermission } from '@/lib/permissions'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const userSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await requirePermission(session.user.id, 'users', 'read')

    const user = await prisma.user.findUnique({
      where: { id: params.id },
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
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { password, ...userWithoutPassword } = user
    return NextResponse.json(userWithoutPassword)
  } catch (error: any) {
    if (error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    await requirePermission(session.user.id, 'users', 'update')

    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = userSchema.parse(body)

    const updateData: any = { ...data }

    // Hash password if provided
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    } else {
      delete updateData.password
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
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
      'UPDATE',
      'User',
      user.id,
      { old: existingUser, new: user },
      `Updated user: ${user.name}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    return NextResponse.json(user)
  } catch (error: any) {
    if (error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    await requirePermission(session.user.id, 'users', 'delete')

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent self-deletion
    if (user.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    await createAuditLog(
      session.user.id,
      'DELETE',
      'User',
      params.id,
      user,
      `Deleted user: ${user.name}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

