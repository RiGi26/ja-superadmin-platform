export type PlatformType = 'lms' | 'clinic' | 'pharmacy' | 'jastip'
export type TenantStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled'
export type PlanTier = 'starter' | 'pro' | 'enterprise'
export type GlobalRole = 'superadmin' | 'owner' | 'admin' | 'member'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'

export interface Tenant {
  id               : string
  name             : string
  slug             : string
  logo_url?        : string | null
  phone?           : string | null
  email?           : string | null
  address?         : string | null
  platform?        : PlatformType | null
  status           : TenantStatus
  plan_tier?       : PlanTier | null
  owner_user_id?   : string | null
  linked_tenant_id?: string | null
  trial_ends_at?   : string | null
  suspended_at?    : string | null
  cancelled_at?    : string | null
  data_deletion_at?: string | null
  metadata         : Record<string, unknown>
  created_at       : string
  updated_at       : string
  fonnte_token?    : string | null
}

export interface SubscriptionPlan {
  id                : string
  platform          : PlatformType
  tier              : PlanTier
  tier_display_name : string
  price_monthly     : number
  features          : string[]
  limits            : Record<string, number>
  midtrans_plan_id? : string | null
  is_active         : boolean
  created_at        : string
}

export interface TenantSubscription {
  id                       : string
  tenant_id                : string
  plan_id                  : string
  status                   : SubscriptionStatus
  trial_ends_at?           : string | null
  current_period_start?    : string | null
  current_period_end?      : string | null
  grace_period_ends_at?    : string | null
  cancelled_at?            : string | null
  created_at               : string
  updated_at               : string
  plan?                    : SubscriptionPlan
  tenant?                  : Pick<Tenant, 'id' | 'name' | 'slug' | 'platform'>
}

export interface TenantMember {
  id            : string
  tenant_id     : string
  user_id       : string
  role          : GlobalRole
  platform_role?: string | null
  joined_at     : string
  is_active     : boolean
}

export interface SubscriptionEvent {
  id         : string
  tenant_id  : string
  event_type : string
  payload    : Record<string, unknown>
  created_at : string
}

export interface CreateTenantFormData {
  name             : string
  slug             : string
  platform         : PlatformType
  plan_id          : string
  owner_name       : string
  owner_email      : string
  owner_phone?     : string
  linked_tenant_id?: string
}

export interface CreateTenantResult {
  tenant: Tenant
  owner : { email: string; temporaryPassword: string }
}

export interface JWTClaims {
  sub              : string
  email?           : string
  tenant_id?       : string
  tenant_slug?     : string
  platform?        : PlatformType
  user_role?       : GlobalRole
  platform_role?   : string
  linked_tenant_id?: string
  exp              : number
  iat?             : number
}
