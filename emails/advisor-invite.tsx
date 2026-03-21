import * as React from 'react'

interface AdvisorInviteEmailProps {
  advisorName: string
  invitedEmail: string
  acceptUrl: string
}

export function AdvisorInviteEmail({ advisorName, invitedEmail, acceptUrl }: AdvisorInviteEmailProps) {
  const containerStyle = { fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '40px 20px', backgroundColor: '#ffffff' }
  const headerStyle = { textAlign: 'center' as const, marginBottom: '32px' }
  const h1Style = { color: '#1a1a2e', fontSize: '24px', margin: '0' }
  const subtitleStyle = { color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }
  const boxStyle = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '32px', marginBottom: '24px' }
  const h2Style = { color: '#1a1a2e', fontSize: '20px', marginTop: '0' }
  const textStyle = { color: '#374151', fontSize: '16px', lineHeight: '1.6' }
  const btnWrapStyle = { textAlign: 'center' as const, margin: '32px 0' }
  const btnStyle = { backgroundColor: '#2563eb', color: '#ffffff', padding: '14px 32px', borderRadius: '6px', textDecoration: 'none', fontSize: '16px', fontWeight: 'bold' }
  const hintStyle = { color: '#6b7280', fontSize: '14px', textAlign: 'center' as const, margin: '0' }
  const footerStyle = { color: '#9ca3af', fontSize: '12px', textAlign: 'center' as const }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={h1Style}>MyWealthMap</h1>
        <p style={subtitleStyle}>Financial, Retirement &amp; Estate Planning in One Place</p>
      </div>
      <div style={boxStyle}>
        <h2 style={h2Style}>You have been invited</h2>
        <p style={textStyle}><strong>{advisorName}</strong> has invited you to join MyWealthMap — a comprehensive platform for financial, retirement, d estate planning.</p>
        <p style={textStyle}>Your advisor will be able to collaborate with you on your financial plan directly through the platform.</p>
        <div style={btnWrapStyle}>
          <a href={acceptUrl} style={btnStyle}>Accept Invitation</a>
        </div>
        <p style={hintStyle}>This invitation was sent to {invitedEmail}. It expires in 7 days.</p>
      </div>
      <p style={footerStyle}>If you did not expect this invitation, you can safely ignore this email.</p>
    </div>
  )
}
