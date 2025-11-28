import { prisma } from './prisma'
import { AuditAction } from '@prisma/client'

export async function createAuditLog(
  userId: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  changes?: any,
  description?: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        changes: changes ? JSON.stringify(changes) : null,
        description,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - audit logging should not break the main flow
  }
}

