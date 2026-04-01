'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';

interface BusinessSuccessionDashboardProps {
  householdId: string;
  userRole: 'consumer' | 'advisor';
}

interface BusinessDetail {
  id: string;
  entity_name: string;
  entity_type: string;
  fmv: number;
  discount_pct: number;
  discounted_value: number;
  ownership_pct: number;
  estate_inclusion: number;
  succession_plan_type: string | null;
  buy_sell_agreement_type: string | null;
  buy_sell_funded: boolean;
  key_person_insured: boolean;
  readiness_score: number;
  gaps: { gap: string; label: string; severity: 'high' | 'medium' }[];
}

interface Recommendation {
  type: string;
  priority: 'high' | 'medium';
  label: string;
  detail: string;
}

interface BusinessSuccessionSummary {
  household_id: string;
  business_count: number;
  total_business_fmv: number;
  total_discounted_value: number;
  total_estate_inclusion: number;
  total_key_person_coverage: number;
  readiness_score: number;
  recommendations: Recommendation[];
  businesses: BusinessDetail[];
}

const fmt$ = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const ENTITY_LABELS: Record<string, string> = {
  llc:         'LLC',
  s_corp:      'S-Corporation',
  c_corp:      'C-Corporation',
  partnership: 'Partnership',
  sole_prop:   'Sole Proprietorship',
  lp:          'Limited Partnership',
  flp:         'Family Limited Partnership',
};

const SUCCESSION_LABELS: Record<string, string> = {
  family_transfer:  'Family Transfer',
  esop:             'ESOP',
  third_party_sale: 'Third-Party Sale',
  liquidation:      'Liquidation',
  undecided:        'Undecided',
};

const BUY_SELL_LABELS: Record<string, string> = {
  none:              'None',
  cross_purchase:    'Cross-Purchase',
  entity_redemption: 'Entity Redemption',
  wait_and_see:      'Wait-and-See',
};

const priorityColors: Record<string, string> = {
  high:   'border-l-red-500 bg-red-50',
  medium: 'border-l-yellow-500 bg-yellow-50',
};

const priorityBadge: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
};

const severityDot: Record<string, string> = {
  high:   'bg-red-400',
  medium: 'bg-yellow-400',
};

const readinessColor = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

const readinessLabel = (score: number) => {
  if (score >= 80) return 'Strong';
  if (score >= 50) return 'Moderate';
  if (score > 0)   return 'Needs Attention';
  return 'Not Started';
};

const emptyForm = {
  entity_name:                 '',
  entity_type:                 'llc',
  ownership_pct:               '',
  total_entity_value:          '',
  fmv_estimated:               '',
  valuation_method:            'capitalized_earnings',
  succession_plan_type:        'undecided',
  successor_name:              '',
  transfer_timeline_years:     '',
  buy_sell_agreement_type:     'none',
  buy_sell_funded:             false,
  key_person_insured:          false,
  key_person_insurance_amount: '',
  co_owner_names:              '',
};

export default function BusinessSuccessionDashboard({
  householdId,
  userRole,
}: BusinessSuccessionDashboardProps) {

  const [summary, setSummary]         = useState<BusinessSuccessionSummary | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm]               = useState(emptyForm);
  const [saving, setSaving]           = useState(false);
  const [activeTab, setActiveTab]     = useState<'overview' | 'businesses' | 'recommendations'>('overview');
  const [hydrated, setHydrated]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);
  useEffect(() => { setHydrated(true); }, []);

  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('generate_business_succession_summary', {
        p_household_id: householdId,
      });
      if (rpcError) throw rpcError;
      setSummary(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load business succession summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [householdId]);

  const handleEdit = async (biz: BusinessDetail) => {
    // Fetch full row from DB to get all fields not in summary
    const { data } = await supabase
      .from('business_interests')
      .select('*')
      .eq('id', biz.id)
      .single();

    if (!data) return;

    setForm({
      entity_name:                 data.entity_name                 ?? '',
      entity_type:                 data.entity_type                 ?? 'llc',
      ownership_pct:               data.ownership_pct?.toString()   ?? '',
      total_entity_value:          data.total_entity_value?.toString() ?? '',
      fmv_estimated:               data.fmv_estimated?.toString()   ?? '',
      valuation_method:            data.valuation_method            ?? 'capitalized_earnings',
      succession_plan_type:        data.succession_plan_type        ?? 'undecided',
      successor_name:              data.successor_name              ?? '',
      transfer_timeline_years:     data.transfer_timeline_years?.toString() ?? '',
      buy_sell_agreement_type:     data.buy_sell_agreement_type     ?? 'none',
      buy_sell_funded:             data.buy_sell_funded             ?? false,
      key_person_insured:          data.key_person_insured          ?? false,
      key_person_insurance_amount: data.key_person_insurance_amount?.toString() ?? '',
      co_owner_names:              data.co_owner_names              ?? '',
    });
    setEditingId(biz.id);
    setShowAddForm(true);
  };

  const handleDelete = async (bizId: string, bizName: string) => {
    if (!confirm(`Delete "${bizName}"? This cannot be undone.`)) return;
    setDeleting(bizId);
    try {
      const { error } = await supabase
        .from('business_interests')
        .delete()
        .eq('id', bizId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleAdd = async () => {
    if (!form.entity_name || !form.fmv_estimated) return;
    setSaving(true);
    try {
      const payload = {
        entity_name:                 form.entity_name,
        entity_type:                 form.entity_type,
        ownership_pct:               form.ownership_pct               ? parseFloat(form.ownership_pct as string)               : null,
        total_entity_value:          form.total_entity_value          ? parseFloat(form.total_entity_value as string)          : null,
        fmv_estimated:               form.fmv_estimated               ? parseFloat(form.fmv_estimated as string)               : null,
        fmv_to_use:                  'estimated',
        valuation_method:            form.valuation_method,
        succession_plan_type:        form.succession_plan_type,
        successor_name:              form.successor_name              || null,
        transfer_timeline_years:     form.transfer_timeline_years     ? parseInt(form.transfer_timeline_years as string)        : null,
        buy_sell_agreement_type:     form.buy_sell_agreement_type,
        buy_sell_funded:             form.buy_sell_funded,
        key_person_insured:          form.key_person_insured,
        key_person_insurance_amount: form.key_person_insurance_amount ? parseFloat(form.key_person_insurance_amount as string) : null,
        co_owner_names:              form.co_owner_names              || null,
        updated_at:                  new Date().toISOString(),
      };

      if (editingId) {
        // UPDATE existing business
        const { error: updateError } = await supabase
          .from('business_interests')
          .update(payload)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        // INSERT new business
        const { data: { user } } = await supabase.auth.getUser();
        const { error: insertError } = await supabase
          .from('business_interests')
          .insert({ ...payload, household_id: householdId, owner_id: user!.id });
        if (insertError) throw insertError;
      }

      setForm(emptyForm);
      setEditingId(null);
      setShowAddForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="ml-3 text-gray-500">Loading business succession summary...</span>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
  );

  if (!summary) return null;

  const hasBuySell = (type: string | null) => type && type !== 'none';

  return (
    <Fragment>

      {showAddForm && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false); }}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>{editingId ? 'Edit Business Interest' : 'Add Business Interest'}</h2>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ color: '#9ca3af', cursor: 'pointer', background: 'none', border: 'none', fontSize: '20px' }}>x</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Business Name *</label>
                  <input type="text" value={form.entity_name} onChange={e => setForm(f => ({ ...f, entity_name: e.target.value }))} placeholder="e.g. Acme LLC" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Entity Type</label>
                  <select value={form.entity_type} onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}>
                    {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Ownership %</label>
                  <input type="number" value={form.ownership_pct} onChange={e => setForm(f => ({ ...f, ownership_pct: e.target.value }))} placeholder="e.g. 40" min="0" max="100" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Total Entity Value</label>
                  <input type="number" value={form.total_entity_value} onChange={e => setForm(f => ({ ...f, total_entity_value: e.target.value }))} placeholder="Full entity FMV" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Estimated FMV *</label>
                  <input type="number" value={form.fmv_estimated} onChange={e => setForm(f => ({ ...f, fmv_estimated: e.target.value }))} placeholder="Your ownership share FMV" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Valuation Method</label>
                  <select value={form.valuation_method} onChange={e => setForm(f => ({ ...f, valuation_method: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}>
                    <option value="book_value">Book Value</option>
                    <option value="capitalized_earnings">Capitalized Earnings</option>
                    <option value="market_comp">Market Comp</option>
                    <option value="formal_appraisal">Formal Appraisal</option>
                    <option value="not_valued">Not Valued</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Succession Plan</label>
                  <select value={form.succession_plan_type} onChange={e => setForm(f => ({ ...f, succession_plan_type: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}>
                    <option value="undecided">Undecided</option>
                    <option value="family_transfer">Family Transfer</option>
                    <option value="esop">ESOP</option>
                    <option value="third_party_sale">Third-Party Sale</option>
                    <option value="liquidation">Liquidation</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Transfer Timeline (years)</label>
                  <input type="number" value={form.transfer_timeline_years} onChange={e => setForm(f => ({ ...f, transfer_timeline_years: e.target.value }))} placeholder="e.g. 5" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                </div>
              </div>

              {form.succession_plan_type !== 'undecided' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Successor Name</label>
                  <input type="text" value={form.successor_name} onChange={e => setForm(f => ({ ...f, successor_name: e.target.value }))} placeholder="e.g. Jane Smith" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Buy-Sell Agreement</label>
                  <select value={form.buy_sell_agreement_type} onChange={e => setForm(f => ({ ...f, buy_sell_agreement_type: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}>
                    <option value="none">None</option>
                    <option value="cross_purchase">Cross-Purchase</option>
                    <option value="entity_redemption">Entity Redemption</option>
                    <option value="wait_and_see">Wait-and-See</option>
                  </select>
                </div>
                {form.buy_sell_agreement_type !== 'none' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                    <input type="checkbox" id="buy_sell_funded" checked={form.buy_sell_funded} onChange={e => setForm(f => ({ ...f, buy_sell_funded: e.target.checked }))} style={{ width: '16px', height: '16px' }} />
                    <label htmlFor="buy_sell_funded" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>Agreement is funded</label>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                  <input type="checkbox" id="key_person_insured" checked={form.key_person_insured} onChange={e => setForm(f => ({ ...f, key_person_insured: e.target.checked }))} style={{ width: '16px', height: '16px' }} />
                  <label htmlFor="key_person_insured" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>Key person insured</label>
                </div>
                {form.key_person_insured && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Coverage Amount</label>
                    <input type="number" value={form.key_person_insurance_amount} onChange={e => setForm(f => ({ ...f, key_person_insurance_amount: e.target.value }))} placeholder="e.g. 2000000" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Co-Owner Names</label>
                <input type="text" value={form.co_owner_names} onChange={e => setForm(f => ({ ...f, co_owner_names: e.target.value }))} placeholder="e.g. Jane Smith, Bob Jones" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
              </div>

              {form.ownership_pct && parseFloat(form.ownership_pct as string) < 50 && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: '#92400e' }}>
                  Ownership below 50% — minority interest and DLOM discounts may apply. Your advisor can add discount entries after saving.
                </div>
              )}

            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #e5e7eb' }}>
              <button type="button" onClick={() => { setShowAddForm(false); setEditingId(null); setForm(emptyForm); }} style={{ padding: '8px 16px', fontSize: '14px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleAdd} disabled={saving || !form.entity_name || !form.fmv_estimated} style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 500, backgroundColor: saving || !form.entity_name || !form.fmv_estimated ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: saving || !form.entity_name || !form.fmv_estimated ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editingId ? 'Update Business' : 'Save Business'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Succession</h1>
            <p className="text-sm text-gray-500 mt-1">
              {summary.business_count === 0
                ? 'No business interests on file'
                : `${summary.business_count} business interest${summary.business_count !== 1 ? 's' : ''}`}
            </p>
          </div>
          {userRole === 'advisor' && (
            <button type="button" onClick={() => setShowAddForm(true)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Business
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Business FMV</p>
            <p className="text-2xl font-bold text-gray-900">{fmt$(summary.total_business_fmv)}</p>
            <p className="text-xs text-gray-400 mt-1">Estimated fair market value</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Est. Estate Inclusion</p>
            <p className="text-2xl font-bold text-gray-900">{fmt$(summary.total_estate_inclusion)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {summary.total_business_fmv > 0
                ? `After discounts — ${fmtPct((1 - summary.total_estate_inclusion / summary.total_business_fmv) * 100)} reduced`
                : 'After applicable discounts'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Succession Readiness</p>
            <p className={`text-2xl font-bold ${readinessColor(summary.readiness_score)}`}>
              {summary.readiness_score}/100
            </p>
            <p className="text-xs text-gray-400 mt-1">{readinessLabel(summary.readiness_score)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Key Person Coverage</p>
            <p className="text-2xl font-bold text-gray-900">{fmt$(summary.total_key_person_coverage)}</p>
            <p className="text-xs text-gray-400 mt-1">Life insurance in force</p>
          </div>
        </div>

        {summary.business_count === 0 && (
          <div className="text-center py-16 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-sm">No business interests on file.{userRole === 'advisor' ? ' Click Add Business to get started.' : ' Your advisor can add business interests to build your succession plan.'}</p>
          </div>
        )}

        {hydrated && summary.business_count > 0 && (
          <>
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex gap-6">
                {(['overview', 'businesses', 'recommendations'] as const).map(tab => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab === 'overview' ? 'Overview' : tab === 'businesses' ? 'Businesses' : 'Recommendations'}
                  </button>
                ))}
              </nav>
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Overall Succession Readiness</p>
                    <span className={`text-sm font-bold ${readinessColor(summary.readiness_score)}`}>
                      {summary.readiness_score}/100 — {readinessLabel(summary.readiness_score)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${summary.readiness_score >= 80 ? 'bg-green-500' : summary.readiness_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${summary.readiness_score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Scored across valuation, succession plan, buy-sell agreement, funding, key person insurance, and review recency.</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-700">Estate Inclusion Summary</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {[
                      { label: 'Total Business FMV',     value: fmt$(summary.total_business_fmv),        sub: 'Gross estimated value across all interests' },
                      { label: 'Total Discounted Value', value: fmt$(summary.total_discounted_value),    sub: 'After minority interest and DLOM discounts' },
                      { label: 'Est. Estate Inclusion',  value: fmt$(summary.total_estate_inclusion),    sub: 'Ownership share of discounted value', bold: true },
                      { label: 'Key Person Coverage',    value: fmt$(summary.total_key_person_coverage), sub: 'Life insurance protecting business continuity' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-6 py-3">
                        <div>
                          <p className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{row.label}</p>
                          <p className="text-xs text-gray-400">{row.sub}</p>
                        </div>
                        <p className={`text-sm ${row.bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {summary.recommendations.filter(r => r.priority === 'high').length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-800 mb-2">High Priority Gaps</p>
                    <ul className="space-y-1">
                      {summary.recommendations.filter(r => r.priority === 'high').map((r, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'businesses' && (
              <div className="space-y-4">
                {summary.businesses.map((biz) => (
                  <div key={biz.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{biz.entity_name}</p>
                        <p className="text-xs text-gray-500">{ENTITY_LABELS[biz.entity_type] ?? biz.entity_type} · {biz.ownership_pct}% ownership</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm font-bold ${readinessColor(biz.readiness_score)}`}>{biz.readiness_score}/100</p>
                          <p className="text-xs text-gray-400">{readinessLabel(biz.readiness_score)}</p>
                        </div>
                        {userRole === 'advisor' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(biz)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(biz.id, biz.entity_name)}
                              disabled={deleting === biz.id}
                              className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                            >
                              {deleting === biz.id ? '...' : '🗑️ Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {[
                        { label: 'Estimated FMV',      value: fmt$(biz.fmv) },
                        { label: 'Discount Applied',   value: biz.discount_pct > 0 ? fmtPct(biz.discount_pct) : '—' },
                        { label: 'Discounted Value',   value: fmt$(biz.discounted_value) },
                        { label: 'Estate Inclusion',   value: fmt$(biz.estate_inclusion), bold: true },
                        { label: 'Succession Plan',    value: SUCCESSION_LABELS[biz.succession_plan_type ?? ''] ?? 'Not set' },
                        { label: 'Buy-Sell Agreement', value: BUY_SELL_LABELS[biz.buy_sell_agreement_type ?? ''] ?? '—' },
                        { label: 'Agreement Funded',   value: hasBuySell(biz.buy_sell_agreement_type) ? (biz.buy_sell_funded ? 'Yes' : 'No') : '—' },
                        { label: 'Key Person Insured', value: biz.key_person_insured ? 'Yes' : 'No' },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between px-6 py-2.5">
                          <p className="text-sm text-gray-600">{row.label}</p>
                          <p className={`text-sm ${row.bold ? 'font-bold text-gray-900' : 'text-gray-800'}`}>{row.value}</p>
                        </div>
                      ))}
                    </div>
                    {biz.gaps.length > 0 && (
                      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gaps</p>
                        <div className="space-y-1">
                          {biz.gaps.map((gap, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${severityDot[gap.severity]}`} />
                              <span className="text-sm text-gray-700">{gap.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div className="space-y-3">
                {summary.recommendations.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No recommendations at this time.</p>
                ) : (
                  summary.recommendations.map((rec, i) => (
                    <div key={i} className={`border-l-4 rounded-r-lg p-4 ${priorityColors[rec.priority] ?? 'border-l-gray-300 bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityBadge[rec.priority]}`}>
                          {rec.priority.toUpperCase()}
                        </span>
                        <p className="text-sm font-semibold text-gray-900">{rec.label}</p>
                      </div>
                      <p className="text-sm text-gray-600">{rec.detail}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Fragment>
  );
}
