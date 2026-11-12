-- PROPOSED read-only Gate B settings check. Exact target and Owner authority required.
-- Only schema metadata and booleans; no customer/session/payment data.
BEGIN READ ONLY;
SELECT 'membership' AS feature, enabled FROM stock_membership_private.settings WHERE singleton
UNION ALL SELECT 'preparation', enabled FROM stock_membership_private.preparation_settings WHERE singleton
UNION ALL SELECT 'workspace', enabled FROM stock_workspace_private.settings WHERE singleton
UNION ALL SELECT 'invitation', enabled FROM stock_membership_private.operator_invitation_settings WHERE singleton
UNION ALL SELECT 'operator_commit', enabled FROM stock_membership_private.operator_commit_settings WHERE singleton
UNION ALL SELECT 'operator_confirmation', enabled FROM stock_membership_private.operator_confirmation_settings WHERE singleton
UNION ALL SELECT 'lifecycle_mutations', mutations_enabled FROM stock_membership_private.lifecycle_settings WHERE singleton
UNION ALL SELECT 'lifecycle_delivery', delivery_enabled FROM stock_membership_private.lifecycle_settings WHERE singleton;
SELECT 'billing' AS feature,enabled,payment_mode='sandbox' AS sandbox_mode FROM stock_billing_private.settings WHERE singleton;
SELECT id,is_active,is_for_sale,stock_billing_private.approved_plan(id) AS approved_contract FROM public.subscription_plans WHERE id IN ('5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2001'::uuid,'5dc6f4d0-6ef8-4b61-9950-7b4b1e8a2002'::uuid) ORDER BY id;
COMMIT;
