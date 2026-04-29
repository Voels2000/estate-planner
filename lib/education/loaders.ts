import { promises as fs } from 'node:fs'
import path from 'node:path'

export type EducationComplexity = 'foundation' | 'intermediate' | 'advanced'
export type EducationPillar = 'financial' | 'retirement' | 'estate'

export type EducationModuleMeta = {
  slug: string
  title: string
  pillar: EducationPillar
  complexity: EducationComplexity
  estimatedTime: string
  order: number
  summary: string
  tags: string[]
}

export type EducationModule = EducationModuleMeta & {
  body: string
}

const MODULES_DIR = path.join(process.cwd(), 'content', 'education', 'modules')

function parseFrontmatter(raw: string): {
  frontmatter: Record<string, string>
  body: string
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: raw }
  }

  const frontmatterBlock = match[1]
  const body = match[2]
  const frontmatter: Record<string, string> = {}

  for (const line of frontmatterBlock.split('\n')) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1')
    frontmatter[key] = value
  }

  return { frontmatter, body }
}

function toModuleMeta(slug: string, frontmatter: Record<string, string>): EducationModuleMeta {
  const tags = (frontmatter.tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  return {
    slug,
    title: frontmatter.title ?? slug,
    pillar: (frontmatter.pillar as EducationPillar) ?? 'financial',
    complexity: (frontmatter.complexity as EducationComplexity) ?? 'foundation',
    estimatedTime: frontmatter.estimatedTime ?? '15 min',
    order: Number(frontmatter.order ?? 999),
    summary: frontmatter.summary ?? '',
    tags,
  }
}

export async function listEducationModules(): Promise<EducationModuleMeta[]> {
  const entries = await fs.readdir(MODULES_DIR, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  const modules = await Promise.all(
    files.map(async (file) => {
      const slug = file.name.replace(/\.md$/, '')
      const fullPath = path.join(MODULES_DIR, file.name)
      const raw = await fs.readFile(fullPath, 'utf8')
      const { frontmatter } = parseFrontmatter(raw)
      return toModuleMeta(slug, frontmatter)
    }),
  )
  return modules.sort((a, b) => a.order - b.order)
}

export async function getEducationModule(slug: string): Promise<EducationModule | null> {
  const fullPath = path.join(MODULES_DIR, `${slug}.md`)
  try {
    const raw = await fs.readFile(fullPath, 'utf8')
    const { frontmatter, body } = parseFrontmatter(raw)
    return {
      ...toModuleMeta(slug, frontmatter),
      body,
    }
  } catch {
    return null
  }
}

