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
      try {
        const payload = JSON.parse(atob(data.session.access_token.split('.')[1]))
        const isSuperadmin =
          payload?.user_role === 'superadmin' ||
          email === process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL

        if (!isSuperadmin) {
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
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <ShieldCheck size={24} className="text-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">JapanarEna Superadmin</h1>
          <p className="text-sm text-muted-foreground mt-1">Internal access only</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-foreground text-base">Masuk</CardTitle>
            <CardDescription className="text-muted-foreground">
              Hanya untuk superadmin@japanarenacorp.com
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
                  placeholder="superadmin@japanarenacorp.com"
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
                  'Masuk'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          JapanarEna Corp · Internal Tool
        </p>
      </div>
    </div>
  )
}
