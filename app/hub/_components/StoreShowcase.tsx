import type { StockPlanChoice } from '@/lib/customer-onboarding'
import type { PortfolioClient } from '../_public/public-content'
import { StockStoreFront, type StockStoreQuote } from './StockStoreFront'
import styles from '../hub.module.css'

const clientVisualClass: Record<PortfolioClient['visual'], string> = {
  arena: styles.clientShowcaseVisualArena,
  bakso: styles.clientShowcaseVisualBakso,
  kamy: styles.clientShowcaseVisualKamy,
}

export function ClientPreviewVisual({ client }: { client: PortfolioClient }) {
  return (
    <div className={`${styles.clientShowcaseVisual} ${clientVisualClass[client.visual]}`} aria-hidden="true">
      <div className={styles.clientShowcaseBrowser}>
        <div className={styles.clientShowcaseBrowserTop}>
          <span />
          <span />
          <span />
          <small>{client.website}</small>
        </div>
        <div className={styles.clientShowcaseWindow}>
          <div className={styles.clientShowcaseWindowMark} />
          <div className={styles.clientShowcaseWindowNav}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.clientShowcaseWindowBody}>
            <div className={styles.clientShowcaseWindowCopy}>
              <i />
              <b />
              <b />
              <em />
            </div>
            <div className={styles.clientShowcaseWindowPanel}>
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
      <span className={styles.clientShowcaseFloat}>{client.industry}</span>
    </div>
  )
}


export function StoreShowcase({ quote = null }: { plans?: StockPlanChoice[]; quote?: StockStoreQuote | null }) {
  return <StockStoreFront quote={quote} />
}
