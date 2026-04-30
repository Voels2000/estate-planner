import { promises as fs } from 'node:fs'
import path from 'node:path'
import ReactMarkdown from 'react-markdown'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EducationProse } from '@/components/education/EducationProse'
import { EducationDisclaimer } from '@/components/education/EducationDisclaimer'

export default async function EducationGlossaryPage() {
  const fullPath = path.join(process.cwd(), 'content', 'education', 'glossary.md')
  const body = await fs.readFile(fullPath, 'utf8')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ButtonLink href="/education" variant="link">
        ← Back to Education Guide
      </ButtonLink>
      <Card className="mt-4 p-6">
        <EducationProse>
          <ReactMarkdown>{body}</ReactMarkdown>
        </EducationProse>
      </Card>
      <div className="mt-8">
        <EducationDisclaimer />
      </div>
    </div>
  )
}

