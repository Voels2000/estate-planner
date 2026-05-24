#!/usr/bin/env bash
# Sprint C-2b: UX Language Audit — grep pass
# Run from project root: bash scripts/audit-ux-language.sh

set -euo pipefail

RESULTS="audit-results.txt"
SUMMARY="audit-summary.txt"
COUNTS_TMP="audit-phrase-counts.tmp"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")

SCAN_DIRS=(
  "app/(dashboard)"
  "app/(public)"
  "components"
  "lib/estate"
  "lib/planning"
  "lib/events"
  "lib/dashboard"
  "lib/my-estate-strategy"
  "lib/trusts"
  "app/api/export-estate-plan"
)

EXTS="--include=*.ts --include=*.tsx --include=*.js --include=*.jsx --include=*.mdx"

PHRASE_LIST="
plan health|CRITICAL — implies platform grades the plan
plan grade|CRITICAL — implies platform grades the plan
plan score|CRITICAL — implies platform grades the plan
your plan is|HIGH — 'plan' vs 'household data'
we recommend|CRITICAL — platform must not recommend
you should|HIGH — directive language
you need to|HIGH — directive language
action required|MEDIUM — urgency framing
optimize your|HIGH — implies platform knows optimal state
improve your plan|HIGH — directive + 'plan' language
earns a|MEDIUM — grading language
based on your profile, we suggest|CRITICAL — personalized recommendation
for your situation|HIGH — personalizes generic strategy education
for your estate|HIGH — personalizes generic strategy education
could save you|HIGH — dollar-saving claim without counsel
best state|CRITICAL — domicile recommendation
best year to|HIGH — timing recommendation
you must|HIGH — directive language
\\bact now\\b|HIGH — urgency directive
optimal|HIGH — implies platform knows best outcome
your plan earns|CRITICAL — grading language
we suggest|CRITICAL — platform must not suggest
target allocation|CRITICAL — check if platform-generated vs user-entered
success rate|HIGH — Monte Carlo: use 'scenarios reached goal' not 'success rate'
chance of success|CRITICAL — advice framing for MC output
needs improvement|HIGH — judgment on plan quality
"

should_skip_line() {
  local line="$1"
  case "$line" in
    *lib/compliance/language-policy.ts*) return 0 ;;
    *lib/estate/planningTopicPresentation.ts*) return 0 ;;
    *components/advisor/*) return 0 ;;
    *success_rate*) return 0 ;;
    *successThreshold*) return 0 ;;
    *optimalConversionWindow*) return 0 ;;
    *".replace("*) return 0 ;;
  esac
  return 1
}

echo "# UX Language Audit — Sprint C-2b" > "$RESULTS"
echo "# Run: $TIMESTAMP" >> "$RESULTS"
echo "# Project root: $(pwd)" >> "$RESULTS"
echo "" >> "$RESULTS"
rm -f "$COUNTS_TMP"

TOTAL_HITS=0

while IFS='|' read -r phrase severity; do
  [ -z "$phrase" ] && continue
  phrase_count=0

  for dir in "${SCAN_DIRS[@]}"; do
    [ ! -d "$dir" ] && continue

    raw=$(grep -rn --ignore-case $EXTS -E "$phrase" "$dir" 2>/dev/null || true)
    if [ -z "$raw" ]; then continue; fi

    filtered=""
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      if should_skip_line "$line"; then continue; fi
      filtered+="$line"$'\n'
    done <<< "$raw"

    [ -z "$filtered" ] && continue
    count=$(echo "$filtered" | sed '/^$/d' | wc -l | tr -d ' ')
    phrase_count=$((phrase_count + count))

    echo "" >> "$RESULTS"
    echo "═══════════════════════════════════════════" >> "$RESULTS"
    echo "PHRASE: \"$phrase\"" >> "$RESULTS"
    echo "SEVERITY: $severity" >> "$RESULTS"
    echo "HITS: $count (in $dir)" >> "$RESULTS"
    echo "───────────────────────────────────────────" >> "$RESULTS"
    echo "$filtered" >> "$RESULTS"
  done

  if [ "$phrase_count" -gt 0 ]; then
    echo "$phrase|$severity|$phrase_count" >> "$COUNTS_TMP"
    TOTAL_HITS=$((TOTAL_HITS + phrase_count))
  fi
done <<EOF
$PHRASE_LIST
EOF

echo "# UX Language Audit — Summary" > "$SUMMARY"
echo "# $TIMESTAMP" >> "$SUMMARY"
echo "# Total flagged instances: $TOTAL_HITS" >> "$SUMMARY"
echo "" >> "$SUMMARY"
echo "| Phrase | Hits | Severity |" >> "$SUMMARY"
echo "|--------|------|----------|" >> "$SUMMARY"

if [ -f "$COUNTS_TMP" ]; then
  while IFS='|' read -r phrase severity count; do
    echo "| \"$phrase\" | $count | $severity |" >> "$SUMMARY"
  done < "$COUNTS_TMP"
  rm -f "$COUNTS_TMP"
fi

echo "" >> "$SUMMARY"
echo "Full findings: audit-results.txt" >> "$SUMMARY"

echo ""
echo "✅ Audit complete."
echo "   Total flagged instances: $TOTAL_HITS"

if [ "$TOTAL_HITS" -gt 0 ]; then
  echo "⚠️  $TOTAL_HITS instance(s) require review."
  exit 1
fi

echo "✅ No flagged phrases found. Language audit passed."
exit 0
