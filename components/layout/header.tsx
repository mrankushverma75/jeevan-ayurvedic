'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDateTime, formatRelativeTime } from '@/lib/utils'

export function Header() {
  const { data: session } = useSession()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications')
      if (!res.ok) throw new Error('Failed to fetch notifications')
      return res.json()
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })
      if (!res.ok) throw new Error('Failed to mark as read')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true }),
      })
      if (!res.ok) throw new Error('Failed to mark all as read')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id)
    }
    // Navigate to the related entity if available
    if (notification.entityType && notification.entityId) {
      if (notification.entityType === 'Lead') {
        window.location.href = session?.user?.role === 'ADMIN' 
          ? `/admin/leads` 
          : `/dashboard/leads`
      } else if (notification.entityType === 'Order') {
        window.location.href = session?.user?.role === 'ADMIN'
          ? `/admin/orders`
          : `/dashboard/orders`
      }
    }
    setNotificationsOpen(false)
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-10"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen} trigger={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {unreadCount}
              </Badge>
            )}
          </Button>
        }>
          <PopoverContent className="p-0">
            <div className="p-2 border-b">
              <h3 className="font-semibold text-sm">Notifications</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification: any) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`
                        p-3 hover:bg-gray-50 cursor-pointer transition-colors
                        ${!notification.read ? 'bg-blue-50' : ''}
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{notification.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatRelativeTime(new Date(notification.createdAt))}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary mt-1 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {notifications.length > 0 && unreadCount > 0 && (
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                >
                  {markAllAsReadMutation.isPending ? 'Marking...' : 'Mark all as read'}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <Link href={session?.user?.role === 'ADMIN' ? '/admin/profile' : '/dashboard/profile'}>
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="text-right">
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <p className="text-xs text-gray-500">{session?.user?.role}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
              {session?.user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </Link>
      </div>
    </header>
  )
}

