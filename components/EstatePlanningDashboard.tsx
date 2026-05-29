'use client';

import { useEffect, useState } from 'react';
import { ExportPDFButton } from '@/components/pdf/ExportPDFButton';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { PlanningTopicsList } from '@/app/(dashboard)/_components/dashboard/PlanningTopicsList';
import type {
  EstatePlanningCompleteness,
  EstatePlanningRecommendations,
} from '@/lib/estate/loadEstatePlanningDashboard';
import type { ReactNode } from 'react';

interface EstatePlanningDashboardProps {
  householdId: string;
  userRole: 'consumer' | 'advisor';
  consumerTier?: number;
  /** When false, hides the advisor "Estate Tax Exposure" card (e.g. on pages that show tax elsewhere). Default false. */
  showTaxExposure?: boolean;
  showHeader?: boolean;
  showCompleteness?: boolean;
  showGaps?: boolean;
  embedded?: boolean;
  afterHeaderContent?: ReactNode;
  /** Server-prefetched — skips mount RPC when provided */
  initialRecommendations?: EstatePlanningRecommendations | null;
  initialCompleteness?: EstatePlanningCompleteness | null;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const complexityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export default function EstatePlanningDashboard({
  householdId,
  userRole,
  consumerTier = 1,
  showTaxExposure = false,
  showHeader = true,
  showCompleteness = true,
  showGaps = true,
  embedded = false,
  afterHeaderContent,
  initialRecommendations,
  initialCompleteness,
}: EstatePlanningDashboardProps) {
  const hasInitial =
    initialRecommendations !== undefined && initialCompleteness !== undefined
  const [recommendations, setRecommendations] = useState<EstatePlanningRecommendations | null>(
    hasInitial ? initialRecommendations : null,
  );
  const [completeness, setCompleteness] = useState<EstatePlanningCompleteness | null>(
    hasInitial ? initialCompleteness : null,
  );
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState<string | null>(null);
  const isAdvisor = userRole === 'advisor';
  const isConsumerT3 = userRole === 'consumer' && consumerTier >= 3;

  useEffect(() => {
    if (initialRecommendations !== undefined) {
      setRecommendations(initialRecommendations)
      setCompleteness(initialCompleteness ?? null)
      setLoading(false)
      return
    }
    async function loadDashboard() {
      try {
        setLoading(true);
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient();
        const { loadEstatePlanningDashboard } = await import(
          '@/lib/estate/loadEstatePlanningDashboard'
        )
        const result = await loadEstatePlanningDashboard(supabase, householdId)
        if (result.error) throw new Error(result.error)
        setRecommendations(result.recommendations);
        setCompleteness(result.completeness);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load estate planning data.');
      } finally {
        setLoading(false);
      }
    }
    void loadDashboard();
  }, [householdId, initialRecommendations, initialCompleteness]);

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="ml-3 text-gray-500">Loading estate plan...</span>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
  );

  if (!recommendations || !completeness) return null;

  const scoreColor =
    completeness.completeness_pct >= 80 ? 'text-green-600' :
    completeness.completeness_pct >= 60 ? 'text-yellow-600' :
    completeness.completeness_pct >= 40 ? 'text-orange-600' : 'text-red-600';

  const content = (
    <>

      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Estate Value and Tax Horizons</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              Score {recommendations.complexity_score}/20
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${complexityColors[recommendations.complexity_flag]}`}>
              {recommendations.complexity_flag.charAt(0).toUpperCase() + recommendations.complexity_flag.slice(1)} Complexity
            </span>
            {userRole === 'advisor' && (
              <ExportPDFButton householdId={householdId} role={userRole} />
            )}
          </div>
        </div>
      )}

      {afterHeaderContent}

      {showCompleteness && (
        <CollapsibleSection
          title="Estate Plan Completeness"
          subtitle={`Grade ${completeness.grade} · ${completeness.completeness_pct}% complete`}
          defaultOpen={false}
          storageKey="estate-planning-completeness"
        >
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="currentColor" strokeWidth="3"
                  strokeDasharray={`${completeness.completeness_pct}, 100`}
                  className={scoreColor} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-xl font-bold ${scoreColor}`}>{completeness.completeness_pct}%</span>
                <span className="text-xs text-gray-400">Grade {completeness.grade}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {[
                { label: 'Will or Trust', points: completeness.breakdown.will_or_trust_points, max: 25, done: completeness.breakdown.has_will_or_trust },
                { label: 'Power of Attorney', points: completeness.breakdown.dpoa_points, max: 20, done: completeness.breakdown.has_dpoa },
                { label: 'Healthcare Directive', points: completeness.breakdown.healthcare_points, max: 15, done: completeness.breakdown.has_healthcare_directive },
                { label: 'Beneficiary Designations', points: completeness.breakdown.beneficiary_points, max: 10, done: completeness.breakdown.has_beneficiaries },
                { label: 'Tax Strategy', points: completeness.breakdown.tax_strategy_points, max: 30, done: completeness.breakdown.has_tax_strategy },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`w-4 h-4 rounded-full flex-shrink-0 ${item.done ? 'bg-green-500' : 'bg-gray-200'}`} />
                  <span className="text-sm text-gray-700 flex-1">{item.label}</span>
                  <span className="text-xs text-gray-400">{item.points}/{item.max} pts</span>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Tax Exposure — Advisor only */}
      {isAdvisor && showTaxExposure && (
        <CollapsibleSection
          title="Estate Tax Exposure"
          subtitle={recommendations.total_tax_exposure > 0 ? `Total exposure ${formatCurrency(recommendations.total_tax_exposure)}` : undefined}
          defaultOpen={false}
          storageKey="estate-planning-estate-tax-exposure"
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Gross Estate</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(recommendations.gross_estate)}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Federal Tax</p>
              <p className={`text-xl font-bold ${recommendations.federal_estate_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {recommendations.federal_estate_tax > 0 ? formatCurrency(recommendations.federal_estate_tax) : 'None'}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">State Tax</p>
              <p className={`text-xl font-bold ${recommendations.state_estate_tax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {recommendations.state_estate_tax > 0 ? formatCurrency(recommendations.state_estate_tax) : 'None'}
              </p>
            </div>
          </div>
          {recommendations.total_tax_exposure > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <span className="text-sm text-red-700 font-medium">
                Total estimated tax exposure: {formatCurrency(recommendations.total_tax_exposure)}
              </span>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Consumer T3 notice — no numbers */}
      {isConsumerT3 && !isAdvisor && showTaxExposure && recommendations.total_tax_exposure > 0 && (
        <CollapsibleSection
          title="Potential estate tax exposure detected"
          defaultOpen={false}
          storageKey="estate-planning-consumer-tax-notice"
        >
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 -m-2">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-orange-900">Potential estate tax exposure detected</p>
              <p className="text-sm text-orange-700 mt-1">Based on your estate size, state or federal estate tax may be a topic many families discuss with counsel. A financial advisor can help illustrate exposure and common planning approaches.</p>
              <button className="mt-3 px-4 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors">
                Connect with an Advisor
              </button>
            </div>
          </div>
        </div>
        </CollapsibleSection>
      )}

      {/* Recommendations */}
      {showGaps && (isAdvisor || isConsumerT3) && recommendations.recommendations.length > 0 && (
        <CollapsibleSection
          title="Common planning topics"
          subtitle={`${recommendations.recommendations.length} topics`}
          defaultOpen={false}
          storageKey="estate-planning-gaps"
        >
          <PlanningTopicsList
            topics={recommendations.recommendations}
            cardClassName="p-4 bg-gray-50 rounded-lg border-l-4"
          />
        </CollapsibleSection>
      )}
    </>
  )

  if (embedded) {
    return <div className="space-y-6">{content}</div>
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {content}
    </div>
  );
}
