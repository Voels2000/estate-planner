'use client';

import dynamic from 'next/dynamic';

const CharitableGivingDashboard = dynamic(
  () => import('@/components/CharitableGivingDashboard'),
  { ssr: false }
);

export default CharitableGivingDashboard;
