-- Proposed only. Core hxhusfkrlafxdnyasmsu. One read of the frozen S3
-- delivery and Produksi invitation. Returns fixed booleans, no raw values.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

WITH fixture AS (
  SELECT '8215b025-e5b6-43d4-b2d1-3a4236178b6c'::uuid AS company_id,
    'b326f8c3-8522-47cb-a267-ccd59fad823c'::uuid AS reservation_id,
    '5d813c3f-e45f-4893-9356-2f3f14566629'::uuid AS tenant_id,
    'e692a22f-1ae2-47bc-9074-59247e0ae023'::uuid AS invoice_id,
    'cc38953d-5973-4609-834d-675091ddf5ac'::uuid AS delivery_id,
    '5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid AS plan_id,
    '36191ebc-3a6e-4d8c-b8e4-abb62e33b965'::uuid AS core_subject,
    'c22a4ea5-3679-4cc6-a583-f8012bd471bc'::uuid AS stock_subject,
    'df28ca9c-d65d-4a21-99fb-a8e64514a808'::uuid AS stock_tenant_id,
    'd385d443-3423-4c7e-aa97-fc3523e449f4'::uuid AS profile_id
), paid_delivery AS (
  SELECT d.state, d.last_attempt_at, d.expires_at, i.paid_at, i.subscription_id
  FROM fixture f
  JOIN stock_billing_private.deliveries d ON d.invoice_id=f.invoice_id
    AND d.delivery_id=f.delivery_id AND d.tenant_id=f.tenant_id AND d.plan_id=f.plan_id
  JOIN public.subscription_invoices i ON i.id=f.invoice_id AND i.tenant_id=f.tenant_id
    AND i.plan_id=f.plan_id AND i.status='paid' AND i.paid_at IS NOT NULL
    AND i.period='monthly' AND i.amount=149000 AND i.midtrans_mode='sandbox'
), scoped_invite AS (
  SELECT id FROM stock_membership_private.operator_invitations
  WHERE company_id='d713ddba-3568-477b-af22-7dec7d7ec740'::uuid
    AND instance_id='cf6437d2-b6c2-4973-8ea7-ae69333883b1'::uuid AND role='produksi'
    AND email_hash=sha256(convert_to('egyelisyaaaaa+stock-operator2-20261103@gmail.com','UTF8'))
)
SELECT
  EXISTS (SELECT 1 FROM paid_delivery) AS exact_paid_delivery,
  EXISTS (SELECT 1 FROM paid_delivery WHERE state='pending') AS delivery_pending,
  EXISTS (SELECT 1 FROM paid_delivery WHERE last_attempt_at>=paid_at) AS claim_recorded_since_payment,
  EXISTS (SELECT 1 FROM fixture f JOIN paid_delivery d ON true
    JOIN public.tenant_subscriptions s ON s.id=d.subscription_id AND s.tenant_id=f.tenant_id
      AND s.plan_id=f.plan_id AND s.status='active' AND s.current_period_end=d.expires_at
    WHERE d.expires_at>clock_timestamp()) AS current_subscription_matches,
  EXISTS (SELECT 1 FROM fixture f
    JOIN stock_billing_private.accounts a ON a.company_id=f.company_id AND a.reservation_id=f.reservation_id
      AND a.tenant_id=f.tenant_id AND a.owner_id=f.core_subject
    JOIN stock_workspace_private.billing_origins o ON o.company_id=f.company_id AND o.reservation_id=f.reservation_id
      AND o.core_tenant_id=f.tenant_id AND o.core_subject=f.core_subject AND o.origin_version=2
    JOIN stock_workspace_private.billing_bindings b ON b.reservation_id=f.reservation_id
      AND b.stock_subject=f.stock_subject AND b.stock_tenant_id=f.stock_tenant_id AND b.profile_id=f.profile_id)
    AS exact_owner_resource_binding,
  EXISTS (SELECT 1 FROM fixture f WHERE stock_billing_private.current_owner(f.company_id,f.core_subject)
    AND stock_billing_private.paid_creation_allowed(f.core_subject,f.stock_subject)) AS current_owner_eligible,
  EXISTS (SELECT 1 FROM stock_billing_private.settings WHERE singleton AND enabled AND payment_mode='sandbox')
    AS sandbox_delivery_enabled,
  EXISTS (SELECT 1 FROM scoped_invite) AS production_role_invitation_reserved,
  EXISTS (SELECT 1 FROM scoped_invite i JOIN stock_membership_private.operator_mail m ON m.id=i.id)
    AS production_role_mail_prepared,
  EXISTS (SELECT 1 FROM scoped_invite i JOIN stock_membership_private.operator_mail_receipts r ON r.id=i.id)
    AS production_role_mail_acknowledged;

COMMIT;
