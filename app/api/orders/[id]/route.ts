import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const orderUpdateSchema = z.object({
  status: z.enum(['PENDING', 'PAYMENT_RECEIVED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'PAID', 'RETURNED', 'CANCELLED']).optional(),
  dispatchDate: z.string().transform((str) => new Date(str)).optional(),
  trackingId: z.string().optional(),
  courierService: z.string().optional(),
  weight: z.number().min(0).optional(),
  receivedAmount: z.number().min(0).optional(),
  paymentStatus: z.enum(['PENDING', 'PARTIAL', 'FULL', 'CUSTOM', 'COMPLETED']).optional(),
  paymentMethod: z.string().optional(),
  moneyOrderNumber: z.string().optional(),
  deliveredDate: z.string().transform((str) => new Date(str)).optional(),
  returnDate: z.string().transform((str) => new Date(str)).optional(),
  returnReason: z.string().optional(),
  notes: z.string().optional(),
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

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            disease: true,
            duration: true,
            patientHistory: true,
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
            zipCode: true,
            area: true,
          },
        },
        payments: {
          orderBy: { receivedAt: 'desc' },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Data isolation: Employees can only access their own orders
    if (session.user.role === 'EMPLOYEE' && order.assignedTo !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('Error fetching order:', error)
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

    const existingOrder = await prisma.order.findUnique({
      where: { id: params.id },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Data isolation: Employees can only update their own orders
    if (session.user.role === 'EMPLOYEE' && existingOrder.assignedTo !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const data = orderUpdateSchema.parse(body)

    const updateData: any = { ...data }

    // Handle dispatch
    if (data.status === 'DISPATCHED' && !existingOrder.dispatchedBy) {
      updateData.dispatchedBy = session.user.id
      if (!updateData.dispatchDate) {
        updateData.dispatchDate = new Date()
      }
    }

    // Handle payment updates
    if (data.receivedAmount && Number(data.receivedAmount) > Number(existingOrder.receivedAmount)) {
      const additionalAmount = Number(data.receivedAmount) - Number(existingOrder.receivedAmount)
      await prisma.payment.create({
        data: {
          orderId: params.id,
          amount: additionalAmount,
          paymentType: Number(existingOrder.receivedAmount) > 0 ? 'PARTIAL' : 'INITIAL',
          paymentMethod: data.paymentMethod || existingOrder.paymentMethod || 'MONEY_ORDER',
          referenceNumber: data.moneyOrderNumber || existingOrder.moneyOrderNumber,
          receivedBy: session.user.id,
        },
      })
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
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
        payments: {
          orderBy: { receivedAt: 'desc' },
        },
      },
    })

    await createAuditLog(
      session.user.id,
      'UPDATE',
      'Order',
      order.id,
      { old: existingOrder, new: order },
      `Updated order: ${order.orderNumber}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    // Create notifications
    // 1. If status changed, notify the assigned user (if not the one making the change)
    if (data.status && data.status !== existingOrder.status) {
      if (order.assignedTo !== session.user.id) {
        await createNotification({
          userId: order.assignedTo,
          type: 'ORDER_STATUS_CHANGED',
          title: 'Order Status Updated',
          message: `Order ${order.orderNumber} status changed to ${data.status} by ${session.user.name || 'Admin'}`,
          entityType: 'Order',
          entityId: order.id,
        })
      }

      // Notify admin if employee changed status
      if (session.user.role === 'EMPLOYEE') {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', isActive: true },
        })
        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            type: 'ORDER_STATUS_CHANGED',
            title: 'Order Status Updated',
            message: `Employee ${session.user.name} changed order ${order.orderNumber} status to ${data.status}`,
            entityType: 'Order',
            entityId: order.id,
          })
        }
      }

      // Special notification for dispatch
      if (data.status === 'DISPATCHED') {
        await createNotification({
          userId: order.assignedTo,
          type: 'ORDER_DISPATCHED',
          title: 'Order Dispatched',
          message: `Order ${order.orderNumber} has been dispatched. Tracking ID: ${data.trackingId || 'N/A'}`,
          entityType: 'Order',
          entityId: order.id,
        })
      }
    }

    // 2. If payment received, notify assigned user
    if (data.receivedAmount && Number(data.receivedAmount) > Number(existingOrder.receivedAmount)) {
      if (order.assignedTo !== session.user.id) {
        await createNotification({
          userId: order.assignedTo,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Received',
          message: `Payment of ₹${Number(data.receivedAmount) - Number(existingOrder.receivedAmount)} received for order ${order.orderNumber}`,
          entityType: 'Order',
          entityId: order.id,
        })
      }
    }

    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

