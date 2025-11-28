import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { requirePermission } from '@/lib/permissions'
import { z } from 'zod'

const bulkAssignSchema = z.object({
  leadIds: z.array(z.string()),
  assignedTo: z.string().min(1),
})

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

    await requirePermission(session.user.id, 'leads', 'update')

    const body = await req.json()
    const { leadIds, assignedTo } = bulkAssignSchema.parse(body)

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: assignedTo },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update leads
    const result = await prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
      },
      data: {
        assignedTo,
      },
    })

    // Create audit logs
    for (const leadId of leadIds) {
      await createAuditLog(
        session.user.id,
        'ASSIGN',
        'Lead',
        leadId,
        { assignedTo },
        `Bulk assigned lead to ${user.name}`,
        ip,
        req.headers.get('user-agent') || undefined
      )
    }

    return NextResponse.json({ success: true, count: result.count })
  } catch (error: any) {
    if (error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error bulk assigning leads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

