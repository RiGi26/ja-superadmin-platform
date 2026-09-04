import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticlePageContent } from '../../../_public/PublicExploreContent'
import { PUBLIC_ARTICLES } from '../../../_public/public-content'

export function generateStaticParams() {
  return PUBLIC_ARTICLES.map((article) => ({ slug: article.slug }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = PUBLIC_ARTICLES.find((item) => item.slug === slug)
  if (!article) return { title: 'Artikel tidak ditemukan | Webzoka' }
  return {
    title: `${article.title} | Webzoka`,
    description: article.excerpt,
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = PUBLIC_ARTICLES.find((item) => item.slug === slug)
  if (!article) notFound()
  return <ArticlePageContent article={article} />
}
