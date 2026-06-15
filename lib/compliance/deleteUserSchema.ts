/** Classify PostgREST delete/select errors for WCPA deletion path. */

export type SchemaDeleteSkip = {
  table: string
  column: string
  kind: 'missing_table' | 'missing_column'
  detail: string
}

export function classifySchemaDeleteError(
  table: string,
  column: string,
  message: string,
): SchemaDeleteSkip | 'fatal' {
  if (message.includes('Could not find the table')) {
    return { table, column, kind: 'missing_table', detail: message }
  }
  if (/column .+ does not exist/i.test(message)) {
    return { table, column, kind: 'missing_column', detail: message }
  }
  return 'fatal'
}

export function formatSchemaDeleteSkips(skips: SchemaDeleteSkip[]): string {
  return skips
    .map((s) => `${s.table}.${s.column} (${s.kind})`)
    .join('; ')
}
