export default function ExpiredInvitePage() {
  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: '480px',
        margin: '80px auto',
        textAlign: 'center',
        padding: '0 20px',
      }}
    >
      <h1 style={{ fontSize: '24px', color: '#1a1a2e' }}>Invitation Expired</h1>
      <p style={{ color: '#6b7280', fontSize: '16px' }}>
        This invitation link has expired. Please contact your advisor to request a new invite.
      </p>
    </div>
  )
}
