'use client';

import dynamic from 'next/dynamic';

const BusinessSuccessionDashboard = dynamic(
  () => import('@/components/BusinessSuccessionDashboard'),
  { ssr: false }
);

export default function BusinessSuccessionClient({
  householdId,
  userRole,
}: {
  householdId: string;
  userRole: 'consumer' | 'advisor';
}) {
  return (
    <BusinessSuccessionDashboard
      householdId={householdId}
      userRole={userRole}
    />
  );
}
