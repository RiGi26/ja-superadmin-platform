-- ============================================================
-- 20260524_leads_table.sql
-- Sprint 2 — Leads table untuk form interest landing page
-- Jalankan di Supabase SQL Editor (shared project)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL,
  phone_wa      text,
  business_name text,
  platforms     text[],
  message       text,
  status        text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'converted', 'rejected')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_all_leads" ON public.leads;
CREATE POLICY "superadmin_all_leads" ON public.leads
  FOR ALL
  USING ((auth.jwt() ->> 'user_role') = 'superadmin');

DROP POLICY IF EXISTS "service_role_bypass" ON public.leads;
CREATE POLICY "service_role_bypass" ON public.leads
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Anon bisa INSERT (dari form landing page)
DROP POLICY IF EXISTS "anon_insert_leads" ON public.leads;
CREATE POLICY "anon_insert_leads" ON public.leads
  FOR INSERT
  WITH CHECK (true);
