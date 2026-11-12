-- PROPOSED READ-ONLY. Exact Owner authority required; Core hxhusfkrlafxdnyasmsu.
-- Only three frozen Companies, bounded invoice metadata and aggregate counters.
-- No notification payload, gateway order/token/redirect, Auth/session or secrets.
BEGIN READ ONLY;
WITH allowed AS (SELECT * FROM jsonb_to_recordset($fixtures$[{"label":"existing_basic","company_id":"0c0b5c44-2af7-471e-8685-bd99438db48d","core_tenant_id":"55f50424-6663-440f-8001-0e77af2b1d35","stock_tenant_id":"900376ee-8003-4c20-807e-e4ff50f2be06","profile_id":"94387c2e-3491-4254-9392-6010eddcbb8b"},{"label":"fresh_pro","company_id":"d713ddba-3568-477b-af22-7dec7d7ec740","core_tenant_id":"4613d510-58b2-4c76-b2bb-3860e7918765","stock_tenant_id":"add9ddac-4cc8-4c83-9be1-020c6f96f70b","profile_id":"1a694c28-d7ee-4ebc-a3f2-31f6da20b129"},{"label":"additional_basic","company_id":"8215b025-e5b6-43d4-b2d1-3a4236178b6c","core_tenant_id":"5d813c3f-e45f-4893-9356-2f3f14566629","stock_tenant_id":"df28ca9c-d65d-4a21-99fb-a8e64514a808","profile_id":"d385d443-3423-4c7e-aa97-fc3523e449f4"}]$fixtures$::jsonb) AS a(label text,company_id uuid,core_tenant_id uuid,stock_tenant_id uuid,profile_id uuid))
SELECT a.label,a.company_id,
 (SELECT jsonb_build_object('enabled',c.enabled,'createdAt',c.created_at,'validUntil',c.valid_until)
  FROM stock_billing_private.sandbox_cohort c WHERE c.company_id=a.company_id) AS eligibility,
 (SELECT count(*)::int FROM public.subscription_invoices i WHERE i.tenant_id=a.core_tenant_id) AS invoice_count,
 (SELECT count(*)::int FROM public.subscription_invoices i WHERE i.tenant_id=a.core_tenant_id AND i.status='paid') AS paid_count,
 (SELECT coalesce(jsonb_agg(x ORDER BY x.created_at),'[]'::jsonb) FROM
   (SELECT i.id,i.plan_id,i.period,i.amount,i.status,i.midtrans_mode,i.created_at,i.paid_at
    FROM public.subscription_invoices i WHERE i.tenant_id=a.core_tenant_id ORDER BY i.created_at LIMIT 5) x) AS invoices,
 (SELECT jsonb_build_object('planId',s.plan_id,'status',s.status,'expiresAt',s.current_period_end)
  FROM public.tenant_subscriptions s WHERE s.tenant_id=a.core_tenant_id) AS subscription,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('invoiceId',d.invoice_id,'deliveryId',d.delivery_id,'state',d.state)),'[]'::jsonb)
  FROM stock_billing_private.deliveries d WHERE d.tenant_id=a.core_tenant_id) AS deliveries
FROM allowed a ORDER BY a.label;
COMMIT;
