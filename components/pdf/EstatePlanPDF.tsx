// components/PDF/EstatePlanPDF.tsx
'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

// --- Color Palette ---
const NAVY       = '#1B2A4A'
const GOLD       = '#C9A84C'
const GRAY_DARK  = '#333333'
const GRAY_MID   = '#666666'
const GRAY_LIGHT = '#F4F5F7'
const WHITE      = '#FFFFFF'
const GREEN      = '#2E7D4F'
const RED        = '#C0392B'
const BORDER     = '#DDE1E7'

// --- Styles ---
const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: GRAY_DARK,
    backgroundColor: WHITE,
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 22,
  },
  headerAccent: {
    backgroundColor: GOLD,
    height: 3,
    marginBottom: 20,
  },
  headerAppName: {
    fontSize: 11,
    color: GOLD,
    letterSpacing: 2,
    marginBottom: 6,
  },
  headerClientName: {
    fontSize: 20,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#A8B8D0',
    marginBottom: 2,
  },
  headerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2E4270',
  },
  headerMetaLabel: {
    fontSize: 7,
    color: '#7A9ABF',
    marginBottom: 2,
  },
  headerMetaValue: {
    fontSize: 9,
    color: WHITE,
  },
  body: {
    paddingHorizontal: 36,
    paddingTop: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    backgroundColor: GOLD,
    marginRight: 8,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GRAY_LIGHT,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
  },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  scoreBadgeGrade: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
  },
  scoreDetails: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 8,
    color: GRAY_MID,
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 2,
  },
  scoreSubtext: {
    fontSize: 8,
    color: GRAY_MID,
  },
  ctaBanner: {
    backgroundColor: '#FFF8EC',
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    padding: 10,
    borderRadius: 3,
    marginBottom: 10,
  },
  ctaBannerText: {
    fontSize: 8,
    color: '#7A5C00',
  },
  progressBarOuter: {
    height: 6,
    backgroundColor: BORDER,
    borderRadius: 3,
    marginTop: 6,
    marginBottom: 2,
  },
  progressBarInner: {
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    fontSize: 7,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: GRAY_LIGHT,
  },
  tableCell: {
    fontSize: 8,
    color: GRAY_DARK,
  },
  colPriority: { width: '15%' },
  colItem:     { width: '30%' },
  colReason:   { width: '55%' },
  badgeHigh: {
    backgroundColor: '#FDECEA',
    color: RED,
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: 'Helvetica-Bold',
  },
  badgeMod: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: 'Helvetica-Bold',
  },
  badgeLow: {
    backgroundColor: '#E8F5E9',
    color: GREEN,
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: 'Helvetica-Bold',
  },
  taxGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  taxCard: {
    flex: 1,
    backgroundColor: GRAY_LIGHT,
    borderRadius: 6,
    padding: 12,
    borderTopWidth: 3,
    borderTopColor: NAVY,
  },
  taxCardLabel: {
    fontSize: 7,
    color: GRAY_MID,
    marginBottom: 4,
  },
  taxCardValue: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginBottom: 2,
  },
  taxCardSub: {
    fontSize: 7,
    color: GRAY_MID,
  },
  taxExposureCard: {
    borderTopColor: RED,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    marginTop: 1,
  },
  checkDotComplete: { backgroundColor: GREEN },
  checkDotMissing:  { backgroundColor: RED },
  checkLabel: {
    fontSize: 8,
    color: GRAY_DARK,
    flex: 1,
  },
  checkReason: {
    fontSize: 7,
    color: GRAY_MID,
    marginTop: 2,
    flex: 1,
  },
  priorityScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GRAY_LIGHT,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  priorityScoreLabel: {
    fontSize: 8,
    color: GRAY_MID,
    flex: 1,
  },
  priorityScoreValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: RED,
  },
  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  docChip: {
    backgroundColor: GRAY_LIGHT,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderLeftWidth: 3,
  },
  docChipLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 1,
  },
  docChipStatus: {
    fontSize: 7,
    color: GRAY_MID,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: GRAY_MID,
  },
  consumerCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  consumerCheckDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  consumerCheckLabel: {
    fontSize: 9,
    flex: 1,
  },
  consumerCheckStatus: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  consumerCTABox: {
    backgroundColor: NAVY,
    borderRadius: 6,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  consumerCTATitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    marginBottom: 6,
  },
  consumerCTAText: {
    fontSize: 8,
    color: '#A8B8D0',
    textAlign: 'center',
    lineHeight: 1.5,
  },
})

// --- Helpers ---
const fmt$ = (n: number) =>
  n === 0 ? '$0' : '$' + n.toLocaleString('en-US')

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

const capitalize = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : ''

const clientName = (h: any) => {
  const p1 = [h.person1_first_name, h.person1_last_name].filter(Boolean).join(' ')
  const p2 = h.has_spouse
    ? [h.person2_first_name, h.person2_last_name].filter(Boolean).join(' ')
    : null
  return p2 ? `${p1} & ${p2}` : p1
}

// --- Shared Header ---
const PDFHeader = ({ data }: { data: any }) => (
  <View>
    <View style={s.headerAccent} />
    <View style={s.header}>
      <Text style={s.headerAppName}>ESTATE PLANNER</Text>
      <Text style={s.headerClientName}>{clientName(data.household)}</Text>
      <Text style={s.headerSubtitle}>
        {data.household.state_primary}  |  {data.household.filing_status === 'mfj' ? 'Married Filing Jointly' : data.household.filing_status?.toUpperCase()}  |  Complexity: {capitalize(data.household.estate_complexity_flag ?? '')}
      </Text>
      <View style={s.headerMeta}>
        <View>
          <Text style={s.headerMetaLabel}>PREPARED BY</Text>
          <Text style={s.headerMetaValue}>{data.advisor_name ?? 'Your Advisor'}</Text>
        </View>
        <View>
          <Text style={s.headerMetaLabel}>REPORT TYPE</Text>
          <Text style={s.headerMetaValue}>{data.role === 'advisor' ? 'Advisor Full Report' : 'Estate Plan Summary'}</Text>
        </View>
        <View>
          <Text style={s.headerMetaLabel}>GENERATED</Text>
          <Text style={s.headerMetaValue}>{fmtDate(data.generated_at)}</Text>
        </View>
      </View>
    </View>
  </View>
)

// --- Shared Footer ---
const PDFFooter = ({ data }: { data: any }) => (
  <View style={s.footer} fixed>
    <Text style={s.footerText}>Estate Planner  |  Confidential  |  {clientName(data.household)}</Text>
    <Text style={s.footerText} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
)

// --- Section Wrapper ---
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={s.section}>
    <View style={s.sectionHeader}>
      <View style={s.sectionAccent} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    <View style={s.divider} />
    {children}
  </View>
)

// --- Completeness Score Section ---
const CompletenessSection = ({ data }: { data: any }) => {
  const c = data.completeness
  if (!c) return null
  const pct = c.completeness_pct ?? c.completeness_score ?? 0
  return (
    <Section title="Estate Plan Completeness">
      <View style={s.scoreRow}>
        <View style={s.scoreBadge}>
          <Text style={s.scoreBadgeGrade}>{c.grade}</Text>
        </View>
        <View style={s.scoreDetails}>
          <Text style={s.scoreLabel}>Overall Score</Text>
          <Text style={s.scoreValue}>{pct}%</Text>
          <View style={s.progressBarOuter}>
            <View style={[s.progressBarInner, { width: `${pct}%` }]} />
          </View>
          <Text style={s.scoreSubtext}>Will/Trust  |  DPOA  |  Healthcare Directive  |  Beneficiaries  |  Tax Strategy</Text>
        </View>
      </View>
      {c.attorney_cta_triggered && (
        <View style={s.ctaBanner}>
          <Text style={s.ctaBannerText}>This estate plan has significant gaps. An estate planning attorney consultation is recommended.</Text>
        </View>
      )}
    </Section>
  )
}

// --- Recommendations Section ---
const RecommendationsSection = ({ data }: { data: any }) => {
  const recs = data.recommendations?.recommendations_json?.recommendations
  if (!recs || recs.length === 0) return null
  return (
    <Section title="Estate Planning Recommendations">
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.colPriority]}>Priority</Text>
          <Text style={[s.tableHeaderCell, s.colItem]}>Recommendation</Text>
          <Text style={[s.tableHeaderCell, s.colReason]}>Reason</Text>
        </View>
        {recs.map((r: any, i: number) => (
          <View key={i} style={[s.tableRow, i % 2 !== 0 ? s.tableRowAlt : {}]} wrap={false}>
            <View style={s.colPriority}>
              <Text style={r.priority === 'high' ? s.badgeHigh : r.priority === 'moderate' ? s.badgeMod : s.badgeLow}>
                {r.priority?.toUpperCase()}
              </Text>
            </View>
            <Text style={[s.tableCell, s.colItem]}>{capitalize(r.branch)}</Text>
            <Text style={[s.tableCell, s.colReason]}>{r.reason}</Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

// --- Tax Exposure Section (Advisor only) ---
const TaxSection = ({ data }: { data: any }) => {
  const fed = data.federal_estate_tax
  const state = data.state_estate_tax
  if (!fed || !state) return null
  return (
    <Section title="Tax Exposure">
      <View style={s.taxGrid}>
        <View style={s.taxCard}>
          <Text style={s.taxCardLabel}>Gross Estate</Text>
          <Text style={s.taxCardValue}>{fmt$(fed.gross_estate ?? 0)}</Text>
          <Text style={s.taxCardSub}>{fed.filing_status === 'mfj' ? 'Married Filing Jointly' : ''}</Text>
        </View>
        <View style={s.taxCard}>
          <Text style={s.taxCardLabel}>Federal Estate Tax</Text>
          <Text style={s.taxCardValue}>{fmt$(fed.estimated_tax ?? 0)}</Text>
          <Text style={s.taxCardSub}>Exemption: {fmt$(fed.available_exemption ?? 0)}{fed.tcja_in_effect ? ' (TCJA)' : ''}</Text>
        </View>
        <View style={[s.taxCard, (state.estimated_state_tax ?? 0) > 0 ? s.taxExposureCard : {}]}>
          <Text style={s.taxCardLabel}>{state.domicile_state} State Estate Tax</Text>
          <Text style={[s.taxCardValue, (state.estimated_state_tax ?? 0) > 0 ? { color: RED } : {}]}>
            {fmt$(state.estimated_state_tax ?? 0)}
          </Text>
          <Text style={s.taxCardSub}>
            State Exemption: {fmt$(state.state_exemption ?? 0)}{state.effective_rate_pct ? `  |  Effective Rate: ${state.effective_rate_pct}%` : ''}
          </Text>
        </View>
      </View>
    </Section>
  )
}

// --- Incapacity Section ---
const IncapacitySection = ({ data }: { data: any }) => {
  const inc = data.incapacity
  if (!inc) return null
  return (
    <Section title="Incapacity Planning">
      <View style={s.priorityScoreRow}>
        <Text style={s.priorityScoreLabel}>
          Incapacity Risk Score — {inc.incapacity_gaps?.length ?? 0} gap{inc.incapacity_gaps?.length !== 1 ? 's' : ''} identified
        </Text>
        <Text style={s.priorityScoreValue}>{inc.priority_score ?? 0} / 100</Text>
      </View>
      <View style={[s.table, { marginBottom: 0 }]}>
        {inc.checklist?.map((item: any, i: number) => (
          <View key={i} style={s.checklistItem} wrap={false}>
            <View style={[s.checkDot, item.complete ? s.checkDotComplete : s.checkDotMissing]} />
            <View style={{ flex: 1 }}>
              <Text style={s.checkLabel}>{item.label}</Text>
              {!item.complete && data.role === 'advisor' && (
                <Text style={s.checkReason}>
                  {inc.incapacity_gaps?.find((g: any) => g.doc_type === item.doc_type)?.reason ?? ''}
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 7, color: item.complete ? GREEN : RED, fontFamily: 'Helvetica-Bold' }}>
              {item.complete ? 'ON FILE' : 'MISSING'}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

// --- Documents on File Section ---
const DocumentsSection = ({ data }: { data: any }) => {
  const docs = data.documents
  const trusts = data.trusts
  if ((!docs || docs.length === 0) && (!trusts || trusts.length === 0)) return null
  const allDocs = [
    ...(docs ?? []).map((d: any) => ({ label: capitalize(d.document_type), status: d.status })),
    ...(trusts ?? []).map((t: any) => ({ label: capitalize(t.trust_type), status: 'active' })),
  ]
  return (
    <Section title="Documents & Trusts on File">
      <View style={s.docGrid}>
        {allDocs.map((d, i) => (
          <View key={i} style={[s.docChip, { borderLeftColor: d.status === 'active' || d.status === 'signed' ? GREEN : GOLD }]}>
            <Text style={[s.docChipLabel, { color: NAVY }]}>{d.label}</Text>
            <Text style={s.docChipStatus}>{capitalize(d.status ?? 'on file')}</Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

// --- Consumer T3 Checklist ---
const ConsumerChecklistSection = ({ data }: { data: any }) => {
  const inc = data.incapacity
  const c = data.completeness
  const items = [
    { label: 'Will or Trust', complete: c?.breakdown?.has_will_or_trust ?? false },
    { label: 'Durable Power of Attorney', complete: inc?.has_dpoa ?? false },
    { label: 'Medical Power of Attorney', complete: inc?.has_medical_poa ?? false },
    { label: 'Advance Healthcare Directive', complete: inc?.has_advance_directive ?? false },
    { label: 'Living Will', complete: inc?.has_living_will ?? false },
    { label: 'Beneficiaries Designated', complete: c?.breakdown?.has_beneficiaries ?? false },
    { label: 'Tax Strategy in Place', complete: c?.breakdown?.has_tax_strategy ?? false },
  ]
  return (
    <Section title="Your Estate Planning Checklist">
      <View style={s.table}>
        {items.map((item, i) => (
          <View key={i} style={[s.consumerCheckRow, i % 2 !== 0 ? { backgroundColor: GRAY_LIGHT } : {}]} wrap={false}>
            <View style={[s.consumerCheckDot, { backgroundColor: item.complete ? GREEN : RED }]} />
            <Text style={s.consumerCheckLabel}>{item.label}</Text>
            <Text style={[s.consumerCheckStatus, { color: item.complete ? GREEN : RED }]}>
              {item.complete ? 'Complete' : 'Action Needed'}
            </Text>
          </View>
        ))}
      </View>
      <View style={s.consumerCTABox}>
        <Text style={s.consumerCTATitle}>Ready to Complete Your Estate Plan?</Text>
        <Text style={s.consumerCTAText}>
          An estate planning attorney can help you put the right documents in place.
          Your advisor can connect you with a qualified professional in your area.
        </Text>
      </View>
    </Section>
  )
}

// --- Advisor PDF Export ---
export const AdvisorEstatePlanPDF = ({ data }: { data: any }) => (
  <Document title={`Estate Plan — ${clientName(data.household)}`} author="Estate Planner">
    <Page size="LETTER" style={s.page}>
      <PDFHeader data={data} />
      <View style={s.body}>
        <CompletenessSection data={data} />
        <RecommendationsSection data={data} />
        <TaxSection data={data} />
        <IncapacitySection data={data} />
        <DocumentsSection data={data} />
      </View>
      <PDFFooter data={data} />
    </Page>
  </Document>
)

// --- Consumer T3 PDF Export ---
export const ConsumerEstatePlanPDF = ({ data }: { data: any }) => (
  <Document title={`Estate Plan Summary — ${clientName(data.household)}`} author="Estate Planner">
    <Page size="LETTER" style={s.page}>
      <PDFHeader data={data} />
      <View style={s.body}>
        <CompletenessSection data={data} />
        <ConsumerChecklistSection data={data} />
        <IncapacitySection data={data} />
      </View>
      <PDFFooter data={data} />
    </Page>
  </Document>
)
