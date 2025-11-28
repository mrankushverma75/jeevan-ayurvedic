import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
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

        if (!user || !user.isActive) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.password)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as 'ADMIN' | 'EMPLOYEE',
          permissions: user.roleAssignments.flatMap(ra => 
            ra.role.permissions.map(rp => rp.permission)
          )
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 15 * 60, // 15 minutes
  },
  jwt: {
    maxAge: 15 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.permissions = user.permissions
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.permissions = token.permissions as any[]
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
})

