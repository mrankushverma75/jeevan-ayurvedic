'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ArrowLeft, PackageCheck, RotateCcw } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'

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

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const queryClient = useQueryClient()
  
  const [returnDialog, setReturnDialog] = useState({
    open: false,
    returnReason: '',
  })

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`)
      if (!res.ok) throw new Error('Failed to fetch order')
      return res.json()
    },
  })

  const markDeliveredMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DELIVERED',
          deliveredDate: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Failed to mark order as delivered')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const markReturnedMutation = useMutation({
    mutationFn: async (returnReason: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RETURNED',
          returnDate: new Date().toISOString(),
          returnReason,
        }),
      })
      if (!res.ok) throw new Error('Failed to mark order as returned')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setReturnDialog({ open: false, returnReason: '' })
    },
  })

  const handleMarkDelivered = () => {
    if (confirm('Are you sure you want to mark this order as delivered?')) {
      markDeliveredMutation.mutate()
    }
  }

  const handleMarkReturned = () => {
    setReturnDialog({ open: true, returnReason: '' })
  }

  const confirmReturn = () => {
    if (!returnDialog.returnReason.trim()) {
      alert('Please provide a return reason')
      return
    }
    if (confirm('Are you sure you want to mark this order as returned?')) {
      markReturnedMutation.mutate(returnDialog.returnReason)
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Order Details</h1>
            <p className="text-gray-500">Order Number: {order.orderNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(order.status === 'DISPATCHED' || order.status === 'IN_TRANSIT') && (
            <>
              <Button 
                onClick={handleMarkDelivered}
                disabled={markDeliveredMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <PackageCheck className="h-4 w-4 mr-2" />
                Mark as Delivered
              </Button>
              <Button 
                onClick={handleMarkReturned}
                disabled={markReturnedMutation.isPending}
                variant="destructive"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Mark as Returned
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Order Status */}
      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={statusColors[order.status] as any} className="mt-1">
                {order.status.replace('_', ' ')}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Status</p>
              <Badge variant={paymentStatusColors[order.paymentStatus] as any} className="mt-1">
                {order.paymentStatus}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created At</p>
              <p className="font-medium">{formatDateTime(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assigned To</p>
              <p className="font-medium">{order.assignedUser?.name || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient Information */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Patient Name</p>
              <p className="font-medium">{order.patientName}</p>
            </div>
            {order.patientId && (
              <div>
                <p className="text-sm text-muted-foreground">Patient ID</p>
                <p className="font-medium">{order.patientId}</p>
              </div>
            )}
            {order.lead?.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{order.lead.phone}</p>
              </div>
            )}
            {order.lead?.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{order.lead.email}</p>
              </div>
            )}
            {order.lead?.disease && (
              <div>
                <p className="text-sm text-muted-foreground">Disease</p>
                <p className="font-medium">{order.lead.disease}</p>
              </div>
            )}
            {order.lead?.duration && (
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{order.lead.duration}</p>
              </div>
            )}
          </div>
          {order.lead?.patientHistory && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Patient History</p>
              <p className="font-medium whitespace-pre-wrap">{order.lead.patientHistory}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Address Information */}
      {(order.addressLine1 || order.city || order.pincode) && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {order.addressLine1 && <p>{order.addressLine1}</p>}
              {order.addressLine2 && <p>{order.addressLine2}</p>}
              {order.addressLine3 && <p>{order.addressLine3}</p>}
              {order.addressLine4 && <p>{order.addressLine4}</p>}
              {order.addressLine5 && <p>{order.addressLine5}</p>}
              {order.addressLine6 && <p>{order.addressLine6}</p>}
              <p>
                {order.pincode?.area && `${order.pincode.area}, `}
                {order.city?.city && `${order.city.city}, `}
                {order.state && `${order.state}, `}
                {order.pincode.zipCode + ', '}
                {order.country || 'India'}
              </p>
              {order.station && (
                <p className="text-sm text-muted-foreground">Station: {order.station}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Information */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-xl font-bold">{formatCurrency(order.totalAmount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">VPP Amount</p>
              <p className="text-xl font-bold">{formatCurrency(order.vppAmount)}</p>
            </div>
            {order.eppAmount && (
              <div>
                <p className="text-sm text-muted-foreground">EPP Amount</p>
                <p className="text-xl font-bold">{formatCurrency(order.eppAmount)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Received Amount</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(order.receivedAmount)}</p>
            </div>
            {order.paymentMethod && (
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="font-medium">{order.paymentMethod}</p>
              </div>
            )}
            {order.moneyOrderNumber && (
              <div>
                <p className="text-sm text-muted-foreground">Money Order Number</p>
                <p className="font-medium font-mono">{order.moneyOrderNumber}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {order.payments && order.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.payments.map((payment: any) => (
                <div key={payment.id} className="border-b pb-4 last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{formatCurrency(payment.amount)}</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.paymentType} - {payment.paymentMethod}
                      </p>
                      {payment.referenceNumber && (
                        <p className="text-sm text-muted-foreground font-mono">
                          Ref: {payment.referenceNumber}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(payment.receivedAt)}
                      </p>
                      {payment.receivedBy && (
                        <p className="text-sm text-muted-foreground">
                          By: {payment.receivedBy}
                        </p>
                      )}
                    </div>
                  </div>
                  {payment.notes && (
                    <p className="text-sm text-muted-foreground mt-2">{payment.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dispatch Information */}
      {order.trackingId && (
        <Card>
          <CardHeader>
            <CardTitle>Dispatch Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Tracking ID</p>
                <p className="font-medium font-mono">{order.trackingId}</p>
              </div>
              {order.courierService && (
                <div>
                  <p className="text-sm text-muted-foreground">Courier Service</p>
                  <p className="font-medium">{order.courierService}</p>
                </div>
              )}
              {order.dispatchDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Dispatch Date</p>
                  <p className="font-medium">{formatDateTime(order.dispatchDate)}</p>
                </div>
              )}
              {order.weight && (
                <div>
                  <p className="text-sm text-muted-foreground">Weight</p>
                  <p className="font-medium">{order.weight} grams</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Information */}
      {(order.deliveredDate || order.returnDate) && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {order.deliveredDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Delivered Date</p>
                  <p className="font-medium">{formatDateTime(order.deliveredDate)}</p>
                </div>
              )}
              {order.returnDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Return Date</p>
                  <p className="font-medium">{formatDateTime(order.returnDate)}</p>
                </div>
              )}
              {order.returnReason && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Return Reason</p>
                  <p className="font-medium">{order.returnReason}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Return Dialog */}
      <Dialog open={returnDialog.open} onOpenChange={(open) => setReturnDialog({ ...returnDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Order as Returned</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Order: {order?.orderNumber}
            </p>
            <div className="space-y-2">
              <Label htmlFor="returnReason">Return Reason *</Label>
              <Input
                id="returnReason"
                value={returnDialog.returnReason}
                onChange={(e) => setReturnDialog({ ...returnDialog, returnReason: e.target.value })}
                placeholder="Enter reason for return..."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialog({ ...returnDialog, open: false })}>
              Cancel
            </Button>
            <Button
              onClick={confirmReturn}
              disabled={markReturnedMutation.isPending || !returnDialog.returnReason.trim()}
              variant="destructive"
            >
              {markReturnedMutation.isPending ? 'Processing...' : 'Mark as Returned'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
