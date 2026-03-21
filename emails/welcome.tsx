import * as React from 'react'

interface WelcomeEmailProps {
  firstName: string
}

export function WelcomeEmail({ firstName }: WelcomeEmailProps) {
  const containerStyle = { fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '40px 20px', backgroundColor: '#ffffff' }
  const headerStyle = { textAlign: 'center' as const, marginBottom: '32px' }
  const h1Style = { color: '#1a1a2e', fontSize: '24px', margin: '0' }
  const subtitleStyle = { color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }
  const boxStyle = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '32px', marginBottom: '24px' }
  const h2Style = { color: '#1a1a2e', fontSize: '20px', marginTop: '0' }
  const textStyle = { color: '#374151', fontSize: '16px', lineHeight: '1.6' }
  const listStyle = { color: '#374151', fontSize: '16px', lineHeight: '2' }
  const btnWrapStyle = { textAlign: 'center' as const, margin: '32px 0' }
  const btnStyle = { backgroundColor: '#2563eb', color: '#ffffff', padding: '14px 32px', borderRadius: '6px', textDecoration: 'none', fontSize: '16px', fontWeight: 'bold' }
  const footerStyle = { color: '#9ca3af', fontSize: '12px', textAlign: 'center' as const }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={h1Style}>MyWealthMap</h1>
        <p style={subtitleStyle}>Financial, Retirement &amp; Estate Planning in One Place</p>
      </div>
      <div style={boxStyle}>
        <h2 style={h2Style}>Welcome, {firstName}!</h2>
        <p style={textStyle}>Your MyWealthMap account is ready. You now have access to a complete suite of financial planning tools including:</p>
        <ul style={listStyle}>
          <li>Retirement &amp; Monte Carlo projections</li>
          <li>Asset allocation analysis</li>
          <li>Social Security optimization</li>
          <li>Estate planning tools</li>
          <li>Insurance gap analysis</li>
        </ul>
        <div style={btnWrapStyle}>
          <a href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`} style={btnStyle}>Go to My Dashboard</a>
        </div>
      </div>
      <p style={footerStyle}>Questions? Reply to this email and we will get back to you.</p>
    </div>
  )
}
