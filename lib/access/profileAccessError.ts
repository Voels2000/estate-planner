/** Thrown when profiles read for access tier fails — never downgrade to tier 0. */
export class ProfileAccessError extends Error {
  readonly name = 'ProfileAccessError'

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
  }
}
