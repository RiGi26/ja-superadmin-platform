import { type NextRequest } from 'next/server'
import { handleActiveStockCoreRequest, handleActiveStockCoreHead } from '@/lib/stock-active-http'

export const runtime = 'nodejs'
export const POST = (request: NextRequest) => handleActiveStockCoreRequest(request, 'authorize')
export const HEAD = handleActiveStockCoreHead
