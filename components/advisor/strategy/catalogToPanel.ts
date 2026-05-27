// catalog id = strategy_source (DB key)
// chip = activePanel string inside the panel component
export const CATALOG_TO_PANEL: Record<
  string,
  {
    panel: 'slat' | 'ilit' | 'advanced'
    chip: string
  }
> = {
  slat: { panel: 'slat', chip: 'slat' },
  ilit: { panel: 'ilit', chip: 'ilit' },
  grat: { panel: 'advanced', chip: 'grat' },
  annual_gifting: { panel: 'advanced', chip: 'annual_gifting' },
  cst: { panel: 'advanced', chip: 'credit_shelter_trust' },
  daf: { panel: 'advanced', chip: 'daf' },
  crt: { panel: 'advanced', chip: 'crt' },
  clat: { panel: 'advanced', chip: 'clat' },
  liquidity: { panel: 'advanced', chip: 'liquidity' },
  roth: { panel: 'advanced', chip: 'roth' },
  revocable_trust: { panel: 'advanced', chip: 'revocable_trust' },
}
