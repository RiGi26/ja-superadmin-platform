import { type NextRequest } from 'next/server'
import { handleStockMembershipCoreRequest } from '@/lib/stock-membership-http'

export const runtime = 'nodejs'
export const POST = (request: NextRequest) => handleStockMembershipCoreRequest(request, 'select')
