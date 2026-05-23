-- Sprint 12: collapse pre-launch A/B tests (no live traffic — strategy prior, not data).
-- Keep app_config for other keys (terms, etc.); remove ab_upgrade_copy and ab_assessment_gate.

delete from public.app_config
where key in ('ab_upgrade_copy', 'ab_assessment_gate');
