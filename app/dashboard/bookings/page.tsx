'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Calendar, Edit, Trash2 } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const bookingSchema = z.object({
  leadId: z.string().min(1, 'Lead is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  amount: z.number().min(0).default(0),
  notes: z.string().optional(),
})

type BookingFormData = z.infer<typeof bookingSchema>

const statusColors: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
}

export default function BookingsPage() {
  const [open, setOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<any>(null)
  const [filters, setFilters] = useState({
    status: '',
  })

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

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const res = await fetch('/api/leads')
      if (!res.ok) throw new Error('Failed to fetch leads')
      return res.json()
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      amount: 0,
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create booking')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setOpen(false)
      reset()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BookingFormData & { status: string }> }) => {
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
      setOpen(false)
      setEditingBooking(null)
      reset()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete booking')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })

  const onSubmit = (data: BookingFormData) => {
    if (editingBooking) {
      updateMutation.mutate({ id: editingBooking.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (booking: any) => {
    setEditingBooking(booking)
    reset({
      leadId: booking.leadId,
      title: booking.title,
      description: booking.description || '',
      startDate: new Date(booking.startDate).toISOString().slice(0, 16),
      endDate: booking.endDate ? new Date(booking.endDate).toISOString().slice(0, 16) : '',
      amount: Number(booking.amount),
      notes: booking.notes || '',
    })
    setOpen(true)
  }

  const handleStatusChange = (id: string, status: string) => {
    updateMutation.mutate({ id, data: { status } })
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this booking?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="text-gray-500">Manage your bookings</p>
        </div>
        <Button onClick={() => { setOpen(true); setEditingBooking(null); reset(); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Booking
        </Button>
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
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No bookings found
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking: any) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.title}</TableCell>
                      <TableCell>{booking.lead.name}</TableCell>
                      <TableCell>{formatDateTime(booking.startDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[booking.status] as any}>
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(booking.amount)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(booking)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {booking.status === 'PENDING' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusChange(booking.id, 'COMPLETED')}
                            >
                              Mark Complete
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(booking.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBooking ? 'Edit Booking' : 'Create Booking'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leadId">Lead *</Label>
                <Select id="leadId" {...register('leadId')} disabled={!!editingBooking}>
                  <option value="">Select a lead</option>
                  {leads.map((lead: any) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} - {lead.email || lead.phone}
                    </option>
                  ))}
                </Select>
                {errors.leadId && <p className="text-sm text-destructive">{errors.leadId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" {...register('title')} />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" type="datetime-local" {...register('startDate')} />
                {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="datetime-local" {...register('endDate')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                {...register('description')}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                {...register('notes')}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingBooking ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

