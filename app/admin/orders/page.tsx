'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Search, Package, Truck, Edit, Eye } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Pagination } from '@/components/ui/pagination'

const statusColors: Record<string, string> = {
  PENDING: 'warning',
  PAYMENT_RECEIVED: 'success',
  DISPATCHED: 'default',
  IN_TRANSIT: 'default',
  DELIVERED: 'success',
  PAID: 'success',
  RETURNED: 'destructive',
  CANCELLED: 'destructive',
}

const paymentStatusColors: Record<string, string> = {
  PENDING: 'warning',
  PARTIAL: 'warning',
  FULL: 'success',
  CUSTOM: 'default',
  COMPLETED: 'success',
}

export default function AdminOrdersPage() {
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    search: '',
  })
  const [page, setPage] = useState(1)
  const limit = 20
  const [dispatchDialog, setDispatchDialog] = useState<{
    open: boolean
    order: any
  }>({
    open: false,
    order: null,
  })
  const [dispatchData, setDispatchData] = useState({
    trackingId: '',
    courierService: '',
    weight: '',
  })

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus)
      if (filters.search) params.append('search', filters.search)
      params.append('page', page.toString())
      params.append('limit', limit.toString())
      const res = await fetch(`/api/orders?${params}`)
      if (!res.ok) throw new Error('Failed to fetch orders')
      return res.json()
    },
  })

  const orders = data?.data || []
  const pagination = data?.pagination

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
    setPage(1)
  }

  const dispatchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          status: 'DISPATCHED',
          dispatchDate: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Failed to dispatch order')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setDispatchDialog({ open: false, order: null })
      setDispatchData({ trackingId: '', courierService: '', weight: '' })
    },
  })

  const handleDispatch = (order: any) => {
    setDispatchDialog({ open: true, order })
    setDispatchData({
      trackingId: order.trackingId || '',
      courierService: order.courierService || '',
      weight: order.weight ? order.weight.toString() : '',
    })
  }

  const confirmDispatch = () => {
    if (!dispatchDialog.order) return
    dispatchMutation.mutate({
      id: dispatchDialog.order.id,
      data: {
        trackingId: dispatchData.trackingId,
        courierService: dispatchData.courierService,
        weight: dispatchData.weight ? parseFloat(dispatchData.weight) : undefined,
      },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">All Orders</h1>
        <p className="text-gray-500">Manage and dispatch orders</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search orders..."
                value={filters.search}
                onChange={(e) => handleFilterChange({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAYMENT_RECEIVED">Payment Received</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="PAID">Paid</option>
              <option value="RETURNED">Returned</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Select
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange({ ...filters, paymentStatus: e.target.value })}
            >
              <option value="">All Payment Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="FULL">Full</option>
              <option value="CUSTOM">Custom</option>
              <option value="COMPLETED">Completed</option>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                handleFilterChange({ status: '', paymentStatus: '', search: '' })
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Dispatch Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order: any) => (
                    <TableRow 
                      key={order.id}
                      className={order.status === 'DELIVERED' ? 'bg-green-50 hover:bg-green-100' : ''}
                    >
                      <TableCell className="font-medium font-mono text-sm">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.patientName}</div>
                          <div className="text-sm text-muted-foreground">{order.lead?.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>{order.assignedUser?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[order.status] as any}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={paymentStatusColors[order.paymentStatus] as any}>
                          {order.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{formatCurrency(order.totalAmount)}</div>
                          <div className="text-xs text-muted-foreground">
                            Received: {formatCurrency(order.receivedAmount)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.trackingId ? (
                          <span className="font-mono text-xs">{order.trackingId}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.dispatchDate ? formatDateTime(order.dispatchDate) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.location.href = `/admin/orders/${order.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {order.status !== 'DISPATCHED' && 
                           order.status !== 'CANCELLED' && 
                           order.status !== 'DELIVERED' && 
                           order.status !== 'RETURNED' && 
                           order.status !== 'IN_TRANSIT' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDispatch(order)}
                            >
                              <Truck className="h-4 w-4 mr-1" />
                              Dispatch
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      )}

      {/* Dispatch Dialog */}
      <Dialog open={dispatchDialog.open} onOpenChange={(open) => setDispatchDialog({ ...dispatchDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispatch Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Order: {dispatchDialog.order?.orderNumber}
            </p>
            <div className="space-y-2">
              <Label htmlFor="trackingId">Tracking ID (EPP Number) *</Label>
              <Input
                id="trackingId"
                value={dispatchData.trackingId}
                onChange={(e) => setDispatchData({ ...dispatchData, trackingId: e.target.value })}
                placeholder="CU507364803IN"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courierService">Courier Service *</Label>
              <Select
                id="courierService"
                value={dispatchData.courierService}
                onChange={(e) => setDispatchData({ ...dispatchData, courierService: e.target.value })}
                required
              >
                <option value="">Select Courier</option>
                <option value="INDIA_POST">India Post</option>
                <option value="BLUEDART">BlueDart</option>
                <option value="ECOM">ECOM Express</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (grams)</Label>
              <Input
                id="weight"
                type="number"
                value={dispatchData.weight}
                onChange={(e) => setDispatchData({ ...dispatchData, weight: e.target.value })}
                placeholder="500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchDialog({ ...dispatchDialog, open: false })}>
              Cancel
            </Button>
            <Button
              onClick={confirmDispatch}
              disabled={dispatchMutation.isPending || !dispatchData.trackingId || !dispatchData.courierService}
            >
              {dispatchMutation.isPending ? 'Dispatching...' : 'Dispatch Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

