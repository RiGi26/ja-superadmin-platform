-- ============================================================
-- 002_seed_plans.sql
-- Core DB Baru: jexpxecxylyeefywdzpd
-- Seed 12 subscription plans (4 platform × 3 tier)
-- Jalankan di SQL Editor Core DB BARU setelah 001_core_schema.sql
-- ============================================================

INSERT INTO public.subscription_plans
  (platform, tier, name, price_monthly, price_yearly, max_users, features)
VALUES
  -- LMS
  ('lms','starter','LMS Starter',299000,2990000,50,'["Modul dasar","Absensi","Laporan"]'),
  ('lms','pro','LMS Pro',599000,5990000,200,'["Semua Starter","Sertifikat","WhatsApp notif","Ujian online"]'),
  ('lms','enterprise','LMS Enterprise',1199000,11990000,NULL,'["Semua Pro","Custom domain","API access","Priority support"]'),
  -- Clinic
  ('clinic','starter','Clinic Starter',349000,3490000,10,'["Antrian","Rekam medis","Resep digital"]'),
  ('clinic','pro','Clinic Pro',699000,6990000,50,'["Semua Starter","Lab hasil","WhatsApp notif","Apotek link"]'),
  ('clinic','enterprise','Clinic Enterprise',1399000,13990000,NULL,'["Semua Pro","Multi cabang","Custom form","Priority support"]'),
  -- Pharmacy
  ('pharmacy','starter','Pharmacy Starter',249000,2490000,5,'["Kasir POS","Stok obat","Laporan harian"]'),
  ('pharmacy','pro','Pharmacy Pro',499000,4990000,20,'["Semua Starter","BPJS integration","Resep dari klinik","WhatsApp"]'),
  ('pharmacy','enterprise','Pharmacy Enterprise',999000,9990000,NULL,'["Semua Pro","Multi cabang","API","Priority support"]'),
  -- Jastip
  ('jastip','starter','Jastip Starter',199000,1990000,3,'["Order tracking","Invoice otomatis","WhatsApp notif"]'),
  ('jastip','pro','Jastip Pro',399000,3990000,15,'["Semua Starter","Multi kurir","Dashboard analitik"]'),
  ('jastip','enterprise','Jastip Enterprise',799000,7990000,NULL,'["Semua Pro","Custom domain","API","Priority support"]')
ON CONFLICT DO NOTHING;
