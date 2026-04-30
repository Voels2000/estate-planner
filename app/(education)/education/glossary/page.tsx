import { promises as fs } from 'node:fs'
import path from 'node:path'
import ReactMarkdown from 'react-markdown'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EducationProse } from '@/components/education/EducationProse'

export default async function EducationGlossaryPage() {
  const fullPath = path.join(process.cwd(), 'content', 'education', 'glossary.md')
  const body = await fs.readFile(fullPath, 'utf8')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ButtonLink href="/education" variant="link" className="text-[color:var(--navy)]">
        ← Back to Education Guide
      </ButtonLink>
      <Card className="card-surface mt-4 p-6">
        <h1 className="education-title mb-2 text-2xl">Planning Glossary</h1>
        <p className="education-subtitle mb-5 text-sm">
          Plain-English definitions for common financial, retirement, and estate planning terms.
        </p>
        <EducationProse>
          <ReactMarkdown>{body}</ReactMarkdown>
        </EducationProse>
      </Card>
    </div>
  )
}

