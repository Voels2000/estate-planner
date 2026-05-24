declare module 'papaparse' {
  export interface ParseError {
    message: string
  }

  export interface ParseMeta {
    fields?: string[]
  }

  export interface ParseResult<T> {
    data: T[]
    errors: ParseError[]
    meta: ParseMeta
  }

  export interface ParseConfig {
    header?: boolean
    skipEmptyLines?: boolean | 'greedy'
  }

  function parse<T>(input: string, config?: ParseConfig): ParseResult<T>

  export default { parse }
}
