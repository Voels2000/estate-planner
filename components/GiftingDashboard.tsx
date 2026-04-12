'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CollapsibleSection } from '@/components/CollapsibleSection';

interface GiftingDashboardProps {
  householdId: string;
  userRole: 'consumer' | 'advisor';
  consumerTier?: number;
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

interface GiftingSummary {
  success: boolean;
  tax_year: number;
  filing_status: string;
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
  annual_by_recipient: any[];
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

const priorityColors: Record<string, string> = {
  high: 'border-l-red-500 bg-red-50',
  moderate: 'border-l-yellow-500 bg-yellow-50',
  low: 'border-l-green-500 bg-green-50',
};

const priorityBadge: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

export default function GiftingDashboard({ householdId, userRole, consumerTier }: GiftingDashboardProps) {
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
  const [summary, setSummary] = useState<GiftingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview'); // default: overview
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('calculate_gifting_summary', {
        p_household_id: householdId,
      });
      if (rpcError) throw rpcError;
      setSummary(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load gifting summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [householdId]);

  const handleAdd = async () => {
    if (!form.recipient_name || !form.amount) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('gift_history').insert({
        household_id: householdId,
        owner_id: user!.id,
        tax_year: form.tax_year,
        donor_person: form.donor_person,
        recipient_name: form.recipient_name,
        recipient_relationship: form.recipient_relationship,
        amount: parseFloat(form.amount as string),
        gift_type: form.gift_type,
        form_709_filed: form.form_709_filed,
        notes: form.notes,
      });
      if (insertError) throw insertError;
      setForm(emptyForm);
      setShowAddForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    try {
      const { error: delError } = await supabase.from('gift_history').delete().eq('id', id);
      if (delError) throw delError;
      await load();
    } catch (e: any) {
      setError(e.message);
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

  const lifetimePct = Math.min(100, summary.lifetime_used_pct ?? 0);
  const annualPct = Math.min(100, summary.annual_used_pct ?? 0);

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
                    <option value="person1">Person 1</option>
                    <option value="person2">Person 2</option>
                    <option value="joint">Joint</option>
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
                disabled={saving || !form.recipient_name || !form.amount}
                style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 500, backgroundColor: saving || !form.recipient_name || !form.amount ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: saving || !form.recipient_name || !form.amount ? 'not-allowed' : 'pointer' }}
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
          {summary.tcja_in_effect && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">TCJA Sunset — December 31, 2026</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  The current {fmt$(summary.exemption_per_person)} per-person exemption is scheduled to drop to ~$7M on Jan 1, 2027.
                  Gifts made before year-end 2026 lock in the higher exemption permanently.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lifetime Exemption Used</p>
              <div className="flex items-end justify-between mb-3">
                <span className="text-2xl font-bold text-gray-900">{fmt$(summary.lifetime_exemption_used)}</span>
                <span className="text-sm text-gray-500">of {fmt$(summary.total_exemption)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${lifetimePct}%` }} />
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-green-600">{fmt$(summary.lifetime_exemption_remaining)}</span> remaining
                {summary.filing_status === 'mfj' ? ' (combined MFJ)' : ''}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Annual Exclusion Used ({summary.tax_year})</p>
              <div className="flex items-end justify-between mb-3">
                <span className="text-2xl font-bold text-gray-900">{fmt$(summary.annual_used)}</span>
                <span className="text-sm text-gray-500">of {fmt$(summary.annual_capacity)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${annualPct}%` }} />
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-green-600">{fmt$(summary.annual_remaining)}</span> remaining this year
                {summary.filing_status === 'mfj' ? ' (gift splitting)' : ''}
              </p>
            </div>
          </div>
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
            title="Considerations"
            defaultOpen={false}
            storageKey="gifting-considerations"
          >
            <div className="space-y-3">
              {summary.recommendations.map((rec, i) => (
                <div key={i} className={`border-l-4 rounded-r-lg p-4 ${priorityColors[rec.priority] ?? 'border-l-gray-300 bg-gray-50'}`}>
                  <div className="flex items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityBadge[rec.priority]}`}>
                          {rec.priority.toUpperCase()}
                        </span>
                        <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                      </div>
                      <p className="text-sm text-gray-600">{rec.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
              {summary.recommendations.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No recommendations at this time.</p>
              )}
            </div>
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
                    {summary.gifts.map((gift, i) => (
                      <tr key={gift.id} className={`border-b border-gray-100 ${i % 2 !== 0 ? 'bg-gray-50' : ''}`}>
                        <td className="px-4 py-3 text-gray-700">{gift.tax_year}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{gift.recipient_name}</p>
                          {gift.recipient_relationship && (
                            <p className="text-xs text-gray-400">{gift.recipient_relationship}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{GIFT_TYPE_LABELS[gift.gift_type] ?? gift.gift_type}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt$(gift.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          {gift.form_709_filed
                            ? <span className="text-green-600 font-bold">✓</span>
                            : <span className="text-gray-300">—</span>
                          }
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
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>
        )}
      </div>
    </Fragment>
  );
}
