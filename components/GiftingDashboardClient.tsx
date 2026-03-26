'use client';
// client wrapper - ssr disabled

import dynamic from 'next/dynamic';

const GiftingDashboard = dynamic(() => import('@/components/GiftingDashboard'), { ssr: false });

export default function GiftingDashboardClient(props: {
  householdId: string;
  userRole: 'consumer' | 'advisor';
  consumerTier?: number;
}) {
  return <GiftingDashboard {...props} />;
}
