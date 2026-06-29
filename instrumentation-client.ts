// Client-side Sentry — error monitoring only (no tracing/replay/logs).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://4862e4dbf8ad5a4e90951577495a1091@o4511580481126400.ingest.us.sentry.io/4511580500459520',
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend(event, hint) {
    // Resource load failures (blocked fonts/CSS, extensions) reject with DOM Event, not Error.
    const ex = hint.originalException
    if (ex instanceof Event && ex.type === 'error') return null
    return event
  },
})
