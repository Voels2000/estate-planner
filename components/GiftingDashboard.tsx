'use client';

import { useEffect, useState, useRef, Fragment, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { EducationalTopicsCards } from '@/app/(dashboard)/_components/dashboard/EducationalTopicsCards'
import {
  LIFETIME_EXEMPTION_REMAINING_LABEL,
  LIFETIME_GIFTS_USED_LABEL,
} from '@/lib/estate/exemptionLabels';
import {
  GiftDeleteWarningModal,
  type GiftDeleteChoice,
} from '@/components/consumer/strategy/GiftDeleteWarningModal';
import { withdrawStrategy } from '@/lib/consumer/consumerStrategyLineItems';

interface ActiveGiftingPlanInfo {
  id: string;
  amount: number;
  metadata?: Record<string, unknown> | null;
}

interface GiftingDashboardProps {
  householdId: string;
  userRole: 'consumer' | 'advisor';
  consumerTier?: number;
  initialGiftingSummary?: GiftingSummary | null;
  activeGiftingPlan?: ActiveGiftingPlanInfo | null;
  currentLoggedGiftTotal?: number;
  giftingPlanDrift?: boolean;
  onWithdrawGiftingPlan?: (id: string, reason?: string) => Promise<void>;
}

interface GiftRow {
  id: string;
  tax_year: number;
  donor_person: string;
  recipient_name: string;
  recipient_relationship: string;
  amount: number;
  gift_type: string;
  form_709_filed: boolean;
  notes: string;
  created_at: string;
}

export interface GiftingSummary {
  success: boolean;
  tax_year: number;
  filing_status: string;
  split_elected?: boolean;
  per_recipient_limit?: number;
  exemption_per_person: number;
  total_exemption: number;
  lifetime_exemption_used: number;
  lifetime_exemption_remaining: number;
  lifetime_used_pct: number;
  annual_exclusion: number;
  annual_capacity: number;
  annual_used: number;
  annual_remaining: number;
  annual_used_pct: number;
  tcja_in_effect: boolean;
  gifts: GiftRow[];
  annual_by_recipient: unknown[];
  recommendations: { type: string; priority: string; title: string; detail: string }[];
  gross_estate: number;
}

const fmt$ = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const GIFT_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Exclusion',
  lifetime: 'Lifetime Exemption',
  '529': '529 Contribution',
  medical: 'Direct Medical',
  tuition: 'Direct Tuition',
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unexpected error';

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: string };
    if (data.error) return data.error;
  } catch {
    // ignore JSON parse failure
  }
  return text || 'Request failed';
}

export default function GiftingDashboard({
  householdId,
  initialGiftingSummary,
  activeGiftingPlan = null,
  onWithdrawGiftingPlan,
}: GiftingDashboardProps) {
  const router = useRouter();
  const CURRENT_YEAR = new Date().getFullYear();
  const emptyForm = {
    tax_year: CURRENT_YEAR,
    donor_person: 'person1',
    recipient_name: '',
    recipient_relationship: '',
    amount: '',
    gift_type: 'annual',
    form_709_filed: false,
    notes: '',
  };
  const emptyPriorForm = {
    tax_year: CURRENT_YEAR - 1,
    donor_person: 'person1',
    recipient_name: '',
    amount: '',
    notes: '',
    form_709_filed: false,
  };
  const [summary, setSummary] = useState<GiftingSummary | null>(initialGiftingSummary ?? null);
  const [loading, setLoading] = useState(initialGiftingSummary == null);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPriorForm, setShowPriorForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [priorForm, setPriorForm] = useState(emptyPriorForm);
  const [saving, setSaving] = useState(false);
  const [savingPrior, setSavingPrior] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [giftDeleteModal, setGiftDeleteModal] = useState<{
    giftId: string;
    giftAmount: number;
  } | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview'); // default: overview
  const [donorNames, setDonorNames] = useState<{ person1: string; person2: string; hasSpouse: boolean }>({
    person1: 'Person 1',
    person2: 'Person 2',
    hasSpouse: false,
  });
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const giftRows = summary?.gifts ?? [];

  const splitElectedYears = useMemo(
    () =>
      new Set(
        giftRows
          .filter((g) => g.gift_type === 'annual' && g.form_709_filed === true)
          .map((g) => g.tax_year),
      ),
    [summary?.gifts],
  );

  const yearsWithAnnualGifts = useMemo(
    () =>
      new Set(
        giftRows.filter((g) => g.gift_type === 'annual').map((g) => g.tax_year),
      ),
    [summary?.gifts],
  );

  const giftsGroupedByYear = useMemo(() => {
    const map = new Map<number, GiftRow[]>();
    for (const g of giftRows) {
      const list = map.get(g.tax_year) ?? [];
      list.push(g);
      map.set(g.tax_year, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [summary?.gifts]);

  const priorTaxableGifts = useMemo(
    () =>
      (summary?.gifts ?? [])
        .filter(g => g.gift_type === 'lifetime')
        .sort(
          (a, b) =>
            b.tax_year - a.tax_year ||
            a.recipient_name.localeCompare(b.recipient_name),
        ),
    [summary?.gifts],
  );

  const [priorSectionOpen, setPriorSectionOpen] = useState(
    () => (initialGiftingSummary?.gifts ?? []).some(g => g.gift_type === 'lifetime'),
  );

  useEffect(() => {
    setPriorSectionOpen(priorTaxableGifts.length > 0);
  }, [priorTaxableGifts.length]);

  useEffect(() => {
    let isMounted = true;
    const loadDonorNames = async () => {
      const { data, error } = await supabase
        .from('households')
        .select('person1_name, person2_name, has_spouse')
        .eq('id', householdId)
        .maybeSingle();
      if (!isMounted || error || !data) return;

      const first = (name: string | null | undefined, fallback: string) => {
        const trimmed = (name ?? '').trim();
        if (!trimmed) return fallback;
        return trimmed.split(/\s+/)[0] || fallback;
      };

      setDonorNames({
        person1: first(data.person1_name, 'Person 1'),
        person2: first(data.person2_name, 'Person 2'),
        hasSpouse: !!data.has_spouse,
      });
    };
    void loadDonorNames();
    return () => {
      isMounted = false;
    };
  }, [householdId, supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('calculate_gifting_summary', {
        p_household_id: householdId,
      });
      if (rpcError) throw rpcError;
      setSummary(data);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [householdId, supabase]);

  useEffect(() => {
    if (refreshCount === 0) return;
    void load();
  }, [refreshCount, load]);

  const refreshAfterGiftWrite = () => {
    router.refresh();
    setRefreshCount((c) => c + 1);
  };

  const handleAdd = async () => {
    const recipientName = form.recipient_name.trim();
    if (!recipientName || !form.amount) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/consumer/gift-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_year: form.tax_year,
          recipient_name: recipientName,
          donor_person: form.donor_person,
          recipient_relationship: form.recipient_relationship?.trim() || undefined,
          amount: parseFloat(form.amount as string),
          gift_type: form.gift_type,
          notes: form.notes?.trim() ?? null,
          form_709_filed: form.form_709_filed,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setForm(emptyForm);
      setShowAddForm(false);
      refreshAfterGiftWrite();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddPriorGift = async () => {
    const recipientName = priorForm.recipient_name.trim();
    if (!recipientName || !priorForm.amount) return;
    setSavingPrior(true);
    setError(null);
    try {
      const res = await fetch('/api/consumer/gift-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_year: priorForm.tax_year,
          recipient_name: recipientName,
          donor_person: priorForm.donor_person,
          amount: parseFloat(priorForm.amount as string),
          gift_type: 'lifetime',
          notes: priorForm.notes?.trim() ?? null,
          form_709_filed: priorForm.form_709_filed,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setPriorForm(emptyPriorForm);
      setShowPriorForm(false);
      refreshAfterGiftWrite();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPrior(false);
    }
  };

  const deleteGiftById = async (id: string) => {
    const res = await fetch('/api/consumer/gift-history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    refreshAfterGiftWrite();
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const giftToDelete = giftRows.find((g) => g.id === id);
    const syncedPlan =
      activeGiftingPlan &&
      activeGiftingPlan.metadata?.synced_from_gift_history === true;

    if (syncedPlan && giftToDelete) {
      setGiftDeleteModal({ giftId: id, giftAmount: giftToDelete.amount });
      return;
    }

    setDeleteId(id);
    try {
      await deleteGiftById(id);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setDeleteId(null);
    }
  };

  const handleGiftDeleteChoice = async (choice: GiftDeleteChoice) => {
    if (!giftDeleteModal) return;
    if (choice === 'cancel') {
      setGiftDeleteModal(null);
      return;
    }

    const { giftId } = giftDeleteModal;
    setGiftDeleteModal(null);
    setDeleteId(giftId);
    setError(null);
    try {
      await deleteGiftById(giftId);
      if (choice === 'delete_and_withdraw' && activeGiftingPlan) {
        if (onWithdrawGiftingPlan) {
          await onWithdrawGiftingPlan(
            activeGiftingPlan.id,
            'Gift log deleted — annual gifting program withdrawn',
          );
        } else {
          await withdrawStrategy(
            activeGiftingPlan.id,
            'Gift log deleted — annual gifting program withdrawn',
          );
          router.refresh();
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="ml-3 text-gray-500">Loading gifting summary...</span>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
  );

  if (!summary) return null;

  const annualGiftRows = summary.gifts.filter(
    g => g.gift_type === 'annual' && g.tax_year === summary.tax_year,
  );
  // Session 27 fix — use RPC values as single source of truth
  // summary.split_elected and summary.per_recipient_limit come from
  // calculate_gifting_summary which correctly handles all edge cases
  const annualSplitSelected =
    summary.split_elected ??
    (summary.filing_status === 'mfj' && annualGiftRows.some(g => g.form_709_filed === true));
  const annualPerRecipientLimit =
    summary.per_recipient_limit ?? (annualSplitSelected ? 38000 : 19000);
  const uniqueAnnualRecipients = new Set(
    annualGiftRows
      .map(g => (g.recipient_name ?? '').trim().toLowerCase())
      .filter(Boolean),
  ).size;
  const recipientCountForCapacity = uniqueAnnualRecipients;
  const annualCapacityDynamic = annualPerRecipientLimit * recipientCountForCapacity;
  const recipientAnnualTotals = new Map<string, number>();
  const recipientDisplayNames = new Map<string, string>();
  const recipientGiftRows = new Map<string, GiftRow[]>();
  for (const gift of annualGiftRows) {
    const key = (gift.recipient_name ?? 'Unnamed recipient').trim().toLowerCase();
    const displayName = (gift.recipient_name ?? 'Unnamed recipient').trim() || 'Unnamed recipient';
    const amount = Number(gift.amount ?? 0);
    recipientAnnualTotals.set(key, (recipientAnnualTotals.get(key) ?? 0) + amount);
    if (!recipientDisplayNames.has(key)) recipientDisplayNames.set(key, displayName);
    const rows = recipientGiftRows.get(key) ?? [];
    rows.push(gift);
    recipientGiftRows.set(key, rows);
  }
  const annualUsedDynamic = Array.from(recipientAnnualTotals.values()).reduce(
    (sum, totalForRecipient) => sum + Math.min(Math.max(0, totalForRecipient), annualPerRecipientLimit),
    0,
  );
  const annualLoggedTotal = annualGiftRows.reduce((sum, g) => sum + Number(g.amount ?? 0), 0);
  // Lifetime exemption should only absorb per-recipient amounts above annual exclusion.
  const annualOverflowToLifetime = Math.max(0, annualLoggedTotal - annualUsedDynamic);
  const annualRemainingDynamic = Math.max(0, annualCapacityDynamic - annualUsedDynamic);
  const annualPct = annualCapacityDynamic > 0
    ? Math.min(100, (annualUsedDynamic / annualCapacityDynamic) * 100)
    : 0;
  const recipientAuditRows = Array.from(recipientAnnualTotals.entries())
    .map(([key, totalGifted]) => {
      const exclusionUsed = Math.min(Math.max(0, totalGifted), annualPerRecipientLimit);
      const overflowToLifetime = Math.max(0, totalGifted - annualPerRecipientLimit);
      return {
        key,
        recipientName: recipientDisplayNames.get(key) ?? 'Unnamed recipient',
        totalGifted,
        exclusionUsed,
        overflowToLifetime,
        entries: recipientGiftRows.get(key) ?? [],
      };
    })
    .sort((a, b) => b.totalGifted - a.totalGifted);
  const lifetimeUsedDisplay = Math.max(0, Number(summary.lifetime_exemption_used ?? 0));
  const lifetimeRemainingDisplay = Math.max(0, Number(summary.total_exemption ?? 0) - lifetimeUsedDisplay);
  const lifetimePct = summary.total_exemption > 0
    ? Math.min(100, (lifetimeUsedDisplay / summary.total_exemption) * 100)
    : 0;

  return (
    <Fragment>
      {/* Modal */}
      {showAddForm && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false); }}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>Log a Gift</h2>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ color: '#9ca3af', cursor: 'pointer', background: 'none', border: 'none', fontSize: '20px' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Tax Year</label>
                  <input
                    type="number"
                    value={form.tax_year}
                    onChange={e => setForm(f => ({ ...f, tax_year: parseInt(e.target.value) }))}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Donor</label>
                  <select
                    value={form.donor_person}
                    onChange={e => setForm(f => ({ ...f, donor_person: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}
                  >
                    <option value="person1">{donorNames.person1}</option>
                    {donorNames.hasSpouse && (
                      <option value="person2">{donorNames.person2}</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Recipient Name *</label>
                <input
                  type="text"
                  value={form.recipient_name}
                  onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
                  placeholder="e.g. John Smith"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Relationship</label>
                <input
                  type="text"
                  value={form.recipient_relationship}
                  onChange={e => setForm(f => ({ ...f, recipient_relationship: e.target.value }))}
                  placeholder="e.g. Child, Grandchild, Friend"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Amount *</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Gift Type</label>
                  <select
                    value={form.gift_type}
                    onChange={e => setForm(f => ({ ...f, gift_type: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}
                  >
                    <option value="annual">Annual Exclusion</option>
                    <option value="lifetime">Lifetime Exemption</option>
                    <option value="529">529 Contribution</option>
                    <option value="medical">Direct Medical</option>
                    <option value="tuition">Direct Tuition</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="form709"
                  checked={form.form_709_filed}
                  onChange={e => setForm(f => ({ ...f, form_709_filed: e.target.checked }))}
                />
                <label htmlFor="form709" style={{ fontSize: '14px', color: '#374151' }}>Form 709 filed</label>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #e5e7eb' }}>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: '8px 16px', fontSize: '14px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !form.recipient_name.trim() || !form.amount}
                style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 500, backgroundColor: saving || !form.recipient_name.trim() || !form.amount ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: saving || !form.recipient_name.trim() || !form.amount ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Saving...' : 'Save Gift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gifting Strategy</h1>
            <p className="text-sm text-gray-500 mt-1">{summary.tax_year} tax year</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Log a Gift
          </button>
        </div>

        <CollapsibleSection
          title="Lifetime & annual exclusion summary"
          subtitle={`${summary.tax_year} tax year`}
          defaultOpen={true}
          storageKey="gifting-exemption-overview"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {LIFETIME_GIFTS_USED_LABEL}
              </p>
              <div className="flex items-end justify-between mb-3">
                <span className="text-2xl font-bold text-gray-900">{fmt$(lifetimeUsedDisplay)}</span>
                <span className="text-sm text-gray-500">of {fmt$(summary.total_exemption)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${lifetimePct}%` }} />
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-green-600">{fmt$(lifetimeRemainingDisplay)}</span>{' '}
                {LIFETIME_EXEMPTION_REMAINING_LABEL.toLowerCase()}
                {summary.filing_status === 'mfj' ? ' (combined MFJ)' : ''}
              </p>
              {annualOverflowToLifetime > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Includes {fmt$(annualOverflowToLifetime)} above annual exclusion limits this year.
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Annual Exclusion Used ({summary.tax_year})</p>
              <div className="flex items-end justify-between mb-3">
                <span className="text-2xl font-bold text-gray-900">{fmt$(annualUsedDynamic)}</span>
                <span className="text-sm text-gray-500">of {fmt$(annualCapacityDynamic)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full bg-[var(--mwm-sage)] transition-all" style={{ width: `${annualPct}%` }} />
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-green-600">{fmt$(annualRemainingDynamic)}</span> remaining this year
                {summary.filing_status === 'mfj'
                  ? annualSplitSelected
                    ? ' (gift splitting selected)'
                    : ' (gift splitting not selected)'
                  : ''}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Total annual gifts logged: {fmt$(annualLoggedTotal)} across {uniqueAnnualRecipients} recipient{uniqueAnnualRecipients === 1 ? '' : 's'}.
              </p>
              {annualOverflowToLifetime > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  {fmt$(annualOverflowToLifetime)} exceeds per-recipient annual limits and counts toward lifetime exemption.
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Annual exclusion used is the sum across recipients, capped at {fmt$(annualPerRecipientLimit)} per recipient
                {' '}({annualSplitSelected ? 'gift-splitting selected' : 'no gift-splitting'}).
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {recipientCountForCapacity} recipient{recipientCountForCapacity === 1 ? '' : 's'} × {fmt$(annualPerRecipientLimit)}
                {' '}= {fmt$(annualCapacityDynamic)} capacity; {fmt$(annualUsedDynamic)} used.
              </p>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Prior taxable gifts (Form 709)"
          subtitle="Gifts reported on Form 709 that count toward your lifetime exemption"
          defaultOpen={priorTaxableGifts.length > 0}
          open={priorSectionOpen}
          onOpenChange={setPriorSectionOpen}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                Record lifetime exemption gifts from prior tax years (Form 709).
              </p>
              <button
                type="button"
                onClick={() => setShowPriorForm(v => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {showPriorForm ? 'Cancel' : 'Add prior gift'}
              </button>
            </div>

            {showPriorForm && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tax year *</label>
                    <input
                      type="number"
                      value={priorForm.tax_year}
                      onChange={e => setPriorForm(f => ({ ...f, tax_year: parseInt(e.target.value, 10) || f.tax_year }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  {donorNames.hasSpouse && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Gifted by *</label>
                      <select
                        value={priorForm.donor_person}
                        onChange={e => setPriorForm(f => ({ ...f, donor_person: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="person1">{donorNames.person1}</option>
                        <option value="person2">{donorNames.person2}</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Recipient name *</label>
                  <input
                    type="text"
                    value={priorForm.recipient_name}
                    onChange={e => setPriorForm(f => ({ ...f, recipient_name: e.target.value }))}
                    placeholder="e.g. Family trust, Child"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Gift type</label>
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                    Form 709 — Taxable gift
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={priorForm.amount}
                    onChange={e => {
                      const amount = e.target.value;
                      setPriorForm(f => ({
                        ...f,
                        amount,
                        ...(amount !== '' && Number(amount) > 0 ? { form_709_filed: true } : {}),
                      }));
                    }}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={priorForm.notes}
                    onChange={e => setPriorForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="prior-form709"
                      checked={priorForm.form_709_filed}
                      onChange={e => setPriorForm(f => ({ ...f, form_709_filed: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="prior-form709" className="text-sm text-gray-700">
                      Form 709 filed
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 pl-6">
                    A gift exceeding the annual exclusion requires Form 709. Uncheck only if filing is still pending — the amber indicator will remind you.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddPriorGift}
                    disabled={savingPrior || !priorForm.recipient_name.trim() || !priorForm.amount}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingPrior ? 'Saving...' : 'Save prior gift'}
                  </button>
                </div>
              </div>
            )}

            {priorTaxableGifts.length === 0 ? (
              <p className="text-sm text-gray-500">No prior lifetime gifts recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {priorTaxableGifts.map(gift => (
                  <div
                    key={gift.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 ${
                      gift.form_709_filed ? 'border-l-4 border-l-gray-300' : 'border-l-4 border-l-amber-400'
                    }`}
                  >
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold">{fmt$(gift.amount)}</span>
                      {' · '}
                      {gift.tax_year}
                      {' · '}
                      {gift.recipient_name.trim()}
                      {gift.form_709_filed ? ' · Form 709 filed ✓' : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDelete(gift.id)}
                      disabled={deleteId === gift.id}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 shrink-0"
                    >
                      {deleteId === gift.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Per-recipient annual exclusion audit"
          subtitle="Annual exclusion used and lifetime overflow by recipient"
          defaultOpen={false}
          storageKey="gifting-recipient-audit"
        >
          {recipientAuditRows.length === 0 ? (
            <p className="text-sm text-gray-500">No annual gifts logged for {summary.tax_year}.</p>
          ) : (
            <div className="space-y-3">
              {recipientAuditRows.map((row) => (
                <div key={row.key} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-center">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Recipient</p>
                      <p className="text-sm font-semibold text-gray-900">{row.recipientName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Total gifted</p>
                      <p className="text-sm font-semibold text-gray-900">{fmt$(row.totalGifted)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Annual exclusion used</p>
                      <p className="text-sm font-semibold text-green-700">{fmt$(row.exclusionUsed)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">To lifetime exemption</p>
                      <p className={`text-sm font-semibold ${row.overflowToLifetime > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
                        {fmt$(row.overflowToLifetime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Limit applied</p>
                      <p className="text-sm text-gray-700">
                        {fmt$(annualPerRecipientLimit)}
                        {annualSplitSelected ? ' (split)' : ' (non-split)'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Entries ({row.entries.length})
                    </p>
                    <div className="space-y-2">
                      {row.entries.map((gift) => (
                        <div
                          key={gift.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                        >
                          <div className="text-xs text-gray-600">
                            <span className="font-medium text-gray-800">{fmt$(gift.amount)}</span>
                            {' '}· {GIFT_TYPE_LABELS[gift.gift_type] ?? gift.gift_type}
                            {gift.form_709_filed ? ' · Form 709 filed' : ''}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(gift.id)}
                            disabled={deleteId === gift.id}
                            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            {deleteId === gift.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {(['overview', 'history'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'overview' ? 'Considerations' : 'Gift History'}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && (
          <CollapsibleSection
            title="Common planning topics"
            defaultOpen={false}
            storageKey="gifting-considerations"
          >
            <EducationalTopicsCards
              topics={summary.recommendations.map((rec, i) => ({
                key: `${rec.type}-${i}`,
                title: rec.title,
                detail: rec.detail,
                priority: rec.priority,
              }))}
              cardClassName="border-l-4 rounded-r-lg p-4 bg-gray-50"
            />
          </CollapsibleSection>
        )}

        {activeTab === 'history' && (
          <CollapsibleSection
            title="Gift History"
            defaultOpen={false}
            storageKey="gifting-gift-history"
          >
            {summary.gifts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a4 4 0 00-4-4H5.45a4 4 0 00-3.95 3.45L1 9h22l-.5-3.55A4 4 0 0018.55 2H16a4 4 0 00-4 4v2zm-7 4h14" />
                </svg>
                <p className="text-sm">No gifts logged yet. Click <strong>Log a Gift</strong> to get started.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden -m-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Year</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipient</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">709 Filed</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {giftsGroupedByYear.map(([year, yearGifts]) => {
                      const isMfj = summary.filing_status === 'mfj';
                      const showSplitBadge = splitElectedYears.has(year);
                      const showSplitPrompt =
                        isMfj &&
                        yearsWithAnnualGifts.has(year) &&
                        !splitElectedYears.has(year);

                      return (
                        <Fragment key={year}>
                          <tr className="bg-gray-100 border-b border-gray-200">
                            <td colSpan={6} className="px-4 py-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-gray-900">{year}</span>
                                <div className="flex flex-wrap items-center gap-2">
                                  {showSplitBadge && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                      Gift Split Elected
                                      <span aria-hidden>✓</span>
                                    </span>
                                  )}
                                  {showSplitPrompt && (
                                    <span className="text-xs text-gray-500">
                                      Split available — file Form 709
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {yearGifts.map((gift, i) => (
                            <tr
                              key={gift.id}
                              className={`border-b border-gray-100 ${i % 2 !== 0 ? 'bg-gray-50' : ''}`}
                            >
                              <td className="px-4 py-3 text-gray-400 pl-6" />
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{gift.recipient_name}</p>
                                {gift.recipient_relationship && (
                                  <p className="text-xs text-gray-400">{gift.recipient_relationship}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {GIFT_TYPE_LABELS[gift.gift_type] ?? gift.gift_type}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                {fmt$(gift.amount)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {gift.form_709_filed ? (
                                  <span className="text-green-600 font-bold">✓</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDelete(gift.id)}
                                  disabled={deleteId === gift.id}
                                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                                >
                                  {deleteId === gift.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>
        )}
      </div>

      {giftDeleteModal && activeGiftingPlan && (
        <GiftDeleteWarningModal
          giftAmount={giftDeleteModal.giftAmount}
          planAmount={activeGiftingPlan.amount}
          onChoice={(choice) => void handleGiftDeleteChoice(choice)}
        />
      )}
    </Fragment>
  );
}
