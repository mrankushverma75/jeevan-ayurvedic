'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Check, X, Ban } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const statusColors: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
}

export default function AdminBookingsPage() {
  const [filters, setFilters] = useState({
    status: '',
  })
  const [actionDialog, setActionDialog] = useState<{
    open: boolean
    booking: any
    action: 'approve' | 'reject' | 'cancel' | null
  }>({
    open: false,
    booking: null,
    action: null,
  })
  const [reason, setReason] = useState('')

  const queryClient = useQueryClient()

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      const res = await fetch(`/api/bookings?${params}`)
      if (!res.ok) throw new Error('Failed to fetch bookings')
      return res.json()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update booking')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setActionDialog({ open: false, booking: null, action: null })
      setReason('')
    },
  })

  const handleAction = (booking: any, action: 'approve' | 'reject' | 'cancel') => {
    setActionDialog({ open: true, booking, action })
  }

  const confirmAction = () => {
    if (!actionDialog.booking || !actionDialog.action) return

    const data: any = { status: actionDialog.action.toUpperCase() }
    if (actionDialog.action === 'cancel' || actionDialog.action === 'reject') {
      data.cancelledReason = reason
    }

    updateMutation.mutate({
      id: actionDialog.booking.id,
      data,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">All Bookings</h1>
        <p className="text-gray-500">Manage and approve bookings</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-48"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Button
              variant="outline"
              onClick={() => setFilters({ status: '' })}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No bookings found
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking: any) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.title}</TableCell>
                      <TableCell>{booking.lead.name}</TableCell>
                      <TableCell>{booking.assignedUser.name}</TableCell>
                      <TableCell>{formatDateTime(booking.startDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[booking.status] as any}>
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(booking.amount)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {booking.status === 'PENDING' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAction(booking, 'approve')}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAction(booking, 'reject')}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(booking, 'cancel')}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'approve' && 'Approve Booking'}
              {actionDialog.action === 'reject' && 'Reject Booking'}
              {actionDialog.action === 'cancel' && 'Cancel Booking'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {actionDialog.booking?.title}
            </p>
            {(actionDialog.action === 'reject' || actionDialog.action === 'cancel') && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter reason..."
                  required
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ ...actionDialog, open: false })}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={updateMutation.isPending || (actionDialog.action !== 'approve' && !reason)}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

