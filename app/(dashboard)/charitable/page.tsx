import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserAccess } from '@/lib/get-user-access';
import UpgradeBanner from '@/app/(dashboard)/_components/UpgradeBanner';
import CharitableGivingDashboardClient from './_charitable-client';

export default async function CharitablePage() {
  const access = await getUserAccess();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (access.tier < 3) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Charitable Planning</h1>
        <UpgradeBanner
          requiredTier={3}
          moduleName="Charitable Planning"
          valueProposition="Model charitable giving strategies including DAFs, CRTs, and QCDs."
        />
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

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
        consumerTier={access.tier}
      />
    </div>
  );
}
