// app/share/estate-flow/[token]/SharePageClient.tsx
// Sprint 60 — Client component for public estate flow share page.
// Shows estate structure only. No financial account values, no tax details.

'use client'

import React from 'react'
import type { EstateFlowGraph, FlowNode } from '@/lib/estate-flow/generateEstateFlow'

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  person:       { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800' },
  trust:        { bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-800' },
  beneficiary:  { bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-800' },
  probate:      { bg: 'bg-gray-50',    border: 'border-gray-300',   text: 'text-gray-700' },
  real_estate:  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  digital_asset:{ bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-800' },
  asset:        { bg: 'bg-blue-50',    border: 'border-blue-100',   text: 'text-blue-700' },
  business:     { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800' },
  insurance:    { bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-700' },
  tax_deduction:{ bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800' },
}

function NodePill({ node }: { node: FlowNode }) {
  const c = NODE_COLORS[node.type] ?? NODE_COLORS.asset
  // On share page: never show dollar values — estate structure only
  return (
    <div className={`inline-flex items-center px-4 py-2.5 rounded-xl border ${c.bg} ${c.border} shadow-sm`}>
      <span className={`text-sm font-medium ${c.text}`}>{node.label}</span>
    </div>
  )
}

interface Props {
  flowData: unknown
  householdName: string
  expiresAt: string
  token: string
}

export default function SharePageClient({ flowData, householdName, expiresAt }: Props) {
  const graph = flowData as EstateFlowGraph

  const ownerNodes = graph.nodes.filter(n => n.category === 'owner')
  const vehicleNodes = graph.nodes.filter(n => n.category === 'vehicle')
  const recipientNodes = graph.nodes.filter(n => n.category === 'recipient')

  // Documents — names only, not content
  const docNames: string[] = []
  if (graph.summary.has_trust) docNames.push('Revocable Living Trust')
  if (graph.summary.has_business) docNames.push('Business Succession Documents')
  if (graph.summary.has_digital_assets) docNames.push('Digital Asset Inventory')

  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">
              Estate Planning Summary
            </div>
            <div className="text-base font-semibold text-gray-900">{householdName}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Link expires</div>
            <div className="text-xs font-medium text-gray-600">{expiryDate}</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Intro */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
          <p className="text-sm text-blue-800 leading-relaxed">
            You've been given access to view this estate planning summary. This view shows the
            estate structure — how assets are planned to transfer at death — but does not show
            specific financial values or tax details.
          </p>
        </div>

        {/* Estate flow visual */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-900">Estate transfer plan</h2>

          {/* Owner */}
          {ownerNodes.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Estate owner</div>
              <div className="flex flex-wrap gap-2">
                {ownerNodes.map(n => <NodePill key={n.id} node={n} />)}
              </div>
            </div>
          )}

          {/* Arrow */}
          <div className="flex items-center gap-2 text-gray-300 pl-2">
            <div className="w-px h-5 bg-gray-200" />
            <span className="text-xs text-gray-400">assets transfer through</span>
          </div>

          {/* Vehicles */}
          {vehicleNodes.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Transfer vehicles</div>
              <div className="flex flex-wrap gap-2">
                {vehicleNodes.map(n => <NodePill key={n.id} node={n} />)}
              </div>
            </div>
          )}

          {/* Arrow */}
          <div className="flex items-center gap-2 text-gray-300 pl-2">
            <div className="w-px h-5 bg-gray-200" />
            <span className="text-xs text-gray-400">to your heirs</span>
          </div>

          {/* Recipients */}
          {recipientNodes.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Beneficiaries</div>
              <div className="flex flex-wrap gap-2">
                {recipientNodes.map(n => <NodePill key={n.id} node={n} />)}
              </div>
            </div>
          )}
        </div>

        {/* Estate documents — names only */}
        {docNames.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Estate documents on file</h2>
            <div className="space-y-2">
              {docNames.map(doc => (
                <div key={doc} className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {doc}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Document names only — content is private.
            </p>
          </div>
        )}

        {/* What to do when you inherit — 5 step guide */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">What to do when you inherit</h2>
          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Locate the will and trust documents',
                body: 'The executor or trustee named in the estate documents will lead this process. Find out who that person is early.',
              },
              {
                step: '2',
                title: 'Notify financial institutions and government agencies',
                body: 'Banks, investment firms, Social Security, and the IRS may all need to be notified. The executor handles most of this.',
              },
              {
                step: '3',
                title: 'Understand the estate administration timeline',
                body: 'Trust distributions can often happen within weeks. Probate can take 6–18 months depending on the state.',
              },
              {
                step: '4',
                title: 'Be aware of tax considerations',
                body: 'Inherited assets often receive a "step-up" in cost basis, which can reduce capital gains taxes when you sell. A tax advisor can help you understand what applies.',
              },
              {
                step: '5',
                title: 'Consider your own estate plan',
                body: 'After inheriting, update your own estate plan to reflect your new financial situation.',
              },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800">{item.title}</div>
                  <div className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="px-4 py-3 bg-gray-100 rounded-xl text-xs text-gray-500 leading-relaxed">
          This estate planning summary is provided for informational purposes only and does not constitute legal, tax, or financial advice. The estate structure shown reflects planning information as of the date this link was generated. Please consult with a qualified estate planning attorney and financial advisor before making any decisions based on this information.
        </div>
      </div>
    </div>
  )
}
