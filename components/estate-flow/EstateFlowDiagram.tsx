// components/estate-flow/EstateFlowDiagram.tsx
// Sprint 60 — Advisor interactive estate flow diagram
// SVG-based, color-coded by node type, with toggle controls.
// Printable and exportable as PDF.

'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { EstateFlowGraph, FlowNode, FlowEdge, DeathView } from '@/lib/estate-flow/generateEstateFlow'
import { generateEstateFlow } from '@/lib/estate-flow/generateEstateFlow'
import { saveEstateFlowSnapshot, generateShareLink, loadSnapshotHistory } from '@/lib/estate-flow/snapshotFlow'
import { createClient } from '@/lib/supabase/client'

// ─── Color palette ────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  person:         { fill: '#EFF6FF', stroke: '#2563EB', text: '#1E40AF' },
  asset:          { fill: '#EFF6FF', stroke: '#3B82F6', text: '#1E3A8A' },
  real_estate:    { fill: '#ECFDF5', stroke: '#059669', text: '#065F46' },
  digital_asset:  { fill: '#F5F3FF', stroke: '#7C3AED', text: '#4C1D95' },
  business:       { fill: '#FFF7ED', stroke: '#EA580C', text: '#7C2D12' },
  insurance:      { fill: '#ECFDF5', stroke: '#10B981', text: '#064E3B' },
  trust:          { fill: '#F0FDFA', stroke: '#0D9488', text: '#134E4A' },
  probate:        { fill: '#F9FAFB', stroke: '#9CA3AF', text: '#374151' },
  beneficiary:    { fill: '#F0FDF4', stroke: '#16A34A', text: '#14532D' },
  tax_deduction:  { fill: '#FFFBEB', stroke: '#D97706', text: '#78350F' },
  digital_executor: { fill: '#FAF5FF', stroke: '#9333EA', text: '#581C87' },
}

const EDGE_COLORS: Record<string, string> = {
  owns:          '#93C5FD',
  transfers_to:  '#6EE7B7',
  distributes_to:'#86EFAC',
  probate_to:    '#D1D5DB',
  tax_deducted:  '#FCD34D',
  bypasses:      '#67E8F9',
}

// ─── Layout engine ────────────────────────────────────────────────────────────

interface PositionedNode extends FlowNode {
  x: number
  y: number
  width: number
  height: number
}

function layoutNodes(
  nodes: FlowNode[],
  edges: FlowEdge[],
): { positioned: PositionedNode[]; svgWidth: number } {
  const NODE_W = 160
  const NODE_H = 60
  const H_GAP = 24
  const V_GAP = 80

  // Group nodes into layers by category
  const layers: Record<string, FlowNode[]> = {
    owner: [],
    asset: [],
    vehicle: [],
    tax: [],
    recipient: [],
  }

  for (const node of nodes) {
    layers[node.category]?.push(node)
  }

  const layerOrder = ['owner', 'asset', 'vehicle', 'tax', 'recipient']
  const MAX_PER_ROW = 6 // wrap after this many nodes in a layer

  let maxRowW = 0
  for (const layerKey of layerOrder) {
    const layer = layers[layerKey]
    if (!layer || layer.length === 0) continue
    for (let i = 0; i < layer.length; i += MAX_PER_ROW) {
      const row = layer.slice(i, i + MAX_PER_ROW)
      const rowW = row.length * NODE_W + (row.length - 1) * H_GAP
      maxRowW = Math.max(maxRowW, rowW)
    }
  }
  const SVG_W = Math.max(900, maxRowW + H_GAP * 2)

  const positioned: PositionedNode[] = []
  const SVG_W_USED = SVG_W

  let y = 60
  for (const layerKey of layerOrder) {
    const layer = layers[layerKey]
    if (!layer || layer.length === 0) continue

    const rows: FlowNode[][] = []
    for (let i = 0; i < layer.length; i += MAX_PER_ROW) {
      rows.push(layer.slice(i, i + MAX_PER_ROW))
    }

    for (const row of rows) {
      const totalW = row.length * NODE_W + (row.length - 1) * H_GAP
      let x = (SVG_W_USED - totalW) / 2

      for (const node of row) {
        positioned.push({ ...node, x, y, width: NODE_W, height: NODE_H })
        x += NODE_W + H_GAP
      }
      y += NODE_H + V_GAP
    }
  }

  return { positioned, svgWidth: SVG_W }
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function NodeBox({ node, isAdvisor }: { node: PositionedNode; isAdvisor: boolean }) {
  const colors = NODE_COLORS[node.type] ?? NODE_COLORS.asset
  const label = isAdvisor ? node.technicalLabel : node.label
  const lines = wrapText(label, 22)

  return (
    <g key={node.id}>
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={8}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={1.5}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={node.x + node.width / 2}
          y={node.y + (node.height / 2) - ((lines.length - 1) * 8) + i * 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fill={colors.text}
          fontWeight={node.category === 'owner' ? '600' : '400'}
        >
          {line}
        </text>
      ))}
    </g>
  )
}

function EdgeLine({
  edge,
  nodeMap,
  showLabels,
}: {
  edge: FlowEdge
  nodeMap: Map<string, PositionedNode>
  showLabels: boolean
}) {
  const source = nodeMap.get(edge.source)
  const target = nodeMap.get(edge.target)
  if (!source || !target) return null

  const x1 = source.x + source.width / 2
  const y1 = source.y + source.height
  const x2 = target.x + target.width / 2
  const y2 = target.y

  const color = EDGE_COLORS[edge.type] ?? '#CBD5E1'
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  return (
    <g>
      <defs>
        <marker
          id={`arrow_${edge.id}`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      </defs>
      <path
        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
        stroke={color}
        strokeWidth={edge.type === 'tax_deducted' ? 2 : 1.5}
        strokeDasharray={edge.type === 'tax_deducted' ? '4 3' : undefined}
        fill="none"
        markerEnd={`url(#arrow_${edge.id})`}
      />
      {showLabels && edge.value > 0 && (
        <text
          x={midX}
          y={midY - 6}
          textAnchor="middle"
          fontSize={9}
          fill="#6B7280"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {edge.label}
        </text>
      )}
    </g>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { type: 'person', label: 'Estate owner' },
    { type: 'asset', label: 'Financial assets' },
    { type: 'real_estate', label: 'Real estate' },
    { type: 'trust', label: 'Trust vehicle' },
    { type: 'probate', label: 'Probate estate' },
    { type: 'beneficiary', label: 'Beneficiaries' },
    { type: 'tax_deduction', label: 'Estate tax' },
  ]

  return (
    <div className="flex flex-wrap gap-3 mb-3 px-1">
      {items.map(item => {
        const c = NODE_COLORS[item.type] ?? NODE_COLORS.asset
        return (
          <div key={item.type} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{ background: c.fill, borderColor: c.stroke }}
            />
            <span className="text-xs text-gray-500">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main diagram component ───────────────────────────────────────────────────

interface Props {
  householdId: string
  scenarioId: string | null
  advisorId?: string
  isAdvisor?: boolean
  deathView?: DeathView
  onShareLinkGenerated?: (url: string) => void
}

export default function EstateFlowDiagram({
  householdId,
  scenarioId,
  advisorId,
  isAdvisor = false,
  deathView,
  onShareLinkGenerated,
}: Props) {
  console.log('isAdvisor prop:', isAdvisor)
  const supabase = useMemo(() => createClient(), [])
  const [graph, setGraph] = useState<EstateFlowGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalDeathView, setInternalDeathView] = useState<DeathView>(deathView ?? 'first_death')
  const [showLabels, setShowLabels] = useState(true)
  const [snapshotId, setSnapshotId] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [annotation, setAnnotation] = useState('')
  const [showAnnotation, setShowAnnotation] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (deathView) setInternalDeathView(deathView)
  }, [deathView])

  useEffect(() => {
    let cancelled = false

    async function fetchGraph() {
      setLoading(true)
      setError(null)
      console.log('fetchGraph called with deathView:', internalDeathView)
      try {
        const g = await generateEstateFlow(householdId, scenarioId, internalDeathView, supabase)
        if (!cancelled) {
          setGraph(g)
          const snap = await saveEstateFlowSnapshot(g)
          if (snap && !cancelled) setSnapshotId(snap.id)
        }
      } catch (e) {
        if (!cancelled) setError('Could not load estate flow data.')
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchGraph()

    return () => {
      cancelled = true
    }
  }, [householdId, scenarioId, internalDeathView, supabase])

  const handleGenerateShareLink = async () => {
    if (!snapshotId || !advisorId) return
    setShareLoading(true)
    const result = await generateShareLink(householdId, snapshotId, advisorId)
    if (result) {
      setShareUrl(result.url)
      onShareLinkGenerated?.(result.url)
    }
    setShareLoading(false)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Building estate flow diagram…</p>
        </div>
      </div>
    )
  }

  if (error || !graph) {
    return (
      <div className="flex items-center justify-center h-40 text-red-500 text-sm">
        {error ?? 'No estate data available.'}
      </div>
    )
  }

  const { positioned, svgWidth: SVG_W } = layoutNodes(graph.nodes, graph.edges)
  const nodeMap = new Map(positioned.map(n => [n.id, n]))

  // SVG viewport
  const maxY = Math.max(...positioned.map(n => n.y + n.height)) + 80
  const SVG_H = Math.max(maxY, 400)

  return (
    <div className="space-y-4">
      {/* Controls */}
      {isAdvisor && (
        <div className="flex flex-wrap items-center gap-3" style={{ position: 'relative', zIndex: 10 }}>
          {/* Labels toggle */}
          <button
            onClick={() => setShowLabels(l => !l)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            {showLabels ? 'Hide amounts' : 'Show amounts'}
          </button>

          {/* Annotation */}
          <button
            onClick={() => setShowAnnotation(a => !a)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            {showAnnotation ? 'Hide note' : 'Add note'}
          </button>

          <div className="flex-1" />

          {/* Share link */}
          <button
            onClick={handleGenerateShareLink}
            disabled={shareLoading || !snapshotId}
            className="px-3 py-1.5 text-sm border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            {shareLoading ? 'Generating…' : 'Share link'}
          </button>

          {/* Print/PDF */}
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Print / PDF
          </button>
        </div>
      )}

      {/* Share URL display */}
      {shareUrl && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-700 font-medium">Share link (90 days):</span>
          <input
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent text-blue-600 text-xs outline-none select-all"
            onClick={e => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            Copy
          </button>
        </div>
      )}

      {/* Annotation */}
      {showAnnotation && isAdvisor && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <label className="text-xs font-medium text-amber-700 block mb-1">Diagram note</label>
          <textarea
            value={annotation}
            onChange={e => setAnnotation(e.target.value)}
            placeholder="Add a note that will appear on the printed diagram…"
            className="w-full bg-transparent text-sm text-amber-900 outline-none resize-none"
            rows={2}
          />
        </div>
      )}

      {/* Legend */}
      <Legend />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Gross estate', value: fmt(graph.summary.gross_estate) },
          {
            label: 'Total estate tax',
            value: fmt(graph.summary.estate_tax_federal + graph.summary.estate_tax_state),
            accent: true,
          },
          { label: 'Net to heirs', value: fmt(graph.summary.net_to_heirs), green: true },
        ].map(item => (
          <div
            key={item.label}
            className={`px-4 py-3 rounded-lg border ${
              item.accent
                ? 'border-amber-200 bg-amber-50'
                : item.green
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="text-xs text-gray-500 mb-0.5">{item.label}</div>
            <div
              className={`text-base font-semibold ${
                item.accent ? 'text-amber-700' : item.green ? 'text-green-700' : 'text-gray-800'
              }`}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* SVG Diagram */}
      <div
        className="border border-gray-200 rounded-xl bg-white shadow-sm print:shadow-none w-full overflow-x-auto"
        style={{ position: 'relative', zIndex: 1, WebkitOverflowScrolling: 'touch' }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          height="100%"
          style={{
            minWidth: Math.min(SVG_W, 600),
            minHeight: SVG_H,
            maxWidth: '100%',
          }}
          preserveAspectRatio="xMidYMid meet"
          className="block"
          role="img"
          aria-label="Estate flow diagram"
        >
          {/* Edges (drawn first, behind nodes) */}
          {graph.edges.map(edge => (
            <EdgeLine key={edge.id} edge={edge} nodeMap={nodeMap} showLabels={showLabels} />
          ))}

          {/* Nodes */}
          {positioned.map(node => (
            <NodeBox key={node.id} node={node} isAdvisor={isAdvisor} />
          ))}

          {/* Annotation watermark */}
          {annotation && (
            <text
              x={SVG_W / 2}
              y={SVG_H - 20}
              textAnchor="middle"
              fontSize={11}
              fill="#9CA3AF"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontStyle="italic"
            >
              {annotation}
            </text>
          )}
        </svg>
      </div>

      {/* Death view label */}
      <p className="text-center text-xs text-gray-400">
        {internalDeathView === 'first_death' ? 'First death view' : 'Second death view'} ·{' '}
        Generated {new Date(graph.generated_at).toLocaleDateString()}
      </p>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!n || n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}
