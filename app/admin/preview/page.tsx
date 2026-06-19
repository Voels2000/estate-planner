import { notFound } from 'next/navigation'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { PreviewGalleryClient } from './_preview-gallery-client'

export default async function AdminPreviewPage() {
  const { isSuperuser } = await getAccessContext()
  if (!isSuperuser) notFound()

  return <PreviewGalleryClient />
}
