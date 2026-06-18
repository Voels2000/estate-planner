import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  applyEmailUnsubscribe,
  parseEmailUnsubscribeType,
} from '@/lib/email/applyEmailUnsubscribe'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribeToken'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mywealthmaps.com'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  const token = req.nextUrl.searchParams.get('token')
  const typeParam = req.nextUrl.searchParams.get('type')

  if (!email) {
    return new NextResponse('Invalid unsubscribe link', { status: 400 })
  }

  const parsedType = parseEmailUnsubscribeType(typeParam)
  if (parsedType === 'invalid') {
    return new NextResponse('Invalid unsubscribe link', { status: 400 })
  }

  const verifyType =
    parsedType === 'capture' ? null : parsedType

  if (!verifyUnsubscribeToken(email, token, verifyType)) {
    return new NextResponse('Invalid or expired unsubscribe link', { status: 403 })
  }

  const admin = createAdminClient()
  const result = await applyEmailUnsubscribe(admin, parsedType, email)

  if (!result.ok) {
    console.error('email unsubscribe write failed:', result.error)
    return new NextResponse('Unable to process unsubscribe request', { status: 500 })
  }

  return new NextResponse(
    `<!DOCTYPE html>
    <html>
    <head><title>Unsubscribed</title></head>
    <body style="font-family:system-ui;text-align:center;padding:60px 20px;background:#fafaf8;">
      <div style="max-width:400px;margin:0 auto;">
        <div style="font-size:32px;margin-bottom:16px;">✓</div>
        <h1 style="font-family:Georgia,serif;color:#0f1f3d;margin-bottom:8px;">You're unsubscribed</h1>
        <p style="color:#718096;font-size:14px;">
          You won't receive any more emails from My Wealth Maps.<br>
          You can still use the platform at any time.
        </p>
        <a href="${BASE_URL}"
          style="display:inline-block;margin-top:24px;background:#0f1f3d;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;">
          Go to My Wealth Maps
        </a>
      </div>
    </body>
    </html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  )
}
