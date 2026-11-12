/** Separate active-Stock gate. Existing Company/E1/quarantine flags stay unchanged. */
export const ACTIVE_STOCK_RUNTIME_ENABLED = false as const

/** Bounded pilot only; database cohort and tuple checks remain mandatory. */
export const STOCK_SSO_PILOT_ENABLED = process.env.STOCK_SSO_PILOT_ENABLED === 'true'
