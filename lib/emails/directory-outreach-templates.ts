/**
 * First-wave directory outreach copy (claim link = magic link to /claim/[token]).
 * Merge fields: {{firm_name}}, {{first_name}}, {{claim_link}}, {{sender_name}}
 */

import { COMPANY_ADDRESS, COMPANY_LEGAL_NAME } from '@/lib/legal/company'

export type DirectoryOutreachRole = 'attorney' | 'advisor'

export type DirectoryOutreachEmail = {
  subject: string
  bodyText: string
  bodyHtml: string
}

function directoryOutreachFooterText(): string {
  return [
    `${COMPANY_LEGAL_NAME} · ${COMPANY_ADDRESS}`,
    'Reply "unsubscribe" if you\'d prefer we don\'t follow up.',
  ].join('\n')
}

function directoryOutreachFooterHtml(): string {
  return `<p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">${COMPANY_LEGAL_NAME} · ${COMPANY_ADDRESS}<br>Reply &quot;unsubscribe&quot; if you&apos;d prefer we don&apos;t follow up.</p>`
}

function paragraphsToHtml(paragraphs: string[], cta: { label: string; href: string }): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.7">${p}</p>`)
    .join('')
  const button = `<p style="margin:24px 0;text-align:center"><a href="${cta.href}" style="display:inline-block;background:#0f1f3d;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">${cta.label}</a></p>`
  return `${body}${button}`
}

export function buildAttorneyDirectoryOutreachEmail(fields: {
  firmName: string
  firstName: string
  claimLink: string
  senderName: string
}): DirectoryOutreachEmail {
  const subject = `${fields.firmName} is listed on My Wealth Maps — claim it in 5 minutes`
  const paragraphs = [
    `Hi ${fields.firstName},`,
    `We've listed ${fields.firmName} on My Wealth Maps, a Washington estate-planning platform designed to connect attorneys with households working through their estate plans — trust funding, WA estate tax exposure, beneficiary coordination.`,
    `Once a client connects, you'll see modeled estate tax exposure, plan completeness, and document gaps in their matter workspace — as they share their household data.`,
    `Claiming your listing takes about five minutes and your first connected client is free, so you can see the platform before deciding if it's worth paying for. After that, it's pay-per-connection — no seats, no annual contract, no minimum. You pay only for clients actually connected to your firm.`,
    `This link logs you in automatically — no password to set up.`,
    `We built your listing from public directory information. If ${fields.firmName} isn't the right contact, just reply and let us know who is.`,
    `${fields.senderName}<br>My Wealth Maps`,
  ]
  const footer = directoryOutreachFooterText()
  return {
    subject,
    bodyText: [
      paragraphs[0],
      '',
      paragraphs[1],
      '',
      paragraphs[2],
      '',
      paragraphs[3],
      '',
      `Claim your listing: ${fields.claimLink}`,
      '',
      paragraphs[4],
      '',
      paragraphs[5],
      '',
      fields.senderName,
      'My Wealth Maps',
      '',
      footer,
    ].join('\n'),
    bodyHtml:
      paragraphsToHtml(paragraphs.slice(0, 6), {
        label: 'Claim your listing',
        href: fields.claimLink,
      }) +
      `<p style="margin:0;color:#9ca3af;font-size:12px">${paragraphs[6]}</p>` +
      directoryOutreachFooterHtml(),
  }
}

export function buildAdvisorDirectoryOutreachEmail(fields: {
  firmName: string
  firstName: string
  claimLink: string
  senderName: string
}): DirectoryOutreachEmail {
  const subject = `${fields.firmName} is listed on My Wealth Maps — claim it in 5 minutes`
  const paragraphs = [
    `Hi ${fields.firstName},`,
    `We've listed ${fields.firmName} on My Wealth Maps. It's a platform built for advisors working with high-net-worth households ($2M–$30M) on estate and retirement planning — designed so households can connect their advisor directly and share plan data with your review in mind.`,
    `Once a household connects, you get read-only access to their live data, strategy recommendations they can accept in their dashboard, and meeting-prep briefs — without re-keying their balance sheet.`,
    `Claiming takes about five minutes. Pricing is per connected household, not per seat — so your whole team can be on the platform without a per-seat bill, and cost only grows as you actually connect clients.`,
    `This link logs you in automatically — no password needed.`,
    `We built your listing from public directory information. Wrong contact at ${fields.firmName}? Just reply and point us to the right person.`,
    `${fields.senderName}<br>My Wealth Maps`,
  ]
  const footer = directoryOutreachFooterText()
  return {
    subject,
    bodyText: [
      paragraphs[0],
      '',
      paragraphs[1],
      '',
      paragraphs[2],
      '',
      paragraphs[3],
      '',
      `Claim your listing: ${fields.claimLink}`,
      '',
      paragraphs[4],
      '',
      paragraphs[5],
      '',
      fields.senderName,
      'My Wealth Maps',
      '',
      footer,
    ].join('\n'),
    bodyHtml:
      paragraphsToHtml(paragraphs.slice(0, 6), {
        label: 'Claim your listing',
        href: fields.claimLink,
      }) +
      `<p style="margin:0;color:#9ca3af;font-size:12px">${paragraphs[6]}</p>` +
      directoryOutreachFooterHtml(),
  }
}

export function buildDirectoryOutreachEmail(
  role: DirectoryOutreachRole,
  fields: {
    firmName: string
    firstName: string
    claimLink: string
    senderName: string
  },
): DirectoryOutreachEmail {
  return role === 'attorney'
    ? buildAttorneyDirectoryOutreachEmail(fields)
    : buildAdvisorDirectoryOutreachEmail(fields)
}
