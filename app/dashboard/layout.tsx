import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { verifySuperadmin } from '@/lib/auth'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Header } from '@/components/dashboard/Header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // Hanya superadmin yang boleh melihat dashboard (bukan sekadar user login).
  // verifySuperadmin: JWT user_role==='superadmin' ATAU email ∈ SUPERADMIN_EMAIL(S).
  if (!(await verifySuperadmin())) redirect('/unauthorized')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header email={user.email ?? ''} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
