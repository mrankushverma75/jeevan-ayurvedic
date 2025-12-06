import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const leadSchema = z.object({
  name: z.union([z.string(), z.literal(''), z.null()]).optional().transform(val => val === '' || val === null ? undefined : val),
  fatherName: z.union([z.string(), z.literal(''), z.null()]).optional().transform(val => val === '' || val === null ? undefined : val),
  gender: z.union([z.enum(['MALE', 'FEMALE', 'OTHER']), z.literal(''), z.null()]).optional().transform(val => val === '' || val === null ? undefined : val),
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
    
    // Use safeParse to allow extra fields and handle validation errors gracefully
    const validationResult = leadSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('Validation errors:', validationResult.error.errors)
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 })
    }
    
    const parsedData = validationResult.data
    console.log('Parsed lead data:', JSON.stringify(parsedData, null, 2))
    console.log('Existing lead status:', existingLead.status)

    // Employees cannot reassign leads
    if (session.user.role === 'EMPLOYEE' && 'assignedTo' in body) {
      delete body.assignedTo
      if ('assignedTo' in parsedData) delete parsedData.assignedTo
    }

    // Get current user details for notifications
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, role: true },
    })
    console.log('Current user:', currentUser)

    // Build update data object, only including fields that are explicitly provided in the request body
    // Use the original body to check what fields were sent, not the transformed data
    const updateData: any = {}
    
    // Helper function to safely add field to updateData
    const addField = (key: string, value: any, transform?: (val: any) => any) => {
      if (key in body) {
        const transformedValue = transform ? transform(value) : value
        // Convert empty string to null, keep null as null, keep undefined as undefined
        if (transformedValue === '' || transformedValue === null) {
          updateData[key] = null
        } else if (transformedValue !== undefined) {
          updateData[key] = transformedValue
        }
      }
    }
    
    // Only update fields that are present in the request body
    addField('name', body.name)
    addField('fatherName', body.fatherName)
    addField('gender', body.gender)
    addField('age', body.age, (val) => val !== undefined && val !== null ? Number(val) : undefined)
    addField('phone', body.phone)
    addField('email', body.email)
    addField('alternatePhone', body.alternatePhone)
    addField('disease', body.disease)
    addField('duration', body.duration)
    addField('patientHistory', body.patientHistory)
    addField('vppAmount', body.vppAmount, (val) => val !== undefined && val !== null ? Number(val) : undefined)
    addField('addressLine1', body.addressLine1)
    addField('addressLine2', body.addressLine2)
    addField('addressLine3', body.addressLine3)
    addField('addressLine4', body.addressLine4)
    addField('addressLine5', body.addressLine5)
    addField('addressLine6', body.addressLine6)
    // Handle pincodeId and cityId - always update if present in body
    if ('pincodeId' in body) {
      console.log('Processing pincodeId:', body.pincodeId, typeof body.pincodeId)
      if (body.pincodeId === '' || body.pincodeId === null || body.pincodeId === undefined || body.pincodeId === 'null') {
        updateData.pincodeId = null
      } else {
        const parsed = parseInt(String(body.pincodeId), 10)
        updateData.pincodeId = isNaN(parsed) ? null : parsed
      }
      console.log('Final pincodeId in updateData:', updateData.pincodeId)
    } else {
      console.log('pincodeId not found in body')
    }
    if ('cityId' in body) {
      console.log('Processing cityId:', body.cityId, typeof body.cityId)
      if (body.cityId === '' || body.cityId === null || body.cityId === undefined || body.cityId === 'null') {
        updateData.cityId = null
      } else {
        const parsed = parseInt(String(body.cityId), 10)
        updateData.cityId = isNaN(parsed) ? null : parsed
      }
      console.log('Final cityId in updateData:', updateData.cityId)
    } else {
      console.log('cityId not found in body')
    }
    addField('state', body.state)
    addField('country', body.country)
    addField('preferredLanguage', body.preferredLanguage)
    addField('preferredCommunication', body.preferredCommunication)
    if ('source' in body) updateData.source = body.source
    if ('status' in body) updateData.status = body.status
    if ('priority' in body) updateData.priority = body.priority
    addField('notes', body.notes)
    if ('assignedTo' in body) updateData.assignedTo = body.assignedTo

    console.log('Update data to be sent to Prisma:', JSON.stringify(updateData, null, 2))

    const lead = await prisma.lead.update({
      where: { id: params.id },
      data: updateData,
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
      { old: existingLead, new: lead, updatedFields: updateData },
      `Updated lead: ${lead.name || lead.phone || 'Lead'}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    // Create notifications
    // 1. If assigned to changed, notify the new assignee
    if (updateData.assignedTo && updateData.assignedTo !== existingLead.assignedTo) {
      console.log('Creating notification for lead assignment:', { userId: updateData.assignedTo, leadId: lead.id })
      const notif = await createNotification({
        userId: updateData.assignedTo,
        type: 'LEAD_ASSIGNED',
        title: 'New Lead Assigned',
        message: `You have been assigned a new lead: ${lead.name || lead.phone || 'New Lead'}`,
        entityType: 'Lead',
        entityId: lead.id,
      })
      console.log('Notification created:', notif ? 'Success' : 'Failed')
    }

    // 2. If status changed, notify relevant users
    if (updateData.status && updateData.status !== existingLead.status) {
      console.log('Status changed:', { 
        oldStatus: existingLead.status, 
        newStatus: updateData.status, 
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
          message: `Admin ${userName} changed lead "${lead.name || lead.phone || 'Lead'}" status to ${updateData.status}`,
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
            message: `Employee ${userName} changed lead "${lead.name || lead.phone || 'Lead'}" status to ${updateData.status}`,
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
      `Deleted lead: ${lead.name || lead.phone || 'Lead'}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lead:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
