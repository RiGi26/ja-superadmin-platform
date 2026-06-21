-- ============================================================
-- 006_import_to_core_db.sql
-- Jalankan di Core DB BARU (jexpxecxylyeefywdzpd)
-- Import data dari OLD DB (jqypnrwegqyjteparqpv)
--
-- URUTAN EKSEKUSI:
--   SECTION A: tenants (tidak ada FK ke auth.users)
--   SECTION B: tenant_subscriptions (FK ke tenants + plans)
--   SECTION C: tenant_members — JALANKAN TERAKHIR, setelah
--              semua user_id sudah ada di auth.users Core DB
-- ============================================================

-- ============================================================
-- SECTION A — TENANTS
-- 9 tenant diimport, 3 di-skip (platform = NULL)
-- Skipped:
--   5c63b537 "Demo Admin LMS" — platform null
--   8bb66715 "Demo Admin LMS" — platform null
--   a1d9b70d "Demo Admin LMS" — platform null
-- ============================================================

INSERT INTO public.tenants
  (id, name, slug, platform, status, plan_tier,
   email, phone, address, logo_url,
   linked_tenant_id, fonnte_token,
   suspended_at, cancelled_at,
   created_at, updated_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000099',
    'Demo LMS', 'demo', 'lms', 'trial', 'starter',
    'demo@japanarenacorp.com', NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '2026-05-18T22:56:39.668822+00:00',
    '2026-05-24T11:03:23.001546+00:00'
  ),
  (
    'e3b4d66f-3171-48d9-9b8d-fc6d59b3c2cf',
    'Demo Admin LMS', 'demo-admin-f3cc2c72', 'lms', 'active', 'starter',
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '2026-05-23T15:40:19.518806+00:00',
    '2026-05-24T11:03:23.001546+00:00'
  ),
  (
    'd4a6668f-2cff-4a7e-8db3-fa413c8c3f11',
    'Demo Admin LMS', 'demo-admin-2c052784', 'lms', 'active', 'starter',
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '2026-05-23T16:03:44.848755+00:00',
    '2026-05-24T11:03:23.001546+00:00'
  ),
  (
    '5bde3cae-6ddf-4ddf-8899-a8d3dac6702c',
    'Demo Admin LMS', 'demo-admin-742016c2', 'lms', 'active', 'starter',
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '2026-05-23T16:29:31.12106+00:00',
    '2026-05-24T11:03:23.001546+00:00'
  ),
  (
    '3c67f6c1-83e9-4f92-90ed-347513cca28e',
    'Demo Admin LMS', 'demo-admin-4c0e0d3f', 'lms', 'active', 'starter',
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '2026-05-23T16:42:49.567929+00:00',
    '2026-05-24T11:03:23.001546+00:00'
  ),
  (
    '8078f917-7a46-4ab5-a1f4-ade456490327',
    'Demo Admin LMS', 'demo-admin-a26a6aa9', 'lms', 'active', 'starter',
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '2026-05-23T17:02:49.557165+00:00',
    '2026-05-24T11:03:23.001546+00:00'
  ),
  (
    'ffa277a9-5167-4415-8053-4060db6478a9',
    'Demo Admin LMS', 'demo-admin-88dfacc3', 'lms', 'active', 'starter',
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '2026-05-24T02:31:08.995625+00:00',
    '2026-05-24T11:03:23.001546+00:00'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Japan Arena Academy', 'japan-arena', 'lms', 'active', 'enterprise',
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '2026-05-18T12:21:24.103177+00:00',
    '2026-05-24T11:03:23.001546+00:00'
  ),
  (
    '38997a1c-1c46-4153-925f-978d02e1192f',
    'PT SUKA MAJU', 'pt-suka-maju', 'lms', 'trial', 'pro',
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '2026-05-25T03:08:02.851+00:00',
    '2026-05-25T03:08:02.851+00:00'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION B — TENANT_SUBSCRIPTIONS
-- plan_id di-lookup dari Core DB baru via platform + tier
-- status 'trial' (OLD DB) → 'trialing' (Core DB schema)
-- ============================================================

INSERT INTO public.tenant_subscriptions
  (id, tenant_id, plan_id, status,
   trial_ends_at, current_period_start, current_period_end,
   grace_period_ends_at, cancelled_at,
   created_at, updated_at)
VALUES
  (
    '73d96d3b-b58b-4639-b624-8f5d8c1c330c',
    '00000000-0000-0000-0000-000000000099',
    (SELECT id FROM public.subscription_plans WHERE platform = 'lms' AND tier = 'starter' LIMIT 1),
    'trialing',
    '2026-06-07T14:34:23.052855+00:00',
    '2026-05-24T14:34:23.052855+00:00',
    '2026-06-07T14:34:23.052855+00:00',
    NULL, NULL,
    '2026-05-24T14:34:23.052855+00:00',
    '2026-05-24T14:34:23.052855+00:00'
  ),
  (
    'd864d309-716c-4e82-9bbb-1f3cf1b91655',
    '38997a1c-1c46-4153-925f-978d02e1192f',
    (SELECT id FROM public.subscription_plans WHERE platform = 'lms' AND tier = 'pro' LIMIT 1),
    'trialing',
    '2026-06-08T02:37:09.169+00:00',
    '2026-05-25T03:08:02.851+00:00',
    NULL,
    NULL, NULL,
    '2026-05-25T03:08:02.851+00:00',
    '2026-05-25T03:41:22.573356+00:00'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION C — TENANT_MEMBERS
-- ⚠️  JALANKAN SECTION INI TERAKHIR
--     Setelah semua user_id di bawah sudah dibuat di Core DB
--     Authentication → Users (atau via create tenant flow)
--
-- User IDs yang dibutuhkan (buat dulu di Core DB auth.users):
--   dad4930d-9801-4d0d-9fe9-1fd11e8af749  (student Demo LMS)
--   c2f3ba12-278e-4bb8-9576-8b171a3f8356  (admin Demo LMS)
--   ee8c49f5-e846-4b16-b0c7-ff093cfc54a7  (admin Demo Admin f3cc)
--   dae6b090-e054-4dcc-81e3-8c0ba7ccc00f  (admin Demo Admin 2c05)
--   3705a49b-93a9-4ecb-8b98-d14043c1b243  (admin Demo Admin 7420)
--   a1c5b9d6-379b-442e-a788-22c9fc1b33c2  (admin Demo Admin 4c0e)
--   b35b0d04-3457-4d0b-aa6c-998368585d29  (admin Demo Admin a26a)
--   8156ce69-df21-4f91-9c28-3b5b9d3d1e53  (admin Demo Admin 88df)
--   3e0cd532-5db9-4a8c-97ed-7a6b2148ceb8  (admin Demo LMS)
--   d74ea99d-39a9-47a9-9122-f360f59162a9  (owner PT SUKA MAJU)
-- ============================================================

INSERT INTO public.tenant_members
  (id, tenant_id, user_id, role, platform_role, created_at)
VALUES
  (
    'f1d7a85a-ac1d-4852-9eaf-63eebd91d886',
    '00000000-0000-0000-0000-000000000099',
    'dad4930d-9801-4d0d-9fe9-1fd11e8af749',
    'member', 'student',
    '2026-05-18T23:20:30.06854+00:00'
  ),
  (
    '76cbaac8-6cc3-44c5-9fe2-c19c94b6a457',
    '00000000-0000-0000-0000-000000000099',
    'c2f3ba12-278e-4bb8-9576-8b171a3f8356',
    'admin', NULL,
    '2026-05-18T23:20:30.06854+00:00'
  ),
  (
    '59a99125-1f1c-4fc3-b5ec-55fb4d9e4f3f',
    'e3b4d66f-3171-48d9-9b8d-fc6d59b3c2cf',
    'ee8c49f5-e846-4b16-b0c7-ff093cfc54a7',
    'admin', NULL,
    '2026-05-23T15:40:21.008609+00:00'
  ),
  (
    '56e5e683-94e3-416c-acf1-9231799f1fe9',
    'd4a6668f-2cff-4a7e-8db3-fa413c8c3f11',
    'dae6b090-e054-4dcc-81e3-8c0ba7ccc00f',
    'admin', NULL,
    '2026-05-23T16:03:46.46183+00:00'
  ),
  (
    '2b6e1fb7-756c-4ba8-904a-0e27eb8dd308',
    '5bde3cae-6ddf-4ddf-8899-a8d3dac6702c',
    '3705a49b-93a9-4ecb-8b98-d14043c1b243',
    'admin', NULL,
    '2026-05-23T16:29:32.702472+00:00'
  ),
  (
    'a8e2b395-00ec-4f8f-b8bd-b92075ca743b',
    '3c67f6c1-83e9-4f92-90ed-347513cca28e',
    'a1c5b9d6-379b-442e-a788-22c9fc1b33c2',
    'admin', NULL,
    '2026-05-23T16:42:50.712865+00:00'
  ),
  (
    'f965c126-c2b7-4552-8927-76d1bb0983d7',
    '8078f917-7a46-4ab5-a1f4-ade456490327',
    'b35b0d04-3457-4d0b-aa6c-998368585d29',
    'admin', NULL,
    '2026-05-23T17:02:50.687469+00:00'
  ),
  (
    'cbc7f351-6272-43a1-8e19-3759926796eb',
    'ffa277a9-5167-4415-8053-4060db6478a9',
    '8156ce69-df21-4f91-9c28-3b5b9d3d1e53',
    'admin', NULL,
    '2026-05-24T02:31:10.303917+00:00'
  ),
  (
    '5f2b9481-2223-4253-b9e9-b12f9763abbf',
    '00000000-0000-0000-0000-000000000099',
    '3e0cd532-5db9-4a8c-97ed-7a6b2148ceb8',
    'admin', NULL,
    '2026-05-24T14:29:59.740134+00:00'
  ),
  (
    'e9564c4f-2814-46f1-987f-9df4a91d7daf',
    '38997a1c-1c46-4153-925f-978d02e1192f',
    'd74ea99d-39a9-47a9-9122-f360f59162a9',
    'owner', NULL,
    '2026-05-25T03:08:02.851+00:00'
  )
ON CONFLICT (id) DO NOTHING;
