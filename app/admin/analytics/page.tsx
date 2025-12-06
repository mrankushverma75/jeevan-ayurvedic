import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

export default async function AnalyticsPage() {
  const session = await getServerSession()
  if (!session?.user?.id) return null

  // Get employee performance data
  const employees = await prisma.user.findMany({
    where: {
      role: 'EMPLOYEE',
      isActive: true,
    },
    include: {
      _count: {
        select: {
          assignedLeads: true,
          assignedOrders: true,
        },
      },
      assignedLeads: {
        select: {
          status: true,
          vppAmount: true,
        },
      },
      assignedOrders: {
        select: {
          status: true,
          receivedAmount: true,
          vppAmount: true,
        },
      },
    },
  })

  // Calculate stats for each employee
  const employeeStats = employees.map((emp) => {
    const convertedLeads = emp.assignedLeads.filter((l) => l.status === 'CONVERTED').length
    const paidOrders = emp.assignedOrders.filter((o) => o.status === 'PAID')
    const nonReturnedOrders = emp.assignedOrders.filter((o) => o.status !== 'RETURNED')
    const revenue = paidOrders.reduce((sum, o) => sum + Number(o.receivedAmount), 0)
    // Calculate VPP amount excluding returned orders
    const vppAmount = nonReturnedOrders.reduce((sum, o) => sum + Number(o.vppAmount || 0), 0)
    const conversionRate = emp._count.assignedLeads > 0
      ? ((emp._count.assignedOrders / emp._count.assignedLeads) * 100).toFixed(1)
      : '0.0'

    return {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      totalLeads: emp._count.assignedLeads,
      convertedLeads,
      totalOrders: emp._count.assignedOrders,
      paidOrders: paidOrders.length,
      revenue,
      vppAmount,
      conversionRate,
    }
  })

  // Get lead sources
  const leadSources = await prisma.lead.groupBy({
    by: ['source'],
    _count: {
      id: true,
    },
    where: {
      source: { not: null },
    },
  })

  // Get order status distribution
  const orderStatuses = await prisma.order.groupBy({
    by: ['status'],
    _count: {
      id: true,
    },
  })

  // Get total VPP amounts (excluding returned orders)
  const totalVppAggregate = await prisma.order.aggregate({
    where: {
      status: { not: 'RETURNED' },
    },
    _sum: {
      vppAmount: true,
    },
  })
  const totalVppAmount = Number(totalVppAggregate._sum.vppAmount || 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-gray-500">Company-wide analytics and insights</p>
      </div>

      {/* Employee Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Total Leads</TableHead>
                <TableHead>Won Leads</TableHead>
                <TableHead>Total Orders</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>VPP Amount</TableHead>
                <TableHead>Conversion Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No employee data available
                  </TableCell>
                </TableRow>
              ) : (
                employeeStats.map((stat) => (
                  <TableRow key={stat.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{stat.name}</div>
                        <div className="text-sm text-muted-foreground">{stat.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{stat.totalLeads}</TableCell>
                    <TableCell>{stat.convertedLeads}</TableCell>
                    <TableCell>{stat.totalOrders}</TableCell>
                    <TableCell>{stat.paidOrders}</TableCell>
                    <TableCell>{formatCurrency(stat.revenue)}</TableCell>
                    <TableCell>{formatCurrency(stat.vppAmount)}</TableCell>
                    <TableCell>{stat.conversionRate}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lead Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leadSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lead source data available</p>
            ) : (
              leadSources.map((source) => (
                <div key={source.source} className="flex items-center justify-between">
                  <span className="text-sm">{source.source || 'Unknown'}</span>
                  <span className="text-sm font-medium">{source._count.id} leads</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Order Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orderStatuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No order data available</p>
            ) : (
              orderStatuses.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <span className="text-sm">{status.status}</span>
                  <span className="text-sm font-medium">{status._count.id} orders</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* VPP Amount Summary */}
      <Card>
        <CardHeader>
          <CardTitle>VPP Amount Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total VPP Amount (Excluding Returned Orders)</span>
              <span className="text-lg font-bold">{formatCurrency(totalVppAmount)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This total excludes orders with RETURNED status from VPP calculations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

