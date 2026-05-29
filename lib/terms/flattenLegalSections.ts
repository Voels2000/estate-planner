import type { LegalSection } from '@/components/legal/LegalDocumentLayout'

export type AcceptTermsSection = {
  title: string
  body: string
}

export function flattenLegalSections(sections: LegalSection[]): AcceptTermsSection[] {
  return sections.map((section) => ({
    title: section.title,
    body: section.blocks
      .map((block) => {
        if (block.kind === 'p') return block.text
        return block.items.map((item) => `• ${item}`).join('\n')
      })
      .join('\n\n'),
  }))
}
