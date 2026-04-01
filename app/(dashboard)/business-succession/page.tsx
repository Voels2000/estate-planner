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

  if (!household) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="text-2xl mb-3">🏢</p>
          <h2 className="text-lg font-semibold text-amber-900 mb-2">Your household profile isn't set up yet</h2>
          <p className="text-sm text-amber-700">Your advisor needs to complete your household setup before you can view your business succession plan. Please reach out to your advisor to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <BusinessSuccessionClient
        householdId={household.id}
        userRole={profile.role}
      />
    </div>
  );
}
