import { getServerSession } from './get-session'
import { prisma } from './prisma'

export type Permission = {
  module: string
  action: string
}

export async function hasPermission(
  userId: string,
  module: string,
  action: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!user) return false

  // Admin has all permissions
  if (user.role === 'ADMIN') return true

  // Check if user has the permission through any assigned role
  const hasPermission = user.roleAssignments.some(ra =>
    ra.role.permissions.some(rp =>
      rp.permission.module === module && rp.permission.action === action
    )
  )

  return hasPermission
}

export async function requirePermission(
  userId: string,
  module: string,
  action: string
): Promise<void> {
  const hasAccess = await hasPermission(userId, module, action)
  if (!hasAccess) {
    throw new Error('Insufficient permissions')
  }
}

export async function getCurrentUser() {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roleAssignments: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  })

  return user
}

