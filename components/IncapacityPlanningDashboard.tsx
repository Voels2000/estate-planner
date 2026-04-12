'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ExportPDFButton } from '@/components/pdf/ExportPDFButton';
import { CollapsibleSection } from '@/components/CollapsibleSection';

interface ChecklistItem {
  doc_type: string;
  label: string;
  complete: boolean;
}

interface GapItem {
  doc_type: string;
  label: string;
  priority: 'high' | 'moderate' | 'low';
  reason: string;
}

interface IncapacityResult {
  success: boolean;
  household_id: string;
  has_dpoa: boolean;
  has_medical_poa: boolean;
  has_advance_directive: boolean;
  has_living_will: boolean;
  has_trusts: boolean;
  has_successor_trustee: boolean;
  has_minor_beneficiaries: boolean;
  has_guardian_designation: boolean;
  incapacity_gaps: GapItem[];
  checklist: ChecklistItem[];
  priority_score: number;
}

interface IncapacityPlanningDashboardProps {
  householdId: string;
  userRole: 'consumer' | 'advisor';
  consumerTier?: number;
}

interface DocumentConfirmation {
  doc_type: string;
  status: string;
  last_reviewed: string | null;
}

const priorityColors: Record<string, string> = {
  high: 'border-l-red-500',
  moderate: 'border-l-yellow-500',
  low: 'border-l-green-500',
};

const priorityLabelColors: Record<string, string> = {
  high: 'text-red-600',
  moderate: 'text-yellow-600',
  low: 'text-green-600',
};

export default function IncapacityPlanningDashboard({
  householdId,
  userRole,
  consumerTier = 1,
}: IncapacityPlanningDashboardProps) {
  const supabase = createClient();
  const [data, setData] = useState<IncapacityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, DocumentConfirmation>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isAdvisor = userRole === 'advisor';
  const isConsumerT3 = userRole === 'consumer' && consumerTier >= 3;
  const canView = isAdvisor || isConsumerT3;

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data: result, error: err } = await supabase.rpc(
          'generate_incapacity_recommendations',
          { p_household_id: householdId }
        );
        if (err) throw err;
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load incapacity planning data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [householdId]);

  useEffect(() => {
    async function loadConfirmations() {
      const { data: docs } = await supabase
        .from('estate_documents')
        .select('doc_type, status, last_reviewed')
        .eq('household_id', householdId)
        .in('doc_type', ['dpoa', 'medical_poa', 'advance_directive', 'living_will']);
      if (docs) {
        const map: Record<string, DocumentConfirmation> = {};
        docs.forEach(d => {
          map[d.doc_type] = d;
        });
        setConfirmations(map);
      }
    }
    loadConfirmations();
  }, [householdId]);

  async function handleToggleConfirmation(doc_type: string, confirmed: boolean) {
    setSaving(doc_type);
    setSaveError(null);
    try {
      if (confirmed) {
        const { error } = await supabase
          .from('estate_documents')
          .upsert(
            {
              household_id: householdId,
              doc_type,
              status: 'confirmed',
              last_reviewed: new Date().toISOString().split('T')[0],
            },
            { onConflict: 'household_id,doc_type' }
          );
        if (error) throw error;
        setConfirmations(prev => ({
          ...prev,
          [doc_type]: { doc_type, status: 'confirmed', last_reviewed: new Date().toISOString().split('T')[0] },
        }));
      } else {
        const { error } = await supabase
          .from('estate_documents')
          .delete()
          .eq('household_id', householdId)
          .eq('doc_type', doc_type);
        if (error) throw error;
        setConfirmations(prev => {
          const next = { ...prev };
          delete next[doc_type];
          return next;
        });
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save.');
    } finally {
      setSaving(null);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="ml-3 text-gray-500">Loading incapacity plan...</span>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
  );

  if (!data || !canView) return null;

  const guardianRequired = data.has_minor_beneficiaries
  const guardianComplete = data.has_guardian_designation
  const completedCount = data.checklist.filter(i => i.complete).length + (guardianRequired && guardianComplete ? 1 : 0)
  const totalCount = data.checklist.length + (guardianRequired ? 1 : 0)

  const highGaps = data.incapacity_gaps.filter(g => g.priority === 'high');
  const moderateGaps = data.incapacity_gaps.filter(g => g.priority === 'moderate');

  const hasGaps = data.incapacity_gaps.length > 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Incapacity Planning</h2>
          <p className="text-sm text-gray-500 mt-1">
            Documents and structures that protect you if you become unable to manage your own affairs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasGaps && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
              {data.incapacity_gaps.length} gap{data.incapacity_gaps.length !== 1 ? 's' : ''} found
            </span>
          )}
          {!hasGaps && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              Complete
            </span>
          )}
          {userRole === 'advisor' && (
            <ExportPDFButton householdId={householdId} role={userRole} />
          )}
        </div>
      </div>

      <CollapsibleSection
        title="Incapacity Documents"
        subtitle={`${completedCount} of ${totalCount} complete`}
        defaultOpen={true}
        storageKey="incapacity-documents"
      >
        <div className="space-y-3">
          {data.checklist.map(item => (
            <div key={item.doc_type} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                item.complete ? 'bg-green-500' : 'bg-gray-200'
              }`}>
                {item.complete && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={`text-sm flex-1 ${item.complete ? 'text-gray-700' : 'text-gray-500'}`}>
                {item.label}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                item.complete
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {item.complete ? 'On file' : 'Missing'}
              </span>
            </div>
          ))}
        </div>

        {/* Trustee succession — advisor only */}
        {isAdvisor && data.has_trusts && (
          <div className={`mt-4 flex items-center gap-3 py-2 border-t border-gray-100`}>
            <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
              data.has_successor_trustee ? 'bg-green-500' : 'bg-gray-200'
            }`}>
              {data.has_successor_trustee && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className={`text-sm flex-1 ${data.has_successor_trustee ? 'text-gray-700' : 'text-gray-500'}`}>
              Successor Trustee Named
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              data.has_successor_trustee
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {data.has_successor_trustee ? 'Named' : 'Missing'}
            </span>
          </div>
        )}

        {/* Guardian designation */}
        {data.has_minor_beneficiaries && (
          <div className={`mt-2 flex items-center gap-3 py-2 border-t border-gray-100`}>
            <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
              data.has_guardian_designation ? 'bg-green-500' : 'bg-gray-200'
            }`}>
              {data.has_guardian_designation && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className={`text-sm flex-1 ${data.has_guardian_designation ? 'text-gray-700' : 'text-gray-500'}`}>
              Guardian Designation (minor beneficiaries detected)
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              data.has_guardian_designation
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {data.has_guardian_designation ? 'Named' : 'Missing'}
            </span>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Document Confirmation"
        subtitle="Confirm which incapacity planning documents you have in place. This updates your gap analysis."
        defaultOpen={false}
        storageKey="incapacity-document-confirmation"
      >
        {saveError && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
        )}
        <div className="space-y-3">
          {[
            { doc_type: 'dpoa', label: 'Durable Power of Attorney (DPOA)' },
            { doc_type: 'medical_poa', label: 'Medical Power of Attorney' },
            { doc_type: 'advance_directive', label: 'Advance Directive' },
            { doc_type: 'living_will', label: 'Living Will' },
          ].map(({ doc_type, label }) => {
            const confirmed = confirmations[doc_type]?.status === 'confirmed';
            const isSaving = saving === doc_type;
            const reviewedDate = confirmations[doc_type]?.last_reviewed;
            return (
              <div
                key={doc_type}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                  confirmed ? 'border-green-200 bg-green-50' : 'border-neutral-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`confirm-${doc_type}`}
                    checked={confirmed}
                    disabled={isSaving}
                    onChange={e => void handleToggleConfirmation(doc_type, e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <label
                      htmlFor={`confirm-${doc_type}`}
                      className={`text-sm font-medium cursor-pointer ${confirmed ? 'text-green-800' : 'text-neutral-700'}`}
                    >
                      {label}
                    </label>
                    {reviewedDate && (
                      <p className="text-xs text-neutral-400 mt-0.5">Confirmed {reviewedDate}</p>
                    )}
                  </div>
                </div>
                {isSaving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neutral-400" />
                )}
                {confirmed && !isSaving && (
                  <span className="text-xs font-medium text-green-600">✓ On file</span>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {isAdvisor && hasGaps && (
        <CollapsibleSection
          title="Gap Analysis"
          subtitle={`${data.incapacity_gaps.length} item${data.incapacity_gaps.length !== 1 ? 's' : ''}`}
          defaultOpen={false}
          storageKey="incapacity-gap-analysis"
        >
          {highGaps.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">High Priority</p>
              <div className="space-y-2">
                {highGaps.map(gap => (
                  <div key={gap.doc_type} className={`p-4 bg-gray-50 rounded-lg border-l-4 ${priorityColors[gap.priority]}`}>
                    <p className="text-sm font-semibold text-gray-900">{gap.label}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{gap.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {moderateGaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide mb-2">Moderate Priority</p>
              <div className="space-y-2">
                {moderateGaps.map(gap => (
                  <div key={gap.doc_type} className={`p-4 bg-gray-50 rounded-lg border-l-4 ${priorityColors[gap.priority]}`}>
                    <p className="text-sm font-semibold text-gray-900">{gap.label}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{gap.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Priority score — advisor only */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Incapacity Risk Score</p>
              <p className="text-xs text-gray-400 mt-0.5">Higher score = more urgent gaps</p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${
                data.priority_score >= 75 ? 'text-red-600' :
                data.priority_score >= 40 ? 'text-orange-600' :
                data.priority_score >= 20 ? 'text-yellow-600' : 'text-green-600'
              }`}>{data.priority_score}</span>
              <span className="text-sm text-gray-400 ml-1">/ 130</span>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {isConsumerT3 && !isAdvisor && hasGaps && (
        <CollapsibleSection
          title="Your incapacity plan has gaps"
          defaultOpen={false}
          storageKey="incapacity-consumer-gaps-cta"
        >
          <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 -m-2">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-blue-900">Your incapacity plan has gaps</p>
            <p className="text-sm text-blue-700 mt-1">
              You are missing {data.incapacity_gaps.length} key document{data.incapacity_gaps.length !== 1 ? 's' : ''} that protect you and your family if you become unable to manage your own affairs.
              An estate planning attorney can help you address these gaps.
            </p>
            <button className="mt-3 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              Connect with an Attorney
            </button>
          </div>
        </div>
        </CollapsibleSection>
      )}

      {!hasGaps && (
        <CollapsibleSection
          title="Incapacity plan looks complete"
          defaultOpen={false}
          storageKey="incapacity-plan-complete"
        >
          <div className="p-5 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 -m-2">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-900">Incapacity plan looks complete</p>
            <p className="text-sm text-green-700 mt-1">
              All key incapacity documents are on file. Review annually or after major life events.
            </p>
          </div>
        </div>
        </CollapsibleSection>
      )}

    </div>
  );
}
