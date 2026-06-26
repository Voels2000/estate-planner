import type { ReactNode } from 'react'

export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }

export type LegalSection = {
  id: string
  title: string
  blocks: LegalBlock[]
}

type Props = {
  title: string
  lastUpdated: string
  sections: LegalSection[]
  contact?: ReactNode
}

export function LegalDocumentLayout({ title, lastUpdated, sections, contact }: Props) {
  return (
    <div className="min-h-screen bg-[#fafaf8] font-sans text-[#0f1f3d]">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-8 md:py-16">
        <header className="mb-10 border-b border-[#e2e8f0] pb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#718096]">
            My Wealth Maps
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-[#718096]">Last updated: {lastUpdated}</p>
        </header>

        <nav
          aria-label="Table of contents"
          className="mb-10 rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#718096]">
            Contents
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-[#0f1f3d] underline-offset-4 hover:text-[#2a4a7f] hover:underline"
                >
                  {section.title.replace(/^\d+\.\s*/, '')}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="font-serif text-xl font-medium text-[#0f1f3d] md:text-2xl">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-[#4a5568]">
                {section.blocks.map((block, index) => {
                  if (block.kind === 'p') {
                    return (
                      <p key={index} className="whitespace-pre-line">
                        {block.text}
                      </p>
                    )
                  }
                  return (
                    <ul key={index} className="list-disc space-y-2 pl-6">
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )
                })}
              </div>
            </section>
          ))}
        </article>

        {contact && (
          <footer className="mt-12 border-t border-[#e2e8f0] pt-8 text-sm leading-relaxed text-[#4a5568]">
            {contact}
          </footer>
        )}
      </div>
    </div>
  )
}
