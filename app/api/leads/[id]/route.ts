import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const leadSchema = z.object({
  name: z.string().min(1).optional(),
  fatherName: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  age: z.number().int().positive().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  alternatePhone: z.string().optional(),
  disease: z.string().optional(),
  duration: z.string().optional(),
  patientHistory: z.string().optional(),
  vppAmount: z.number().min(0).optional(),
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
  preferredLanguage: z.string().optional(),
  preferredCommunication: z.string().optional(),
  source: z.enum(['WHATSAPP', 'SOCIAL_MEDIA', 'WEBSITE', 'REFERRAL', 'PHONE_CALL', 'OTHER']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
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

    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
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
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            payments: {
              orderBy: { receivedAt: 'desc' },
            },
          },
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Data isolation: Employees can only access their own leads
    if (session.user.role === 'EMPLOYEE' && lead.assignedTo !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error fetching lead:', error)
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

    const existingLead = await prisma.lead.findUnique({
      where: { id: params.id },
    })

    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Data isolation: Employees can only update their own leads
    if (session.user.role === 'EMPLOYEE' && existingLead.assignedTo !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    console.log('Lead update request body:', JSON.stringify(body, null, 2))
    const data = leadSchema.parse(body)
    console.log('Parsed lead data:', JSON.stringify(data, null, 2))
    console.log('Existing lead status:', existingLead.status)

    // Employees cannot reassign leads
    if (session.user.role === 'EMPLOYEE' && 'assignedTo' in data) {
      delete data.assignedTo
    }

    // Get current user details for notifications
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, role: true },
    })
    console.log('Current user:', currentUser)

    const lead = await prisma.lead.update({
      where: { id: params.id },
      data,
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
      'UPDATE',
      'Lead',
      lead.id,
      { old: existingLead, new: lead },
      `Updated lead: ${lead.name}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    // Create notifications
    // 1. If assigned to changed, notify the new assignee
    if (data.assignedTo && data.assignedTo !== existingLead.assignedTo) {
      console.log('Creating notification for lead assignment:', { userId: data.assignedTo, leadId: lead.id })
      const notif = await createNotification({
        userId: data.assignedTo,
        type: 'LEAD_ASSIGNED',
        title: 'New Lead Assigned',
        message: `You have been assigned a new lead: ${lead.name}`,
        entityType: 'Lead',
        entityId: lead.id,
      })
      console.log('Notification created:', notif ? 'Success' : 'Failed')
    }

    // 2. If status changed, notify relevant users
    if (data.status && data.status !== existingLead.status) {
      console.log('Status changed:', { 
        oldStatus: existingLead.status, 
        newStatus: data.status, 
        currentUserRole: currentUser?.role,
        assignedTo: lead.assignedTo,
        sessionUserId: session.user.id 
      })
      
      const userName = currentUser?.name || 'Admin'
      
      // Notify the assigned employee when admin changes status
      if (currentUser?.role === 'ADMIN' && lead.assignedTo !== session.user.id) {
        console.log('Creating notification for admin status change:', { userId: lead.assignedTo, leadId: lead.id })
        const notif = await createNotification({
          userId: lead.assignedTo,
          type: 'LEAD_STATUS_CHANGED',
          title: 'Lead Status Updated',
          message: `Admin ${userName} changed lead "${lead.name}" status to ${data.status}`,
          entityType: 'Lead',
          entityId: lead.id,
        })
        console.log('Notification created:', notif ? 'Success' : 'Failed')
      }

      // Notify admin if employee changed status
      if (currentUser?.role === 'EMPLOYEE') {
        console.log('Creating notifications for employee status change')
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', isActive: true },
        })
        console.log('Found admins:', admins.length)
        for (const admin of admins) {
          const notif = await createNotification({
            userId: admin.id,
            type: 'LEAD_STATUS_CHANGED',
            title: 'Lead Status Updated',
            message: `Employee ${userName} changed lead "${lead.name}" status to ${data.status}`,
            entityType: 'Lead',
            entityId: lead.id,
          })
          console.log(`Notification for admin ${admin.id}:`, notif ? 'Success' : 'Failed')
        }
      }
    }

    return NextResponse.json(lead)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error updating lead:', error)
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

    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Data isolation: Employees can only delete their own leads
    if (session.user.role === 'EMPLOYEE' && lead.assignedTo !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.lead.delete({
      where: { id: params.id },
    })

    await createAuditLog(
      session.user.id,
      'DELETE',
      'Lead',
      params.id,
      lead,
      `Deleted lead: ${lead.name}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lead:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
