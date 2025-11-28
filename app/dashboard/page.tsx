import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { FileText, Calendar, TrendingUp, DollarSign } from 'lucide-react'

export default async function DashboardPage() {
  const session = await getServerSession()
  if (!session?.user?.id) return null

  const userId = session.user.id

  // Get employee's leads and orders stats
  const [totalLeads, activeLeads, totalOrders, pendingOrders, revenue] = await Promise.all([
    prisma.lead.count({ where: { assignedTo: userId } }),
    prisma.lead.count({ where: { assignedTo: userId, status: { not: 'LOST' } } }),
    prisma.order.count({ where: { assignedTo: userId } }),
    prisma.order.count({
      where: {
        assignedTo: userId,
        status: { in: ['PENDING', 'PAYMENT_RECEIVED'] },
      },
    }),
    prisma.order.aggregate({
      where: {
        assignedTo: userId,
        status: 'PAID',
      },
      _sum: {
        receivedAmount: true,
      },
    }),
  ])

  const totalRevenue = Number(revenue._sum.receivedAmount || 0)

  // Get recent leads
  const recentLeads = await prisma.lead.findMany({
    where: { assignedTo: userId },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      assignedUser: {
        select: {
          name: true,
        },
      },
    },
  })

  // Get pending orders
  const pendingOrdersList = await prisma.order.findMany({
    where: {
      assignedTo: userId,
      status: { in: ['PENDING', 'PAYMENT_RECEIVED', 'DISPATCHED'] },
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      lead: {
        select: {
          name: true,
          phone: true,
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Welcome back, {session.user.name}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {activeLeads} active leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              {pendingOrders} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              From paid orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalLeads > 0 ? ((totalOrders / totalLeads) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Leads to orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads and Pending Orders */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leads yet</p>
              ) : (
                recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-muted-foreground">{lead.phone}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{lead.status}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingOrdersList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending orders</p>
              ) : (
                pendingOrdersList.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.lead.name} • {order.patientName}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">{order.status}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

