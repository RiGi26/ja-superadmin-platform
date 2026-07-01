// ============================================================
// lib/platform-settings.ts — Baca konfigurasi tingkat platform dari Core DB
// (tabel platform_settings, key/value). Server-only.
//
// Saat ini: kampanye promo (Fase 2). Sumber kebenaran = DB → owner bisa
// nyalakan/matikan tanpa redeploy. Pola baca sejajar getMidtransMode() di
// lib/midtrans.ts.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'

export type AdminDb = ReturnType<typeof createAdminClient>

// Kampanye promo langganan. `tier` = enum Core (mis. 'enterprise' = display "Pro").
// startDate/endDate opsional (ISO); bila diisi, kampanye hanya aktif dalam window.
export type PromoCampaign = {
  active: boolean
  discountPct: number
  tier: string
  months: number
  startDate: string | null
  endDate: string | null
  code: string
}

export const DEFAULT_PROMO_CAMPAIGN: PromoCampaign = {
  active: false,
  discountPct: 50,
  tier: 'enterprise',
  months: 3,
  startDate: null,
  endDate: null,
  code: 'PROMO_PRO_50_3M',
}

// Baca config kampanye (key JSON `promo_campaign`). Error/kosong/invalid → default OFF.
export async function getPromoCampaign(db: AdminDb): Promise<PromoCampaign> {
  const { data, error } = await db
    .from('platform_settings')
    .select('value')
    .eq('key', 'promo_campaign')
    .maybeSingle()
  if (error) {
    console.error(`[promo] gagal baca promo_campaign, fallback OFF: ${error.message}`)
    return DEFAULT_PROMO_CAMPAIGN
  }
  if (!data?.value) return DEFAULT_PROMO_CAMPAIGN
  try {
    const parsed = JSON.parse(data.value) as Partial<PromoCampaign>
    return { ...DEFAULT_PROMO_CAMPAIGN, ...parsed }
  } catch {
    console.error('[promo] promo_campaign JSON invalid, fallback OFF')
    return DEFAULT_PROMO_CAMPAIGN
  }
}

// Aktif = flag ON DAN (bila tanggal diisi) `now` dalam window [startDate, endDate].
export function isCampaignActive(c: PromoCampaign, now: Date = new Date()): boolean {
  if (!c.active) return false
  if (c.startDate && now < new Date(c.startDate)) return false
  if (c.endDate && now > new Date(c.endDate)) return false
  return true
}
