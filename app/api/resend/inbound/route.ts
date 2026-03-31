import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// All test emails forward to this single inbox
const FORWARD_TO = 'avoels@comcast.net';

// Maps the local part of the inbound address to a readable label
// e.g. consumer1@rolobe.resend.app → [TEST: Consumer T1]
const PERSONA_LABELS: Record<string, string> = {
  consumer1: '[TEST: Consumer T1]',
  consumer3: '[TEST: Consumer T3]',
  attorney: '[TEST: Attorney]',
  advisor2: '[TEST: Advisor 2]',
  admin: '[TEST: Admin]',
};

export const POST = async (request: NextRequest) => {
  try {
    const event = await request.json();

    if (event.type === 'email.received') {
      const emailId: string = event.data.email_id;
      const toAddress: string = event.data.to?.[0] ?? '';

      // Extract persona from local part e.g. "consumer1" from "consumer1@rolobe.resend.app"
      const persona = toAddress.split('@')[0]?.toLowerCase() ?? 'unknown';
      const label = PERSONA_LABELS[persona] ?? `[TEST: ${persona}]`;

      console.log(`[Resend Inbound] Email received for persona: ${label} (${toAddress})`);

      const { data, error } = await resend.emails.receiving.forward({
        emailId,
        to: FORWARD_TO,
        from: 'hello@mywealthmaps.com',
      });

      if (error) {
        console.error('[Resend Inbound] Forward error:', error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
      }

      console.log(`[Resend Inbound] Forwarded successfully to ${FORWARD_TO}`);
      return NextResponse.json({ forwarded: true, persona: label, data });
    }

    // Not an email.received event — acknowledge and ignore
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[Resend Inbound] Unexpected error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
};
