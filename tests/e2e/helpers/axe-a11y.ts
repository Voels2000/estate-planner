import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** Rules with high false-positive rates on marketing/auth shells — fix incrementally. */
const AXE_DISABLED_RULES = ['color-contrast'] as const

export async function expectNoSeriousA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .disableRules([...AXE_DISABLED_RULES])
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
    .analyze()

  const blocking = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  )

  if (blocking.length > 0) {
    const summary = blocking
      .map(
        (v) =>
          `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes
            .slice(0, 3)
            .map((n) => n.html)
            .join('\n  ')}`,
      )
      .join('\n')
    expect(blocking, `${label} serious/critical a11y violations:\n${summary}`).toEqual([])
  }
}
