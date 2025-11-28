import { prisma } from './prisma'

export type NotificationType = 
  | 'LEAD_ASSIGNED'
  | 'LEAD_STATUS_CHANGED'
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_DISPATCHED'
  | 'PAYMENT_RECEIVED'
  | 'SYSTEM_ALERT'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  entityType?: string
  entityId?: string
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  entityType,
  entityId,
}: CreateNotificationParams) {
  try {
    console.log('Creating notification:', { userId, type, title, entityType, entityId })
    const notification = await (prisma as any).notification.create({
      data: {
        userId,
        type,
        title,
        message,
        entityType,
        entityId,
      },
    })
    console.log('Notification created successfully:', notification.id)
    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    console.error('Notification data:', { userId, type, title, message, entityType, entityId })
    // Don't throw - notifications shouldn't break the main flow
    return null
  }
}

export async function createNotificationForUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  try {
    const notifications = userIds.map(userId => ({
      userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType,
      entityId: params.entityId,
    }))

    return await (prisma as any).notification.createMany({
      data: notifications,
    })
  } catch (error) {
    console.error('Error creating notifications for users:', error)
    return null
  }
}

