'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CharitableGivingDashboardProps {
  householdId: string;
  userRole: 'consumer' | 'advisor';
  consumerTier?: number;
}

interface DonationRow {
  id: string;
  tax_year: number;
  vehicle_type: string;
  donor_person: string;
  organization_name: string;
  amount: number;
  fmv_at_donation: number | null;
  cost_basis: number | null;
  capital_gain_avoided: number | null;
  deductible_amount: number | null;
  is_qcd: boolean;
  form_8283_required: boolean;
  notes: string | null;
  created_at: string;
}

interface CharitableSummary {
  household_id: string;
  tax_year: number;
  summary: {
    total_donated: number;
    total_deductible: number;
    total_qcd: number;
    capital_gains_avoided: number;
    donation_count: number;
  };
  by_vehicle: {
    cash: number;
    appreciated_asset: number;
    daf: number;
    daf_asset: number;
    crt: number;
    qcd: number;
  };
  deduction_detail: {
    itemizing: boolean;
    agi_combined: number;
    cash_agi_limit_60pct: number;
    asset_agi_limit_30pct: number;
    cash_group_donated: number;
    asset_group_donated: number;
    cash_deductible: number;
    asset_deductible: number;
    total_deductible: number;
    carryforward_available: number;
  };
  qcd_summary: {
    person1_eligible: boolean;
    person1_age: number;
    person1_used: number;
    person1_limit: number;
    person1_remaining: number;
    person2_eligible: boolean;
    person2_age: number | null;
    person2_used: number;
    person2_limit: number;
    person2_remaining: number;
    total_qcd_this_year: number;
    note: string;
  };
  donation_history: DonationRow[];
  recommendations: { type: string; priority: number; title: string; detail: string }[];
}

const fmt$ = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const VEHICLE_LABELS: Record<string, string> = {
  cash:             'Cash Donation',
  appreciated_asset:'Appreciated Asset',
  daf:              'Donor-Advised Fund',
  daf_asset:        'Appreciated Asset to DAF',
  qcd:              'Qualified Charitable Distribution',
  crt:              'Charitable Remainder Trust',
};

const priorityColors: Record<number, string> = {
  1: 'border-l-red-500 bg-red-50',
  2: 'border-l-yellow-500 bg-yellow-50',
  3: 'border-l-green-500 bg-green-50',
};

const priorityBadge: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-green-100 text-green-700',
};

const priorityLabel: Record<number, string> = {
  1: 'HIGH',
  2: 'MODERATE',
  3: 'LOW',
};

export default function CharitableGivingDashboard({
  householdId,
  userRole,
  consumerTier,
}: CharitableGivingDashboardProps) {
  const CURRENT_YEAR = new Date().getFullYear();

  const emptyForm = {
    tax_year: CURRENT_YEAR,
    vehicle_type: 'cash',
    donor_person: 'person1',
    organization_name: '',
    amount: '',
    fmv_at_donation: '',
    cost_basis: '',
    deductible_amount: '',
    is_qcd: false,
    ira_account_label: '',
    notes: '',
  };

  const [summary, setSummary] = useState<CharitableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'deductions' | 'history'>('recommendations');
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('calculate_charitable_summary', {
        p_household_id: householdId,
      });
      if (rpcError) throw rpcError;
      setSummary(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load charitable giving summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [householdId]);

  const isAppreciatedVehicle = ['appreciated_asset', 'daf_asset', 'crt'].includes(form.vehicle_type);
  const isQcdVehicle = form.vehicle_type === 'qcd';

  const handleAdd = async () => {
    if (!form.organization_name || !form.amount) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('charitable_donations').insert({
        household_id: householdId,
        owner_id: user!.id,
        tax_year: form.tax_year,
        vehicle_type: form.vehicle_type,
        donor_person: form.donor_person,
        organization_name: form.organization_name,
        amount: parseFloat(form.amount as string),
        fmv_at_donation: form.fmv_at_donation ? parseFloat(form.fmv_at_donation as string) : null,
        cost_basis: form.cost_basis ? parseFloat(form.cost_basis as string) : null,
        deductible_amount: form.deductible_amount ? parseFloat(form.deductible_amount as string) : null,
        is_qcd: isQcdVehicle,
        ira_account_label: form.ira_account_label || null,
        notes: form.notes || null,
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
      const { error: delError } = await supabase.from('charitable_donations').delete().eq('id', id);
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
      <span className="ml-3 text-gray-500">Loading charitable giving summary...</span>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
  );

  if (!summary) return null;

  const { summary: s, deduction_detail: dd, qcd_summary: qcd } = summary;

  return (
    <Fragment>
      {showAddForm && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false); }}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>Log a Donation</h2>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ color: '#9ca3af', cursor: 'pointer', background: 'none', border: 'none', fontSize: '20px' }}>x</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Tax Year</label>
                  <input type="number" value={form.tax_year} onChange={e => setForm(f => ({ ...f, tax_year: parseInt(e.target.value) }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Donor</label>
                  <select value={form.donor_person} onChange={e => setForm(f => ({ ...f, donor_person: e.target.value }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}>
                    <option value="person1">Person 1</option>
                    <option value="person2">Person 2</option>
                    <option value="joint">Joint</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Giving Vehicle</label>
                <select value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value, is_qcd: e.target.value === 'qcd' }))} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}>
                  <option value="cash">Cash Donation</option>
                  <option value="appreciated_asset">Appreciated Asset</option>
                  <option value="daf">Donor-Advised Fund (Cash)</option>
                  <option value="daf_asset">Donor-Advised Fund (Appreciated Asset)</option>
                  <option value="qcd">Qualified Charitable Distribution (QCD)</option>
                  {userRole === 'advisor' && <option value="crt">Charitable Remainder Trust (CRT)</option>}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Organization Name *</label>
                <input type="text" value={form.organization_name} onChange={e => setForm(f => ({ ...f, organization_name: e.target.value }))} placeholder="e.g. American Red Cross" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Amount *</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
              </div>
              {isAppreciatedVehicle && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>FMV at Donation</label>
                    <input type="number" value={form.fmv_at_donation} onChange={e => setForm(f => ({ ...f, fmv_at_donation: e.target.value }))} placeholder="Fair market value" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Cost Basis</label>
                    <input type="number" value={form.cost_basis} onChange={e => setForm(f => ({ ...f, cost_basis: e.target.value }))} placeholder="Original cost" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                  </div>
                </div>
              )}
              {isQcdVehicle && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>IRA Account Label</label>
                  <input type="text" value={form.ira_account_label} onChange={e => setForm(f => ({ ...f, ira_account_label: e.target.value }))} placeholder="e.g. Fidelity IRA ending 4321" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
              </div>
              {isAppreciatedVehicle && form.fmv_at_donation && parseFloat(form.fmv_at_donation as string) >= 500 && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: '#92400e' }}>
                  Form 8283 required -- non-cash donations with FMV of $500 or more must be reported to the IRS.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #e5e7eb' }}>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: '8px 16px', fontSize: '14px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleAdd} disabled={saving || !form.organization_name || !form.amount} style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 500, backgroundColor: saving || !form.organization_name || !form.amount ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: saving || !form.organization_name || !form.amount ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Donation'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Charitable Giving</h1>
            <p className="text-sm text-gray-500 mt-1">{summary.tax_year} tax year</p>
          </div>
          <button type="button" onClick={() => setShowAddForm(true)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Log a Donation
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Donated</p>
            <p className="text-2xl font-bold text-gray-900">{fmt$(s.total_donated)}</p>
            <p className="text-xs text-gray-400 mt-1">{s.donation_count} donation{s.donation_count !== 1 ? 's' : ''} this year</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tax Deductible</p>
            <p className="text-2xl font-bold text-gray-900">{fmt$(s.total_deductible)}</p>
            <p className="text-xs text-gray-400 mt-1">{dd.itemizing ? 'Itemizing this year' : 'Not itemizing -- no deduction'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">QCD This Year</p>
            <p className="text-2xl font-bold text-gray-900">{fmt$(s.total_qcd)}</p>
            <p className="text-xs text-gray-400 mt-1">Excluded from gross income</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Capital Gains Avoided</p>
            <p className="text-2xl font-bold text-gray-900">{fmt$(s.capital_gains_avoided)}</p>
            <p className="text-xs text-gray-400 mt-1">Via appreciated asset donations</p>
          </div>
        </div>

        {(qcd.person1_eligible || qcd.person2_eligible) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-800 mb-2">QCD Eligibility</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {qcd.person1_eligible && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-700 font-medium">Person 1 (age {Math.floor(qcd.person1_age)})</span>
                    <span className="text-xs text-blue-700">{fmt$(qcd.person1_used)} of {fmt$(qcd.person1_limit)} used</span>
                  </div>
                  <div className="w-full bg-blue-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, qcd.person1_limit > 0 ? (qcd.person1_used / qcd.person1_limit) * 100 : 0)}%` }} />
                  </div>
                  <p className="text-xs text-blue-600 mt-1">{fmt$(qcd.person1_remaining)} remaining</p>
                </div>
              )}
              {qcd.person2_eligible && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-700 font-medium">Person 2 (age {Math.floor(qcd.person2_age ?? 0)})</span>
                    <span className="text-xs text-blue-700">{fmt$(qcd.person2_used)} of {fmt$(qcd.person2_limit)} used</span>
                  </div>
                  <div className="w-full bg-blue-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, qcd.person2_limit > 0 ? (qcd.person2_used / qcd.person2_limit) * 100 : 0)}%` }} />
                  </div>
                  <p className="text-xs text-blue-600 mt-1">{fmt$(qcd.person2_remaining)} remaining</p>
                </div>
              )}
            </div>
          </div>
        )}

        {hydrated && (
          <>
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex gap-6">
                {(['recommendations', 'deductions', 'history'] as const).map(tab => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab === 'recommendations' ? 'Recommendations' : tab === 'deductions' ? 'Deduction Detail' : 'Donation History'}
                  </button>
                ))}
              </nav>
            </div>

            {activeTab === 'recommendations' && (
              <div className="space-y-3">
                {summary.recommendations.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No recommendations at this time.</p>
                ) : (
                  summary.recommendations.map((rec, i) => (
                    <div key={i} className={`border-l-4 rounded-r-lg p-4 ${priorityColors[rec.priority] ?? 'border-l-gray-300 bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityBadge[rec.priority]}`}>{priorityLabel[rec.priority]}</span>
                        <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                      </div>
                      <p className="text-sm text-gray-600">{rec.detail}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'deductions' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-700">{dd.itemizing ? `Itemizing -- AGI ${fmt$(dd.agi_combined)}` : `Taking standard deduction -- AGI ${dd.agi_combined > 0 ? fmt$(dd.agi_combined) : 'not entered'}`}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    { label: 'Cash / DAF donations',              value: fmt$(dd.cash_group_donated),     sub: `60% AGI limit: ${fmt$(dd.cash_agi_limit_60pct)}` },
                    { label: 'Appreciated asset / CRT donations', value: fmt$(dd.asset_group_donated),    sub: `30% AGI limit: ${fmt$(dd.asset_agi_limit_30pct)}` },
                    { label: 'Cash deductible this year',         value: fmt$(dd.cash_deductible),        sub: dd.itemizing ? 'After AGI limit applied' : 'Not itemizing' },
                    { label: 'Asset deductible this year',        value: fmt$(dd.asset_deductible),       sub: dd.itemizing ? 'After AGI limit applied' : 'Not itemizing' },
                    { label: 'Total deductible',                  value: fmt$(dd.total_deductible),       sub: 'Available to claim on Schedule A', bold: true },
                    { label: 'Carryforward available',            value: fmt$(dd.carryforward_available), sub: 'Can be claimed over next 5 years' },
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
            )}

            {activeTab === 'history' && (
              <div>
                {summary.donation_history.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <p className="text-sm">No donations logged yet. Click <strong>Log a Donation</strong> to get started.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Year</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organization</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gain Avoided</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">8283</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.donation_history.map((don, i) => (
                          <tr key={don.id} className={`border-b border-gray-100 ${i % 2 !== 0 ? 'bg-gray-50' : ''}`}>
                            <td className="px-4 py-3 text-gray-700">{don.tax_year}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{don.organization_name}</p>
                              {don.is_qcd && <p className="text-xs text-blue-500">QCD -- income exclusion</p>}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{VEHICLE_LABELS[don.vehicle_type] ?? don.vehicle_type}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt$(don.amount)}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-medium">{don.capital_gain_avoided ? fmt$(don.capital_gain_avoided) : <span className="text-gray-300">--</span>}</td>
                            <td className="px-4 py-3 text-center">{don.form_8283_required ? <span className="text-amber-500 font-bold text-xs">REQ</span> : <span className="text-gray-300">--</span>}</td>
                            <td className="px-4 py-3 text-right">
                              <button type="button" onClick={() => handleDelete(don.id)} disabled={deleteId === don.id} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
                                {deleteId === don.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Fragment>
  );
}
