/**
 * Raw personal data export policy (CCPA/CPRA + WA WCPA).
 * Self-serve endpoint is a separate PR — portability stays on /api/consumer/privacy-request.
 */
export function canExportRawData(): boolean {
  return true
}
