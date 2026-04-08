'use client'

interface FlowNode {
  id: string
  label: string
  category?: 'owner' | 'vehicle' | 'recipient'
}

interface FlowData {
  nodes?: FlowNode[]
}

interface Props {
  flowData: unknown
  deathView?: string
  readOnly?: boolean
  highlightRelationship?: string
}

export default function EstateFlowDiagram({
  flowData,
  highlightRelationship,
}: Props) {
  const data = (flowData ?? {}) as FlowData
  const nodes = data.nodes ?? []
  const ownerNodes = nodes.filter((n) => n.category === 'owner')
  const vehicleNodes = nodes.filter((n) => n.category === 'vehicle')
  const recipientNodes = nodes.filter((n) => n.category === 'recipient')

  return (
    <div className="space-y-4">
      {highlightRelationship && (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 inline-block">
          Highlighted relationship: <span className="capitalize">{highlightRelationship}</span>
        </p>
      )}

      {nodes.length === 0 ? (
        <p className="text-sm text-gray-500">No estate flow nodes available for this snapshot.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <FlowSection title="Owners" nodes={ownerNodes} />
          <FlowSection title="Transfer Vehicles" nodes={vehicleNodes} />
          <FlowSection title="Recipients" nodes={recipientNodes} />
        </div>
      )}
    </div>
  )
}

function FlowSection({ title, nodes }: { title: string; nodes: FlowNode[] }) {
  if (nodes.length === 0) return null
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{title}</p>
      <div className="flex flex-wrap gap-2">
        {nodes.map((node) => (
          <span
            key={node.id}
            className="inline-flex rounded-full border bg-white px-3 py-1 text-gray-700"
          >
            {node.label}
          </span>
        ))}
      </div>
    </div>
  )
}
