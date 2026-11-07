/** Closed until provider, account-linking, isolated runtime and release review pass. */
export const GOOGLE_SOCIAL_RUNTIME_ENABLED = false as const

export const GOOGLE_SOCIAL_PILOT_ENABLED = process.env.STOCK_SSO_PILOT_ENABLED === 'true'
