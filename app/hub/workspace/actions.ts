'use server'

import { submitHubE1Workspace, type HubE1State } from '@/lib/hub-e1-workspace'

export async function createHubWorkspace(keys: unknown, _previous: HubE1State, form: FormData): Promise<HubE1State> {
  // All bound arguments and previous state are untrusted. The DAL validates the
  // request and independently authenticates the current customer before writes.
  return submitHubE1Workspace(keys, form)
}
