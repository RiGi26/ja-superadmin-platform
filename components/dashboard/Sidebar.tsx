'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, PlusCircle, Users,
  CreditCard, ScrollText, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Dashboard',       href: '/dashboard',                  icon: LayoutDashboard },
  { label: 'Semua Tenant',    href: '/dashboard/tenants',          icon: Building2 },
  { label: 'Buat Tenant',     href: '/dashboard/tenants/new',      icon: PlusCircle },
  { label: 'Leads',           href: '/dashboard/leads',            icon: Users },
  { label: 'Subscriptions',   href: '/dashboard/subscriptions',    icon: CreditCard },
  { label: 'Audit Log',       href: '/dashboard/audit',            icon: ScrollText },
  { label: 'Settings',        href: '/dashboard/settings',         icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="px-5 py-5 border-b border-zinc-800">
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">JapanarEna</p>
        <p className="text-sm font-semibold text-zinc-100 mt-0.5">Superadmin</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-3 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold">
          JapanarEna Corp · Internal
        </p>
      </div>
    </aside>
  )
}
