'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface UpgradeBannerProps {
  requiredTier: 2 | 3;
  moduleName: string;
  valueProposition: string;
}

export default function UpgradeBanner({
  requiredTier,
  moduleName,
  valueProposition,
}: UpgradeBannerProps) {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4">
      <span className="mt-0.5 text-xl" aria-hidden="true">🔒</span>
      <div className="flex-1">
        <p className="font-semibold text-amber-900">
          {moduleName} requires a Tier {requiredTier} plan
        </p>
        <p className="mt-0.5 text-sm text-amber-800">{valueProposition}</p>
      </div>
      <Link
        href={`/billing?returnTo=${pathname}`}
        className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        Upgrade to unlock
      </Link>
    </div>
  );
}
