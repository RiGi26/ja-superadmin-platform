-- ============================================================
-- 004_jwt_hook.sql
-- Core DB Baru: jexpxecxylyeefywdzpd
-- Custom JWT Claims Hook — inject user_role, tenant_id, dll ke JWT
-- Jalankan di SQL Editor Core DB BARU setelah 003_rls_policies.sql
--
-- SETELAH jalankan SQL ini:
-- Pasang di Supabase Dashboard → Authentication → Hooks
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_jwt_claims(event JSONB)
RETURNS JSONB AS $$
DECLARE
  v_user_id     UUID;
  v_member      RECORD;
  v_claims      JSONB;
BEGIN
  v_user_id := (event ->> 'user_id')::UUID;
  v_claims  := event -> 'claims';

  -- Cari membership aktif user ini
  SELECT
    tm.role,
    tm.platform_role,
    tm.tenant_id,
    t.slug,
    t.platform,
    t.status,
    t.linked_tenant_id
  INTO v_member
  FROM public.tenant_members tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = v_user_id
  LIMIT 1;

  IF v_member IS NOT NULL THEN
    v_claims := v_claims
      || jsonb_build_object('user_role',          v_member.role)
      || jsonb_build_object('platform_role',       v_member.platform_role)
      || jsonb_build_object('tenant_id',           v_member.tenant_id)
      || jsonb_build_object('tenant_slug',         v_member.slug)
      || jsonb_build_object('platform',            v_member.platform)
      || jsonb_build_object('tenant_status',       v_member.status)
      || jsonb_build_object('linked_tenant_id',    v_member.linked_tenant_id);
  END IF;

  RETURN jsonb_build_object('claims', v_claims);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute ke supabase_auth_admin (dibutuhkan agar hook bisa dipanggil)
GRANT EXECUTE ON FUNCTION public.custom_jwt_claims TO supabase_auth_admin;
