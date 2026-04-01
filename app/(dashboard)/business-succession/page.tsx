import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BusinessSuccessionClient from './_business-succession-client';

export default async function BusinessSuccessionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  // Advisor-only for v1
  if (profile.role !== 'advisor' && Number(profile.consumer_tier) < 3) {
    redirect('/billing?returnTo=/business-succession');
  }

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!household) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <BusinessSuccessionClient
        householdId={household.id}
        userRole={profile.role}
      />
    </div>
  );
}
