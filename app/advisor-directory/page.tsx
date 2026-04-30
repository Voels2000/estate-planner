import { createClient } from '@/lib/supabase/server'
import { AdvisorDirectoryClient } from '@/app/(dashboard)/my-advisor-directory/_advisor-directory-client'

export default async function PublicAdvisorDirectoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: connectionRows } = user
    ? await supabase
        .from('connection_requests')
        .select('listing_id')
        .eq('consumer_id', user.id)
        .eq('listing_type', 'advisor')
        .eq('status', 'pending')
    : { data: null }

  const existingConnections = (connectionRows ?? []).map(r => r.listing_id)

  const { data: advisors } = await supabase
    .from('advisor_directory')
    .select('*, profile_id')
    .eq('is_active', true)
    .order('is_verified', { ascending: false })
    .order('firm_name')

  const allSpecializations = Array.from(
    new Set((advisors ?? []).flatMap((a: any) => a.specializations ?? []))
  ).sort()

  const allCredentials = Array.from(
    new Set((advisors ?? []).flatMap((a: any) => a.credentials ?? []))
  ).sort()

  const allStates = Array.from(
    new Set((advisors ?? []).map((a: any) => a.state).filter(Boolean))
  ).sort()

  return (
    <div>
      <nav style={{
        background: '#0f1f3d',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: '#c9a84c',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Playfair Display, Georgia, serif',
            fontWeight: 600, fontSize: 16,
            color: '#0f1f3d',
          }}>M</div>
          <div>
            <div style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 17, fontWeight: 500,
              color: 'white', lineHeight: 1.2,
            }}>My Wealth Maps</div>
            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.5px', textTransform: 'uppercase',
            }}>Find an Advisor</div>
          </div>
        </div>
        <a href="/" style={{
          color: 'rgba(255,255,255,0.6)', fontSize: 12,
          textDecoration: 'none',
          border: '1.5px solid rgba(255,255,255,0.2)',
          padding: '6px 14px', borderRadius: 6,
        }}>← Back to Home</a>
      </nav>

      <div style={{
        background: '#1a3460',
        borderLeft: '4px solid #c9a84c',
        padding: '11px 32px',
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
        lineHeight: 1.5,
      }}>
        <span style={{ color: '#c9a84c', fontWeight: 500 }}>
          ucational platform only.
        </span>
        {' '}Connecting with an advisor does not constitute financial advice.
        Always verify credentials independently.
      </div>

      <AdvisorDirectoryClient
        advisors={advisors ?? []}
        allSpecializations={allSpecializations}
        allCredentials={allCredentials}
        allStates={allStates}
        existingConnections={existingConnections}
      />
    </div>
  )
}
