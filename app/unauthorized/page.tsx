import Link from 'next/link'
import { ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-950 flex items-center justify-center mx-auto mb-6">
          <ShieldOff size={26} className="text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Akses Ditolak</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Halaman ini hanya untuk superadmin JapanarEna Corp.
        </p>
        <Button variant="outline" className="border-border text-foreground hover:bg-muted" render={<Link href="/login" />}>
          Kembali ke Login
        </Button>
      </div>
    </div>
  )
}
