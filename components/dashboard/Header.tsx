'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Menu, LayoutDashboard, Building2, PlusCircle, Users, CreditCard, ScrollText, Settings } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import Link from 'next/link'
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

export function Header({ email }: { email: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const initials = email ? email.slice(0, 2).toUpperCase() : 'SA'

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-border bg-card flex-shrink-0">
      <div className="flex items-center">
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden mr-2" />}>
            <Menu size={20} />
            <span className="sr-only">Toggle Sidebar</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-card border-r border-border">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="py-6 px-5 flex items-center justify-center border-b border-border">
              <img
                src="/logo-wide-clean.png"
                alt="Webzoka — Part of Japan Arena Corp"
                className="w-[210px] max-w-[86%] max-h-[64px] object-contain"
              />
            </div>
            <nav className="px-3 py-4 space-y-0.5">
              {NAV.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors bg-transparent border-none cursor-pointer">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-muted text-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground max-w-48 truncate hidden sm:inline-block">{email}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
          >
            <LogOut size={14} className="mr-2" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
