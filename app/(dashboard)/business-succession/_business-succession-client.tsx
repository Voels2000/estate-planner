'use client';

import dynamic from 'next/dynamic';

const BusinessSuccessionDashboard = dynamic(
  () => import('@/components/BusinessSuccessionDashboard'),
  { ssr: false }
);

interface Props {
  householdId: string;
  userRole: 'consumer' | 'advisor';
}

export default function BusinessSuccessionClient({ householdId, userRole }: Props) {
  return (
    <BusinessSuccessionDashboard
      householdId={householdId}
      userRole={userRole}
    />
  );
}
