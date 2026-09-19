import Image from 'next/image'
import { BadgeCheck, MessagesSquare, ShieldCheck } from 'lucide-react'
import styles from '../hub.module.css'

export function HubAuthStory({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <section className={styles.loginStory} aria-label="Tentang Webzoka Customer Hub">
      <a className={styles.loginBrand} href="https://www.webzoka.com">
        <Image src="/logo-rocket.png" alt="" width={42} height={38} priority unoptimized />
        <span translate="no">webzoka</span>
      </a>
      <div className={styles.loginStoryBody}>
        <p className={styles.eyebrowLight}>Customer Hub</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <ul className={styles.loginBenefits}>
          <li><BadgeCheck aria-hidden="true" /> Data akun langsung dari Webzoka Core</li>
          <li><ShieldCheck aria-hidden="true" /> Akses terlindungi untuk setiap bisnis</li>
          <li><MessagesSquare aria-hidden="true" /> Bantuan Webzoka dalam satu jalur</li>
        </ul>
      </div>
      <p className={styles.loginStoryFoot}>Part of Japan Arena Corp</p>
    </section>
  )
}
