export interface Lead {
  id            : string
  name          : string
  email         : string
  phone_wa?     : string | null
  business_name?: string | null
  platforms?    : string[]
  message?      : string | null
  status        : 'new' | 'contacted' | 'converted' | 'rejected'
  notes?        : string | null
  created_at    : string
}
