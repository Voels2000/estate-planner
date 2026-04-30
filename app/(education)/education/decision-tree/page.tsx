import { promises as fs } from 'node:fs'
import path from 'node:path'
import ReactMarkdown from 'react-markdown'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EducationProse } from '@/components/education/EducationProse'
import { EducationDisclaimer } from '@/components/education/EducationDisclaimer'

export default async function EducationDecisionTreePage() {
  const fullPath = path.join(process.cwd(), 'content', 'education', 'decision-tree.md')
  const body = await fs.readFile(fullPath, 'utf8')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ButtonLink href="/education" variant="link" className="text-[#1a3460]">
        ← Back to Education Guide
      </ButtonLink>
      <Card className="education-surface mt-4 p-6">
        <h1 className="education-title mb-2 text-2xl">Your Planning Education Path</h1>
        <p className="education-subtitle mb-5 text-sm">
          Answer questions to discover which concepts are most relevant to your situation.
        </p>
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

