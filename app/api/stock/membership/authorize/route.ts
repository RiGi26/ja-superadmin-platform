import { type NextRequest } from 'next/server'
import { handleStockMembershipCoreRequest, handleStockMembershipCoreHead } from '@/lib/stock-membership-http'

export const runtime = 'nodejs'
export const POST = (request: NextRequest) => handleStockMembershipCoreRequest(request)
export const HEAD = handleStockMembershipCoreHead
