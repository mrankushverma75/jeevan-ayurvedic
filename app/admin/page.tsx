import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Users, FileText, Calendar, DollarSign, TrendingUp } from 'lucide-react'

export default async function AdminDashboardPage() {
  const session = await getServerSession()
  if (!session?.user?.id) return null

  // Get company-wide stats
  const [
    totalUsers,
    activeUsers,
    totalLeads,
    activeLeads,
    totalOrders,
    revenue,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { status: { not: 'LOST' } } }),
    prisma.order.count(),
    prisma.order.aggregate({
      where: {
        status: 'PAID',
      },
      _sum: {
        receivedAmount: true,
      },
    }),
  ])

  const totalRevenue = Number(revenue._sum.receivedAmount || 0)

  // Get employee performance
  const employeePerformance = await prisma.user.findMany({
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
    },
    take: 5,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-500">Company-wide overview and analytics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {activeUsers} active users
            </p>
          </CardContent>
        </Card>

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
              All orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              From paid orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Top Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employeePerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees yet</p>
            ) : (
              employeePerformance.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{employee.name}</p>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{employee._count.assignedLeads} leads</p>
                    <p className="text-sm text-muted-foreground">{employee._count.assignedOrders} orders</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

