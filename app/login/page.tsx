'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      toast.error('Email atau password salah.')
      setLoading(false)
      return
    }

    if (data.session) {
      // Verifikasi superadmin di SERVER (sumber kebenaran tunggal: user_role JWT
      // atau email ∈ SUPERADMIN_EMAIL/SUPERADMIN_EMAILS). Cookie sesi sudah ter-set
      // oleh @supabase/ssr, jadi route server membacanya.
      try {
        const res = await fetch('/api/auth/superadmin', { cache: 'no-store' })
        const { ok } = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean }
        if (!ok) {
          await supabase.auth.signOut()
          toast.error('Akses ditolak. Akun ini bukan superadmin.')
          setLoading(false)
          return
        }
      } catch {
        await supabase.auth.signOut()
        toast.error('Gagal memverifikasi akses. Coba lagi.')
        setLoading(false)
        return
      }
    }

    toast.success('Login berhasil')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <img src="/logo-rocket.png" alt="Logo Webzoka" className="h-16 w-16 object-contain mb-4" />
          <h1 className="text-xl font-semibold text-foreground">Webzoka Superadmin</h1>
          <p className="text-sm text-muted-foreground mt-1">Part of Japan Arena Corp</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-foreground text-base">Login</CardTitle>
            <CardDescription className="text-muted-foreground">
              Hanya untuk superadmin@webzoka.com
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="superadmin@webzoka.com"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-muted-foreground text-xs uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full font-semibold"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin" /> Memverifikasi...
                  </span>
                ) : (
                  'Login'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Webzoka · Part of Japan Arena Corp
        </p>
      </div>
    </div>
  )
}
