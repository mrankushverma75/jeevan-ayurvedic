'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ArrowLeft, Save } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const statusOptions = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAYMENT_RECEIVED', label: 'Payment Received' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'PAID', label: 'Paid' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const paymentStatusOptions = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'FULL', label: 'Full' },
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'COMPLETED', label: 'Completed' },
]

const paymentMethodOptions = [
  { value: 'MONEY_ORDER', label: 'Money Order' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
]

const courierServiceOptions = [
  { value: 'INDIA_POST', label: 'India Post' },
  { value: 'BLUEDART', label: 'BlueDart' },
  { value: 'ECOM', label: 'ECOM Express' },
  { value: 'OTHER', label: 'Other' },
]

export default function EditOrderPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    status: '',
    paymentStatus: '',
    paymentMethod: '',
    receivedAmount: '',
    moneyOrderNumber: '',
    trackingId: '',
    courierService: '',
    weight: '',
    returnReason: '',
    notes: '',
  })

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`)
      if (!res.ok) throw new Error('Failed to fetch order')
      return res.json()
    },
  })

  // Populate form when order data is loaded
  useEffect(() => {
    if (order) {
      setFormData({
        status: order.status || '',
        paymentStatus: order.paymentStatus || '',
        paymentMethod: order.paymentMethod || '',
        receivedAmount: order.receivedAmount ? Number(order.receivedAmount).toString() : '',
        moneyOrderNumber: order.moneyOrderNumber || '',
        trackingId: order.trackingId || '',
        courierService: order.courierService || '',
        weight: order.weight ? Number(order.weight).toString() : '',
        returnReason: order.returnReason || '',
        notes: order.notes || '',
      })
    }
  }, [order])

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update order')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      router.push(`/admin/orders/${orderId}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const updateData: any = {}

    if (formData.status) updateData.status = formData.status
    if (formData.paymentStatus) updateData.paymentStatus = formData.paymentStatus
    if (formData.paymentMethod) updateData.paymentMethod = formData.paymentMethod
    if (formData.receivedAmount) updateData.receivedAmount = parseFloat(formData.receivedAmount)
    if (formData.moneyOrderNumber !== undefined) updateData.moneyOrderNumber = formData.moneyOrderNumber
    if (formData.trackingId !== undefined) updateData.trackingId = formData.trackingId
    if (formData.courierService) updateData.courierService = formData.courierService
    if (formData.weight) updateData.weight = parseFloat(formData.weight)
    if (formData.returnReason !== undefined) updateData.returnReason = formData.returnReason
    if (formData.notes !== undefined) updateData.notes = formData.notes

    updateMutation.mutate(updateData)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">Loading...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">Order not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Order</h1>
          <p className="text-gray-500">Order Number: {order.orderNumber}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Order Status */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="">Select Status</option>
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentStatus">Payment Status</Label>
                  <Select
                    id="paymentStatus"
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                  >
                    <option value="">Select Payment Status</option>
                    {paymentStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="receivedAmount">Received Amount</Label>
                  <Input
                    id="receivedAmount"
                    type="number"
                    step="0.01"
                    value={formData.receivedAmount}
                    onChange={(e) => setFormData({ ...formData, receivedAmount: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Current: {formatCurrency(order.receivedAmount)} | Total: {formatCurrency(order.totalAmount)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    id="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  >
                    <option value="">Select Payment Method</option>
                    {paymentMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="moneyOrderNumber">Money Order Number</Label>
                  <Input
                    id="moneyOrderNumber"
                    value={formData.moneyOrderNumber}
                    onChange={(e) => setFormData({ ...formData, moneyOrderNumber: e.target.value })}
                    placeholder="Enter money order number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dispatch Information */}
          <Card>
            <CardHeader>
              <CardTitle>Dispatch Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trackingId">Tracking ID (EPP Number)</Label>
                  <Input
                    id="trackingId"
                    value={formData.trackingId}
                    onChange={(e) => setFormData({ ...formData, trackingId: e.target.value })}
                    placeholder="CU507364803IN"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courierService">Courier Service</Label>
                  <Select
                    id="courierService"
                    value={formData.courierService}
                    onChange={(e) => setFormData({ ...formData, courierService: e.target.value })}
                  >
                    <option value="">Select Courier</option>
                    {courierServiceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (grams)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.01"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="500"
                  />
                </div>
                {order.dispatchDate && (
                  <div className="space-y-2">
                    <Label>Dispatch Date</Label>
                    <p className="text-sm text-muted-foreground">{formatDateTime(order.dispatchDate)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Return Information */}
          {(order.status === 'RETURNED' || formData.status === 'RETURNED') && (
            <Card>
              <CardHeader>
                <CardTitle>Return Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="returnReason">Return Reason</Label>
                  <Input
                    id="returnReason"
                    value={formData.returnReason}
                    onChange={(e) => setFormData({ ...formData, returnReason: e.target.value })}
                    placeholder="Enter return reason"
                  />
                </div>
                {order.returnDate && (
                  <div className="space-y-2">
                    <Label>Return Date</Label>
                    <p className="text-sm text-muted-foreground">{formatDateTime(order.returnDate)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">Order Notes</Label>
                <textarea
                  id="notes"
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter any additional notes about this order"
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

