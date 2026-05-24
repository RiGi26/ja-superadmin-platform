'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'

export function Header({ email }: { email: string }) {
  const router = useRouter()
  const initials = email ? email.slice(0, 2).toUpperCase() : 'SA'

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
      <div />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-800 transition-colors bg-transparent border-none cursor-pointer">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-zinc-700 text-zinc-200 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-zinc-400 max-w-48 truncate">{email}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-200">
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-400 focus:text-red-300 focus:bg-red-950/40 cursor-pointer"
          >
            <LogOut size={14} className="mr-2" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
