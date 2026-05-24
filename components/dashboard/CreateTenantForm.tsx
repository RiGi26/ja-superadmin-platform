'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Loader2, Copy } from 'lucide-react'
import type { SubscriptionPlan, Tenant } from '@/types/tenant'

interface Props {
  plans           : Pick<SubscriptionPlan, 'id' | 'platform' | 'tier' | 'tier_display_name' | 'price_monthly'>[]
  linkableTenants : Pick<Tenant, 'id' | 'name' | 'platform' | 'slug'>[]
}

const PLATFORM_OPTIONS = [
  { value: 'lms',      label: 'Japan Arena LMS' },
  { value: 'clinic',   label: 'Japan Arena Clinic' },
  { value: 'pharmacy', label: 'Japan Arena Pharmacy' },
  { value: 'jastip',   label: 'Japan Arena Jastip' },
]

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('08')) return '628' + digits.slice(1)
  if (digits.startsWith('8')) return '628' + digits
  return digits
}

export function CreateTenantForm({ plans, linkableTenants }: Props) {
  const [platform,        setPlatform]        = useState('')
  const [name,            setName]            = useState('')
  const [slug,            setSlug]            = useState('')
  const [planId,          setPlanId]          = useState('')
  const [ownerName,       setOwnerName]       = useState('')
  const [ownerEmail,      setOwnerEmail]      = useState('')
  const [ownerPhone,      setOwnerPhone]      = useState('')
  const [linkTenant,      setLinkTenant]      = useState(false)
  const [linkedTenantId,  setLinkedTenantId]  = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [result,          setResult]          = useState<{ tenantName: string; email: string; password: string } | null>(null)
  const [copied,          setCopied]          = useState(false)

  const filteredPlans = plans.filter(p => p.platform === platform)
  const needsLink = platform === 'clinic' || platform === 'pharmacy'
  const filteredLinkable = linkableTenants.filter(t =>
    platform === 'clinic' ? t.platform === 'pharmacy' : t.platform === 'clinic'
  )

  const handleNameChange = (val: string) => {
    setName(val)
    setSlug(slugify(val))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/admin/tenants', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        name, slug, platform, plan_id: planId,
        owner_name: ownerName,
        owner_email: ownerEmail,
        owner_phone: ownerPhone ? formatPhone(ownerPhone) : undefined,
        linked_tenant_id: linkTenant && linkedTenantId ? linkedTenantId : undefined,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Terjadi kesalahan. Coba lagi.')
      return
    }

    setResult({
      tenantName: data.tenant.name,
      email     : data.owner.email,
      password  : data.owner.temporaryPassword,
    })
  }

  const copyPassword = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (result) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-5">
            <CheckCircle2 size={20} className="text-green-400" />
            <p className="font-semibold text-zinc-100">Tenant &ldquo;{result.tenantName}&rdquo; berhasil dibuat!</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Email</span>
              <span className="text-zinc-200 font-mono">{result.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Password Sementara</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-200 font-mono bg-zinc-700 px-2 py-0.5 rounded">{result.password}</span>
                <button onClick={copyPassword} className="text-zinc-400 hover:text-zinc-200 transition-colors">
                  {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            Simpan password ini — tidak akan ditampilkan lagi. Welcome email sudah terkirim ke owner.
          </p>
          <Button
            onClick={() => { setResult(null); setName(''); setSlug(''); setPlatform(''); }}
            variant="outline"
            className="mt-4 border-zinc-700 text-zinc-300"
          >
            Buat Tenant Lain
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 bg-red-950/50 border border-red-900 rounded-xl p-3">
          <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Informasi Tenant */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-zinc-300">Informasi Tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400 uppercase tracking-wider">Platform *</Label>
            <Select value={platform} onValueChange={v => { setPlatform(v ?? ''); setPlanId('') }}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                <SelectValue placeholder="Pilih platform..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
                {PLATFORM_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400 uppercase tracking-wider">Nama Bisnis / Institusi *</Label>
            <Input
              value={name} onChange={e => handleNameChange(e.target.value)}
              required placeholder="Contoh: LMS Akademi Cepat"
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400 uppercase tracking-wider">Slug *</Label>
            <Input
              value={slug} onChange={e => setSlug(slugify(e.target.value))}
              required placeholder="lms-akademi-cepat"
              className="bg-zinc-800 border-zinc-700 text-zinc-200 font-mono"
            />
            {slug && (
              <p className="text-xs text-zinc-600">Preview: {slug}.japanarenacorp.com</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Informasi Owner */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-zinc-300">Informasi Owner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400 uppercase tracking-wider">Nama Lengkap *</Label>
            <Input
              value={ownerName} onChange={e => setOwnerName(e.target.value)}
              required placeholder="Nama owner"
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400 uppercase tracking-wider">Email Owner *</Label>
            <Input
              type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
              required placeholder="owner@bisnis.com"
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400 uppercase tracking-wider">WhatsApp</Label>
            <Input
              value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)}
              placeholder="08xx atau +628xx"
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-zinc-300">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400 uppercase tracking-wider">Plan *</Label>
            <Select value={planId} onValueChange={v => setPlanId(v ?? '')} disabled={!platform}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                <SelectValue placeholder={platform ? 'Pilih plan...' : 'Pilih platform dulu'} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
                {filteredPlans.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.tier_display_name} — Rp {p.price_monthly.toLocaleString('id-ID')}/bln
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-zinc-600 bg-zinc-800/50 rounded-lg px-3 py-2">
            Trial 14 hari gratis. Subscription mulai setelah trial berakhir.
          </div>
        </CardContent>
      </Card>

      {/* Linked Tenant (clinic/pharmacy only) */}
      {needsLink && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-300">
              Link ke Tenant Lain
              <span className="text-zinc-600 font-normal ml-2">(opsional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox" id="link-toggle"
                checked={linkTenant}
                onChange={e => { setLinkTenant(e.target.checked); setLinkedTenantId('') }}
                className="rounded border-zinc-700 bg-zinc-800"
              />
              <Label htmlFor="link-toggle" className="text-sm text-zinc-400 cursor-pointer">
                Link ke tenant {platform === 'clinic' ? 'pharmacy' : 'clinic'} yang sudah ada
              </Label>
            </div>
            {linkTenant && (
              <Select value={linkedTenantId} onValueChange={v => setLinkedTenantId(v ?? '')}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue placeholder="Pilih tenant yang di-link..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  {filteredLinkable.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.slug})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      <Button
        type="submit" disabled={loading || !platform || !planId}
        className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-semibold"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" /> Membuat tenant...
          </span>
        ) : (
          'Buat Tenant & Kirim Welcome Email'
        )}
      </Button>
    </form>
  )
}
