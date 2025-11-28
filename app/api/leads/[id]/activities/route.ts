import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const activitySchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
})

export async function POST(
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

    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Data isolation: Employees can only add activities to their own leads
    if (session.user.role === 'EMPLOYEE' && lead.assignedTo !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const data = activitySchema.parse(body)

    const activity = await prisma.leadActivity.create({
      data: {
        ...data,
        leadId: params.id,
      },
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

