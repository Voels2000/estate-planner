// lib/estate-flow/snapshotFlow.ts
// Sprint 60 — Estate flow snapshot storage and share link generation
// Immutable snapshots stored in estate_flow_snapshots.
// Share links stored in estate_flow_share_links with 90-day expiry.

import { createClient } from '@/lib/supabase/client'
import type { EstateFlowGraph } from './generateEstateFlow'

// ─── Save snapshot ────────────────────────────────────────────────────────────

export async function saveEstateFlowSnapshot(
  graph: EstateFlowGraph,
): Promise<{ id: string } | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('estate_flow_snapshots')
    .insert({
      household_id: graph.household_id,
      scenario_id: graph.scenario_id,
      death_view: graph.death_view,
      flow_data: graph,
      generated_at: graph.generated_at,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[snapshotFlow] save error:', error)
    return null
  }
  return { id: data.id }
}

// ─── Load latest snapshot ─────────────────────────────────────────────────────

export async function loadLatestSnapshot(
  householdId: string,
  deathView: 'first_death' | 'second_death' = 'first_death',
): Promise<EstateFlowGraph | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('estate_flow_snapshots')
    .select('flow_data, generated_at')
    .eq('household_id', householdId)
    .eq('death_view', deathView)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data.flow_data as EstateFlowGraph
}

// ─── Load snapshot history ────────────────────────────────────────────────────

export interface SnapshotHistoryEntry {
  id: string
  generated_at: string
  death_view: string
  scenario_id: string | null
  gross_estate: number
  net_to_heirs: number
}

export async function loadSnapshotHistory(
  householdId: string,
): Promise<SnapshotHistoryEntry[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('estate_flow_snapshots')
    .select('id, generated_at, death_view, scenario_id, flow_data')
    .eq('household_id', householdId)
    .order('generated_at', { ascending: false })
    .limit(20)

  if (error || !data) return []

  return data.map(row => ({
    id: row.id,
    generated_at: row.generated_at,
    death_view: row.death_view,
    scenario_id: row.scenario_id,
    gross_estate: (row.flow_data as EstateFlowGraph)?.summary?.gross_estate ?? 0,
    net_to_heirs: (row.flow_data as EstateFlowGraph)?.summary?.net_to_heirs ?? 0,
  }))
}

// ─── Generate share link ──────────────────────────────────────────────────────

export async function generateShareLink(
  householdId: string,
  snapshotId: string,
  advisorId: string,
): Promise<{ token: string; url: string } | null> {
  const supabase = createClient()

  // 90-day expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 90)

  // Generate a random token
  const token = generateToken()

  const { error } = await supabase
    .from('estate_flow_share_links')
    .insert({
      token,
      household_id: householdId,
      snapshot_id: snapshotId,
      created_by: advisorId,
      expires_at: expiresAt.toISOString(),
      is_revoked: false,
    })

  if (error) {
    console.error('[snapshotFlow] share link error:', error)
    return null
  }

  const url = `${getBaseUrl()}/share/estate-flow/${token}`
  return { token, url }
}

// ─── Revoke share link ────────────────────────────────────────────────────────

export async function revokeShareLink(token: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('estate_flow_share_links')
    .update({ is_revoked: true })
    .eq('token', token)
  return !error
}

// ─── Load share link data (for public share page) ────────────────────────────

export interface ShareLinkData {
  flow_data: EstateFlowGraph
  household_name: string
  expires_at: string
  is_revoked: boolean
}

export async function loadShareLinkData(
  token: string,
): Promise<ShareLinkData | { expired: true } | { revoked: true } | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('estate_flow_share_links')
    .select('*, estate_flow_snapshots(flow_data), households(name)')
    .eq('token', token)
    .single()

  if (error || !data) return null

  if (data.is_revoked) return { revoked: true }
  if (new Date(data.expires_at) < new Date()) return { expired: true }

  return {
    flow_data: (data.estate_flow_snapshots as { flow_data: EstateFlowGraph }).flow_data,
    household_name: (data.households as { name: string }).name ?? 'Estate Plan',
    expires_at: data.expires_at,
    is_revoked: data.is_revoked,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mywealthmaps.com'
}
