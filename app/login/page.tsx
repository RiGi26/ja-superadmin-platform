'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email atau password salah.')
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
          setError('Akses ditolak. Akun ini bukan superadmin.')
          setLoading(false)
          return
        }
      } catch {
        await supabase.auth.signOut()
        setError('Gagal memverifikasi akses. Coba lagi.')
        setLoading(false)
        return
      }
    }

    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
            <ShieldCheck size={24} className="text-zinc-100" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">JapanarEna Superadmin</h1>
          <p className="text-sm text-zinc-500 mt-1">Internal access only</p>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-zinc-100 text-base">Masuk</CardTitle>
            <CardDescription className="text-zinc-500">
              Hanya untuk superadmin@japanarenacorp.com
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-start gap-2 bg-red-950/50 border border-red-900 rounded-lg p-3 mb-4">
                <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-zinc-400 text-xs uppercase tracking-wider">
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
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-zinc-400 text-xs uppercase tracking-wider">
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
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-semibold"
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

        <p className="text-center text-xs text-zinc-700 mt-6">
          JapanarEna Corp · Internal Tool
        </p>
      </div>
    </div>
  )
}
