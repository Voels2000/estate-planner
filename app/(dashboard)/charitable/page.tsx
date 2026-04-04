import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CharitableGivingDashboardClient from './_charitable-client';

export default async function CharitablePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  // Former consumer tier billing redirect removed — layout enforces subscription; explore with your data.

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!household) redirect('/dashboard');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <CharitableGivingDashboardClient
        householdId={household.id}
        userRole={profile.role as 'consumer' | 'advisor'}
        consumerTier={profile.consumer_tier ?? undefined}
      />
    </div>
  );
}
