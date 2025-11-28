'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Settings,
  BarChart3,
  ClipboardList,
  Shield,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from 'next-auth/react'

const employeeNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/leads', label: 'My Leads', icon: FileText },
  { href: '/dashboard/orders', label: 'My Orders', icon: Calendar },
  { href: '/dashboard/profile', label: 'Profile', icon: Settings },
]

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/roles', label: 'Roles & Permissions', icon: Shield },
  { href: '/admin/leads', label: 'All Leads', icon: FileText },
  { href: '/admin/orders', label: 'All Orders', icon: Calendar },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardList },
  { href: '/admin/profile', label: 'Profile', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const navItems = isAdmin ? adminNavItems : employeeNavItems

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold text-primary">Jeevan Ayurvedic</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon
          // Fix active state: Dashboard should only match exact path, others can match with sub-paths
          const isActive = item.href === '/dashboard' || item.href === '/admin'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}

