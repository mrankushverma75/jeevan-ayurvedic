import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getServerSession } from '@/lib/get-session'
import { redirect } from 'next/navigation'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return <DashboardLayout>{children}</DashboardLayout>
}

