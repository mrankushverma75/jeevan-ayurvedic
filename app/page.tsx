import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/get-session'

export default async function Home() {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  // Redirect based on user role
  if (session.user.role === 'ADMIN') {
    redirect('/admin')
  }

  redirect('/dashboard')
}

