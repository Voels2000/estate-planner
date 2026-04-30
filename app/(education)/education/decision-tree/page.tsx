import { promises as fs } from 'node:fs'
import path from 'node:path'
import ReactMarkdown from 'react-markdown'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'

export default async function EducationDecisionTreePage() {
  const fullPath = path.join(process.cwd(), 'content', 'education', 'decision-tree.md')
  const body = await fs.readFile(fullPath, 'utf8')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/education" className="text-sm text-indigo-600 hover:text-indigo-700">
        ← Back to Education Guide
      </Link>
      <Card className="mt-4 p-6">
        <article className="prose prose-neutral max-w-none">
          <ReactMarkdown>{body}</ReactMarkdown>
        </article>
      </Card>
      <div className="mt-8">
        <DisclaimerBanner context="education guide" />
      </div>
    </div>
  )
}

