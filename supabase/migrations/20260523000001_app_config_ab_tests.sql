-- Sprint 5: A/B test flags in app_config (toggle in Supabase dashboard, no deploy)

insert into public.app_config (key, value, description)
values
  (
    'ab_upgrade_copy',
    '"personalized"',
    'A/B test: upgrade banner copy variant. Values: "personalized" | "generic"'
  ),
  (
    'ab_assessment_gate',
    '"score_visible"',
    'A/B test: assessment results gate. Values: "score_visible" | "full_gate"'
  )
on conflict (key) do nothing;
