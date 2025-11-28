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
import { Search, Package, Truck, Plus } from 'lucide-react'
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

export default function OrdersPage() {
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    search: '',
  })
  const [page, setPage] = useState(1)
  const limit = 20

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Orders</h1>
          <p className="text-gray-500">Manage your orders</p>
        </div>
        <Button onClick={() => window.location.href = '/dashboard/leads'}>
          <Plus className="mr-2 h-4 w-4" />
          Create Order from Lead
        </Button>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium font-mono text-sm">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.patientName}</div>
                          <div className="text-sm text-muted-foreground">{order.lead?.phone}</div>
                        </div>
                      </TableCell>
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
                      <TableCell>{formatCurrency(order.totalAmount)}</TableCell>
                      <TableCell>{formatCurrency(order.receivedAmount)}</TableCell>
                      <TableCell>
                        {order.trackingId ? (
                          <span className="font-mono text-xs">{order.trackingId}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(order.createdAt)}</TableCell>
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
    </div>
  )
}

