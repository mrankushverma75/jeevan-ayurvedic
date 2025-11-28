import 'next-auth'
import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      permissions?: Array<{
        id: string
        module: string
        action: string
        name: string
      }>
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: UserRole
    permissions?: Array<{
      id: string
      module: string
      action: string
      name: string
    }>
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    permissions?: Array<{
      id: string
      module: string
      action: string
      name: string
    }>
  }
}

