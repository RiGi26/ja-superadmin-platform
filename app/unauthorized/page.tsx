import Link from 'next/link'
import { ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-950 flex items-center justify-center mx-auto mb-6">
          <ShieldOff size={26} className="text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-zinc-100 mb-2">Akses Ditolak</h1>
        <p className="text-sm text-zinc-500 mb-8">
          Halaman ini hanya untuk superadmin JapanarEna Corp.
        </p>
        <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" render={<Link href="/login" />}>
          Kembali ke Login
        </Button>
      </div>
    </div>
  )
}
