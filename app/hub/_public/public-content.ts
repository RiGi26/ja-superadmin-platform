export type PortfolioClient = {
  name: string
  website: string
  href: string
  industry: string
  products: string[]
  description: string
  detail: string
  visual: 'arena' | 'bakso' | 'kamy'
  featured?: boolean
}

export type PublicArticle = {
  slug: string
  category: string
  title: string
  excerpt: string
  intro: string
  sections: Array<{
    heading: string
    paragraphs: string[]
    bullets?: string[]
  }>
}

export type FaqItem = {
  question: string
  answer: string
}

export type Commitment = {
  title: string
  description: string
  points: string[]
  visual: 'honest' | 'proof' | 'local' | 'care'
}

export type PublicNavIcon = 'store' | 'portfolio' | 'article' | 'faq' | 'commitment'

export const PUBLIC_NAV: Array<{ href: string; label: string; icon: PublicNavIcon; badge?: string }> = [
  { href: '/hub/store', label: 'Webzoka Store', icon: 'store' as const },
  { href: '/hub/portofolio', label: 'Portofolio', icon: 'portfolio' as const },
  { href: '/hub/artikel', label: 'Artikel', icon: 'article' as const, badge: 'Baru' },
  { href: '/hub/faq', label: 'FAQ', icon: 'faq' as const },
  { href: '/hub/komitmen', label: 'Komitmen Kami', icon: 'commitment' as const },
]

export const PORTFOLIO_CLIENTS: PortfolioClient[] = [
  {
    name: 'Japan Arena',
    website: 'japanarena.id',
    href: 'https://www.japanarena.id',
    industry: 'Education',
    products: ['Website', 'LMS'],
    description: 'Kelas bahasa Jepang, pendaftaran, dan pengalaman belajar dalam satu ekosistem.',
    detail: 'Website membantu calon siswa menemukan program, sementara LMS mengelola pengalaman belajar setelah mendaftar.',
    visual: 'arena',
    featured: true,
  },
  {
    name: 'Bakso Tini',
    website: 'bakso-tini.webzoka.com',
    href: 'https://bakso-tini.webzoka.com',
    industry: 'Food & Beverage',
    products: ['Website', 'Stock'],
    description: 'Website pemesanan yang terhubung dengan operasi stok dan pemenuhan pesanan.',
    detail: 'Pelanggan melihat menu dari website, lalu tim dapat menindaklanjuti pesanan lewat sistem operasi yang terhubung.',
    visual: 'bakso',
  },
  {
    name: 'Kamy Physio',
    website: 'kamy-physio.webzoka.com',
    href: 'https://kamy-physio.webzoka.com',
    industry: 'Healthcare',
    products: ['Website'],
    description: 'Pengalaman digital yang membantu pasien memahami layanan dan mengambil langkah pertama.',
    detail: 'Struktur halaman dibuat untuk menjelaskan layanan fisioterapi dengan tenang dan mengarahkan calon pasien ke percakapan.',
    visual: 'kamy',
  },
]

export const PUBLIC_ARTICLES: PublicArticle[] = [
  {
    slug: 'website-atau-portal-bisnis',
    category: 'Panduan Bisnis',
    title: 'Website atau portal bisnis: mulai dari mana?',
    excerpt: 'Kenali peran website dan portal supaya investasi digital Anda dimulai dari kebutuhan yang paling dekat.',
    intro: 'Banyak pemilik bisnis mengira website dan portal adalah hal yang sama. Keduanya saling melengkapi, tetapi dipakai untuk pekerjaan yang berbeda.',
    sections: [
      {
        heading: 'Website bekerja di sisi pelanggan',
        paragraphs: [
          'Website adalah tempat orang menemukan bisnis Anda, memahami layanan, melihat produk, dan mengambil langkah pertama. Fokusnya adalah kejelasan, kepercayaan, dan kemudahan menghubungi Anda.',
          'Karena berada di depan, website harus menjawab pertanyaan dasar dengan cepat: Anda membantu siapa, menawarkan apa, dan bagaimana cara memulainya?',
        ],
      },
      {
        heading: 'Portal bekerja di sisi operasional',
        paragraphs: [
          'Portal membantu tim menjalankan pekerjaan di belakang layar. Contohnya, LMS untuk kelas dan siswa, Stock untuk pesanan dan inventori, atau sistem klinik untuk alur layanan.',
          'Portal menjadi penting saat pekerjaan mulai tersebar di banyak chat, spreadsheet, dan catatan yang sulit dilacak.',
        ],
      },
      {
        heading: 'Urutan yang masuk akal untuk memulai',
        paragraphs: ['Mulai dari bagian yang paling menghambat bisnis hari ini, lalu tambah sistem saat kebutuhan sudah jelas.'],
        bullets: [
          'Jika pelanggan sulit menemukan dan memahami bisnis Anda, mulai dari website.',
          'Jika tim kewalahan mengurus order, stok, kelas, atau layanan, mulai dari portal.',
          'Jika dua kebutuhan itu sama-sama mendesak, website dan portal dapat dirancang sebagai satu alur.',
        ],
      },
    ],
  },
  {
    slug: 'persiapan-website-live-3-5-hari',
    category: 'Proses Webzoka',
    title: 'Apa yang perlu disiapkan agar website bisa live dalam 3–5 hari kerja?',
    excerpt: 'Checklist singkat agar proses pembangunan website berjalan cepat, jelas, dan tidak bolak-balik.',
    intro: 'Estimasi website Webzoka adalah 3–5 hari kerja setelah data bisnis dan pembayaran atau DP diterima. Kelengkapan briefing menjadi faktor terbesar yang membuat proses tetap lancar.',
    sections: [
      {
        heading: 'Siapkan bahan yang paling penting dulu',
        paragraphs: ['Anda tidak perlu menulis semuanya dengan sempurna. Cukup kumpulkan bahan inti agar tim dapat menyusun draf pertama.'],
        bullets: [
          'Nama bisnis, layanan atau produk utama, dan area layanan.',
          'Logo, foto, warna, atau contoh gaya yang Anda sukai jika sudah ada.',
          'Nomor WhatsApp, alamat, jam buka, domain, dan tautan sosial yang ingin ditampilkan.',
          'Satu tujuan utama website, misalnya menerima order, booking, atau konsultasi.',
        ],
      },
      {
        heading: 'Sampaikan keputusan yang sudah pasti',
        paragraphs: [
          'Beritahu tim halaman atau fitur yang wajib ada sejak awal. Ini membantu kami membedakan kebutuhan inti dari ide tambahan yang bisa dikerjakan setelah website live.',
          'Jika Anda belum punya foto atau copy final, kami tetap dapat menyiapkan struktur awal dan menandai bagian yang perlu dilengkapi.',
        ],
      },
      {
        heading: 'Perubahan besar dibicarakan lebih dulu',
        paragraphs: ['Revisi konten dan penyesuaian layout minor termasuk dalam paket. Ganti template, menambah fitur, atau mengubah arah besar akan kami diskusikan dan estimasikan sebelum dikerjakan.'],
      },
    ],
  },
  {
    slug: 'memilih-sistem-bisnis',
    category: 'Operasional',
    title: 'Kapan bisnis membutuhkan sistem stok, LMS, atau klinik?',
    excerpt: 'Gunakan tanda-tanda sederhana dari pekerjaan harian untuk menentukan sistem yang paling tepat.',
    intro: 'Sistem yang baik bukan yang paling banyak fiturnya. Sistem yang baik mengurangi pekerjaan berulang yang sudah menghabiskan waktu tim Anda.',
    sections: [
      {
        heading: 'Pilih berdasarkan pekerjaan yang berulang',
        paragraphs: ['Catat pekerjaan yang dilakukan hampir setiap hari dan sering menimbulkan kesalahan. Dari sana, kebutuhan sistem biasanya terlihat lebih jelas daripada dari daftar fitur.'],
        bullets: [
          'Stock cocok saat pesanan, inventori, produksi, atau pemenuhan mulai sulit dilacak.',
          'LMS cocok saat Anda mengelola kelas, siswa, materi, progres, atau sertifikat.',
          'Clinic cocok saat alur layanan, jadwal, dan data pasien perlu ditata dalam satu tempat.',
        ],
      },
      {
        heading: 'Satu sistem tidak harus dipakai sekaligus',
        paragraphs: [
          'Anda dapat memulai dari sistem yang paling mendesak, lalu menghubungkan kebutuhan lain secara bertahap. Pendekatan ini membuat tim punya waktu untuk beradaptasi.',
          'Website tetap dapat berjalan terpisah sebagai pintu masuk pelanggan, atau dirancang bersama portal agar alurnya lebih singkat.',
        ],
      },
      {
        heading: 'Mulai dengan percakapan yang konkret',
        paragraphs: ['Sebelum memilih paket, ceritakan alur kerja yang sekarang berjalan, bagian yang paling sering tersendat, dan hasil yang ingin Anda lihat. Tim Webzoka akan membantu memetakan fondasi yang paling masuk akal.'],
      },
    ],
  },
]

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Apakah Store bisa dijelajahi tanpa menjadi pelanggan?',
    answer: 'Bisa. Store, Portofolio, Artikel, FAQ, dan Komitmen Kami dapat dibaca tanpa akun Customer Hub. Akun diperlukan saat Anda ingin mengakses sistem bisnis yang sudah aktif.',
  },
  {
    question: 'Bagaimana cara mendapatkan akun Customer Hub?',
    answer: 'Akun Customer Hub diaktifkan oleh tim Webzoka saat layanan atau portal Anda mulai berjalan. Gunakan satu akun untuk melihat sistem aktif, tagihan, dan jalur bantuan.',
  },
  {
    question: 'Apa bedanya website dengan portal bisnis?',
    answer: 'Website adalah tampilan online yang dilihat pelanggan. Portal adalah sistem operasional untuk menjalankan bisnis dari dalam, seperti mengelola stok, kelas, atau layanan. Keduanya dapat dipakai terpisah atau bersamaan.',
  },
  {
    question: 'Apakah saya bisa menggunakan domain sendiri?',
    answer: 'Bisa. Tim Webzoka dapat membantu mengarahkan domain Anda ke sistem. Jika belum memiliki domain, Anda dapat memulai dari subdomain Webzoka atau membahas domain baru bersama tim.',
  },
  {
    question: 'Berapa lama website saya selesai?',
    answer: 'Estimasi standar adalah 3–5 hari kerja setelah data bisnis dan pembayaran atau DP diterima. Fitur custom atau data yang belum lengkap dapat memengaruhi waktu, dan timeline akan dikonfirmasi sebelum mulai.',
  },
  {
    question: 'Apakah saya bisa meminta revisi?',
    answer: 'Bisa. Revisi konten dan penyesuaian layout minor termasuk dalam paket. Perubahan besar seperti mengganti template atau menambah fitur baru akan dibahas dan diestimasi lebih dulu.',
  },
  {
    question: 'Apakah ada kontrak minimum?',
    answer: 'Tidak ada kontrak minimum untuk portal berbasis langganan. Website berjalan dengan hosting tahunan dan dapat tidak diperpanjang saat jatuh tempo.',
  },
  {
    question: 'Kapan tim Webzoka bisa dihubungi?',
    answer: 'Support WhatsApp tersedia Senin–Sabtu, pukul 08.00–17.00 WIB. Sertakan nama bisnis dan sistem yang digunakan agar tim dapat membantu lebih cepat.',
  },
]

export const COMMITMENTS: Commitment[] = [
  {
    title: 'Harga dan ruang lingkup jelas sejak awal',
    description: 'Anda berhak tahu apa yang dibeli, kapan dikerjakan, dan biaya apa yang mungkin muncul sebelum mengambil keputusan.',
    points: ['Estimasi biaya ditampilkan sebelum pembayaran.', 'Perubahan besar dibahas dan diestimasi lebih dulu.', 'Tidak ada kontrak paksa untuk portal.'],
    visual: 'honest',
  },
  {
    title: 'Klaim yang bisa diperiksa',
    description: 'Kami menunjukkan demo dan portofolio live supaya Anda dapat menilai hasilnya dengan bukti yang nyata.',
    points: ['Contoh bisnis dapat dibuka langsung.', 'Fitur dijelaskan sesuai penggunaan sebenarnya.', 'Kami menghindari klaim yang tidak bisa dibuktikan.'],
    visual: 'proof',
  },
  {
    title: 'Dibuat untuk cara kerja di Indonesia',
    description: 'Bahasa, metode pembayaran, dan jalur bantuan kami disiapkan untuk pemilik bisnis Indonesia.',
    points: ['Komunikasi dalam Bahasa Indonesia.', 'Pembayaran melalui mitra payment gateway resmi.', 'Dukungan WhatsApp pada jam kerja Indonesia.'],
    visual: 'local',
  },
  {
    title: 'Data dan proses diperlakukan dengan tanggung jawab',
    description: 'Kami menjaga batas akses, memisahkan data bisnis, dan menjelaskan proses kerja supaya Anda tetap punya kendali.',
    points: ['Data setiap bisnis disimpan terpisah.', 'Kami tidak menyimpan nomor kartu pembayaran.', 'Timeline dan bahan kerja dikonfirmasi bersama.'],
    visual: 'care',
  },
]
